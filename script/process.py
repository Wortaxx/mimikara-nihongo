# -*- coding: utf-8 -*-
"""Processes one episode: Japanese subtitles (+ video) -> analysed sentences + clips.
Usage: python process.py --srt JP.srt --video EP.mkv --ep S01E27 --out out_dir [--no-video]
"""
import argparse, json, os, re, sqlite3, subprocess, wave, hashlib, unicodedata
import numpy as np, pysubs2, fugashi
from grammar import PATTERNS, tokstr

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("JMDICT_DB", os.path.join(HERE, "jmdict_min.db"))
if not os.path.exists(DB) and os.path.exists(os.path.join(HERE, "jmdict_min.zip")):
    import zipfile
    print("Descomprimiendo el diccionario (solo la primera vez)…")
    zipfile.ZipFile(os.path.join(HERE, "jmdict_min.zip")).extractall(HERE)

# ---------- ffmpeg ----------
import shutil
def ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if exe: return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise SystemExit("No encuentro ffmpeg. Instálalo con:  pip install imageio-ffmpeg")
FF = None

def probe_streams(video):
    """Reads the video's streams from the output of 'ffmpeg -i'. Returns [(idx, type, language, title)]."""
    r = subprocess.run([FF, "-hide_banner", "-i", video], capture_output=True, text=True, encoding="utf-8", errors="replace")
    out, cur = [], None
    for ln in r.stderr.splitlines():
        m = re.match(r"\s*Stream #0:(\d+)(?:\[\w+\])?(?:\((\w+)\))?: (\w+):", ln)
        if m:
            cur = [int(m.group(1)), m.group(3).lower(), m.group(2) or "", ""]; out.append(cur); continue
        m = re.match(r"\s+title\s*:\s*(.*)", ln)
        if m and cur is not None and not cur[3]: cur[3] = m.group(1).strip()
    return out

# ---------- text utilities ----------
def kata2hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)

def has_kanji(s):
    return any("一" <= c <= "鿿" or c in "々〆ヵヶ" for c in s)

def is_kana(c):
    return "぀" <= c <= "ヿ"

FURI_RE = re.compile(r"([一-鿿々]+)\(([぀-ゟー]+)\)")

def clean_line(raw):
    """Returns (speaker, display_text, furigana_overrides), or None if the line is not dialogue."""
    t = re.sub(r"\{[^}]*\}", "", raw).replace("\\N", "\n").replace("\\n", "\n")
    if re.search(r"[♪♬♫]", t):
        return None
    t = t.replace("➡", "").replace("→", "")
    speaker = None
    lines = []
    for ln in t.split("\n"):
        ln = ln.strip()
        m = re.match(r"^（([^）]+)）\s*(.*)$", ln)
        if m:
            if speaker is None:
                speaker = m.group(1)
            ln = m.group(2)
        ln = re.sub(r"［[^］]*］|\[[^\]]*\]", "", ln)  # sound effects
        ln = re.sub(r"^（[^）]*）$", "", ln)  # line with only a sound or a name
        ln = ln.strip()
        if ln:
            lines.append(ln)
    text = " ".join(lines)
    overrides = {k: v for k, v in FURI_RE.findall(text)}
    text = FURI_RE.sub(r"\1", text)
    text = re.sub(r"[ 　]+", " ", text).strip()
    if not text or not re.search(r"[぀-ヿ一-鿿]", text):
        return None
    if speaker and "の声" in speaker:
        speaker = speaker.replace("の声", "")
    return speaker, text, overrides

# ---------- furigana ----------
def furi_split(surface, reading):
    """Splits surface into segments [(text, reading|None)], leaving the okurigana without a reading."""
    if not has_kanji(surface) or not reading:
        return [(surface, None)]
    s, r = surface, reading
    pre = ""
    while s and r and not has_kanji(s[0]) and kata2hira(s[0]) == r[0]:
        pre += s[0]; s = s[1:]; r = r[1:]
    post = ""
    while s and r and not has_kanji(s[-1]) and kata2hira(s[-1]) == r[-1]:
        post = s[-1] + post; s = s[:-1]; r = r[:-1]
    out = []
    if pre: out.append((pre, None))
    out.append((s, r if r else None))
    if post: out.append((post, None))
    return out

