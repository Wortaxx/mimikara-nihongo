# -*- coding: utf-8 -*-
"""Processes every episode in a folder and creates one .zip per episode for the app.

Usage (from Anaconda Prompt):
    python run_all.py "E:\\Anime\\Frieren"
    python run_all.py "E:\\Anime\\Frieren" --solo S01E01 S01E02     (only those episodes)
    python run_all.py "E:\\Anime\\Frieren" --salida "D:\\other\\folder"  (save the .zip files somewhere else)

Finds the videos (.mkv/.mp4) and their Japanese subtitles (.srt/.ass) in the folder and its subfolders,
matches them by season and episode, and writes the packs to
<project folder>\\paquetes\\anime\\<series name> (the project folder is the one that contains "script").
Episodes that already have a pack are skipped.
"""
import os, re, sys, shutil, argparse, time
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)  # the folder that contains "script" (and "app")
sys.path.insert(0, HERE)
import process
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

def key_of(name):
    n = os.path.basename(name)
    m = re.search(r"S(\d{1,2})E(\d{1,3})", n, re.I)
    if m: return f"S{int(m.group(1)):02d}E{int(m.group(2)):02d}"
    m = re.search(r"S(\d{1,2})\s*-\s*(\d{1,3})\b", n, re.I)
    if m: return f"S{int(m.group(1)):02d}E{int(m.group(2)):02d}"
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("carpeta"); ap.add_argument("--solo", nargs="*"); ap.add_argument("--salida"); ap.add_argument("--rehacer", action="store_true", help="vuelve a crear también los episodios que ya tienen .zip")
    ap.add_argument("--no-unir", action="store_true", help="no juntar las líneas seguidas del mismo personaje")
    a = ap.parse_args()
    root = a.carpeta
    # Default: <project folder>\paquetes\anime\<series folder name>
    serie = os.path.basename(os.path.normpath(root)) or "serie"
    out_dir = a.salida or os.path.join(PROJECT, "paquetes", "anime", serie)
    work = os.path.join(out_dir, "_trabajo")
    os.makedirs(work, exist_ok=True)
    videos, subs = {}, {}
    for dp, dn, fn in os.walk(root):
        if os.path.abspath(dp).startswith(os.path.abspath(out_dir)): continue
        for f in fn:
            k = key_of(f)
            if not k: continue
            p = os.path.join(dp, f)
            if f.lower().endswith((".mkv", ".mp4")): videos[k] = p
            elif f.lower().endswith((".srt", ".ass")) and not re.search(r"\.(en|eng|es|spa)\.", f, re.I): subs[k] = p
    eps = sorted(set(videos) & set(subs))
    if a.solo: eps = [e for e in eps if e in {s.upper() for s in a.solo}]
    falt = sorted(set(videos) - set(subs))
    if falt: print("Sin subtítulos japoneses (se saltan):", ", ".join(falt))
    print(f"{len(eps)} episodios para procesar. Paquetes en: {out_dir}\n")
    for i, ep in enumerate(eps, 1):
        dst = os.path.join(out_dir, ep + ".zip")
        if os.path.exists(dst) and not a.rehacer:
            print(f"[{i}/{len(eps)}] {ep}: ya existe, se salta"); continue
        print(f"[{i}/{len(eps)}] {ep}")
        t0 = time.time()
        wdir = os.path.join(work, ep)
        try:
            process.main(["--srt", subs[ep], "--video", videos[ep], "--ep", ep, "--out", wdir] + (["--no-unir"] if a.no_unir else []))
            import zipfile
            tmp = dst + ".part"
            with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:
                z.write(os.path.join(wdir, "episode.json"), "episode.json")
                for f in sorted(os.listdir(os.path.join(wdir, "clips"))):
                    z.write(os.path.join(wdir, "clips", f), "clips/" + f)
            os.replace(tmp, dst)
            shutil.rmtree(wdir, ignore_errors=True)
            print(f"  listo: {os.path.basename(dst)} ({os.path.getsize(dst)//(1024*1024)} MB, {int(time.time()-t0)} s)\n")
        except Exception as e:
            print(f"  ERROR en {ep}: {e}\n")
    shutil.rmtree(work, ignore_errors=True)
    print("Terminado. Copia los .zip al móvil e impórtalos en la app.")

if __name__ == "__main__":
    main()
