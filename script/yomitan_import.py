"""
Converts a Yomitan dictionary export (Settings → Backup → Export Dictionary Collection,
yomitan-dictionaries-*.json) into dicts.sqlite, which process.py uses to add your
dictionaries to every episode pack.

  python yomitan_import.py                      (uses the newest yomitan-dictionaries-*.json here)
  python yomitan_import.py path/to/export.json

Only needs to run once (and again if you add dictionaries to Yomitan and export again).
The dictionaries stay on your PC and inside your packs; nothing is uploaded anywhere.
"""
import glob, json, os, sqlite3, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "dicts.sqlite")

# the order the dictionaries are shown in (matched by part of their title); others go after these
ORDER = ["アクセント", "新明解", "JMdict", "JMnedict", "KANJIDIC", "KireiCake", "Freq"]


def order_of(title):
    for i, key in enumerate(ORDER):
        if key.lower() in title.lower():
            return i
    return len(ORDER)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else max(glob.glob(os.path.join(HERE, "yomitan-dictionaries-*.json")), key=os.path.getmtime, default=None)
    if not src or not os.path.exists(src):
        sys.exit("No encuentro el archivo exportado de Yomitan (yomitan-dictionaries-*.json).")
    t0 = time.time()
    print(f"Leyendo {os.path.basename(src)} ({os.path.getsize(src) / 2**20:.0f} MB)…", flush=True)
    text = open(src, encoding="utf-8").read()
    dec = json.JSONDecoder()

    def rows(table):
        """Yields the rows of one table of the Dexie export without parsing the whole file at once."""
        i = text.find('{"tableName":"%s"' % table)
        if i < 0:
            return
        i = text.index('"rows":[', i) + len('"rows":[')
        while True:
            while text[i] in " \r\n\t,":
                i += 1
            if text[i] == "]":
                return
            obj, i = dec.raw_decode(text, i)
            if isinstance(obj.get("$"), list):   # non-inbound tables wrap each row as {"$": [key, row]}
                obj = obj["$"][1]
            yield obj

    if os.path.exists(OUT):
        os.remove(OUT)
    db = sqlite3.connect(OUT)
    db.executescript("""
        CREATE TABLE dicts(id INTEGER PRIMARY KEY, title TEXT, ord INTEGER);
        CREATE TABLE terms(d INTEGER, e TEXT, r TEXT, tags TEXT, score INTEGER, g TEXT);
        CREATE TABLE kanji(d INTEGER, c TEXT, onyomi TEXT, kunyomi TEXT, m TEXT, st TEXT);
        CREATE TABLE meta(d INTEGER, e TEXT, mode TEXT, data TEXT);
    """)
    ids = {}
    for row in rows("dictionaries"):
        title = row["title"]
        ids[title] = len(ids) + 1
        db.execute("INSERT INTO dicts VALUES(?,?,?)", (ids[title], title, order_of(title)))
        print(f"  · {title}")

    def fill(table, sql, make):
        batch, n = [], 0
        for row in rows(table):
            d = ids.get(row.get("dictionary"))
            if d is None:
                continue
            batch.append(make(d, row)); n += 1
            if len(batch) >= 50000:
                db.executemany(sql, batch); batch.clear()
                print(f"  {table}: {n:,}", end="\r", flush=True)
        if batch:
            db.executemany(sql, batch)
        print(f"  {table}: {n:,}          ")

    fill("terms", "INSERT INTO terms VALUES(?,?,?,?,?,?)",
         lambda d, r: (d, r["expression"], r.get("reading") or "", r.get("definitionTags") or "", r.get("score") or 0, json.dumps(r.get("glossary"), ensure_ascii=False)))
    fill("kanji", "INSERT INTO kanji VALUES(?,?,?,?,?,?)",
         lambda d, r: (d, r["character"], r.get("onyomi") or "", r.get("kunyomi") or "", json.dumps(r.get("meanings") or [], ensure_ascii=False), json.dumps(r.get("stats") or {}, ensure_ascii=False)))
    fill("termMeta", "INSERT INTO meta VALUES(?,?,?,?)",
         lambda d, r: (d, r["expression"], r.get("mode") or "", json.dumps(r.get("data"), ensure_ascii=False)))
    print("Creando índices…", flush=True)
    db.executescript("CREATE INDEX terms_e ON terms(e); CREATE INDEX kanji_c ON kanji(c); CREATE INDEX meta_e ON meta(e);")
    db.commit(); db.close()
    print(f"Listo: {OUT} ({os.path.getsize(OUT) / 2**20:.0f} MB) en {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