# ---------- dictionary ----------
class Dict:
    """Compact JMdict (jmdict_min.db): entry(idseq, pri, uk, g), kanji(text,idseq), kana(text,idseq)."""
    def __init__(self, path):
        self.c = sqlite3.connect(path)
        self.cache = {}

    def lookup(self, base, reading, lemma=""):
        key = (base, reading, lemma)
        if key in self.cache:
            return self.cache[key]
        c = self.c
        ids = [r[0] for r in c.execute("select idseq from kanji where text=?", (base,))]
        ids += [r[0] for r in c.execute("select idseq from kana where text=?", (base,))]
        if lemma and lemma != base:
            ids += [r[0] for r in c.execute("select idseq from kanji where text=?", (lemma,))]
        if not ids and reading:
            ids = [r[0] for r in c.execute("select idseq from kana where text=?", (reading,))]
        best = None
        for idseq in dict.fromkeys(ids):
            row = c.execute("select pri, uk, g from entry where idseq=?", (idseq,)).fetchone()
            if not row: continue
            pri, uk, g = row
            kanas = [r[0] for r in c.execute("select text from kana where idseq=?", (idseq,))]
            kanjis = [r[0] for r in c.execute("select text from kanji where idseq=?", (idseq,))]
            score = min(pri, 5)
            if reading and reading in kanas: score += 10
            if lemma and lemma in kanjis: score += 20
            if base in kanjis or (not kanjis and base in kanas): score += 3
            if not has_kanji(base) and base in kanas and uk: score += 8
            if best is None or score > best[0]:
                best = (score, g, pri)
        res = {"g": json.loads(best[1]), "common": best[2] > 0} if best else None
        self.cache[key] = res
        return res

# ---------- tokenisation ----------
POS_MAP = {"名詞": "n", "代名詞": "pron", "動詞": "v", "形容詞": "adj", "形状詞": "adjna", "副詞": "adv",
           "連体詞": "adn", "接続詞": "conj", "感動詞": "int", "助詞": "prt", "助動詞": "aux",
           "接頭辞": "pre", "接尾辞": "suf", "補助記号": "sym", "空白": "sp", "記号": "sym"}
POS_ES = {"n": "sustantivo", "pron": "pronombre", "v": "verbo", "adj": "adjetivo -i", "adjna": "adjetivo -na",
          "adv": "adverbio", "adn": "adnominal", "conj": "conjunción", "int": "interjección", "prt": "partícula",
          "aux": "auxiliar", "pre": "prefijo", "suf": "sufijo", "pn": "nombre propio"}

# The series' proper nouns: the analyser splits them (フリー+レン). Extended with the speaker names from the subtitles.
NAMES = set("フリーレン フェルン シュタルク ヒンメル ハイター アイゼン ゼーリエ デンケン ラオフェン リヒター カンネ ラヴィーネ "
            "ユーベル ラント ヴィアベル エーレ シャルフ ゲナウ メトーデ ゼンゼ レルネン フランメ ザイン アウラ リュグナー リーニエ "
            "ドラート クラフト ファルシュ トーア ヴァルム レヴォルテ ソリテール マハト グラオザーム クヴァール ゼーリエ様".split())
KATA = re.compile(r"^[ァ-ヶー・]+$")

class Node:
    def __init__(self, surface, feature): self.surface, self.feature = surface, feature

def merged_nodes(tagger, text):
    ws = [Node(w.surface, w.feature) for w in tagger(text)]
    out, i = [], 0
    while i < len(ws):
        done = False
        if KATA.match(ws[i].surface):
            for j in range(min(len(ws), i + 5), i, -1):
                cat = "".join(w.surface for w in ws[i:j])
                if cat in NAMES and all(KATA.match(w.surface) for w in ws[i:j]):
                    f = ws[i].feature._replace(pos1="名詞", pos2="固有名詞", lemma=cat, orthBase=cat, orth=cat, kana=cat, kanaBase=cat, cForm="*", cType="*")
                    out.append(Node(cat, f)); i = j; done = True; break
        if not done:
            out.append(ws[i]); i += 1
    return out

