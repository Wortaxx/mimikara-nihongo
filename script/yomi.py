"""
Looks words up in dicts.sqlite (made by yomitan_import.py) and turns the entries into small,
safe HTML for the app's word sheet and the Anki cards.
"""
import html, json, os, re, sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "dicts.sqlite")

MAX_PER_DICT = 3        # entries per dictionary and word
MAX_HTML = 6000         # characters per dictionary and word

TAGS = {"ul", "ol", "li", "div", "span", "ruby", "rt", "rp", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
        "details", "summary", "i", "b", "em", "strong", "sub", "sup", "br", "a"}
LIST_STYLE = re.compile(r"^(none|disc|circle|square|decimal|'[^'<>;]{0,12}'|\"[^\"<>;]{0,12}\")$")


def kata2hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s or "")


def esc(s):
    return html.escape(str(s), quote=True)


def sc_html(node):
    """Yomitan structured content → HTML with a small whitelist of tags and styles."""
    if node is None:
        return ""
    if isinstance(node, str):
        return esc(node).replace("\n", "<br>")
    if isinstance(node, list):
        return "".join(sc_html(n) for n in node)
    if not isinstance(node, dict):
        return ""
    kind = node.get("type")
    if kind == "structured-content":
        return sc_html(node.get("content"))
    if kind == "text":
        return esc(node.get("text", "")).replace("\n", "<br>")
    if kind == "image" or node.get("tag") == "img":
        return ""
    tag = node.get("tag")
    inner = sc_html(node.get("content"))
    if tag == "br":
        return "<br>"
    if tag not in TAGS:
        return inner
    if tag == "a":          # links to Yomitan searches do nothing here
        tag = "span"
    attrs = ""
    data = node.get("data") or {}
    if isinstance(data, dict) and data.get("content"):
        attrs += f' data-sc="{esc(data["content"])}"'
    style = node.get("style") or {}
    css = []
    if style.get("fontWeight") == "bold":
        css.append("font-weight:700")
    if style.get("fontStyle") == "italic":
        css.append("font-style:italic")
    ls = style.get("listStyleType")
    if isinstance(ls, str) and LIST_STYLE.match(ls):
        css.append("list-style-type:" + ls)
    if css:
        attrs += f' style="{esc(";".join(css))}"'
    return f"<{tag}{attrs}>{inner}</{tag}>"


def text_html(s):
    """Plain-text glossaries (新明解, the accent dictionary): first line in bold, line breaks kept."""
    lines = [l.rstrip() for l in s.strip("\n").split("\n")]
    if not lines:
        return ""
    return "<b>" + esc(lines[0].strip()) + "</b>" + "".join("<br>" + esc(l) for l in lines[1:])


def glossary_html(g):
    parts = []
    for item in g or []:
        parts.append(text_html(item) if isinstance(item, str) else sc_html(item))
    return "<br>".join(p for p in parts if p)


def accent_html(g):
    """The accent dictionary: keep the pitch lines (ハシ↓ [2]) and example lines, drop the header and the source."""
    out = []
    for item in g or []:
        if not isinstance(item, str):
            continue
        for l in item.split("\n"):
            l = l.strip()
            if not l or l.startswith("【") or l.startswith("出典") or re.match(r"^\S+｛", l):
                continue
            out.append(esc(l))
    return "<br>".join(out)


