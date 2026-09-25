# Empaqueta un episodio procesado en un .zip para importarlo en la app.
import sys, os, zipfile
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dst, "w", zipfile.ZIP_STORED) as z:
    z.write(os.path.join(src, "episode.json"), "episode.json")
    cd = os.path.join(src, "clips")
    if os.path.isdir(cd):
        for f in sorted(os.listdir(cd)):
            if f.startswith("_"): continue
            z.write(os.path.join(cd, f), "clips/" + f)
print(dst, os.path.getsize(dst) // 1024, "KB")