def tokenize(tagger, dic, text, overrides, vocab, feats):
    toks = []
    for w in merged_nodes(tagger, text):
        f = w.feature
        pos = f.pos1 + ("-" + f.pos2 if f.pos2 and f.pos2 != "*" else "")
        cf = (f.cForm or "*").split("-")[0]
        if f.pos1 != "空白" and w.surface.strip():
            feats.append((w.surface, f.lemma or w.surface, pos, cf, len(toks)))
        s = w.surface
        p = POS_MAP.get(f.pos1, "x")
        if f.pos2 == "固有名詞": p = "pn"
        if p == "sp" or s.strip() == "":
            toks.append({"s": " ", "p": "sp"}); continue
        reading = kata2hira(f.kana) if f.kana and f.kana != "*" else ""
        if s in overrides: reading = overrides[s]
        t = {"s": s, "p": p}
        if has_kanji(s) and reading:
            t["f"] = [[a, b] if b else [a] for a, b in furi_split(s, reading)]
        if reading: t["r"] = reading
        base = f.orthBase if f.orthBase and f.orthBase != "*" else s
        t["b"] = base
        if p in ("n", "pron", "v", "adj", "adjna", "adv", "adn", "conj", "int", "pn") and p != "sym":
            rb = kata2hira(f.kanaBase) if f.kanaBase and f.kanaBase != "*" else reading
            key = base
            lem = (f.lemma or "").split("-")[0]
            if key not in vocab:
                ent = dic.lookup(base, rb, lem) if p != "pn" else None
                if not ent and p != "pn" and re.fullmatch(r"[ァ-ヶー・]+", base):
                    p = "pn"; t["p"] = "pn"
                if not ent and p != "pn" and re.fullmatch(r"[0-9０-９]+", base):
                    toks.append(t); continue
                vocab[key] = {"r": rb, "p": p, "g": ent["g"] if ent else [], "c": bool(ent and ent["common"]), "n": 0}
            vocab[key]["n"] += 1
            if vocab[key]["p"] == "pn": t["p"] = "pn"
        if f.pos2 == "非自立可能": t["nz"] = 1
        toks.append(t)
    return toks

def chunks(toks):
    """Groups tokens into blocks (approximate bunsetsu) for the sentence-order drill."""
    out = []
    for i, t in enumerate(toks):
        if t["p"] == "sp":
            continue
        attach = out and (t["p"] in ("prt", "aux", "suf", "sym") or
                          (t.get("nz") and t["p"] in ("v", "adj") and out[-1][-1] > -1 and toks[out[-1][-1]]["s"] in ("て", "で")))
        if out and toks[out[-1][-1]]["p"] == "pre":
            attach = True
        if attach:
            out[-1].append(i)
        else:
            out.append([i])
    return out

