// Análisis de audio para shadowing: decodificación, detección de voz, tono (YIN) y puntuación.
'use strict';
const SR = 16000, HOP = 160, WIN = 640; // 10 ms de salto, 40 ms de ventana

let _actx = null;
function actx() { if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)(); return _actx; }

async function decodeMono16k(blob) {
  const buf = await blob.arrayBuffer();
  const ab = await actx().decodeAudioData(buf.slice(0));
  const len = Math.max(1, Math.ceil(ab.duration * SR));
  const off = new OfflineAudioContext(1, len, SR);
  const src = off.createBufferSource(); src.buffer = ab; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return out.getChannelData(0).slice();
}

function frameRms(x) {
  const n = Math.max(0, Math.floor((x.length - WIN) / HOP) + 1), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const o = i * HOP; for (let j = 0; j < WIN; j++) { const v = x[o + j]; s += v * v; } r[i] = Math.sqrt(s / WIN); }
  return r;
}

// Recorta silencio inicial y final. Devuelve {a,b} en tramas.
function activeRange(rms, relThr = 0.06) {
  let peak = 0; for (const v of rms) if (v > peak) peak = v;
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] || 0;
  const thr = Math.max(peak * relThr, floor * 2.5, 0.004);
  let a = 0, b = rms.length - 1;
  while (a < rms.length && rms[a] < thr) a++;
  while (b > a && rms[b] < thr) b--;
  return { a, b, thr };
}

// YIN simplificado por trama. Devuelve Hz o 0 (sordo).
function yinPitch(x, rms, thr) {
  const n = rms.length, f0 = new Float32Array(n);
  const tauMin = Math.floor(SR / 450), tauMax = Math.floor(SR / 70);
  const d = new Float32Array(tauMax + 1);
  for (let i = 0; i < n; i++) {
    if (rms[i] < thr) continue;
    const o = i * HOP, W = WIN - tauMax > 200 ? WIN - tauMax : 400;
    if (o + W + tauMax >= x.length) continue;
    for (let t = 1; t <= tauMax; t++) { let s = 0; for (let j = 0; j < W; j++) { const v = x[o + j] - x[o + j + t]; s += v * v; } d[t] = s; }
    let run = 0, best = -1;
    for (let t = 1; t <= tauMax; t++) {
      run += d[t]; const c = d[t] * t / (run || 1);
      if (t >= tauMin && c < 0.15) { // primer mínimo bajo el umbral
        while (t + 1 <= tauMax) { const run2 = run + d[t + 1]; const c2 = d[t + 1] * (t + 1) / run2; if (c2 < c) { run = run2; t++; } else break; }
        best = t; break;
      }
    }
    if (best > 0) f0[i] = SR / best;
  }
  return f0;
}

function median(a) { if (!a.length) return 0; const s = Array.from(a).sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; }

// Contorno en semitonos respecto a la mediana del hablante, con filtro de mediana.
function contour(f0) {
  const n = f0.length, st = new Float32Array(n).fill(NaN);
  const voiced = [];
  for (let i = 0; i < n; i++) if (f0[i] > 0) { st[i] = 12 * Math.log2(f0[i] / 100); voiced.push(st[i]); }
  const m = median(voiced);
  const out = new Float32Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isNaN(st[i])) continue;
    const w = []; for (let k = -2; k <= 2; k++) { const v = st[i + k]; if (v !== undefined && !isNaN(v)) w.push(v); }
    const v = median(w) - m;
    out[i] = Math.max(-12, Math.min(12, v));
  }
  // quita saltos de octava aislados
  for (let i = 1; i < n - 1; i++) if (!isNaN(out[i]) && Math.abs(out[i]) > 9) out[i] = NaN;
  return out;
}

// Pausas: tramos de energía baja >= 150 ms dentro de la zona activa. Posición normalizada 0..1.
function pauses(rms, a, b, thr) {
  const res = []; let run = 0, start = 0;
  for (let i = a; i <= b; i++) {
    if (rms[i] < thr * 1.2) { if (!run) start = i; run++; }
    else { if (run >= 15) res.push(((start + run / 2) - a) / Math.max(1, b - a)); run = 0; }
  }
  return res;
}

