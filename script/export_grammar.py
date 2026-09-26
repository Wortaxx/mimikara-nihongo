# Generates app/grammar_ja.js from grammar_jlpt.py (the app needs the full list).
import json, sys, os
from grammar_jlpt import GRAMMAR
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "app", "grammar_ja.js")
data = {g["id"]: [g["label"], g["q"], g["ex"], g["lv"], g["im"] or "", 1 if g["basic"] else 0, 1 if g["pat"] else 0] for g in GRAMMAR}
with open(out, "w", encoding="utf-8") as f:
    f.write("'use strict';\n// JLPT N5〜N1 文法（id → [見出し, 短い答え, 説明, レベル, IMABIのページ, 基本, 自動検出]）\n")
    f.write("// grammar_jlpt.py から export_grammar.py で自動生成。\n")
    f.write("window.GRAMMAR_JA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(out, len(data), os.path.getsize(out) // 1024, "KB")
