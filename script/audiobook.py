# -*- coding: utf-8 -*-
"""Procesa un audiolibro japonés (un archivo de audio por capítulo) y crea un .zip por capítulo para la app.

Uso (Anaconda Prompt):
    python audiobook.py "C:\\ruta\\Individual Chapters\\mp3"
    python audiobook.py "C:\\ruta\\mp3" --modelo small          (más rápido, algo menos preciso)
    python audiobook.py "C:\\ruta\\mp3" --solo 2 3               (solo esos capítulos)

Pasos por capítulo:
 1. Transcribe el audio con Whisper (faster-whisper) con marcas de tiempo por palabra.
    La transcripción se guarda en _transcripciones\\ para no repetirla nunca.
 2. Divide el texto en frases (por 。！？ y pausas) y agrupa las frases en párrafos (段落)
    según las pausas largas del narrador.
 3. Analiza cada frase igual que el anime (palabras, significados, gramática JLPT, dificultad).
 4. Corta un clip de audio por frase y empaqueta todo en
    <carpeta del proyecto>\\paquetes\\audiolibros\\<título>\\<ID>_<nn>.zip  (o en --salida)
"""
import argparse, json, os, re, subprocess, sys, time, zipfile, shutil
# Anaconda (numpy/MKL) y faster-whisper (ctranslate2) traen cada uno su libiomp5md.dll;
# sin esto, al cargar Whisper sale "OMP: Error #15" y el programa se cierra.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)  # la carpeta que contiene "script" (y "app")
sys.path.insert(0, HERE)
import process  # reutiliza el análisis del anime
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

AUDIO_EXT = (".mp3", ".m4b", ".m4a", ".aac", ".flac", ".wav", ".ogg", ".opus")

# ---------------------------------------------------------------- capítulos
def chapter_info(fname):
    """'小説 君の名は。 [B07GPT59BQ] - 03 - 第二章　端緒.mp3' -> (3, '第二章　端緒', '小説 君の名は。')"""
    base = os.path.splitext(os.path.basename(fname))[0]
    m = re.search(r"^(.*?)\s*(?:\[[^\]]*\])?\s*-\s*(\d{1,3})\s*-\s*(.+)$", base)
    if m:
        return int(m.group(2)), m.group(3).strip(), m.group(1).strip()
    m = re.search(r"(\d{1,3})", base)
    return (int(m.group(1)) if m else 0), base, ""

# ---------------------------------------------------------------- transcripción
def transcribe(path, cache, model_name, device):
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return json.load(f)
    from faster_whisper import WhisperModel
    global _MODEL
    if "_MODEL" not in globals() or _MODEL[0] != model_name:
        print(f"  cargando Whisper '{model_name}' (la primera vez se descarga, puede tardar)…")
        ct = "int8" if device == "cpu" else "float16"
        _MODEL = (model_name, WhisperModel(model_name, device=device, compute_type=ct))
    model = _MODEL[1]
    segs, info = model.transcribe(
        path, language="ja", word_timestamps=True, vad_filter=True, beam_size=5,
        condition_on_previous_text=False,
        initial_prompt="以下は小説の朗読です。句読点「、」「。」をきちんと付けて書き起こします。")
    words, t0, dur = [], time.time(), info.duration or 1
    for s in segs:
        for w in (s.words or []):
            words.append([round(w.start, 3), round(w.end, 3), w.word])
        print(f"\r  transcribiendo… {100 * s.end / dur:5.1f}%  ({int(time.time() - t0)} s)", end="", flush=True)
    print()
    data = {"model": model_name, "duration": dur, "words": words}
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data

# ---------------------------------------------------------------- frases y párrafos
END = re.compile(r"[。！？!?]+[」』）)]*$")
def build_sentences(words, max_chars=70, gap_split=0.9):
    """Une las palabras de Whisper en frases con tiempos."""
    sents, cur = [], []
    def flush():
        if not cur: return
        text = re.sub(r"\s+", "", "".join(w[2] for w in cur)).strip().lstrip("、,，")
        if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", text):
            sents.append({"st": int(cur[0][0] * 1000), "en": int(cur[-1][1] * 1000), "t": text})
        cur.clear()
    for k, w in enumerate(words):
        cur.append(w)
        text = "".join(x[2] for x in cur).strip()
        nxt = words[k + 1] if k + 1 < len(words) else None
        gap = (nxt[0] - w[1]) if nxt else 99
        nxt_close = nxt is not None and re.match(r"^\s*[」』）)]", nxt[2])
        if (END.search(text) and not nxt_close) or (gap >= gap_split and len(text) >= 4) \
                or (len(text) >= max_chars and re.search(r"[、,]$", text)) or len(text) >= max_chars * 1.6:
            flush()
    flush()
    return sents

def build_passages(sents, pause=1.4, max_sents=10, max_ms=70000):
    """Agrupa frases en párrafos: corta en las pausas largas del narrador."""
    out, start = [], 0
    for i in range(1, len(sents) + 1):
        if i == len(sents):
            out.append([start, i - 1]); break
        gap = (sents[i]["st"] - sents[i - 1]["en"]) / 1000
        n = i - start; dur = sents[i - 1]["en"] - sents[start]["st"]
        if (gap >= pause and n >= 3) or n >= max_sents or dur >= max_ms:
            out.append([start, i - 1]); start = i
    return out