# ---------- synchronisation ----------
def audio_offset(wav, subs):
    w = wave.open(wav)
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32)
    fr = 160; n = len(x) // fr
    e = np.log1p((x[: n * fr].reshape(n, fr) ** 2).mean(1)); e -= np.median(e)
    mask = np.zeros(n)
    for l in subs:
        mask[l.start // 10: l.end // 10] = 1
    mask -= mask.mean()
    best = max(((float((np.roll(mask, -s) * e).sum()), s * 10) for s in range(-400, 401, 2)))
    return best[1]

NON_DIALOGUE = re.compile(r"(?:^|[_\-\s])(?:cart\w*|signs?|op|ed|kara\w*|title\w*|song\w*|insert\w*|lyrics?)(?:$|[_\-\s\d])", re.I)

def pick_translation(streams, forced=None):
    """Picks the translation track: Spanish (Spain > others) and, if there is none, English (full dialogue, not signs)."""
    if forced is not None:
        return forced, "es"
    subs = [s for s in streams if s[1] == "subtitle"]
    spa = [s for s in subs if s[2] in ("spa", "es", "esp")]
    spa.sort(key=lambda s: (not re.search(r"ESP|Spain|España|Castellano|es-ES", s[3], re.I), s[0]))
    if spa:
        return spa[0][0], "es"
    eng = [s for s in subs if s[2] in ("eng", "en") and not re.search(r"sign|song|forced|commentary", s[3], re.I)]
    eng.sort(key=lambda s: (not re.search(r"full|dialog", s[3], re.I), s[0]))
    if eng:
        return eng[0][0], "en"
    return None, None

def es_for(line_start, line_end, es_events):
    parts = []
    for e in es_events:
        ov = min(line_end, e.end) - max(line_start, e.start)
        if ov > 0.4 * min(line_end - line_start, e.end - e.start):
            txt = re.sub(r"\{[^}]*\}", "", e.text).replace("\\N", " ").strip()
            parts.append((e.start, txt))
    return re.sub(r"\s+", " ", " ".join(t for _, t in parts)).strip()

def analyze_text(tagger, dic, text, ov, vocab):
    """Splits into words and detects grammar. Returns (tokens, grammar)."""
    feats = []
    toks = tokenize(tagger, dic, text, ov, vocab, feats)
    flat = re.sub(r"\s", "", text)
    ts = tokstr([f4[:4] for f4 in feats])
    gram = []
    cum = []  # start position in the plain text of each token in feats
    pos_ = 0
    for f4 in feats:
        cum.append(pos_); pos_ += len(f4[0])
    for pat in PATTERNS:
        if pat[2].startswith("T:"):
            m = re.search(pat[2][2:], flat)
            if not m: continue
            a_ = max(k for k in range(len(cum)) if cum[k] <= m.start())
            b_ = max(k for k in range(len(cum)) if cum[k] < m.end())
        else:
            m = re.search(pat[2], ts)
            if not m: continue
            a_ = ts.count(" ", 0, m.start() + 1) - 1
            b_ = ts.count(" ", 0, m.end()) - 1
        a_ = max(0, min(a_, len(feats) - 1)); b_ = max(a_, min(b_, len(feats) - 1))
        gram.append([pat[0], feats[a_][4], feats[b_][4]])
    return toks, gram

def assign_levels(lines, vocab):
    """Approximate difficulty (1-3) of each sentence."""
    for l in lines:
        content = [t for t in l["tk"] if t.get("b") in vocab and vocab[t["b"]]["p"] != "pn"]
        rare = sum(1 for t in content if not vocab[t["b"]]["c"])
        kanji = sum(1 for ch in l["t"] if has_kanji(ch))
        score = rare * 2 + kanji * 0.5 + len(content) * 0.3
        l["lv"] = 1 if score < 3 else (2 if score < 7 else 3)

def grammar_dict(lines):
    from grammar import BY_ID
    used = {g[0] for l in lines for g in l["gr"]}
    return {pid: [BY_ID[pid]["label"], BY_ID[pid]["q"], BY_ID[pid]["ex"], BY_ID[pid]["lv"], BY_ID[pid]["im"], int(BY_ID[pid]["basic"])] for pid in used}

# ---------- merge lines from the same character ----------
CONTINUES = re.compile(r"(て|で|が|けど|けれど|から|ので|のに|し|たら|ば|と|、|…|‥|っ|ながら|ても|でも|けども)$")
def merge_events(events, offset, es_events, join=True, max_gap=700, max_ms=12000, max_chars=70, max_parts=4):
    """Merges consecutive lines from the same character into one sentence (one clip).
    The character comes from the name in brackets in the Japanese subtitles or,
    if there is none, from the "Actor" field of the video's Spanish/English subtitles."""
    def actor(st, en):
        best, bo = None, 0
        for e in es_events:
            o = min(en, e.end) - max(st, e.start)
            if o > bo and (e.name or "").strip():
                best, bo = e.name.strip().upper(), o
        return best
    units = []  # [st, en, spk, text, ov, jp_label, es_actor, parts]
    for ev, (spk, text, ov) in events:
        st, en = ev.start - offset, ev.end - offset
        act = actor(st, en) if es_events else None
        arrow = bool(re.search(r"[➡→]\s*$", re.sub(r"\{[^}]*\}", "", ev.text).strip()))  # TV subtitles mark with ➡ that the sentence continues
        if join and units:
            u = units[-1]
            gap = st - u[1]
            # same character? True = certain, False = different, None = unknown
            if spk and u[5]: same = (spk == u[5])
            elif act and u[6]: same = (act == u[6])
            elif spk: same = False            # a new name appears → the speaker changes
            else: same = None
            cont = bool(CONTINUES.search(u[3])) or u[8]
            limit = (en - u[0] <= max_ms) and (len(u[3]) + len(text) <= max_chars) and u[7] < max_parts
            ok = False
            if limit and same is not False:
                if u[8] and gap <= max_gap * 3: ok = True                         # ➡: the sentence continues
                elif same is True: ok = gap <= max_gap or (cont and gap <= max_gap * 2)
                else: ok = cont and gap <= max_gap * 2                            # no data: only if the sentence is clearly unfinished
            if ok:
                u[1] = en; u[3] = u[3] + " " + text; u[4] = {**u[4], **ov}; u[7] += 1; u[8] = arrow
                if spk and not u[5]: u[5] = spk
                if act and not u[6]: u[6] = act
                if not u[2] and spk: u[2] = spk
                continue
        units.append([st, en, spk, text, ov, spk, act, 1, arrow])
    # the character's Japanese name, from the Actor field of the video's subtitles
    amap = {}
    for u in units:
        if u[5] and u[6]: amap.setdefault(u[6], u[5])
    return [(u[0], u[1], u[2] or amap.get(u[6]), u[3], u[4]) for u in units]

# ---------- main ----------
def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--srt", required=True); ap.add_argument("--video"); ap.add_argument("--ep", required=True)
    ap.add_argument("--title", default=""); ap.add_argument("--out", required=True)
    ap.add_argument("--es-stream", default=None, help="índice ffmpeg del subtítulo español dentro del vídeo")
    ap.add_argument("--no-video", action="store_true")
    ap.add_argument("--no-unir", action="store_true", help="no juntar las líneas seguidas del mismo personaje")
    ap.add_argument("--calidad", choices=["normal", "ligera"], default="normal", help="ligera: clips a 270p, ~37% más pequeños")
    ap.add_argument("--completo", action="store_true", help="incluir también el episodio completo en un solo vídeo (para verlo entero en la app)")
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    global FF
    FF = ffmpeg_exe()
    tagger = fugashi.Tagger(); dic = Dict(DB)

    raw = pysubs2.load(a.srt)
    events = []
    for ev in raw:
        c = clean_line(ev.text)
        if c: events.append((ev, c))

    offset = 0; es_events = []; title = a.title; amap = "0:a:0"; tlang = None
    wav = os.path.join(a.out, "_tmp.wav")
    if a.video:
        streams = probe_streams(a.video)
        auds = [s for s in streams if s[1] == "audio"]
        jp = [s for s in auds if s[2] == "jpn"]
        if jp: amap = f"0:{jp[0][0]}"
        subprocess.run([FF, "-v", "error", "-y", "-i", a.video, "-map", amap, "-ac", "1", "-ar", "16000", wav], check=True)
        offset = audio_offset(wav, [ev for ev, _ in events])
        print("  desfase subtítulos -> vídeo:", offset, "ms")
        # Translation: Spanish (Spain preferred) → otherwise English → otherwise none.
        idx, tlang = pick_translation(streams, a.es_stream)
        if idx is not None:
            es_path = os.path.join(a.out, "_es.ass")
            subprocess.run([FF, "-v", "error", "-y", "-i", a.video, "-map", f"0:{idx}", es_path], check=True)
            es_all = [e for e in pysubs2.load(es_path) if not e.is_comment]
            if not title and tlang == "es":
                for e in es_all:
                    m = re.search(r"Episodio\s*\d+\s*(?:\\N|\n|[:.\-–])\s*(.+)", re.sub(r"\{[^}]*\}", "", e.text))
                    if m: title = m.group(1).replace("\\N", " ").strip(); break
            es_events = [e for e in es_all if not NON_DIALOGUE.search(e.style or "")]
        print("  traducción:", {"es": "español", "en": "inglés (no hay pista en español)"}.get(tlang, "NINGUNA (el vídeo no trae subtítulos en español ni en inglés)"))

    for _, (spk, _t, _o) in events:
        if spk:
            for nm in re.split(r"[・/＆&、 ]", spk):
                if KATA.match(nm) and len(nm) >= 2: NAMES.add(nm)
    vocab = {}
    lines = []
    units = merge_events(events, offset, es_events, join=not a.no_unir)
    print(f"  líneas de subtítulo: {len(events)} → frases: {len(units)}")
    for i, (st, en, spk, text, ov) in enumerate(units):
        toks, gram = analyze_text(tagger, dic, text, ov, vocab)
        lid = f"{a.ep}_{i:04d}"
        line = {"id": lid, "i": i, "st": st, "en": en, "spk": spk, "t": text, "tk": toks,
                "ch": chunks(toks), "gr": gram}
        if es_events:
            line["es"] = es_for(st, en, es_events)
        lines.append(line)

    assign_levels(lines, vocab)

    # clips
    if a.video and not a.no_video:
        cdir = os.path.join(a.out, "clips"); os.makedirs(cdir, exist_ok=True)
        idx_path = os.path.join(cdir, "_index.json")
        try:
            old_idx = json.load(open(idx_path, encoding="utf-8"))
        except Exception:
            old_idx = {}
        new_idx = {}
        Q = {"normal": {"h": 360, "crf": "30", "ab": "64k"}, "ligera": {"h": 270, "crf": "32", "ab": "48k"}}[a.calidad]
        for n, l in enumerate(lines):
            s0 = max(0, l["st"] - 250) / 1000; dur = (l["en"] + 350) / 1000 - s0
            outp = os.path.join(cdir, l["id"] + ".mp4")
            key = f"{s0:.3f}-{dur:.3f}-{a.calidad}"; new_idx[l["id"]] = key
            if not os.path.exists(outp) or old_idx.get(l["id"]) != key:
                subprocess.run([FF, "-v", "error", "-y", "-ss", f"{s0:.3f}", "-i", a.video, "-t", f"{dur:.3f}",
                                "-map", "0:v:0", "-map", amap, "-vf", f"scale=-2:{Q['h']},format=yuv420p", "-c:v", "libx264",
                                "-preset", "veryfast", "-crf", Q["crf"], "-profile:v", "main", "-c:a", "aac", "-b:a", Q["ab"],
                                "-ac", "1", "-movflags", "+faststart", outp], check=True)
            l["clip"] = f"clips/{l['id']}.mp4"; l["cs"] = int(s0 * 1000)
            if n % 25 == 0: print(f"\r  clips {n}/{len(lines)}", end="", flush=True)
        print(f"\r  clips {len(lines)}/{len(lines)}")
        json.dump(new_idx, open(idx_path, "w", encoding="utf-8"))
        if a.completo:   # the whole episode in one video, same quality as the clips
            full = os.path.join(a.out, "episode.mp4"); mark = full + f".{a.calidad}"
            if not (os.path.exists(full) and os.path.exists(mark)):
                print("  episodio completo…", flush=True)
                subprocess.run([FF, "-v", "error", "-y", "-i", a.video, "-map", "0:v:0", "-map", amap, "-vf", f"scale=-2:{Q['h']},format=yuv420p",
                                "-c:v", "libx264", "-preset", "veryfast", "-crf", Q["crf"], "-profile:v", "main", "-c:a", "aac", "-b:a", Q["ab"],
                                "-ac", "1", "-movflags", "+faststart", full], check=True)
                open(mark, "w").close()
    for p in ("_tmp.wav", "_es.ass"):
        if os.path.exists(os.path.join(a.out, p)): os.remove(os.path.join(a.out, p))

    grammar = grammar_dict(lines)
    ep = {"v": 1, "ep": a.ep, "title": title, "tlang": tlang, "offset": offset, "lines": lines, "vocab": vocab, "grammar": grammar}
    if a.completo and a.video and not a.no_video: ep["full"] = "episode.mp4"
    with open(os.path.join(a.out, "episode.json"), "w", encoding="utf-8") as f:
        json.dump(ep, f, ensure_ascii=False, separators=(",", ":"))
    print("  frases:", len(lines), "| vocabulario:", len(vocab), "| título:", title)

if __name__ == "__main__":
    main()