class Yomi:
    def __init__(self, path=DB):
        self.db = sqlite3.connect(path)
        self.dicts = {i: (t, o) for i, t, o in self.db.execute("SELECT id, title, ord FROM dicts")}
        order = sorted(self.dicts, key=lambda i: (self.dicts[i][1], i))
        self.rank = {d: k for k, d in enumerate(order)}          # dictionary id → position shown in the app
        self.titles = [self.dicts[d][0] for d in order]
        self.kind = {d: ("accent" if "アクセント" in t else "names" if "JMnedict" in t else "kanji" if "KANJIDIC" in t else "terms")
                     for d, (t, _) in self.dicts.items()}

    def lookup(self, base, reading, pos):
        """Entries for one word, as [[position, html], …] in the user's order, plus its accents from the accent dictionary."""
        rh = kata2hira(reading)
        rows = self.db.execute("SELECT d, r, tags, score, g FROM terms WHERE e = ?", (base,)).fetchall()
        by = {}
        for d, r, tags, score, g in rows:
            kind = self.kind.get(d)
            if kind == "kanji" or (kind == "names") != (pos == "pn"):
                continue
            g = json.loads(g)
            if kind == "names":     # JMnedict: the readings are the glossary
                if rh and not any(kata2hira(x) == rh for x in g if isinstance(x, str)):
                    continue
            elif r and rh and kata2hira(r) != rh:
                continue
            by.setdefault(d, []).append((score, tags, g))
        out, accents = [], []
        for d in sorted(by, key=lambda d: self.rank[d]):
            ents = sorted(by[d], key=lambda x: -x[0])[:MAX_PER_DICT]
            kind = self.kind[d]
            if kind == "accent":
                for _, _, g in ents:
                    for item in g:
                        if isinstance(item, str):
                            accents += [int(n) for n in re.findall(r"\[(\d+)\]", item)]
                body = "<br>".join(accent_html(g) for _, _, g in ents)
            elif kind == "names":
                body = "<br>".join(f"{esc(tags)}：{esc('・'.join(x for x in g if isinstance(x, str)))}" for _, tags, g in ents)
            else:
                body = "<hr>".join(glossary_html(g) for _, _, g in ents)
            if body:
                out.append([self.rank[d], body[:MAX_HTML]])
        # frequency and pitch dictionaries (Yomitan "termMeta")
        meta = {}
        for d, mode, data in self.db.execute("SELECT d, mode, data FROM meta WHERE e = ?", (base,)):
            data = json.loads(data)
            r = data.get("reading") if isinstance(data, dict) else None
            if r and rh and kata2hira(r) != rh:
                continue
            if mode == "freq":
                val = data.get("frequency", data) if isinstance(data, dict) and "reading" in data else data
                if isinstance(val, dict):
                    val = val.get("displayValue") or val.get("value")
                if val is not None:
                    meta.setdefault(d, []).append(f"{esc(val)}")
            elif mode == "pitch" and isinstance(data, dict):
                pos = [p["position"] for p in data.get("pitches", []) if isinstance(p, dict) and isinstance(p.get("position"), int)]
                accents += pos
                if pos:
                    meta.setdefault(d, []).append("・".join(f"[{p}]" for p in pos))
        for d, vals in meta.items():
            label = "頻度：" if "freq" in self.dicts[d][0].lower() or "頻度" in self.dicts[d][0] else ""
            out.append([self.rank[d], label + " / ".join(dict.fromkeys(vals))])
        out.sort(key=lambda x: x[0])
        return out, list(dict.fromkeys(accents))

    def short_ja(self, base, reading):
        """First definition of the word in a Japanese monolingual dictionary (新明解), in one short line."""
        rh = kata2hira(reading)
        mono = [d for d, (t, _) in self.dicts.items() if "新明解" in t or "国語" in t]
        for d in sorted(mono, key=lambda d: self.rank[d]):
            for r, g in self.db.execute("SELECT r, g FROM terms WHERE e = ? AND d = ? ORDER BY score DESC", (base, d)):
                if r and rh and kata2hira(r) != rh:
                    continue
                for item in json.loads(g):
                    if not isinstance(item, str):
                        continue
                    for l in item.split("\n")[1:]:
                        l = l.strip()
                        if l.startswith("「") and l.endswith("」"):      # example line
                            continue
                        # drop sense numbers and leading notes: （一） [一] 〈どこニ―〉 〔伝説の中で〕
                        l = re.sub(r"^(?:（[一二三四五六七八九十]+）|\[[一二三四五六七八九十]+\]|〈[^〉]*〉|〔[^〕]*〕|\s)+", "", l)
                        l = re.sub(r"\s*\[⇒.*$", "", l)      # cross-reference at the end
                        if not l or l.startswith(("[", "―")) or re.fullmatch(r"（[^）]*）", l):
                            continue
                        return l if len(l) <= 90 else l[:89] + "…"
        return ""

    def kanji(self, c):
        row = self.db.execute("SELECT onyomi, kunyomi, m, st FROM kanji WHERE c = ?", (c,)).fetchone()
        if not row:
            return None
        on, kun, m, st = row
        st = json.loads(st)
        return [on, kun, json.loads(m), st.get("jlpt", ""), st.get("strokes", ""), st.get("grade", "")]


def open_yomi():
    return Yomi() if os.path.exists(DB) else None


def enrich(vocab, out_dir):
    """Adds the Yomitan dictionaries to an episode: writes dict.json next to episode.json and, where the
    accent dictionary knows the word, uses its accent. Does nothing if dicts.sqlite doesn't exist."""
    y = open_yomi()
    path = os.path.join(out_dir, "dict.json")
    if not y:
        if os.path.exists(path):
            os.remove(path)
        return
    words, kanji = {}, {}
    for key, v in vocab.items():
        ent, acc = y.lookup(key, v.get("r", ""), v.get("p", ""))
        if ent:
            words[key] = ent
        ja = y.short_ja(key, v.get("r", ""))
        if ja and v.get("p") != "pn":
            v["ja"] = ja        # short Japanese definition for the Anki card and the word cards
        if acc and v.get("p") != "pn":
            v["a"] = acc[0]
            if len(acc) > 1:
                v["aa"] = acc
        km = []
        for c in key:
            if "一" <= c <= "鿿":
                if c not in kanji:
                    k = y.kanji(c)
                    if k:
                        kanji[c] = k
                if kanji.get(c) and kanji[c][2]:
                    km.append(f"{c}：{'、'.join(kanji[c][2][:2])}")
        if km and v.get("p") != "pn":
            v["km"] = "　".join(km)     # meaning of each kanji (KANJIDIC), for the Anki card
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"d": y.titles, "w": words, "k": kanji}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  diccionarios: {len(words)} palabras, {len(kanji)} kanji ({os.path.getsize(path) / 2**20:.1f} MB)")


if __name__ == "__main__":   # quick check: python yomi.py 橋 はし n
    import sys
    y = Yomi()
    print(y.titles)
    ent, acc = y.lookup(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "n")
    print("accents:", acc)
    for pos, body in ent:
        print("==", y.titles[pos]); print(body[:800])
    for c in sys.argv[1]:
        print(c, y.kanji(c))
