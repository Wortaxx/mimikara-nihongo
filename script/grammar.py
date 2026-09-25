# -*- coding: utf-8 -*-
"""Patrones gramaticales frecuentes en anime, con explicación en español.

Cada patrón se busca sobre una "cadena de tokens" con el formato
  " superficie/lema/pos1-pos2/forma"  (un bloque por palabra)
p. ej.  " 言っ/言う/動詞-一般/連用形 て/て/助詞-接続助詞/* いる/居る/動詞-非自立可能/終止形"
o, si el patrón empieza por 'T:', sobre el texto plano sin espacios.
"""
TE = r"/て/助詞-接続助詞/\S*"
W = r" \S+"          # cualquier token
S = r" [^/ ]+"       # superficie cualquiera (seguida de /...)

def tokstr(toks_feats):
    return "".join(f" {s}/{l}/{p}/{c}" for s, l, p, c in toks_feats)

# La lista completa (JLPT N5–N1) está en grammar_jlpt.py.
from grammar_jlpt import GRAMMAR
BY_ID = {x["id"]: x for x in GRAMMAR}
PATTERNS = [(x["id"], x["label"], (x["pat"][2:] if x["pat"].startswith("K:") else "T:" + x["pat"]), x["q"], x["ex"])
            for x in GRAMMAR if x["pat"]]