# ---------------------------------------------------------------- principal
def process_chapter(audio, n, title, book, book_id, out_dir, tr_dir, args, tagger, dic):
    cid = f"{book_id}_{n:02d}"
    dst = os.path.join(out_dir, cid + ".zip")
    if os.path.exists(dst) and not args.rehacer:
        print(f"  {cid}: ya existe, se salta"); return
    tr = transcribe(audio, os.path.join(tr_dir, cid + ".json"), args.modelo, args.dispositivo)
    sents = build_sentences(tr["words"])
    if not sents:
        print("  (sin texto, se salta)"); return
    passages = build_passages(sents)
    vocab, lines = {}, []
    for i, s in enumerate(sents):
        toks, gram = process.analyze_text(tagger, dic, s["t"], {}, vocab)
        lines.append({"id": f"{cid}_{i:04d}", "i": i, "st": s["st"], "en": s["en"], "spk": None, "t": s["t"],
                      "tk": toks, "ch": process.chunks(toks), "gr": gram, "dq": s["t"].startswith("「")})
    for p, (a, b) in enumerate(passages):
        for i in range(a, b + 1): lines[i]["pa"] = p
    process.assign_levels(lines, vocab)
    work = os.path.join(out_dir, "_trabajo", cid); cdir = os.path.join(work, "clips"); os.makedirs(cdir, exist_ok=True)
    for k, l in enumerate(lines):
        prev_en = lines[k - 1]["en"] if k else 0
        nxt_st = lines[k + 1]["st"] if k + 1 < len(lines) else l["en"] + 400
        s0 = max(0, l["st"] - 150, prev_en - 50) / 1000
        e0 = min(l["en"] + 300, max(l["en"] + 80, nxt_st + 50)) / 1000
        outp = os.path.join(cdir, l["id"] + ".m4a")
        if not os.path.exists(outp):
            subprocess.run([process.FF, "-v", "error", "-y", "-ss", f"{s0:.3f}", "-i", audio, "-t", f"{e0 - s0:.3f}",
                            "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", outp], check=True)
        l["clip"] = f"clips/{l['id']}.m4a"; l["cs"] = int(s0 * 1000)
        if k % 25 == 0: print(f"\r  clips {k}/{len(lines)}", end="", flush=True)
    print(f"\r  clips {len(lines)}/{len(lines)}")
    ep = {"v": 1, "type": "book", "ep": cid, "book": book, "chn": n, "title": title, "tlang": None,
          "passages": passages, "lines": lines, "vocab": vocab, "grammar": process.grammar_dict(lines),
          "asr": tr.get("model")}
    with open(os.path.join(work, "episode.json"), "w", encoding="utf-8") as f:
        json.dump(ep, f, ensure_ascii=False, separators=(",", ":"))
    tmp = dst + ".part"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:
        z.write(os.path.join(work, "episode.json"), "episode.json")
        for fn in sorted(os.listdir(cdir)): z.write(os.path.join(cdir, fn), "clips/" + fn)
    os.replace(tmp, dst); shutil.rmtree(work, ignore_errors=True)
    print(f"  listo: {os.path.basename(dst)} — {len(lines)} frases, {len(passages)} párrafos, {os.path.getsize(dst) // (1024 * 1024)} MB")

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("carpeta", help="carpeta con un archivo de audio por capítulo")
    ap.add_argument("--modelo", default="large-v3-turbo", help="modelo de Whisper: large-v3-turbo (por defecto), medium, small…")
    ap.add_argument("--dispositivo", default="cpu", help="cpu (por defecto) o cuda (solo tarjetas NVIDIA)")
    ap.add_argument("--id", default=None, help="identificador corto del libro (por defecto se saca del nombre)")
    ap.add_argument("--salida", default=None)
    ap.add_argument("--solo", nargs="*", type=int)
    ap.add_argument("--rehacer", action="store_true", help="vuelve a crear los .zip (la transcripción guardada se reutiliza)")
    a = ap.parse_args(argv); args = a
    files = sorted(f for f in os.listdir(a.carpeta) if f.lower().endswith(AUDIO_EXT))
    if not files: raise SystemExit("No hay archivos de audio en esa carpeta.")
    chapters = [(chapter_info(f), os.path.join(a.carpeta, f)) for f in files]
    book = next((b for (_, _, b), _ in chapters if b), os.path.basename(os.path.normpath(a.carpeta)))
    book_id = a.id or ("BOOK" if not re.sub(r"[^A-Za-z0-9]", "", book) else re.sub(r"[^A-Za-z0-9]", "", book)[:8].upper())
    if a.id is None and "君の名は" in book: book_id = "KIMINONAWA"
    # Por defecto: <carpeta del proyecto>\paquetes\audiolibros\<título del libro>
    safe = re.sub(r'[<>:"/\\|?*]', "", book).strip() or book_id
    out_dir = a.salida or os.path.join(PROJECT, "paquetes", "audiolibros", safe)
    tr_dir = os.path.join(out_dir, "_transcripciones")
    os.makedirs(out_dir, exist_ok=True)
    process.FF = process.ffmpeg_exe()
    import fugashi
    tagger = fugashi.Tagger(); dic = process.Dict(process.DB)
    print(f"Libro: {book}  ({len(chapters)} capítulos)  →  {out_dir}\n")
    for (n, title, _), path in chapters:
        if a.solo and n not in a.solo: continue
        print(f"[{n:02d}] {title}")
        t0 = time.time()
        try:
            process_chapter(path, n, title, book, book_id, out_dir, tr_dir, args, tagger, dic)
        except Exception as e:
            print(f"  ERROR: {e}")
        print(f"  ({int(time.time() - t0)} s)\n")
    shutil.rmtree(os.path.join(out_dir, "_trabajo"), ignore_errors=True)
    print("Terminado. Copia los .zip al móvil e impórtalos en la sección オーディオブック de la app.")

if __name__ == "__main__":
    main()