async function analyze(blob, fromMs, toMs) {
  let x = await decodeMono16k(blob);
  if (fromMs != null) {
    const s = Math.max(0, Math.floor((fromMs - 150) / 1000 * SR)), e = Math.min(x.length, Math.ceil((toMs + 250) / 1000 * SR));
    x = x.slice(s, Math.max(s + WIN * 2, e));
  }
  const rms = frameRms(x);
  const { a, b, thr } = activeRange(rms);
  const f0 = yinPitch(x, rms, thr);
  const ct = contour(f0);
  const logE = Array.from(rms, v => Math.log(v + 1e-4));
  return { a, b, thr, rms, ct, logE, dur: (b - a) * HOP / SR, pauses: pauses(rms, a, b, thr), frames: rms.length };
}

// Remuestrea la zona activa a N puntos.
function resample(arr, a, b, N) {
  const out = new Float32Array(N);
  for (let k = 0; k < N; k++) { const i = Math.round(a + (b - a) * k / (N - 1)); out[k] = arr[Math.min(arr.length - 1, Math.max(0, i))]; }
  return out;
}

function zs(a) { let m = 0, c = 0; for (const v of a) if (!isNaN(v)) { m += v; c++; } m /= c || 1; let s = 0; for (const v of a) if (!isNaN(v)) s += (v - m) ** 2; s = Math.sqrt(s / (c || 1)) || 1; return Array.from(a, v => (v - m) / s); }

// DTW con banda sobre envolvente de energía (+tono) para alinear ritmos distintos.
function dtw(A, B, band = 0.2) {
  const n = A.length, m = B.length, W = Math.max(Math.ceil(Math.max(n, m) * band), Math.abs(n - m) + 2);
  const INF = 1e18, D = new Float64Array((n + 1) * (m + 1)).fill(INF); D[0] = 0;
  const idx = (i, j) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) {
    const j0 = Math.max(1, Math.round(i * m / n) - W), j1 = Math.min(m, Math.round(i * m / n) + W);
    for (let j = j0; j <= j1; j++) {
      const c = Math.abs(A[i - 1] - B[j - 1]);
      D[idx(i, j)] = c + Math.min(D[idx(i - 1, j)], D[idx(i, j - 1)], D[idx(i - 1, j - 1)]);
    }
  }
  const path = []; let i = n, j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const a = D[idx(i - 1, j - 1)], b = D[idx(i - 1, j)], c = D[idx(i, j - 1)];
    if (a <= b && a <= c) { i--; j--; } else if (b <= c) i--; else j--;
  }
  return path.reverse();
}

function pearson(x, y) {
  const n = x.length; if (n < 3) return 0;
  let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n;
  let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sx += a * a; sy += b * b; }
  return sxy / (Math.sqrt(sx * sy) || 1);
}
function stdv(a) { const m = a.reduce((p, q) => p + q, 0) / (a.length || 1); return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (a.length || 1)); }
const clamp01 = v => Math.max(0, Math.min(1, v));

// Compara original (o) y usuario (u). Devuelve puntuaciones y consejos.
function compareShadow(o, u) {
  const N = 150;
  if (u.b - u.a < 20) return { error: '声が聞こえませんでした。マイクに近づいて、もう一度どうぞ。' };
  const oc = resample(o.ct, o.a, o.b, N), uc = resample(u.ct, u.a, u.b, N);
  const oe = zs(resample(Float32Array.from(o.logE), o.a, o.b, N)), ue = zs(resample(Float32Array.from(u.logE), u.a, u.b, N));
  const feat = (e, c) => e.map((v, k) => v + (isNaN(c[k]) ? -0.5 : 0.5));
  const path = dtw(feat(oe, oc), feat(ue, uc));
  const px = [], py = [];
  for (const [i, j] of path) if (!isNaN(oc[i]) && !isNaN(uc[j])) { px.push(oc[i]); py.push(uc[j]); }
  const tips = [];
  // Entonación
  let into = null;
  if (px.length >= 12) {
    const md = px.reduce((s, v, k) => s + Math.abs(v - py[k]), 0) / px.length;
    const r = pearson(px, py);
    into = Math.round(100 * (0.45 * clamp01(1 - md / 5) + 0.55 * clamp01((r + 0.1) / 0.9)));
    const so = stdv(px), su = stdv(py);
    if (su < so * 0.55 && so > 1) tips.push('イントネーションが平らです。上がり下がりをもっとはっきりさせましょう。');
    else if (su > so * 1.8 && su > 2) tips.push('イントネーションが大げさです。元の音声はもっと平らです。');
    // final de frase
    const tail = k => { const n = k.length, s = Math.floor(n * 0.75); const a = k.slice(s); return a.length > 3 ? a[a.length - 1] - a[0] : 0; };
    const oT = tail(px), uT = tail(py);
    if (oT < -1.5 && uT > 1) tips.push('文の終わりで上がっていますが、元の音声は下がっています。');
    else if (oT > 1.5 && uT < -1) tips.push('文の終わりで元の音声は上がっています（質問・強調）が、あなたは下がっています。');
  } else tips.push('音の高さをうまく測れませんでした（声が小さいか、元の音声のBGMが大きいです）。');
  // Ritmo
  const ratio = u.dur / Math.max(0.2, o.dur);
  const durS = Math.exp(-2.2 * Math.abs(Math.log(ratio)));
  let pauseS = 1, missed = [];
  if (o.pauses.length || u.pauses.length) {
    let hit = 0;
    for (const p of o.pauses) { if (u.pauses.some(q => Math.abs(q - p) < 0.1)) hit++; else missed.push(p); }
    const extra = u.pauses.filter(q => !o.pauses.some(p => Math.abs(q - p) < 0.1)).length;
    pauseS = clamp01((hit + 0.5) / (o.pauses.length + extra + 0.5));
  }
  const rit = Math.round(100 * (0.65 * durS + 0.35 * pauseS));
  const pct = Math.round(Math.abs(ratio - 1) * 100);
  if (ratio < 0.85) tips.push(`元の音声より約${pct}％速いです。`);
  else if (ratio > 1.18) tips.push(`元の音声より約${pct}％遅いです。`);
  return { into, rit, missed, ratio, oc, uc, path, tips };
}

