# -*- coding: utf-8 -*-
"""Grammar pattern detection for the analysed sentences.

Each pattern is matched against a "token string" with the format
  " surface/lemma/pos1-pos2/form"  (one block per word)
e.g.  " 言っ/言う/動詞-一般/連用形 て/て/助詞-接続助詞/* いる/居る/動詞-非自立可能/終止形"
or, if the pattern starts with 'T:', against the plain text without spaces.
"""
TE = r"/て/助詞-接続助詞/\S*"
W = r" \S+"          # any token
S = r" [^/ ]+"       # any surface form (followed by /...)

def tokstr(toks_feats):
    return "".join(f" {s}/{l}/{p}/{c}" for s, l, p, c in toks_feats)

# The full list (JLPT N5–N1) is in grammar_jlpt.py.
from grammar_jlpt import GRAMMAR
BY_ID = {x["id"]: x for x in GRAMMAR}
PATTERNS = [(x["id"], x["label"], (x["pat"][2:] if x["pat"].startswith("K:") else "T:" + x["pat"]), x["q"], x["ex"])
            for x in GRAMMAR if x["pat"]]