// ---------- Comparación de texto japonés (dictado y reconocimiento de voz) ----------
function kataToHira(s) { return s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)); }
function normJa(s) {
  return kataToHira((s || '').normalize('NFKC'))
    .replace(/[\s、。，．,.!！?？…‥・「」『』（）()〜~～♪\-―—:：;；"'“”]/g, '')
    .toLowerCase();
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) { cur[0] = i; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); [prev, cur] = [cur, prev]; }
  return prev[n];
}
// tokens: [{s, r, p}] ; alinea la entrada con los tokens aceptando kanji o lectura en kana.
function alignJa(tokens, input) {
  const inp = normJa(input);
  const T = tokens.map((t, i) => ({ i, forms: [...new Set([normJa(t.s), normJa(t.r || ''), ...(t.f ? [t.f.map(x => x[1] ? x[1] : x[0]).join('')].map(normJa) : [])].filter(Boolean))], opt: t.p === 'sym' || !normJa(t.s) }))
    .filter(t => t.forms.length || t.opt);
  const n = T.length, m = inp.length, INF = 1e9;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  const bk = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  for (let j = 0; j <= m; j++) dp[0][j] = j; // caracteres sobrantes al principio
  for (let k = 1; k <= n; k++) {
    const t = T[k - 1], L = t.forms.length ? Math.min(...t.forms.map(f => f.length)) : 0, Lmax = t.forms.length ? Math.max(...t.forms.map(f => f.length)) : 0;
    for (let j = 0; j <= m; j++) {
      if (dp[k - 1][j] >= INF) continue;
      // saltar token
      const skipC = t.opt ? 0 : L;
      if (dp[k - 1][j] + skipC < dp[k][j]) { dp[k][j] = dp[k - 1][j] + skipC; bk[k][j] = [j, skipC, '']; }
      if (t.opt) continue;
      for (let e = j + 1; e <= Math.min(m, j + Lmax + 3); e++) {
        const sub = inp.slice(j, e);
        let c = INF; for (const f of t.forms) c = Math.min(c, lev(f, sub));
        if (dp[k - 1][j] + c < dp[k][e]) { dp[k][e] = dp[k - 1][j] + c; bk[k][e] = [j, c, sub]; }
      }
    }
  }
  // caracteres sobrantes al final
  let bestJ = 0, best = INF; for (let j = 0; j <= m; j++) { const c = dp[n][j] + (m - j); if (c < best) { best = c; bestJ = j; } }
  const status = {}; let j = bestJ;
  for (let k = n; k >= 1; k--) { const b = bk[k][j]; if (!b) break; const t = T[k - 1]; status[t.i] = t.opt ? 'opt' : (b[1] === 0 ? 'ok' : (b[2] && b[1] <= Math.max(1, Math.floor(Math.min(...t.forms.map(f => f.length)) / 3)) ? 'close' : 'bad')); j = b[0]; }
  const total = T.filter(t => !t.opt).reduce((s, t) => s + Math.min(...t.forms.map(f => f.length)), 0) || 1;
  const score = Math.max(0, 1 - best / total);
  return { score, status, input: inp };
}

window.JA = { analyze, compareShadow, alignJa, normJa, kataToHira, lev };
