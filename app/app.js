'use strict';
/* 耳から日本語 — アニメのクリップで日本語を勉強するアプリ。データはすべてスマホの中（IndexedDB）に保存。 */

// ================= 保存 =================
const DB_NAME = 'animejp', DB_VER = 1;
let _db;
function idb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('eps')) d.createObjectStore('eps', { keyPath: 'ep' });
      if (!d.objectStoreNames.contains('clips')) d.createObjectStore('clips');
      if (!d.objectStoreNames.contains('prog')) d.createObjectStore('prog', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    let out; Promise.resolve(fn(s)).then(v => out = v);
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const dbGet = (store, key) => tx(store, 'readonly', s => reqP(s.get(key)));
const dbAll = store => tx(store, 'readonly', s => reqP(s.getAll()));
const dbPut = (store, val, key) => tx(store, 'readwrite', s => { key === undefined ? s.put(val) : s.put(val, key); });

// ================= 状態 =================
const S = {
  eps: {}, lines: [], prog: {}, grammar: {}, known: new Set(), days: {}, thumbs: {}, ankiQ: new Set(), ankiDone: new Set(), vprog: {}, kstat: {},
  settings: { video: true, rate: 1, eps: [], lv: [1, 2, 3], short: false, theme: 'auto', roundLen: 10, goal: 20, glv: ['N5', 'N4', 'N3', 'N2', 'N1'], furi: false },
};
const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
function toast(msg, ms = 2200) { document.querySelectorAll('.toast').forEach(t => t.remove()); const t = h('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), ms); }
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const I = (p, fill) => `<svg viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${p}</svg>`;
const ICON = {
  play: I('<path d="M8 5v14l11-7z"/>', 1),
  replay: I('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  slow: I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>'),
  eye: I('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  mic: I('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>'),
  stop: I('<rect x="6" y="6" width="12" height="12" rx="2"/>', 1),
  shuffle: I('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  pen: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  blank: I('<rect x="3" y="7" width="7" height="10" rx="2"/><path d="M14 17h7"/>'),
  sort: I('<rect x="3" y="4" width="8" height="6" rx="1.5"/><rect x="13" y="14" width="8" height="6" rx="1.5"/><path d="M15 7h4v4M9 17H5v-4"/>'),
  ear: I('<path d="M6 8.5a6 6 0 1 1 12 0c0 3-2 4-3 5.5s-1 3.5-3.5 3.5A2.5 2.5 0 0 1 9 15"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0"/>'),
  gram: I('<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="16" r="3"/>'),
  book: I('<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>'),
  cards: I('<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>'),
  flame: I('<path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 11 11c0-4 1-9 1-9z"/>', 1),
  check: I('<path d="M20 6L9 17l-5-5"/>'),
  x: I('<path d="M18 6L6 18M6 6l12 12"/>'),
  minus: I('<path d="M5 12h14"/>'),
  headphones: I('<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>'),
  download: I('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
};

// ================= 読み込み =================
async function loadAll() {
  const eps = await dbAll('eps');
  S.eps = {}; S.lines = []; S.grammar = {};
  eps.sort((a, b) => a.ep.localeCompare(b.ep));
  for (const e of eps) {
    S.eps[e.ep] = e;
    Object.assign(S.grammar, e.grammar || {});
    for (const l of e.lines) { l.ep = e.ep; S.lines.push(l); }
  }
  Object.assign(S.grammar, window.GRAMMAR_JA || {});
  S.prog = {}; for (const p of await dbAll('prog')) S.prog[p.id] = p;
  const st = await dbGet('kv', 'settings'); if (st) Object.assign(S.settings, st);
  S.settings.eps = (S.settings.eps || []).filter(e => S.eps[e]);
  if (!Array.isArray(S.settings.glv) || !S.settings.glv.length) S.settings.glv = LEVELS.slice();
  S.known = new Set((await dbGet('kv', 'known')) || []);
  S.days = (await dbGet('kv', 'days')) || {};
  S.thumbs = (await dbGet('kv', 'thumbs')) || {};
  S.ankiQ = new Set((await dbGet('kv', 'ankiq')) || []);
  S.ankiDone = new Set((await dbGet('kv', 'ankidone')) || []);
  S.vprog = (await dbGet('kv', 'vprog')) || {};
  S.kstat = (await dbGet('kv', 'kstat')) || {};
  buildReadingMap();
  applyTheme();
}
const saveSettings = () => dbPut('kv', S.settings, 'settings');
const saveKnown = () => dbPut('kv', [...S.known], 'known');
function applyTheme() { const t = S.settings.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }

// 音声認識の結果をかなにするための「表記→読み」表
let READMAP = new Map(), READMAX = 1;
function buildReadingMap() {
  READMAP = new Map();
  for (const l of S.lines) for (const t of l.tk) if (t.r && /[一-鿿]/.test(t.s)) { READMAP.set(t.s, t.r); READMAX = Math.max(READMAX, t.s.length); }
  for (const e of Object.values(S.eps)) for (const [b, v] of Object.entries(e.vocab || {})) if (v.r && /[一-鿿]/.test(b) && !READMAP.has(b)) { READMAP.set(b, v.r); READMAX = Math.max(READMAX, b.length); }
}
function toKana(text) {
  let out = '', i = 0;
  while (i < text.length) {
    let done = false;
    for (let L = Math.min(READMAX, text.length - i); L >= 1; L--) { const seg = text.substr(i, L); if (READMAP.has(seg)) { out += READMAP.get(seg); i += L; done = true; break; } }
    if (!done) { out += text[i]; i++; }
  }
  return JA.kataToHira(out);
}
const lineKana = l => l.tk.map(t => t.r || JA.kataToHira(t.s)).join('');

// ================= インポート =================
async function importZip(file, onStatus, kind) {
  onStatus('ファイルを読み込み中…');
  const buf = new Uint8Array(await file.arrayBuffer());
  let files;
  try { files = fflate.unzipSync(buf); } catch (e) { throw new Error('正しい .zip ファイルではありません。'); }
  const jsonName = Object.keys(files).find(n => n.endsWith('episode.json'));
  if (!jsonName) throw new Error('.zip の中に episode.json がありません。');
  const ep = JSON.parse(new TextDecoder().decode(files[jsonName]));
  if (kind && epType(ep) !== kind) throw new Error(epType(ep) === 'book' ? 'これはオーディオブックの .zip です。「オーディオブック」から読み込んでください。' : 'これはアニメの .zip です。「アニメ」から読み込んでください。');
  const clipNames = Object.keys(files).filter(n => /clips\/.+\.(mp4|m4a|webm|ogg)$/.test(n));
  let n = 0;
  const d = await idb();
  for (let i = 0; i < clipNames.length; i += 25) {
    await new Promise((res, rej) => {
      const t = d.transaction('clips', 'readwrite'), s = t.objectStore('clips');
      for (const name of clipNames.slice(i, i + 25)) {
        const id = name.split('/').pop().replace(/\.\w+$/, '');
        const type = name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.m4a') ? 'audio/mp4' : name.endsWith('.webm') ? 'video/webm' : 'audio/ogg';
        s.put(new Blob([files[name]], { type }), id); n++;
      }
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
    onStatus(`クリップを保存中… ${n}/${clipNames.length}`);
  }
  await dbPut('eps', ep);
  delete S.thumbs[ep.ep]; await dbPut('kv', S.thumbs, 'thumbs');
  return { ep: ep.ep, lines: ep.lines.length, clips: n };
}
async function deleteEpisode(epId) {
  const ep = S.eps[epId]; if (!ep) return;
  await tx('clips', 'readwrite', s => { for (const l of ep.lines) s.delete(l.id); });
  await tx('eps', 'readwrite', s => { s.delete(epId); });
  delete S.thumbs[epId]; await dbPut('kv', S.thumbs, 'thumbs');
}

// エピソードのサムネイル（クリップの1コマ）
const thumbBusy = new Set();
async function makeThumb(epId) {
  if (epType(S.eps[epId]) === 'book') return null;
  if (S.thumbs[epId] || thumbBusy.has(epId)) return S.thumbs[epId];
  thumbBusy.add(epId);
  try {
    const ep = S.eps[epId]; const l = ep.lines[Math.floor(ep.lines.length * 0.4)];
    const b = await dbGet('clips', l.id); if (!b) return null;
    const url = URL.createObjectURL(b);
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const data = await new Promise(res => {
      const to = setTimeout(() => res(null), 6000);
      v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
      v.onseeked = () => {
        try { const c = document.createElement('canvas'); c.width = 320; c.height = 180; c.getContext('2d').drawImage(v, 0, 0, 320, 180); clearTimeout(to); res(c.toDataURL('image/jpeg', 0.7)); }
        catch (e) { clearTimeout(to); res(null); }
      };
      v.onerror = () => { clearTimeout(to); res(null); };
    });
    URL.revokeObjectURL(url);
    if (data) { S.thumbs[epId] = data; await dbPut('kv', S.thumbs, 'thumbs'); }
    return data;
  } finally { thumbBusy.delete(epId); }
}

// ================= 進み具合（かんたんな間隔反復） =================
const DAY = 864e5;
function grade(line, ok, kind) {
  const p = S.prog[line.id] || { id: line.id, seen: 0, ok: 0, fail: 0, ivl: 0, due: 0, kinds: {} };
  p.seen++; p.last = Date.now(); p.kinds[kind] = (p.kinds[kind] || 0) + 1;
  if (ok === true) { p.ok++; p.ivl = p.ivl ? Math.min(p.ivl * 2.5, 120) : 1; p.due = Date.now() + p.ivl * DAY; }
  else if (ok === false) { p.fail++; p.ivl = 0; p.due = Date.now() + 10 * 60e3; }
  else { p.ivl = Math.max(0.5, p.ivl); p.due = Date.now() + p.ivl * DAY; }
  S.prog[line.id] = p; dbPut('prog', p);
  countPractice(kind, ok);
}
// 今日の数と、練習の種類ごとの正解数（記録画面のグラフ用）
function countPractice(kind, ok) {
  const d = today(); S.days[d] = (S.days[d] || 0) + 1; dbPut('kv', S.days, 'days');
  const k = S.kstat[kind] || (S.kstat[kind] = { ok: 0, mid: 0, bad: 0 });
  k[ok === true ? 'ok' : ok === false ? 'bad' : 'mid']++; dbPut('kv', S.kstat, 'kstat');
}
function streak() {
  let n = 0; const d = new Date();
  if (!S.days[today()]) d.setDate(d.getDate() - 1);
  for (; ;) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; if (S.days[k]) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}

// ================= 文の選び方 =================
const flatLen = l => l.t.replace(/[\s、。！？…～〜・「」（）!?]/g, '').length;
const isShort = l => flatLen(l) < 4;
const durOf = l => (l.en - l.st) / 1000;
const SEC = () => S.settings.section === 'book' ? 'book' : 'anime';
const epType = e => (e && e.type === 'book') ? 'book' : 'anime';
const isBook = l => epType(S.eps[l.ep]) === 'book';
const secEpIds = (sec = SEC()) => Object.keys(S.eps).filter(id => epType(S.eps[id]) === sec);
const secLines = (sec = SEC()) => S.lines.filter(l => epType(S.eps[l.ep]) === sec);
const selEps = () => { const ids = secEpIds(); const s = S.settings.eps.filter(e => ids.includes(e)); return s.length ? s : ids; };
function pool() {
  const eps = selEps();
  return S.lines.filter(l => eps.includes(l.ep) && S.settings.lv.includes(l.lv || 1) && (S.settings.short || !isShort(l)));
}
const CONTENT_P = ['v', 'adj', 'adjna', 'n', 'adv'];
const vocabOf = (l, t) => { const e = S.eps[l.ep]; return e && e.vocab && e.vocab[t.b]; };
const cleanForm = t => ['n', 'adv', 'adjna'].includes(t.p) || t.s === t.b; // 活用で形が変わった動詞（教わっ など）は選択肢にしない
const blankCands = l => l.tk.map((t, i) => [t, i]).filter(([t]) => CONTENT_P.includes(t.p) && cleanForm(t) && vocabOf(l, t)?.g?.length);
const ELIG = {
  dictado: l => flatLen(l) >= 2 && flatLen(l) <= 40,
  hueco: l => blankCands(l).length > 0 && l.tk.filter(t => t.p !== 'sp' && t.p !== 'sym').length >= 2,
  ordenar: l => l.ch && l.ch.length >= 3 && l.ch.length <= 9,
  oido: l => flatLen(l) >= 4,
  gramatica: l => l.gr && l.gr.some(g => gQuiz(g[0])),
  shadowing: l => durOf(l) >= 0.8 && durOf(l) <= 12 && flatLen(l) >= 3,
};
function weightOf(l) {
  const p = S.prog[l.id]; if (!p) return 1.5;
  let w = 1; if (p.due <= Date.now()) w += 3; w += Math.min(p.fail, 4) * 1.5; if (p.ivl >= 7) w *= 0.3; return w;
}
function pickLine(kind, avoid) {
  const c = pool().filter(ELIG[kind]).filter(l => !avoid.has(l.id));
  if (!c.length) return null;
  let tot = 0; const ws = c.map(l => (tot += weightOf(l)));
  const r = Math.random() * tot; return c[ws.findIndex(w => w >= r)];
}

// ================= 文の表示（ふりがなは設定でオン） =================
const furiHtml = t => t.f.map(([a, r]) => r ? `<ruby>${esc(a)}<rt>${esc(r)}</rt></ruby>` : esc(a)).join('');
function sentenceEl(l, opts = {}) {
  const el = h('div', { class: 'sentence' });
  l.tk.forEach((t, i) => {
    if (t.p === 'sp') { el.append('　'); return; }
    if (opts.blank === i) { el.append(h('span', { class: 'blank' }, opts.blankText || '？')); return; }
    const cls = ['w'];
    if (opts.hl && i >= opts.hl[0] && i <= opts.hl[1]) cls.push('g-hl');
    if (opts.status && opts.status[i]) cls.push('st-' + opts.status[i]);
    const s = S.settings.furi && t.f && t.f.some(x => x[1]) ? h('span', { class: cls.join(' '), html: furiHtml(t) }) : h('span', { class: cls.join(' ') }, t.s);
    if (opts.tap !== false && t.p !== 'sym') s.addEventListener('click', e => { e.stopPropagation(); wordSheet(l, t); });
    el.append(s);
  });
  return el;
}
const POS_JA = { n: '名詞', pron: '代名詞', v: '動詞', adj: 'い形容詞', adjna: 'な形容詞', adv: '副詞', adn: '連体詞', conj: '接続詞', int: '感動詞', prt: '助詞', aux: '助動詞', pre: '接頭辞', suf: '接尾辞', pn: '固有名詞' };
function sheet(content) {
  const bg = h('div', { class: 'sheet-bg', onclick: e => { if (e.target === bg) bg.remove(); } }, h('div', { class: 'sheet' }, h('div', { class: 'grip' }), content));
  document.body.append(bg); return bg;
}
function vocabEntry(base) { for (const e of Object.values(S.eps)) if (e.vocab && e.vocab[base]) return e.vocab[base]; return null; }
function wordSheet(l, t) { wordSheetBase(t.b || t.s, t, l); }
function wordSheetBase(base, t, l) {
  const v = (l && t && vocabOf(l, t)) || vocabEntry(base);
  const p = (t && t.p) || (v && v.p);
  const ex = S.lines.filter(x => x.tk.some(y => y.b === base));
  const count = S.lines.reduce((n, x) => n + x.tk.filter(y => y.b === base).length, 0);
  const canKnow = v && p !== 'pn' && p !== 'prt' && p !== 'aux';
  const kb = canKnow ? h('button', { class: 'kbtn' + (S.known.has(base) ? ' on' : ''), onclick: () => { toggleKnown(base); kb.classList.toggle('on', S.known.has(base)); kb.textContent = S.known.has(base) ? '✓ 覚えた' : '覚えた？'; } }, S.known.has(base) ? '✓ 覚えた' : '覚えた？') : null;
  const box = h('div', {},
    h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' }, h('div', { class: 'hw' }, base), kb),
    h('div', { class: 'rd' }, ['読み：' + ((v && v.r) || (t && t.r) || '―'), POS_JA[p] || ''].filter(Boolean).join('　・　')),
    t && t.b && t.b !== t.s ? h('div', { class: 'small muted' }, `この文では「${t.s}」`) : null,
    v && v.g && v.g.length ? h('ol', {}, v.g.map(g => h('li', {}, g))) :
      h('p', { class: 'muted' }, p === 'pn' ? '人や場所などの名前です。' : p === 'prt' || p === 'aux' ? '文法の言葉です。文の「文法」ボタンで説明を見られます。' : '辞書にのっていません。'),
    h('p', { class: 'small muted' }, `エピソードの中で ${count} 回。意味は JMdict（英語）より。`),
  );
  if (ex.length > 1 || (ex.length && !l)) {
    box.append(h('div', { class: 'section-title', style: 'margin-top:4px' }, '例文'));
    for (const x of ex.filter(x => x !== l).slice(0, 5)) {
      const pb = h('button', { class: 'iconbtn play', 'aria-label': '再生', html: ICON.play });
      pb.onclick = () => { const a = h('div'); pb.closest('.ex').after(a); a.append(playerEl(x)); pb.disabled = true; };
      box.append(h('div', { class: 'ex' }, pb, h('div', { style: 'flex:1' }, sentenceEl(x, { hl: [x.tk.findIndex(y => y.b === base), x.tk.findIndex(y => y.b === base)], tap: false }), x.es ? h('div', { class: 'small muted', style: 'font-family:system-ui' }, x.es) : null)));
    }
  }
  sheet(box);
}
function toggleKnown(base) { if (S.known.has(base)) S.known.delete(base); else S.known.add(base); saveKnown(); }
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const gLv = id => (S.grammar[id] && S.grammar[id][3]) || '';
const gBasic = id => !!(S.grammar[id] && S.grammar[id][5]);
const gQuiz = id => S.grammar[id] && !gBasic(id) && (!gLv(id) || S.settings.glv.includes(gLv(id)));
const lvRank = lv => LEVELS.indexOf(lv);
const imabiUrl = id => { const g = S.grammar[id]; if (g && g[4]) return 'https://imabi.org/' + g[4]; const core = ((g && g[0]) || '').replace(/[〜～（(].*$/, '').split(/[／/]/)[0].replace(/[〜～]/g, ''); return 'https://imabi.org/?s=' + encodeURIComponent(core); };
const lvBadge = lv => lv ? h('span', { class: 'lvb lv-' + lv }, lv) : null;
function linesWithGrammar(gid) { return S.lines.filter(l => l.gr && l.gr.some(g => g[0] === gid)); }
function grammarSheet(gid) {
  const g = S.grammar[gid]; if (!g) return;
  const ex = linesWithGrammar(gid);
  const box = h('div', {},
    h('div', { class: 'row', style: 'align-items:center;gap:10px' }, lvBadge(g[3]), h('div', { class: 'hw', style: 'font-size:24px' }, g[0])),
    h('p', { style: 'font-weight:700;margin:10px 0 6px' }, g[1]),
    h('p', { style: 'margin:0 0 12px' }, g[2]),
    h('a', { class: 'btn sm', href: imabiUrl(gid), target: '_blank', rel: 'noopener', html: ICON.book + `<span>${g[4] ? 'IMABIで詳しく読む' : 'IMABIで探す'}</span>` }),
    h('span', { class: 'small muted', style: 'margin-left:8px' }, '（ネット接続が必要・英語）'));
  box.append(h('div', { class: 'section-title', style: 'margin-top:16px' }, ex.length ? `エピソードの例文（${ex.length}）` : 'まだエピソードに出てきていません'));
  for (const x of ex.slice(0, 8)) {
    const gg = x.gr.find(y => y[0] === gid);
    const pb = h('button', { class: 'iconbtn play', 'aria-label': '再生', html: ICON.play });
    pb.onclick = () => { const a = h('div'); pb.closest('.ex').after(a); a.append(playerEl(x)); pb.disabled = true; };
    box.append(h('div', { class: 'ex' }, pb, h('div', { style: 'flex:1' }, sentenceEl(x, { hl: [gg[1], gg[2]], tap: false }), x.es ? h('div', { class: 'small muted', style: 'font-family:system-ui' }, x.es) : null)));
  }
  sheet(box);
}
const epLabel = ep => { const e = S.eps[ep]; if (e && e.type === 'book') return e.title || ep; const m = /S(\d+)E(\d+)/.exec(ep); return m ? `${+m[1]}期 第${+m[2]}話` : ep; };
const trLabel = l => (S.eps[l.ep] && S.eps[l.ep].tlang === 'en') ? '翻訳（英語）' : '翻訳';
const fmtTime = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function resultBlock(l, extra = {}) {
  const box = h('div', { class: 'card' });
  if (l.spk) box.append(h('div', { class: 'spk' }, l.spk));
  box.append(sentenceEl(l, { hl: extra.hl, status: extra.status }));
  if (l.es) box.append(h('div', { class: 'trans' }, h('span', { class: 'tag' }, trLabel(l)), l.es));
  if (l.gr && l.gr.length) {
    const seen = new Set();
    const gl = l.gr.filter(g => S.grammar[g[0]] && !gBasic(g[0]) && !seen.has(g[0]) && seen.add(g[0])).sort((a, b) => lvRank(gLv(b[0])) - lvRank(gLv(a[0])));
    if (gl.length) box.append(h('div', { class: 'gchips' }, gl.slice(0, 8).map(g => h('button', { class: 'gchip', onclick: () => grammarSheet(g[0]) }, lvBadge(gLv(g[0])), ' ', S.grammar[g[0]][0]))));
  }
  box.append(h('div', { class: 'meta-line' }, `${epLabel(l.ep)} ・ ${fmtTime(l.st)} ・ 言葉をタップすると意味が出ます`));
  box.append(h('div', { style: 'margin-top:10px' }, ankiBtn(l)));
  return box;
}

// Anki のカードの中身（.apkg と AnkiConnect で共通。anki.js のノートタイプと同じ）
const ANKI_MODEL = '耳から日本語（動画）';
const ANKI_OLD = 'フリーレン日本語'; // 名前を変える前の .apkg で作ったノートタイプ・デッキもそのまま使う
const ANKI_FIELDS = ['動画', '表の文', '文', '翻訳', '単語', '文法', '出典'];
const ankiDeck = (book, base = '耳から日本語') => `${base}::${book ? 'オーディオブック' : 'アニメ'}`;
const ankiOpt = () => S.settings.anki || (S.settings.anki = { text: false, fmt: 'video' });
const ankiClipName = l => l.id + (isBook(l) ? '.m4a' : '.mp4');
const ankiTags = l => [isBook(l) ? 'オーディオブック' : 'アニメ', l.ep];
function ankiFields(l, opt, name) {
  const words = l.tk.filter(t => CONTENT_P.includes(t.p) && vocabOf(l, t)?.g?.length).filter((t, i, a) => a.findIndex(x => x.b === t.b) === i)
    .map(t => { const v = vocabOf(l, t); return `<b>${esc(t.b)}</b>（${esc(v.r)}）：${esc(v.g[0])}`; }).join('<br>');
  const seenG = new Set();
  const gram = (l.gr || []).filter(g => S.grammar[g[0]] && !gBasic(g[0]) && !seenG.has(g[0]) && seenG.add(g[0])).map(g => `<b>${esc(gLv(g[0]))} ${esc(S.grammar[g[0]][0])}</b>：${esc(S.grammar[g[0]][1])}`).join('<br>');
  const media = !name ? '' : (isBook(l) || opt.fmt === 'sound') ? `[sound:${name}]` : `<video src="${name}" controls autoplay playsinline></video>`;
  return [media, opt.text ? esc(l.t) : '', esc(l.t), esc(l.es || ''), words, gram, `${epLabel(l.ep)}・${fmtTime(l.st)}`];
}

// AnkiConnect Android（スマホの中で動く AnkiDroid 用の AnkiConnect）に直接送る
const ANKI_URL = 'http://127.0.0.1:8765';
async function ankiConnect(action, params = {}) {
  let r;
  // Content-Type を text/plain のままにして、プリフライト（OPTIONS）を起こさない
  try { r = await fetch(ANKI_URL, { method: 'POST', body: JSON.stringify({ action, version: 6, params }) }); }
  catch (e) { throw new Error('AnkiConnect Android につながりません。アプリが起動しているか、CORS Host の設定を確認してください。'); }
  const j = await r.json().catch(() => { throw new Error('AnkiConnect Android の返事が読めません。'); });
  if (j && typeof j === 'object' && 'error' in j) { if (j.error) throw new Error(j.error); return j.result; }
  return j;
}
const blobB64 = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
const ANKI_READY = {}; // 一度確認できたデッキとノートタイプ（本／アニメ別）
async function ankiCheck(book) {
  if (ANKI_READY[book]) return ANKI_READY[book];
  const [models, decks] = await Promise.all([ankiConnect('modelNames'), ankiConnect('deckNames')]);
  const model = [ANKI_MODEL, ANKI_OLD + '（動画）'].find(m => models.includes(m));
  const deck = [ankiDeck(book), ankiDeck(book, ANKI_OLD)].find(d => decks.includes(d));
  if (!model || !deck) throw new Error(`AnkiDroid に「${ankiDeck(book)}」デッキがありません。先に「Anki」画面で .apkg を一度作って、AnkiDroid に読み込んでください。`);
  return (ANKI_READY[book] = { model, deck });
}
async function ankiSendLive(l) {
  const { model, deck } = await ankiCheck(isBook(l));
  const clip = await dbGet('clips', l.id);
  let name = '';
  if (clip) {
    const r = await ankiConnect('storeMediaFile', { filename: ankiClipName(l), data: await blobB64(clip) });
    name = typeof r === 'string' && r ? r : ankiClipName(l); // AnkiDroid はファイル名に数字を足すことがある
  }
  const vals = ankiFields(l, ankiOpt(), name);
  await ankiConnect('addNote', { note: { deckName: deck, modelName: model, fields: Object.fromEntries(ANKI_FIELDS.map((f, i) => [f, vals[i]])), tags: ankiTags(l), options: { allowDuplicate: true } } });
  S.ankiDone.add(l.id); S.ankiQ.delete(l.id); saveAnki(l.id);
}

// Anki に送る文を選ぶボタン
const saveAnki = id => { dbPut('kv', [...S.ankiQ], 'ankiq'); dbPut('kv', [...S.ankiDone], 'ankidone'); if (id) dispatchEvent(new CustomEvent('ankichange', { detail: id })); };
function ankiBtn(l, small = false) { // small: true＝アイコンだけ、'top'＝上のバー用の短いラベル
  const top = small === 'top'; if (top) small = false;
  const b = h('button', { class: 'ankib' + (small ? ' sm' : ''), 'aria-label': 'Anki に追加' });
  const live = () => S.settings.ankiLive;
  const draw = () => {
    const on = S.ankiQ.has(l.id), done = S.ankiDone.has(l.id);
    b.classList.toggle('on', on || (live() && done)); b.classList.toggle('done', done && !on && !live());
    b.innerHTML = (on || (live() && done) ? ICON.check : ICON.plus) + (small ? '' : `<span>${top ? 'Anki' :
      live() ? (done ? 'AnkiDroid に追加済み' : on ? '未送信（「Anki」画面から送る）' : 'Anki に追加')
        : on ? 'Anki に追加済み' : done ? 'Anki（書き出し済み）' : 'Anki に追加'}</span>`);
  };
  b.onclick = async e => {
    e.stopPropagation();
    if (!live()) { if (S.ankiQ.has(l.id)) S.ankiQ.delete(l.id); else { S.ankiQ.add(l.id); buzz(15); } saveAnki(l.id); draw(); return; }
    if (S.ankiDone.has(l.id)) { toast('この文はもう AnkiDroid に入っています。'); return; }
    b.disabled = true; b.innerHTML = '<span class="spinner"></span>' + (small ? '' : '<span>送信中…</span>');
    try { await ankiSendLive(l); buzz(15); toast('AnkiDroid に追加しました'); }
    catch (err) { S.ankiQ.add(l.id); saveAnki(l.id); toast('送れませんでした（あとで送れるように残しました）：' + err.message, 6000); }
    b.disabled = false; draw();
  };
  const sync = e => { if (!b.isConnected) removeEventListener('ankichange', sync); else if (e.detail === l.id) draw(); };
  addEventListener('ankichange', sync);
  draw(); return b;
}

// ================= プレーヤー =================
const urlCache = new Map();
async function clipUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const b = await dbGet('clips', id); if (!b) return null;
  const u = URL.createObjectURL(b); urlCache.set(id, u);
  if (urlCache.size > 40) { const [k, v] = urlCache.entries().next().value; URL.revokeObjectURL(v); urlCache.delete(k); }
  return u;
}
function playerEl(l, { autoplay = true, onended = null } = {}) {
  const vid = h('video', { playsinline: true, preload: 'auto' });
  const ld = h('div', { class: 'ld', html: '<span class="spinner"></span>' });
  if (S.thumbs[l.ep]) ld.style.backgroundImage = `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url(${S.thumbs[l.ep]})`;
  const book = isBook(l);
  const wrap = h('div', { class: 'player' + (book ? ' audio-only book' : S.settings.video ? '' : ' audio-only') }, vid, ld, h('div', { class: 'aud', html: ICON.headphones + `<span>${book ? esc(epLabel(l.ep)) : '音声のみ'}</span>` }));
  const rateBtn = h('button', { class: 'btn' + (S.settings.rate < 1 ? ' on' : ''), html: ICON.slow + '<span>ゆっくり</span>' });
  const vidBtn = h('button', { class: 'btn' + (S.settings.video ? ' on' : ''), html: ICON.eye + '<span>映像</span>' });
  const play = async () => { vid.playbackRate = S.settings.rate; vid.currentTime = 0; try { await vid.play(); } catch (e) { } };
  const replay = h('button', { class: 'btn', html: ICON.replay + '<span>もう一度</span>', onclick: play });
  rateBtn.onclick = () => { S.settings.rate = S.settings.rate < 1 ? 1 : 0.75; rateBtn.classList.toggle('on', S.settings.rate < 1); saveSettings(); play(); };
  vidBtn.onclick = () => { S.settings.video = !S.settings.video; vidBtn.classList.toggle('on', S.settings.video); wrap.classList.toggle('audio-only', !S.settings.video || book); saveSettings(); };
  wrap.addEventListener('click', play);
  if (onended) vid.addEventListener('ended', onended);
  const box = h('div', {}, wrap, h('div', { class: 'pcontrols' }, replay, rateBtn, book ? null : vidBtn));
  clipUrl(l.id).then(u => {
    if (!u) { wrap.replaceWith(h('div', { class: 'card muted' }, 'このエピソードのクリップがありません。')); return; }
    vid.src = u; vid.preservesPitch = true;
    vid.addEventListener('loadeddata', () => { wrap.classList.add('ready'); if (autoplay) play(); }, { once: true });
  });
  box.play = play; box.video = vid;
  return box;
}

// ================= 画面 =================
const app = () => $('#app');
let CLEANUP = [];
function topbar(title, { back = null, right = null } = {}) {
  return h('header', { class: 'top' },
    back ? h('button', { class: 'iconbtn', 'aria-label': '戻る', html: ICON.back, onclick: back === true ? () => go('home') : back }) : null,
    h('h1', { html: title }), right);
}
function actionbar(...btns) { const b = h('div', { class: 'actionbar' }, h('div', { class: 'in' }, ...btns)); return b; }
function go(view, arg) {
  CLEANUP.forEach(f => { try { f(); } catch (e) { } }); CLEANUP = [];
  window.scrollTo(0, 0); stopRecording(); document.querySelectorAll('.sheet-bg').forEach(x => x.remove());
  VIEWS[view](arg);
}

const MODES = [
  ['mezcla', 'ミックス練習', 'いろいろな練習をランダムに出します', ICON.shuffle, 1],
  ['dictado', '書き取り', '聞いて、文を書こう', ICON.pen, 2],
  ['hueco', '穴埋め', 'ぬけている言葉は？', ICON.blank, 3],
  ['ordenar', '並べ替え', 'ブロックを正しい順に', ICON.sort, 4],
  ['oido', '聞き取り', '聞こえた文をえらぼう', ICON.ear, 5],
  ['gramatica', '文法', 'この表現の意味は？', ICON.gram, 6],
  ['shadowing', 'シャドーイング', 'まねして話して、採点', ICON.mic, 7],
];
const TOOLS = [
  ['lector', '読む', 'エピソードを一行ずつ', ICON.book, 8],
  ['vocab', '単語帳', '出てきた言葉の一覧', ICON.cards, 1],
  ['glist', '文法リスト', 'JLPT N5〜N1 の文法', ICON.gram, 4],
  ['anki', 'Anki', '選んだ文をカードに', ICON.download, 3],
];
function ringSvg(frac, color, stroke = 10) {
  const r = 45, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="${stroke}"/><circle cx="52" cy="52" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c * f} ${c}" ${f <= 0 ? 'opacity="0"' : ''}/></svg>`;
}

function sectionTabs() {
  const mk = (k, t, ic) => h('button', { class: 'seg' + (SEC() === k ? ' on' : ''), html: ic + `<span>${t}</span>`, onclick: () => { S.settings.section = k; saveSettings(); go('home'); } });
  return h('div', { class: 'segs' }, mk('anime', 'アニメ', ICON.eye), mk('book', 'オーディオブック', ICON.headphones));
}
function viewHome() {
  const root = app(); root.innerHTML = '';
  const book = SEC() === 'book';
  root.append(topbar('<span class="brand">耳から</span>日本語', { right: h('button', { class: 'iconbtn', 'aria-label': '設定', html: ICON.gear, onclick: () => go('settings') }) }));
  const w = h('div', { class: 'wrap' }); root.append(w);
  w.append(sectionTabs());
  const lines = secLines(), ids = secEpIds();
  if (!lines.length) {
    w.append(h('div', { class: 'card empty' },
      h('h2', {}, book ? 'まだオーディオブックがありません' : 'まだエピソードがありません'),
      h('p', { class: 'muted' }, book ? 'PCの audiobook.py で作った章の .zip を読み込んでください。音声はこのスマホの中に保存され、オフラインでも使えます。' : 'PCのスクリプトで作ったエピソードの .zip を読み込んでください。クリップはこのスマホの中に保存され、オフラインでも使えます。'),
      importButton()));
    return;
  }
  // ヒーロー
  const P = lines.map(l => S.prog[l.id]).filter(Boolean);
  const due = P.filter(p => p.due <= Date.now() && (p.fail || p.ivl)).length;
  const acc = P.reduce((a, p) => a + p.ok, 0), tot = P.reduce((a, p) => a + p.ok + p.fail, 0);
  const todayN = S.days[today()] || 0, goal = S.settings.goal, st = streak();
  w.append(h('div', { class: 'card', style: 'cursor:pointer', onclick: () => go('stats') },
    h('div', { class: 'hero' },
      h('div', { class: 'ring', html: ringSvg(todayN / goal, todayN >= goal ? 'var(--ok)' : 'var(--accent)') + `<div class="rtxt"><b>${todayN}</b><span>/ ${goal} 今日</span></div>` }),
      h('div', { class: 'hero-stats' },
        h('div', { class: 'hs' }, h('b', {}, `${P.length}`), h('span', {}, `/ ${lines.length} 文を練習`)),
        h('div', { class: 'hs' }, h('b', {}, tot ? Math.round(100 * acc / tot) + '%' : '―'), h('span', {}, '正解率')),
        h('div', { class: 'hs' }, h('b', {}, String(due)), h('span', {}, '復習する文')),
        h('div', { class: 'hs' }, h('b', { class: 'streak', html: ICON.flame + st }), h('span', {}, '日連続')))),
    h('div', { class: 'row', style: 'justify-content:space-between;margin-top:10px' },
      todayN >= goal ? h('span', { class: 'small', style: 'color:var(--ok);font-weight:700' }, '今日の目標、達成！') : h('span'),
      h('span', { class: 'small', style: 'color:var(--accent);font-weight:700' }, '記録を見る ›'))));
  // 棚
  w.append(h('div', { class: 'section-title' }, book ? '章（タップで選ぶ）' : 'エピソード（タップで選ぶ）'));
  const shelf = h('div', { class: 'shelf' }); w.append(shelf);
  const drawShelf = () => {
    shelf.innerHTML = '';
    const sel0 = S.settings.eps.filter(e => ids.includes(e));
    for (const id of ids) {
      const e = S.eps[id];
      const on = !sel0.length || sel0.includes(id);
      const seen = e.lines.filter(l => S.prog[l.id]).length;
      let th;
      if (book) th = h('div', { class: 'th bookcover' }, h('span', { class: 'bk' }, e.book || ''), h('b', {}, e.title || id));
      else {
        th = h('div', { class: 'th' }, S.thumbs[id] ? '' : id);
        if (S.thumbs[id]) th.style.backgroundImage = `url(${S.thumbs[id]})`;
        else makeThumb(id).then(d => { if (d) { th.textContent = ''; th.style.backgroundImage = `url(${d})`; } });
      }
      shelf.append(h('button', { class: 'epc ' + (on ? 'on' : 'off'), onclick: () => {
        let sel = S.settings.eps.filter(x => ids.includes(x)); if (!sel.length) sel = ids.slice();
        sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
        if (!sel.length || sel.length === ids.length) sel = [];
        S.settings.eps = [...S.settings.eps.filter(x => !ids.includes(x)), ...sel]; saveSettings(); drawShelf(); drawCount();
      } }, th, h('div', { class: 'meta' }, h('b', {}, epLabel(id)), h('span', {}, `${e.lines.length} 文${book && e.passages ? `・${e.passages.length} 段落` : ''}`), h('div', { class: 'bar' }, h('i', { style: `width:${100 * seen / e.lines.length}%` })))));
    }
    shelf.append(importButton(SEC(), h('button', { class: 'epc add', 'aria-label': book ? '章を読み込む' : 'エピソードを読み込む' },
      h('div', { class: 'th' }, '＋'), h('div', { class: 'meta' }, h('b', {}, book ? '章を追加' : 'エピソードを追加'), h('span', {}, '.zip を読み込む')))));
  };
  drawShelf();
  // 難しさ
  const lvChips = h('div', { class: 'chips' });
  const cnt = h('span', { class: 'small muted' });
  const drawCount = () => { cnt.textContent = `${pool().length} 文`; };
  const drawLv = () => { lvChips.innerHTML = ''; [[1, 'やさしい'], [2, 'ふつう'], [3, 'むずかしい']].forEach(([v, t]) => lvChips.append(h('button', { class: 'chip' + (S.settings.lv.includes(v) ? ' on' : ''), onclick: () => { const s = S.settings.lv; S.settings.lv = s.includes(v) ? (s.length > 1 ? s.filter(x => x !== v) : s) : [...s, v].sort(); saveSettings(); drawLv(); drawCount(); } }, t))); lvChips.append(cnt); };
  drawLv(); drawCount();
  w.append(h('div', { class: 'section-title' }, 'むずかしさ'), lvChips);
  // 練習
  w.append(h('div', { class: 'section-title' }, '練習'));
  const m = h('div', { class: 'modes' });
  const tango = ['tango', '単語カード', `まだ覚えていない言葉を復習（今日 ${wordsDue()} 語）`, ICON.cards, 8];
  const modes = book ? [MODES[0], ['listen', '章リスニング', '章を最初から聞きながら、文字を追いかける', ICON.headphones, 6], ...MODES.slice(1), tango] : [...MODES, tango];
  for (const [id, t, d, ic, c] of modes) {
    const wide = id === 'mezcla' || id === 'listen' || id === 'tango';
    const el = h('button', { class: 'mode' + (id === 'mezcla' ? ' primary' : wide ? ' wide' : ''), style: `--c:var(--t${c});--cs:var(--t${c}s)`, onclick: () => id === 'listen' ? go('listen') : id === 'tango' ? go('wordquiz') : startRound(id) },
      h('span', { class: 'ic', html: ic }), h('span', { class: 'tx' }, h('span', { class: 't' }, t), h('span', { class: 'd' }, d)));
    if (!wide) { el.append(...el.querySelector('.tx').childNodes); el.querySelector('.tx').remove(); }
    m.append(el);
  }
  w.append(m);
  w.append(h('div', { class: 'section-title' }, '学ぶ'));
  const m2 = h('div', { class: 'modes' });
  for (const [id, t, d, ic, c] of TOOLS) m2.append(h('button', { class: 'mode', style: `--c:var(--t${c});--cs:var(--t${c}s)`, onclick: () => id === 'lector' ? go('reader') : id === 'vocab' ? go('vocab') : id === 'glist' ? go('glist') : go('ankibox') },
    h('span', { class: 'ic', html: ic }), h('span', { class: 't' }, t), h('span', { class: 'd' }, id === 'lector' && book ? '章を段落ごとに読む・聞く' : d)));
  w.append(m2);
}

function importButton(kind = SEC(), trigger) {
  const inp = h('input', { type: 'file', accept: '.zip,application/zip', multiple: true, style: 'display:none' });
  const status = h('div', { class: 'small muted', style: trigger ? 'padding:6px 8px' : 'margin-top:8px' });
  inp.onchange = async () => {
    for (const f of inp.files) {
      const set = t => { status.innerHTML = '<span class="spinner"></span> ' + esc(t); };
      set(f.name + ' を読み込み中…');
      try { const r = await importZip(f, set, kind); await loadAll(); toast(`${epLabel(r.ep)}：${r.lines} 文を読み込みました`); }
      catch (e) { status.textContent = 'エラー：' + e.message; return; }
    }
    S.settings.section = kind; saveSettings(); await loadAll(); go('home');
  };
  if (trigger) { trigger.onclick = () => inp.click(); return h('div', { style: 'flex:none;width:150px' }, trigger, inp, status); }
  return h('div', {}, h('button', { class: 'btn primary', onclick: () => inp.click() }, kind === 'book' ? 'オーディオブックの章を読み込む（.zip）' : 'アニメのエピソードを読み込む（.zip）'), inp, status);
}

function viewSettings() {
  const root = app(); root.innerHTML = '';
  root.append(topbar('設定', { back: true }));
  const w = h('div', { class: 'wrap' }); root.append(w);
  const sel = (key, opts, onch) => { const s = h('select', { onchange: () => { S.settings[key] = isNaN(+s.value) ? s.value : +s.value; saveSettings(); onch && onch(); } }, opts.map(([v, t]) => h('option', { value: v, selected: String(S.settings[key]) === String(v) }, t))); return s; };
  w.append(h('div', { class: 'card' },
    h('div', { class: 'switch' }, h('span', {}, '一日の目標'), sel('goal', [[10, '10問'], [20, '20問'], [30, '30問'], [50, '50問']])),
    h('div', { class: 'switch' }, h('span', {}, '1ラウンドの問題数'), sel('roundLen', [[5, '5問'], [10, '10問'], [20, '20問']])),
    h('div', { class: 'switch' }, h('span', {}, 'ふりがなを表示する'), h('input', { type: 'checkbox', checked: S.settings.furi, onchange: e => { S.settings.furi = e.target.checked; saveSettings(); } })),
    h('div', { class: 'switch' }, h('span', {}, 'とても短い文もふくめる（ハァ…、ん？など）'), h('input', { type: 'checkbox', checked: S.settings.short, onchange: e => { S.settings.short = e.target.checked; saveSettings(); } })),
    h('div', { class: 'switch' }, h('span', {}, 'テーマ'), sel('theme', [['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']], applyTheme)),
    h('div', { class: 'switch', style: 'flex-wrap:wrap' }, h('span', {}, '文法クイズのレベル'), glvChips()),
  ));
  w.append(ankiLiveCard());
  const list = h('div', { class: 'eplist' });
  for (const e of Object.values(S.eps)) list.append(h('div', { class: 'ep' }, h('div', {}, h('span', { class: 'tag' }, epType(e) === 'book' ? '本' : 'アニメ'), h('b', {}, epLabel(e.ep)), h('div', { class: 'small muted' }, `${e.ep}・${e.lines.length} 文`)),
    h('button', { class: 'btn sm danger ghost', onclick: () => confirmInline(list, e.ep) }, '削除')));
  w.append(h('div', { class: 'card' }, h('h2', {}, 'アニメ／オーディオブック'), list, h('div', { style: 'margin-top:12px;display:grid;gap:10px' }, importButton('anime'), importButton('book'))));
  w.append(backupCard());
  w.append(h('div', { class: 'card small muted' }, 'データはすべてこのスマホの中に保存されています。ブラウザのデータを消すと、エピソードと記録も消えます。'));
}

// ================= バックアップ（記録だけ。クリップは .zip から読み込み直す） =================
const BACKUP_KV = ['settings', 'known', 'days', 'ankiq', 'ankidone', 'vprog', 'kstat'];
async function saveFile(blob, fname) { // スマホでは共有メニュー、だめならダウンロード
  try {
    const file = new File([blob], fname, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: fname }); return true; }
  } catch (e) { if (e.name === 'AbortError') return false; }
  const a = h('a', { href: URL.createObjectURL(blob), download: fname }); document.body.append(a); a.click(); a.remove();
  return true;
}
function backupCard() {
  const status = h('div', { class: 'small muted', style: 'margin-top:8px' });
  const exp = h('button', { class: 'btn', html: ICON.download + '<span>記録を保存</span>', onclick: async () => {
    const data = { app: 'mimikara', v: 1, date: new Date().toISOString(), prog: await dbAll('prog'), kv: {} };
    for (const k of BACKUP_KV) { const v = await dbGet('kv', k); if (v !== undefined) data.kv[k] = v; }
    const ok = await saveFile(new Blob([JSON.stringify(data)], { type: 'application/json' }), `mimikara_backup_${today()}.json`);
    if (ok) { S.settings.lastBackup = Date.now(); saveSettings(); status.textContent = `保存しました（${data.prog.length} 文の記録）。`; }
  } });
  const inp = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  const confirmBox = h('div');
  inp.onchange = async () => {
    const f = inp.files[0]; inp.value = ''; if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); if (data.app !== 'mimikara' || !Array.isArray(data.prog)) throw 0; }
    catch (e) { status.textContent = 'エラー：このアプリのバックアップファイルではありません。'; return; }
    confirmBox.innerHTML = '';
    confirmBox.append(h('div', { class: 'card', style: 'margin:10px 0 0;border-color:var(--warn)' },
      h('p', { style: 'margin:0 0 10px' }, `${new Date(data.date).toLocaleDateString('ja-JP')} の記録（${data.prog.length} 文）で、今の記録を置きかえます。よろしいですか？`),
      h('div', { class: 'row', style: 'gap:8px' },
        h('button', { class: 'btn sm', onclick: () => { confirmBox.innerHTML = ''; } }, 'やめる'),
        h('button', { class: 'btn sm primary', onclick: async () => {
          await tx('prog', 'readwrite', st => { st.clear(); for (const p of data.prog) st.put(p); });
          for (const k of BACKUP_KV) if (data.kv[k] !== undefined) await dbPut('kv', data.kv[k], k);
          await loadAll(); applyTheme(); toast('記録をもどしました'); go('settings');
        } }, 'もどす'))));
  };
  const last = S.settings.lastBackup;
  return h('div', { class: 'card' }, h('h2', {}, 'バックアップ'),
    h('p', { class: 'small muted', style: 'margin:0 0 10px' }, '練習の記録・覚えた言葉・連続日数・Anki の選択をファイルに保存します。スマホを変えたときやブラウザのデータを消したときに、ここからもどせます（エピソードは .zip をもう一度読み込んでください）。'),
    h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, exp, h('button', { class: 'btn', onclick: () => inp.click() }, '記録をもどす'), inp),
    h('div', { class: 'small muted', style: 'margin-top:8px' }, last ? `前回の保存：${new Date(last).toLocaleDateString('ja-JP')}` : 'まだ保存していません。'),
    confirmBox, status);
}
function ankiLiveCard() {
  const status = h('div', { class: 'small muted', style: 'margin-top:8px' });
  const test = h('button', { class: 'btn sm', onclick: async () => {
    status.innerHTML = '<span class="spinner"></span> 確認中…'; delete ANKI_READY[SEC() === 'book'];
    try { await ankiConnect('version'); await ankiCheck(SEC() === 'book'); status.textContent = '✓ つながりました。＋ を押すと AnkiDroid に直接入ります。'; }
    catch (e) { status.textContent = 'エラー：' + e.message; }
  } }, '接続テスト');
  const steps = h('ol', { class: 'small', style: 'margin:8px 0 0;padding-left:20px;line-height:1.7' },
    h('li', {}, 'スマホに「AnkiConnect Android」を入れて開き、AnkiDroid へのアクセスを許可して、サービスを起動する。'),
    h('li', {}, 'AnkiConnect Android の設定の「CORS Host」に、これを入れる：', h('code', { style: 'user-select:all;word-break:break-all' }, location.origin)),
    h('li', {}, '「Anki」画面で .apkg を一度作って AnkiDroid に読み込む（カードの形とデッキができます）。'),
    h('li', {}, '「接続テスト」を押す。'));
  const box = h('div', { style: S.settings.ankiLive ? '' : 'display:none' }, steps, h('div', { style: 'margin-top:10px' }, test), status);
  return h('div', { class: 'card' }, h('h2', {}, 'AnkiDroid に直接追加'),
    h('div', { class: 'switch' }, h('span', {}, '＋ を押したらすぐ AnkiDroid に入れる'), h('input', { type: 'checkbox', checked: !!S.settings.ankiLive, onchange: e => { S.settings.ankiLive = e.target.checked; saveSettings(); box.style.display = e.target.checked ? '' : 'none'; } })),
    h('p', { class: 'small muted', style: 'margin:6px 0 0' }, 'AnkiDroid が AnkiWeb と同期すれば、PC の Anki にも届きます。送れなかった文は「Anki」画面に残ります。'),
    box);
}
function glvChips() {
  const box = h('div', { class: 'chips' });
  const draw = () => { box.innerHTML = ''; for (const lv of LEVELS) box.append(h('button', { class: 'chip' + (S.settings.glv.includes(lv) ? ' on' : ''), onclick: () => { const s = S.settings.glv; S.settings.glv = s.includes(lv) ? (s.length > 1 ? s.filter(x => x !== lv) : s) : LEVELS.filter(x => s.includes(x) || x === lv); saveSettings(); draw(); } }, lv)); };
  draw(); return box;
}

// ================= 文法リスト =================
function viewGrammarList(state) {
  state = state || { lv: 'N3', seen: false };
  const root = app(); root.innerHTML = '';
  root.append(topbar('文法リスト', { back: true }));
  const w = h('div', { class: 'wrap' }); root.append(w);
  const counts = {};
  for (const l of secLines()) for (const id of new Set((l.gr || []).map(g => g[0]))) counts[id] = (counts[id] || 0) + 1;
  const all = Object.entries(S.grammar).filter(([, v]) => v[3]);
  const tabs = h('div', { class: 'chips' }, LEVELS.map(lv => {
    const n = all.filter(([, v]) => v[3] === lv).length, s = all.filter(([id, v]) => v[3] === lv && counts[id]).length;
    return h('button', { class: 'chip' + (state.lv === lv ? ' on' : ''), onclick: () => viewGrammarList({ ...state, lv }) }, `${lv}（${s}/${n}）`);
  }));
  const seenBtn = h('button', { class: 'chip' + (state.seen ? ' on' : ''), onclick: () => viewGrammarList({ ...state, seen: !state.seen }) }, 'エピソードに出たものだけ');
  w.append(h('div', { class: 'card' }, tabs, h('div', { class: 'chips', style: 'margin-top:8px' }, seenBtn),
    h('p', { class: 'small muted', style: 'margin:10px 0 0' }, '（出た数／全部）。タップで説明と例文。くわしい解説は IMABI（英語）へのリンクから。')));
  let items = all.filter(([, v]) => v[3] === state.lv);
  if (state.seen) items = items.filter(([id]) => counts[id]);
  items.sort((a, b) => (counts[b[0]] || 0) - (counts[a[0]] || 0));
  const list = h('div', { class: 'card', style: 'padding:4px 14px' });
  if (!items.length) list.append(h('div', { class: 'empty muted' }, 'ここには文法がありません。'));
  for (const [id, v] of items) list.append(h('div', { class: 'vrow', onclick: () => grammarSheet(id) },
    h('div', { class: 'vmain' }, h('div', { class: 'vw', style: 'font-size:17px' }, v[0]), h('div', { class: 'vg', style: 'font-family:var(--ja)' }, v[1])),
    h('span', { class: 'cnt' }, counts[id] ? `${counts[id]}文` : '―')));
  w.append(list);
}

function confirmInline(list, ep) {
  document.querySelectorAll('.confirmbar').forEach(x => x.remove());
  const bar = h('div', { class: 'verdict bad confirmbar', style: 'flex-wrap:wrap' }, `${epLabel(ep)} とクリップを削除しますか？`,
    h('button', { class: 'btn sm danger', onclick: async () => { await deleteEpisode(ep); await loadAll(); go('settings'); } }, '削除する'),
    h('button', { class: 'btn sm ghost', onclick: () => bar.remove() }, 'やめる'));
  list.after(bar);
}

// ================= ラウンド =================
let ROUND = null;
const KINDS = ['dictado', 'hueco', 'ordenar', 'oido', 'gramatica', 'shadowing'];
const KIND_NAME = { dictado: '書き取り', hueco: '穴埋め', ordenar: '並べ替え', oido: '聞き取り', gramatica: '文法', shadowing: 'シャドーイング' };
function startRound(mode) { ROUND = { mode, i: 0, n: S.settings.roundLen, ok: 0, done: 0, used: new Set(), log: [] }; nextItem(); }
function nextItem() {
  if (ROUND.i >= ROUND.n) return go('summary');
  let kind = ROUND.mode === 'mezcla' ? pick(['dictado', 'dictado', 'hueco', 'ordenar', 'oido', 'gramatica', 'gramatica', 'shadowing']) : ROUND.mode;
  let line = pickLine(kind, ROUND.used);
  if (!line && ROUND.mode === 'mezcla') for (const k of shuffle(KINDS)) { line = pickLine(k, ROUND.used); if (line) { kind = k; break; } }
  if (!line) { if (!ROUND.i) { toast('今の条件では、この練習に使える文がありません。'); return go('home'); } return go('summary'); }
  ROUND.used.add(line.id); ROUND.i++;
  CLEANUP.forEach(f => { try { f(); } catch (e) { } }); CLEANUP = []; stopRecording(); window.scrollTo(0, 0);
  EX[kind](line, exShell(kind, line));
}
function finish(line, kind, ok, score) {
  if (!ROUND.finished) { ROUND.done++; if (ok) ROUND.ok++; ROUND.log.push({ line, kind, ok, score }); }
  grade(line, ok, kind);
}
function exShell(kind, line) {
  const root = app(); root.innerHTML = '';
  root.append(topbar(KIND_NAME[kind], { back: true, right: h('div', { class: 'row', style: 'gap:8px;align-items:center' }, h('span', { class: 'small muted' }, `${ROUND.i} / ${ROUND.n}`), ankiBtn(line, 'top')) }));
  const w = h('div', { class: 'wrap has-bar' }); root.append(w);
  w.append(h('div', { class: 'progress' }, h('i', { style: `width:${100 * (ROUND.i - 1) / ROUND.n}%` })));
  return w;
}
function setBar(w, ...btns) { const old = document.querySelector('.actionbar'); if (old) old.remove(); document.getElementById('app').append(actionbar(...btns)); }
function nextBar(w) { setBar(w, h('button', { class: 'btn primary', onclick: nextItem }, ROUND.i >= ROUND.n ? '結果を見る' : '次へ')); }
function verdict(kind, text, target) {
  const ic = kind === 'ok' ? ICON.check : kind === 'bad' ? ICON.x : ICON.minus;
  buzz(kind === 'ok' ? 25 : [60, 40, 60]);
  if (kind === 'bad' && target) { target.classList.remove('shake'); void target.offsetWidth; target.classList.add('shake'); }
  return h('div', { class: 'verdict ' + kind, html: ic + `<span>${esc(text)}</span>` });
}

const EX = {
  dictado(l, w) {
    w.append(playerEl(l));
    w.append(h('div', { class: 'qtitle' }, '聞こえた文を書こう（漢字でも、かなでもOK）'));
    const ta = h('textarea', { class: 'ans', rows: 2, lang: 'ja', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'ここに書いて…' });
    const hintBox = h('div', { class: 'small muted', style: 'margin-top:8px' });
    let hints = 0;
    const hintBtn = h('button', { class: 'btn ghost', onclick: () => {
      hints++;
      const kana = [...lineKana(l).replace(/[\s、。！？…]/g, '')];
      if (hints === 1) hintBox.textContent = `ヒント：だいたい ${kana.length} 文字。「${kana[0]}」で始まります。`;
      else if (hints === 2) hintBox.textContent = `ヒント：${l.tk.filter(t => t.p !== 'sp').map(t => t.p === 'sym' ? t.s : '○'.repeat([...(t.r || t.s)].length)).join('')}`;
      else hintBox.textContent = `ヒント（${trLabel(l)}）：${l.es || 'なし'}`;
    } }, 'ヒント');
    const check = () => {
      const r = JA.alignJa(l.tk, ta.value);
      const pct = Math.round(r.score * 100);
      finish(l, 'dictado', r.score >= 0.9 ? true : r.score < 0.6 ? false : null, pct);
      ta.disabled = true; hintBtn.remove();
      w.append(verdict(pct >= 90 ? 'ok' : pct >= 60 ? 'mid' : 'bad', pct >= 90 ? `よくできました！ ${pct}%` : `${pct}%　赤いところをチェックしよう`, ta));
      w.append(resultBlock(l, { status: r.status }));
      nextBar(w);
    };
    w.append(ta, hintBox, h('div', { class: 'row', style: 'margin-top:6px' }, hintBtn));
    setBar(w, h('button', { class: 'btn ghost', onclick: () => { ta.value = ''; check(); } }, 'わからない'), h('button', { class: 'btn primary', onclick: check }, 'チェック'));
    setTimeout(() => ta.focus(), 300);
  },

  hueco(l, w) {
    let cands = blankCands(l);
    const unknown = cands.filter(([t]) => !S.known.has(t.b));
    if (unknown.length) cands = unknown;
    cands = shuffle(cands).sort((a, b) => (vocabOf(l, a[0]).c ? 1 : 0) - (vocabOf(l, b[0]).c ? 1 : 0));
    const [target, ti] = cands[0];
    const others = shuffle(secLines().flatMap(x => x.tk.filter(t => t.p === target.p && cleanForm(t) && t.b !== target.b && t.s !== target.s && Math.abs(t.s.length - target.s.length) <= 2)));
    const opts = [target.s]; for (const t of others) { if (!opts.includes(t.s)) opts.push(t.s); if (opts.length === 4) break; }
    w.append(playerEl(l));
    w.append(h('div', { class: 'qtitle' }, 'ぬけている言葉はどれ？'));
    const sc = h('div', { class: 'card' }, sentenceEl(l, { blank: ti, tap: false }));
    w.append(sc);
    const box = h('div', { class: 'opts' });
    for (const o of shuffle(opts)) box.append(h('button', { class: 'opt big', onclick: e => {
      const ok = o === target.s;
      box.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.textContent === target.s) b.classList.add('right'); });
      if (!ok) e.currentTarget.classList.add('wrong');
      finish(l, 'hueco', ok);
      const v = vocabOf(l, target);
      w.append(verdict(ok ? 'ok' : 'bad', ok ? '正解！' : `正解は「${target.s}」`, sc));
      w.append(h('div', { class: 'small', style: 'margin:-4px 2px 8px' }, h('b', {}, target.b), `（${v.r}）：${v.g[0]}`));
      w.append(resultBlock(l, { hl: [ti, ti] }));
      nextBar(w);
    } }, o));
    w.append(box);
    setBar(w, h('button', { class: 'btn ghost', onclick: () => { box.querySelector('.opt:not(:disabled)') && [...box.children].find(b => b.textContent !== target.s)?.click(); } }, 'わからない'));
  },

  ordenar(l, w) {
    const pieces = l.ch.map(c => c.map(i => l.tk[i].s).join(''));
    let order = shuffle(pieces.map((p, i) => i)); let tries = 0;
    while (order.every((v, k) => pieces[v] === pieces[k]) && tries++ < 10) order = shuffle(order);
    w.append(playerEl(l));
    w.append(h('div', { class: 'qtitle' }, 'ブロックを正しい順にタップしよう'));
    const ans = h('div', { class: 'tiles' }), pl = h('div', { class: 'tiles pool' });
    const chosen = [];
    const checkBtn = h('button', { class: 'btn primary', disabled: true }, 'チェック');
    const redraw = () => {
      ans.innerHTML = ''; if (!chosen.length) ans.append(h('span', { class: 'ph' }, 'ここに文ができます'));
      chosen.forEach((k, pos) => ans.append(h('button', { class: 'tile', onclick: () => { chosen.splice(pos, 1); redraw(); } }, pieces[k])));
      pl.innerHTML = ''; order.forEach(k => pl.append(h('button', { class: 'tile' + (chosen.includes(k) ? ' used' : ''), onclick: () => { if (!chosen.includes(k)) { chosen.push(k); redraw(); } } }, pieces[k])));
      checkBtn.disabled = chosen.length !== pieces.length;
    };
    checkBtn.onclick = () => {
      const ok = chosen.map(k => pieces[k]).every((p, k) => p === pieces[k]);
      finish(l, 'ordenar', ok);
      ans.querySelectorAll('button').forEach(b => b.disabled = true); pl.remove();
      w.append(verdict(ok ? 'ok' : 'bad', ok ? '正解！' : 'おしい！正しい順番はこちら：', ans));
      w.append(resultBlock(l)); nextBar(w);
    };
    w.append(ans, pl);
    setBar(w, h('button', { class: 'btn ghost', onclick: () => { chosen.length = 0; redraw(); } }, 'リセット'), checkBtn);
    redraw();
  },

  oido(l, w) {
    const len = flatLen(l);
    const others = shuffle(secLines().filter(x => x.id !== l.id && x.t !== l.t && Math.abs(flatLen(x) - len) <= Math.max(3, len * 0.35)));
    const opts = shuffle([l, ...others.slice(0, 3)]);
    w.append(playerEl(l));
    w.append(h('div', { class: 'qtitle' }, 'どの文が聞こえた？'));
    const box = h('div', { class: 'opts' });
    for (const o of opts) {
      const b = h('button', { class: 'opt big', onclick: () => {
        const ok = o === l;
        box.querySelectorAll('.opt').forEach(x => x.disabled = true);
        b.classList.add(ok ? 'right' : 'wrong'); box.children[opts.indexOf(l)].classList.add('right');
        finish(l, 'oido', ok);
        w.append(verdict(ok ? 'ok' : 'bad', ok ? '正解！' : '正解は緑の文です', box), resultBlock(l)); nextBar(w);
      } }, o.t);
      box.append(b);
    }
    w.append(box);
    setBar(w, h('button', { class: 'btn ghost', onclick: () => [...box.children].find((b, k) => opts[k] !== l)?.click() }, 'わからない'));
  },

  gramatica(l, w) {
    const gs = l.gr.filter(g => gQuiz(g[0]));
    const common = ['final', 'yo_ne', 'quote', 'n_desu', 'ka_q', 'kara', 'kedo', 'deshou', 'sore_ni', 'ga_aru', 'mou', 'mada', 'dake'];
    const rare = gs.filter(x => !common.includes(x[0]));
    const g = rare.length ? pick(rare) : pick(gs);
    const G = S.grammar[g[0]];
    const piece = l.tk.slice(g[1], g[2] + 1).map(t => t.s).join('');
    const pool_ = Object.entries(S.grammar).filter(([id, v]) => id !== g[0] && !v[5] && !l.gr.some(x => x[0] === id) && v[1] !== G[1]);
    const same = shuffle(pool_.filter(([, v]) => v[3] === G[3])), other = shuffle(pool_.filter(([, v]) => v[3] !== G[3]));
    const distract = [];
    for (const [, v] of [...same, ...other]) { if (!distract.includes(v[1])) distract.push(v[1]); if (distract.length === 3) break; }
    const opts = shuffle([G[1], ...distract]);
    w.append(playerEl(l));
    w.append(h('div', { class: 'qtitle' }, `この文の「${piece}」はどんな意味？（${G[3] || ''}）`));
    const sc = h('div', { class: 'card' }, sentenceEl(l, { hl: [g[1], g[2]] }));
    w.append(sc);
    const box = h('div', { class: 'opts' });
    for (const o of opts) box.append(h('button', { class: 'opt', onclick: e => {
      const ok = o === G[1];
      box.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.textContent === G[1]) b.classList.add('right'); });
      if (!ok) e.currentTarget.classList.add('wrong');
      finish(l, 'gramatica', ok);
      w.append(verdict(ok ? 'ok' : 'bad', ok ? '正解！' : 'ちょっとちがいます', sc));
      w.append(h('div', { class: 'card' }, h('div', { class: 'row', style: 'gap:8px' }, lvBadge(G[3]), h('b', {}, G[0])), h('p', { style: 'margin:6px 0 10px' }, G[2]),
        h('button', { class: 'btn sm', html: ICON.book + '<span>くわしく</span>', onclick: () => grammarSheet(g[0]) })));
      w.append(resultBlock(l, { hl: [g[1], g[2]] })); nextBar(w);
    } }, o));
    w.append(box);
    setBar(w, h('button', { class: 'btn ghost', onclick: () => [...box.children].find(b => b.textContent !== G[1])?.click() }, 'わからない'));
  },

  shadowing(l, w) { shadowingUI(l, w, true); },
};

// ================= シャドーイング =================
let REC = null;
function stopRecording() { if (REC) { try { REC.stop(); } catch (e) { } } }
function shadowingUI(l, w, inRound) {
  const pl = playerEl(l, { autoplay: true });
  w.append(pl);
  w.append(h('div', { class: 'card' }, l.spk ? h('div', { class: 'spk' }, l.spk) : null, sentenceEl(l), l.es ? h('div', { class: 'trans' }, h('span', { class: 'tag' }, trLabel(l)), l.es) : null, h('div', { style: 'margin-top:10px' }, ankiBtn(l))));
  const modeSel = h('select', {}, h('option', { value: 'after' }, 'クリップのあとに言う'), h('option', { value: 'with' }, 'クリップといっしょに言う（イヤホン推奨）'));
  const recBtn = h('button', { class: 'btn rec', html: ICON.mic + '<span>録音</span>' });
  const status = h('div', { class: 'small muted', style: 'margin:8px 2px;text-align:center' }, '何回でも聞いてから「録音」を押してね。');
  const out = h('div');
  w.append(h('div', { class: 'row', style: 'margin:10px 0' }, h('span', { class: 'small muted' }, 'やり方：'), modeSel), status, out);
  if (inRound) setBar(w, recBtn); else setBar(w, recBtn);
  let origP = null;
  const getOrig = () => origP || (origP = dbGet('clips', l.id).then(b => JA.analyze(b, l.st - (l.cs || 0), l.en - (l.cs || 0))));
  getOrig().catch(() => { });
  recBtn.onclick = async () => {
    if (REC) { stopRecording(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { status.textContent = 'マイクが使えません。ブラウザでマイクを許可してください（https か localhost で開く必要があります）。'; return; }
    const chunks = []; const mr = new MediaRecorder(stream); REC = mr;
    let recog = null, heard = null, recErr = null;
    const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SRC && navigator.onLine) {
      try {
        recog = new SRC(); recog.lang = 'ja-JP'; recog.interimResults = false; recog.maxAlternatives = 3; recog.continuous = true;
        const alts = [];
        recog.onresult = ev => { for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; for (let k = 0; k < r.length; k++) alts[k] = (alts[k] || '') + r[k].transcript; } heard = alts; };
        recog.onerror = ev => { recErr = ev.error; };
        recog.start();
      } catch (e) { recErr = 'start'; recog = null; }
    }
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    const dur = (l.en - l.st) / 1000; let timer;
    mr.onstop = async () => {
      clearTimeout(timer); REC = null; stream.getTracks().forEach(t => t.stop());
      recBtn.classList.remove('pulse'); recBtn.innerHTML = ICON.mic + '<span>もう一度録音</span>';
      if (recog) { try { recog.stop(); } catch (e) { } await new Promise(r => setTimeout(r, 700)); }
      status.innerHTML = '<span class="spinner"></span> 分析中…';
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      try {
        const [o, u] = await Promise.all([getOrig(), JA.analyze(blob)]);
        const res = JA.compareShadow(o, u);
        status.textContent = '';
        renderShadowResult(l, out, res, blob, pl, heard, recErr, inRound, w);
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { console.error(e); status.textContent = '録音を分析できませんでした：' + e.message; }
    };
    const withMode = modeSel.value === 'with';
    if (withMode) pl.play();
    mr.start();
    recBtn.classList.add('pulse'); recBtn.innerHTML = ICON.stop + '<span>ストップ</span>';
    status.textContent = withMode ? 'キャラクターといっしょに話して…' : 'あなたの番！話したら「ストップ」。';
    timer = setTimeout(stopRecording, (dur / (withMode ? S.settings.rate : 1) + (withMode ? 1.5 : 4)) * 1000 + 1500);
  };
}
const scoreColor = v => v >= 80 ? 'var(--ok)' : v >= 60 ? 'var(--warn)' : 'var(--bad)';
function renderShadowResult(l, out, res, blob, pl, heard, recErr, inRound, w) {
  out.innerHTML = '';
  if (res.error) { out.append(verdict('bad', res.error)); return; }
  let pron = null, pronStatus = null, heardTxt = '';
  if (heard && heard.length) {
    const target = JA.normJa(lineKana(l));
    let best = -1;
    for (const alt of heard) {
      const a1 = JA.alignJa(l.tk, alt);
      const kana = JA.normJa(toKana(alt));
      const s = Math.max(a1.score, 1 - JA.lev(kana, target) / Math.max(target.length, 1));
      if (s > best) { best = s; pronStatus = a1.status; heardTxt = alt; }
    }
    pron = Math.round(Math.max(0, best) * 100);
  }
  const parts = [res.into, res.rit, pron].filter(v => v != null);
  const total = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  const card = h('div', { class: 'card' });
  const sub = (name, v) => h('div', { class: 'sub' }, h('div', { class: 'lbl' }, h('span', {}, name), h('b', {}, v == null ? '―' : String(v))), h('div', { class: 'bar' }, h('i', { style: `width:${v || 0}%;background:${v == null ? 'transparent' : scoreColor(v)}` })));
  card.append(h('div', { class: 'scorebox' },
    h('div', { class: 'scorering', html: ringSvg(total / 100, scoreColor(total), 11) + `<div class="rtxt"><b>${total}</b><span>総合</span></div>` }),
    h('div', { class: 'subs' }, sub('イントネーション', res.into), sub('リズム', res.rit), sub('発音', pron))));
  const cv = h('canvas', { class: 'pitch', width: 720, height: 280 });
  card.append(cv, h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:var(--accent)' }), '元の音声'), h('span', {}, h('i', { style: 'background:var(--bad)' }), 'あなた'), h('span', {}, '文字の位置はおおよそ')));
  requestAnimationFrame(() => drawPitch(cv, res, l));
  const tips = res.tips.slice();
  if (res.missed.length) {
    const flat = l.tk.filter(t => t.p !== 'sp'); const totalLen = flat.reduce((a, t) => a + t.s.length, 0);
    for (const p of res.missed.slice(0, 2)) { let acc = 0, word = ''; for (const t of flat) { acc += t.s.length; word = t.s; if (acc / totalLen >= p) break; } tips.push(`「${word}」のあとに少し間（ま）を入れましょう。`); }
  }
  if (pron == null) tips.push(recErr ? 'この端末では、録音といっしょに発音チェックができませんでした。' : !navigator.onLine ? 'オフラインです。発音チェックにはインターネットが必要です。' : '言葉を聞き取れませんでした。もう少し大きな声で話してみて。');
  else if (heardTxt) card.append(h('div', { class: 'small', style: 'margin-top:12px' }, 'スマホが聞き取った文：', h('b', {}, heardTxt)), h('div', { style: 'margin-top:4px' }, sentenceEl(l, { status: pronStatus, tap: false })));
  if (!tips.length && total >= 80) tips.push('とても自然です！');
  if (tips.length) card.append(h('ul', { class: 'tips' }, tips.map(t => h('li', {}, t))));
  const myAudio = new Audio(URL.createObjectURL(blob));
  card.append(h('div', { class: 'row', style: 'margin-top:12px' },
    h('button', { class: 'btn sm', html: ICON.play + '<span>元の音声</span>', onclick: () => pl.play() }),
    h('button', { class: 'btn sm', html: ICON.play + '<span>自分の声</span>', onclick: () => { myAudio.currentTime = 0; myAudio.play(); } }),
    h('button', { class: 'btn sm', html: ICON.replay + '<span>つづけて聞く</span>', onclick: () => { pl.play(); pl.video.onended = () => { pl.video.onended = null; myAudio.currentTime = 0; myAudio.play(); }; } })));
  out.append(card);
  const recBtn = document.querySelector('.actionbar .rec');
  if (inRound) {
    const e = ROUND.log.find(x => x.line === l);
    if (!e) finish(l, 'shadowing', total >= 70 ? true : total < 45 ? false : null, total); else e.score = Math.max(e.score || 0, total);
    setBar(w, recBtn, h('button', { class: 'btn primary', onclick: nextItem }, ROUND.i >= ROUND.n ? '結果を見る' : '次へ'));
  }
}
function smooth(arr) {
  const a = Array.from(arr), n = a.length;
  // 短いすき間を直線でうめる
  let i = 0;
  while (i < n) {
    if (isNaN(a[i])) { let j = i; while (j < n && isNaN(a[j])) j++; if (i > 0 && j < n && j - i <= 12) for (let k = i; k < j; k++) a[k] = a[i - 1] + (a[j] - a[i - 1]) * (k - i + 1) / (j - i + 1); i = j; } else i++;
  }
  const out = a.slice();
  for (let k = 0; k < n; k++) { if (isNaN(a[k])) continue; let s = 0, c = 0; for (let d = -3; d <= 3; d++) { const v = a[k + d]; if (v !== undefined && !isNaN(v)) { s += v; c++; } } out[k] = s / c; }
  return out;
}
function drawPitch(cv, res, l) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, css = getComputedStyle(document.documentElement);
  const TXT = 44, PH = H - TXT;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = css.getPropertyValue('--line').trim(); ctx.lineWidth = 1;
  for (let k = -6; k <= 6; k += 6) { const y = PH / 2 - k * PH / 26; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const N = res.oc.length, map = Array.from({ length: N }, () => []);
  for (const [i, j] of res.path) map[i].push(j);
  const uAligned = map.map(js => { const v = js.map(j => res.uc[j]).filter(x => !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; });
  const X = k => 12 + (W - 24) * k / (N - 1);
  const line = (arr, color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    let pen = false; ctx.beginPath();
    arr.forEach((v, k) => { const y = PH / 2 - v * PH / 26; if (isNaN(v)) { pen = false; return; } if (!pen) { ctx.moveTo(X(k), y); pen = true; } else ctx.lineTo(X(k), y); });
    ctx.stroke();
  };
  line(smooth(res.oc), css.getPropertyValue('--accent').trim(), 7);
  line(smooth(uAligned), css.getPropertyValue('--bad').trim(), 4);
  // 下に文字を並べる（おおよその位置）
  const chars = [...l.t.replace(/[\s　、。！？…]/g, '')];
  if (chars.length) {
    const fs = Math.max(14, Math.min(30, (W - 24) / chars.length * 0.9));
    ctx.fillStyle = css.getPropertyValue('--muted').trim(); ctx.font = `${fs}px ${css.getPropertyValue('--ja')}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    chars.forEach((c, k) => ctx.fillText(c, 12 + (W - 24) * (k + 0.5) / chars.length, H - TXT / 2));
  }
}

// ================= 結果 =================
function viewSummary() {
  ROUND.finished = true;
  const root = app(); root.innerHTML = '';
  root.append(topbar('結果', { back: true }));
  const w = h('div', { class: 'wrap has-bar' }); root.append(w);
  const frac = ROUND.done ? ROUND.ok / ROUND.done : 0;
  w.append(h('div', { class: 'card', style: 'text-align:center' },
    h('div', { class: 'scorering', style: 'margin:0 auto', html: ringSvg(frac, scoreColor(frac * 100), 11) + `<div class="rtxt"><b style="font-size:26px">${ROUND.ok}/${ROUND.done}</b><span>正解</span></div>` }),
    h('div', { class: 'small muted', style: 'margin-top:8px' }, frac >= 0.8 ? 'すばらしい！' : frac >= 0.5 ? 'いい感じ！' : 'まちがえた文は、あとでまた出てきます。')));
  const list = h('div', { class: 'card lines' });
  for (const e of ROUND.log) list.append(h('div', { class: 'ln' },
    h('span', { class: 'iconbtn', style: `color:${e.ok === true ? 'var(--ok)' : e.ok === false ? 'var(--bad)' : 'var(--warn)'}`, html: e.ok === true ? ICON.check : e.ok === false ? ICON.x : ICON.minus }),
    h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'spk' }, KIND_NAME[e.kind] + (e.score != null ? `・${e.score}` : '')), sentenceEl(e.line), e.line.es ? h('div', { class: 'tr' }, e.line.es) : null)));
  w.append(list);
  setBar(w, h('button', { class: 'btn', onclick: () => go('home') }, 'ホーム'), h('button', { class: 'btn primary', onclick: () => startRound(ROUND.mode) }, 'もう1ラウンド'));
}

// ================= 読む =================
function viewReader(epId) {
  if (SEC() === 'book') return viewBookReader(epId);
  const eps = secEpIds(); epId = eps.includes(epId) ? epId : (eps.includes(S.settings.readerEp) ? S.settings.readerEp : eps[0]);
  S.settings.readerEp = epId; saveSettings();
  const ep = S.eps[epId];
  const root = app(); root.innerHTML = '';
  root.append(topbar('読む', { back: true }));
  const w = h('div', { class: 'wrap has-bar' }); root.append(w);
  const sel = h('select', { onchange: () => go('reader', sel.value) }, eps.map(e => h('option', { value: e, selected: e === epId }, epLabel(e))));
  let showTr = false, cont = false, cur = -1;
  const trBtn = h('button', { class: 'chip', onclick: () => { showTr = !showTr; trBtn.classList.toggle('on', showTr); draw(); } }, '翻訳');
  const player = h('div', { class: 'stickyplayer' });
  const list = h('div', { class: 'lines' });
  w.append(h('div', { class: 'row', style: 'margin-bottom:10px' }, sel, trBtn), player, h('div', { class: 'card', style: 'padding:6px 10px' }, list));
  const rows = [];
  const playIdx = i => {
    cur = i; rows.forEach((r, k) => r.classList.toggle('playing', k === i));
    player.innerHTML = '';
    player.append(playerEl(ep.lines[i], { onended: () => { if (cont && cur + 1 < ep.lines.length) playIdx(cur + 1); else if (cont) stopCont(); } }));
    rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const draw = () => {
    list.innerHTML = ''; rows.length = 0;
    ep.lines.forEach((l, i) => {
      const r = h('div', { class: 'ln' + (i === cur ? ' playing' : '') },
        h('button', { class: 'iconbtn play', 'aria-label': '再生', html: ICON.play, onclick: () => { cont = false; updCont(); playIdx(i); } }),
        h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'spk' }, `${fmtTime(l.st)}${l.spk ? '・' + l.spk : ''}`), sentenceEl(l), showTr && l.es ? h('div', { class: 'tr' }, l.es) : null),
        h('div', { class: 'rowbtns' }, ankiBtn(l, true), h('button', { class: 'iconbtn', 'aria-label': 'シャドーイング', html: ICON.mic, onclick: () => shadowOne(l) })));
      rows.push(r); list.append(r);
    });
  };
  const contBtn = h('button', { class: 'btn primary' });
  const updCont = () => { contBtn.innerHTML = cont ? ICON.stop + '<span>とめる</span>' : ICON.headphones + '<span>通して聞く</span>'; };
  const stopCont = () => { cont = false; updCont(); };
  contBtn.onclick = () => { cont = !cont; updCont(); if (cont) playIdx(cur >= 0 && cur + 1 < ep.lines.length ? cur + 1 : 0); else { const v = player.querySelector('video'); v && v.pause(); } };
  updCont(); draw();
  setBar(w, contBtn);
}
function shadowOne(l) {
  const root = app(); root.innerHTML = '';
  root.append(topbar('シャドーイング', { back: () => go('reader', l.ep) }));
  const w = h('div', { class: 'wrap has-bar' }); root.append(w);
  shadowingUI(l, w, false);
}

// ================= 単語帳 =================
function viewVocab(state) {
  state = state || { ep: 'all', f: 'unknown', q: '' };
  const root = app(); root.innerHTML = '';
  root.append(topbar('単語帳', { back: true }));
  const w = h('div', { class: 'wrap' }); root.append(w);
  const words = new Map();
  for (const e of secEpIds().map(id => S.eps[id])) {
    if (state.ep !== 'all' && e.ep !== state.ep) continue;
    for (const [b, v] of Object.entries(e.vocab || {})) {
      if (v.p === 'pn' || !v.g || !v.g.length) continue;
      const cur = words.get(b); if (cur) cur.n += v.n; else words.set(b, { b, r: v.r, p: v.p, g: v.g, n: v.n });
    }
  }
  let arr = [...words.values()].sort((a, b) => b.n - a.n);
  const nKnown = arr.filter(x => S.known.has(x.b)).length;
  const epSel = h('select', { onchange: () => viewVocab({ ...state, ep: epSel.value }) }, h('option', { value: 'all' }, SEC() === 'book' ? 'すべての章' : 'すべてのエピソード'), secEpIds().map(e => h('option', { value: e, selected: e === state.ep }, epLabel(e))));
  const fchips = h('div', { class: 'chips' }, [['unknown', 'まだ'], ['known', '覚えた'], ['all', 'すべて']].map(([k, t]) => h('button', { class: 'chip' + (state.f === k ? ' on' : ''), onclick: () => viewVocab({ ...state, f: k }) }, t)));
  w.append(h('div', { class: 'card' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, epSel, h('span', { class: 'small muted' }, `覚えた ${nKnown} / ${arr.length} 語`)),
    h('div', { class: 'bar', style: 'height:6px;background:var(--surface2);border-radius:6px;overflow:hidden;margin:10px 0' }, h('i', { style: `display:block;height:100%;width:${arr.length ? 100 * nKnown / arr.length : 0}%;background:var(--ok)` })),
    fchips));
  if (state.f === 'unknown') arr = arr.filter(x => !S.known.has(x.b)); else if (state.f === 'known') arr = arr.filter(x => S.known.has(x.b));
  const list = h('div', { class: 'card', style: 'padding:4px 14px' });
  if (!arr.length) list.append(h('div', { class: 'empty muted' }, 'ここには言葉がありません。'));
  const LIMIT = 300;
  for (const x of arr.slice(0, LIMIT)) {
    const kb = h('button', { class: 'kbtn' + (S.known.has(x.b) ? ' on' : ''), onclick: e => { e.stopPropagation(); toggleKnown(x.b); kb.classList.toggle('on', S.known.has(x.b)); kb.textContent = S.known.has(x.b) ? '✓ 覚えた' : '覚えた？'; } }, S.known.has(x.b) ? '✓ 覚えた' : '覚えた？');
    list.append(h('div', { class: 'vrow', onclick: () => wordSheetBase(x.b, null, null) },
      h('div', { class: 'vmain' }, h('div', {}, h('span', { class: 'vw' }, x.b), ' ', h('span', { class: 'vr' }, POS_JA[x.p] || '')), h('div', { class: 'vg' }, x.g[0])),
      h('span', { class: 'cnt' }, `${x.n}回`), kb));
  }
  if (arr.length > LIMIT) list.append(h('div', { class: 'small muted', style: 'padding:10px 0' }, `ほかに ${arr.length - LIMIT} 語あります（よく出る順に表示）。`));
  w.append(list);
}

// ================= 単語カード（言葉ごとの間隔反復） =================
const NO_CARD_P = ['pn', 'prt', 'aux', 'sym', 'sp'];
function wordPool() {
  const words = new Map();
  for (const id of selEps()) for (const [b, v] of Object.entries(S.eps[id].vocab || {})) {
    if (NO_CARD_P.includes(v.p) || !v.g || !v.g.length || S.known.has(b)) continue;
    const cur = words.get(b); if (cur) cur.n += v.n; else words.set(b, { b, r: v.r, p: v.p, g: v.g, n: v.n });
  }
  return [...words.values()];
}
const wordsDue = () => { const now = Date.now(); return wordPool().filter(w => S.vprog[w.b] && S.vprog[w.b].due <= now).length; };
function wordWeight(w) {
  const p = S.vprog[w.b]; if (!p) return 1 + Math.min(w.n, 10) / 5; // 新しい言葉：よく出るものから
  let x = 1; if (p.due <= Date.now()) x += 4; x += Math.min(p.fail, 4) * 1.5; if (p.due > Date.now()) x *= p.ivl >= 7 ? 0.1 : 0.4; return x;
}
function vgrade(b, ok) {
  const p = S.vprog[b] || { ok: 0, fail: 0, ivl: 0, due: 0 };
  if (ok) { p.ok++; p.ivl = p.ivl ? Math.min(p.ivl * 2.5, 120) : 1; p.due = Date.now() + p.ivl * DAY; }
  else { p.fail++; p.ivl = 0; p.due = Date.now() + 10 * 60e3; }
  p.last = Date.now(); S.vprog[b] = p; dbPut('kv', S.vprog, 'vprog');
  countPractice('tango', ok);
}
function exampleFor(b) {
  const eps = selEps();
  const all = S.lines.filter(l => eps.includes(l.ep) && l.tk.some(t => t.b === b));
  const short = all.filter(l => flatLen(l) <= 25);
  return short.length ? pick(short) : all.length ? pick(all) : null;
}
let WQ = null;
function viewWordQuiz(cont) {
  if (!cont || !WQ) WQ = { i: 0, n: S.settings.roundLen, ok: 0, log: [], used: new Set() };
  if (WQ.i >= WQ.n) return go('wordsum');
  const c = wordPool().filter(w => !WQ.used.has(w.b));
  if (!c.length) { if (!WQ.i) { toast('練習できる言葉がありません（全部「覚えた」になっているかも）。'); return go('home'); } return go('wordsum'); }
  let tot = 0; const ws = c.map(w => (tot += wordWeight(w))); const r = Math.random() * tot;
  const w = c[ws.findIndex(x => x >= r)];
  WQ.used.add(w.b); WQ.i++;
  CLEANUP.forEach(f => { try { f(); } catch (e) { } }); CLEANUP = []; window.scrollTo(0, 0);
  const root = app(); root.innerHTML = '';
  root.append(topbar('単語カード', { back: true, right: h('span', { class: 'small muted', style: 'padding-right:6px' }, `${WQ.i} / ${WQ.n}`) }));
  const wr = h('div', { class: 'wrap has-bar' }); root.append(wr);
  wr.append(h('div', { class: 'progress' }, h('i', { style: `width:${100 * (WQ.i - 1) / WQ.n}%` })));
  const p = S.vprog[w.b];
  wr.append(h('div', { class: 'card', style: 'text-align:center;padding:28px 16px' },
    h('div', { class: 'small muted' }, [POS_JA[w.p], !p ? '新しい言葉' : p.due <= Date.now() ? '復習' : ''].filter(Boolean).join('・')),
    h('div', { class: 'hw', style: 'font-size:44px;margin:10px 0 4px' }, w.b),
    h('div', { class: 'small muted' }, `エピソードで ${w.n} 回`)));
  const back = h('div');
  wr.append(back);
  const answer = ok => { vgrade(w.b, ok); if (ok) WQ.ok++; WQ.log.push({ w, ok }); viewWordQuiz(true); };
  const reveal = () => {
    const ex = exampleFor(w.b);
    back.append(h('div', { class: 'card' },
      h('div', { style: 'font-size:20px;font-weight:700;font-family:var(--ja)' }, w.r),
      h('ol', { style: 'margin:8px 0 0;padding-left:20px' }, w.g.slice(0, 3).map(g => h('li', {}, g))),
      h('p', { class: 'small muted', style: 'margin:8px 0 0' }, '意味は JMdict（英語）より。')));
    if (ex) {
      const i = ex.tk.findIndex(t => t.b === w.b);
      back.append(playerEl(ex), h('div', { class: 'card' }, ex.spk ? h('div', { class: 'spk' }, ex.spk) : null, sentenceEl(ex, { hl: [i, i] }),
        ex.es ? h('div', { class: 'trans' }, h('span', { class: 'tag' }, trLabel(ex)), ex.es) : null,
        h('div', { style: 'margin-top:10px' }, ankiBtn(ex))));
    }
    back.append(h('div', { style: 'text-align:center;margin:4px 0 12px' }, h('button', { class: 'btn sm ghost', onclick: () => { toggleKnown(w.b); toast(`「${w.b}」を覚えた言葉にしました`); answer(true); } }, '✓ 覚えた（もう出さない）')));
    setBar(wr, h('button', { class: 'btn', onclick: () => answer(false) }, 'わからなかった'), h('button', { class: 'btn primary', onclick: () => answer(true) }, 'わかった'));
  };
  setBar(wr, h('button', { class: 'btn primary', onclick: reveal }, '答えを見る'));
}
function viewWordSummary() {
  const root = app(); root.innerHTML = '';
  root.append(topbar('結果', { back: true }));
  const w = h('div', { class: 'wrap has-bar' }); root.append(w);
  const done = WQ.log.length, frac = done ? WQ.ok / done : 0;
  w.append(h('div', { class: 'card', style: 'text-align:center' },
    h('div', { class: 'scorering', style: 'margin:0 auto', html: ringSvg(frac, scoreColor(frac * 100), 11) + `<div class="rtxt"><b style="font-size:26px">${WQ.ok}/${done}</b><span>わかった</span></div>` }),
    h('div', { class: 'small muted', style: 'margin-top:8px' }, 'わからなかった言葉は、10分後からまた出てきます。')));
  const list = h('div', { class: 'card', style: 'padding:4px 14px' });
  for (const { w: x, ok } of WQ.log) list.append(h('div', { class: 'vrow', onclick: () => wordSheetBase(x.b, null, null) },
    h('span', { class: 'iconbtn', style: `color:${ok ? 'var(--ok)' : 'var(--bad)'}`, html: ok ? ICON.check : ICON.x }),
    h('div', { class: 'vmain' }, h('div', {}, h('span', { class: 'vw' }, x.b), ' ', h('span', { class: 'vr' }, x.r)), h('div', { class: 'vg' }, x.g[0]))));
  w.append(list);
  setBar(w, h('button', { class: 'btn', onclick: () => go('home') }, 'ホーム'), h('button', { class: 'btn primary', onclick: () => go('wordquiz') }, 'もう1ラウンド'));
}

// ================= 記録 =================
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function bestStreak() {
  const ks = Object.keys(S.days).filter(k => S.days[k]).sort(); let best = 0, run = 0, prev = null;
  for (const k of ks) { const d = new Date(k + 'T12:00'); run = prev && (d - prev) / DAY < 1.5 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}
function viewStats() {
  const root = app(); root.innerHTML = '';
  root.append(topbar('記録', { back: true }));
  const w = h('div', { class: 'wrap' }); root.append(w);
  const total = Object.values(S.days).reduce((a, b) => a + b, 0), nDays = Object.values(S.days).filter(Boolean).length;
  const tile = (v, t) => h('div', { class: 'hs' }, h('b', {}, String(v)), h('span', {}, t));
  w.append(h('div', { class: 'card' }, h('div', { class: 'stat-tiles' },
    tile(total, '練習した問題'), tile(nDays, '練習した日'), tile(streak(), '今の連続日数'), tile(bestStreak(), '最長の連続日数'), tile(S.known.size, '覚えた言葉'), tile(Object.keys(S.vprog).length, '単語カードで見た言葉'))));

  // 毎日の練習（30日）：1系列の棒グラフ＋目標の線
  const N = 30, goal = S.settings.goal, days = [];
  for (let i = N - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ d, v: S.days[dayKey(d)] || 0 }); }
  const max = Math.max(goal, ...days.map(x => x.v), 1);
  const tip = h('div', { class: 'ctip', role: 'status' });
  const bars = h('div', { class: 'dbars' });
  const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
  days.forEach(({ d, v }, i) => {
    const col = h('div', { class: 'dcol', tabindex: 0, 'aria-label': `${fmt(d)}：${v}問` },
      h('i', { class: v >= goal ? 'met' : '', style: `height:${v ? Math.max(3, 100 * v / max) : 0}%` }));
    const show = () => { tip.textContent = `${fmt(d)}${i === N - 1 ? '（今日）' : ''}：${v} 問${v >= goal ? '・目標達成' : ''}`; tip.style.left = `${100 * (i + 0.5) / N}%`; tip.style.transform = `translateX(${i < 4 ? '-10%' : i > N - 5 ? '-90%' : '-50%'})`; tip.classList.add('on'); bars.querySelectorAll('.dcol').forEach(c => c.classList.toggle('hov', c === col)); };
    col.addEventListener('mouseenter', show); col.addEventListener('focus', show); col.addEventListener('click', show);
    bars.append(col);
  });
  bars.addEventListener('mouseleave', () => { tip.classList.remove('on'); bars.querySelectorAll('.hov').forEach(c => c.classList.remove('hov')); });
  const month = days.reduce((a, x) => a + x.v, 0), met = days.filter(x => x.v >= goal).length;
  w.append(h('div', { class: 'card' },
    h('h2', {}, '毎日の練習（30日）'),
    h('div', { class: 'small muted', style: 'margin:-4px 0 12px' }, `30日で ${month} 問・目標（${goal}問）達成 ${met} 日`),
    h('div', { class: 'dchart' },
      h('div', { class: 'dgoal', style: `bottom:${100 * goal / max}%` }, h('span', {}, `目標 ${goal}`)),
      bars, tip),
    h('div', { class: 'daxis' }, h('span', {}, fmt(days[0].d)), h('span', {}, fmt(days[15].d)), h('span', {}, '今日'))));

  // 練習ごとの正解率
  const kinds = [...KINDS, 'tango', ...(S.kstat.passage ? ['passage'] : [])];
  const names = { ...KIND_NAME, tango: '単語カード', passage: '段落リスニング' };
  const rows = h('div', { class: 'kacc' });
  for (const k of kinds) {
    const s = S.kstat[k] || { ok: 0, mid: 0, bad: 0 }, n = s.ok + s.mid + s.bad, pct = n ? Math.round(100 * s.ok / n) : null;
    rows.append(h('div', { class: 'krow', title: n ? `正解 ${s.ok}・おしい ${s.mid}・まちがい ${s.bad}` : 'まだ記録がありません' },
      h('span', { class: 'kn' }, names[k]),
      h('div', { class: 'kbar' }, h('i', { style: `width:${pct || 0}%` })),
      h('span', { class: 'kv' }, n ? `${pct}%` : '―', h('small', {}, n ? ` ${s.ok}/${n}` : ''))));
  }
  const weakest = kinds.map(k => [k, S.kstat[k]]).filter(([, s]) => s && s.ok + s.mid + s.bad >= 10).sort((a, b) => a[1].ok / (a[1].ok + a[1].mid + a[1].bad) - b[1].ok / (b[1].ok + b[1].mid + b[1].bad))[0];
  w.append(h('div', { class: 'card' },
    h('h2', {}, '練習ごとの正解率'),
    weakest ? h('div', { class: 'small', style: 'margin:-4px 0 12px' }, `いちばん苦手：`, h('b', {}, names[weakest[0]])) : null,
    rows,
    h('p', { class: 'small muted', style: 'margin:12px 0 0' }, '正解率は、この画面ができた日からの記録です。書き取りの「おしい」（60〜89%）は正解に入りません。')));
}

// ================= Anki =================
function lineById(id) { return S.lines.find(l => l.id === id); }
function viewAnkiBox() {
  const root = app(); root.innerHTML = '';
  root.append(topbar('Anki カード', { back: true }));
  const w = h('div', { class: 'wrap has-bar' }); root.append(w);
  const sec = secLines();
  const q = sec.filter(l => S.ankiQ.has(l.id));
  const failed = sec.filter(l => S.prog[l.id] && S.prog[l.id].fail > 0 && !S.ankiQ.has(l.id) && !S.ankiDone.has(l.id));
  const opt = ankiOpt();
  const tog =(key, a, b) => { const box = h('div', { class: 'chips' }); const draw = () => { box.innerHTML = ''; for (const [v, t] of [a, b]) box.append(h('button', { class: 'chip' + (opt[key] === v ? ' on' : ''), onclick: () => { opt[key] = v; saveSettings(); draw(); } }, t)); }; draw(); return box; };
  w.append(h('div', { class: 'card' },
    h('div', { style: 'font-size:28px;font-weight:800' }, `${q.length} 文`),
    h('div', { class: 'small muted' }, 'Anki に送るために選んだ文。文の横の ＋ で追加・取り消しができます。'),
    failed.length ? h('button', { class: 'btn sm', style: 'margin-top:10px', html: ICON.plus + `<span>まちがえた文をまとめて追加（${failed.length}）</span>`, onclick: () => { failed.forEach(l => S.ankiQ.add(l.id)); saveAnki(); go('ankibox'); } }) : null,
    S.settings.ankiLive && q.length ? h('button', { class: 'btn sm primary', style: 'margin-top:10px;margin-left:6px', html: ICON.check + `<span>AnkiDroid に直接送る（${q.length}）</span>`, onclick: async e => {
      const b = e.currentTarget; b.disabled = true; let ok = 0;
      try { for (const l of q) { b.innerHTML = `<span class="spinner"></span> ${ok + 1} / ${q.length}`; await ankiSendLive(l); ok++; } toast(`${ok} 枚を AnkiDroid に追加しました`); }
      catch (err) { toast(`${ok} 枚送信。エラー：${err.message}`, 6000); }
      go('ankibox');
    } }) : null));
  const isB = SEC() === 'book';
  w.append(h('div', { class: 'card' },
    h('h2', {}, 'カードの形'),
    h('div', { class: 'switch' }, h('span', {}, '表（おもて）'), tog('text', [false, isB ? '音声だけ' : '動画だけ'], [true, isB ? '音声＋文' : '動画＋文'])),
    isB ? null : h('div', { class: 'switch' }, h('span', {}, '動画の入れ方'), tog('fmt', ['video', 'AnkiDroid（カードの中で再生）'], ['sound', 'PC版 Anki（別ウィンドウ）'])),
    h('p', { class: 'small muted', style: 'margin:8px 0 0' }, '裏（うら）：文・翻訳・単語・文法・出典。同じ文をもう一度書き出しても、Anki では重複しません（上書き）。')));
  const list = h('div', { class: 'card', style: 'padding:4px 12px' });
  if (!q.length) list.append(h('div', { class: 'empty muted' }, 'まだ文を選んでいません。練習の結果や「読む」画面の ＋ で追加してください。'));
  for (const l of q) {
    const r = h('div', { class: 'ln bk' },
      h('button', { class: 'iconbtn play', 'aria-label': '再生', html: ICON.play, onclick: () => { const a = h('div'); r.after(a); a.append(playerEl(l)); } }),
      h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'spk' }, `${epLabel(l.ep)}・${fmtTime(l.st)}`), sentenceEl(l, { tap: false })),
      h('button', { class: 'iconbtn', 'aria-label': '取り消す', html: ICON.x, onclick: () => { S.ankiQ.delete(l.id); saveAnki(); r.remove(); } }));
    list.append(r);
  }
  w.append(list);
  const status = h('div', { class: 'small muted', style: 'margin:0 2px' });
  w.append(status);
  const goBtn = h('button', { class: 'btn primary', disabled: !q.length, html: ICON.download + '<span>.apkg を作る</span>' });
  goBtn.onclick = async () => {
    goBtn.disabled = true; status.innerHTML = '<span class="spinner"></span> カードを作成中…';
    try {
      const items = [];
      for (const l of q) {
        const clip = await dbGet('clips', l.id);
        const name = ankiClipName(l);
        items.push({ guid: 'frierenjp_' + l.id, tags: ankiTags(l), media: clip ? { [name]: clip } : {}, fields: ankiFields(l, opt, clip ? name : '') });
      }
      const blob = await AnkiExport.buildApkg(items, ankiDeck(isB));
      const fname = `mimikara_${today()}_${items.length}.apkg`;
      const shared = !!(navigator.canShare && navigator.canShare({ files: [new File([blob], fname)] }));
      await saveFile(blob, fname);
      q.forEach(l => { S.ankiDone.add(l.id); S.ankiQ.delete(l.id); }); saveAnki();
      toast(`${items.length} 枚のカードを作りました`);
      status.textContent = shared ? 'AnkiDroid を選んで開いてください。' : 'ダウンロードした .apkg を開くと AnkiDroid に入ります。';
      setTimeout(() => go('ankibox'), 2500);
    } catch (e) { console.error(e); status.textContent = 'エラー：' + e.message; goBtn.disabled = false; }
  };
  setBar(w, h('button', { class: 'btn', disabled: !q.length, onclick: () => { q.forEach(l => S.ankiQ.delete(l.id)); saveAnki(); go('ankibox'); } }, '全部取り消す'), goBtn);
}

// ================= オーディオブック =================
// 文のクリップを順番に再生する小さなプレーヤー
function seqPlayer({ onLine, onEnd } = {}) {
  const a = new Audio(); a.preload = 'auto';
  let list = [], idx = -1, playing = false, token = 0;
  const playAt = async i => {
    const my = ++token;
    if (i < 0 || i >= list.length) { playing = false; onEnd && onEnd(); return; }
    idx = i; playing = true; onLine && onLine(list[i], i);
    const u = await clipUrl(list[i].id); if (my !== token) return;
    if (!u) return playAt(i + 1);
    a.src = u; a.playbackRate = S.settings.rate; a.preservesPitch = true;
    try { await a.play(); } catch (e) { }
  };
  a.onended = () => { if (playing) playAt(idx + 1); };
  const api = {
    load(lines) { list = lines; idx = -1; },
    play(i = 0) { playAt(i); },
    stop() { token++; playing = false; a.pause(); },
    get playing() { return playing; }, get idx() { return idx; }, get list() { return list; }, get audio() { return a; },
  };
  CLEANUP.push(() => api.stop());
  return api;
}
const passageLines = (ep, n) => { const [a, b] = ep.passages[n]; return ep.lines.slice(a, b + 1); };
const passageDur = lines => Math.round((lines[lines.length - 1].en - lines[0].st) / 1000);
const fmtSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function viewBookReader(epId) {
  const eps = secEpIds(); epId = eps.includes(epId) ? epId : (eps.includes(S.settings.readerBook) ? S.settings.readerBook : eps[0]);
  S.settings.readerBook = epId; saveSettings();
  const ep = S.eps[epId];
  const root = app(); root.innerHTML = '';
  root.append(topbar('読む', { back: true }));
  const w = h('div', { class: 'wrap has-bar' }); root.append(w);
  const sel = h('select', { onchange: () => go('reader', sel.value) }, eps.map(e => h('option', { value: e, selected: e === epId }, epLabel(e))));
  const rateBtn = h('button', { class: 'chip' + (S.settings.rate < 1 ? ' on' : ''), onclick: () => { S.settings.rate = S.settings.rate < 1 ? 1 : 0.75; rateBtn.classList.toggle('on', S.settings.rate < 1); saveSettings(); } }, 'ゆっくり');
  let hide = false;
  const hideBtn = h('button', { class: 'chip', onclick: () => { hide = !hide; hideBtn.classList.toggle('on', hide); w.classList.toggle('hidetext', hide); } }, '文字をかくす');
  w.append(h('div', { class: 'row', style: 'margin-bottom:6px' }, sel, rateBtn, hideBtn),
    h('div', { class: 'small muted', style: 'margin:0 2px 10px' }, `${ep.book || ''}・${ep.lines.length} 文・${(ep.passages || []).length} 段落。▶ でその文から続けて再生。言葉をタップすると意味が出ます。`));
  const rows = [];
  const sp = seqPlayer({
    onLine: (l, i) => { rows.forEach(r => r.classList.remove('playing')); const r = rows[ep.lines.indexOf(l)]; if (r) { r.classList.add('playing'); r.classList.add('heard'); r.scrollIntoView({ behavior: 'smooth', block: 'center' }); } updBar(); },
    onEnd: () => updBar(),
  });
  sp.load(ep.lines);
  const passages = ep.passages && ep.passages.length ? ep.passages : [[0, ep.lines.length - 1]];
  passages.forEach(([a, b], n) => {
    const pl = ep.lines.slice(a, b + 1);
    const card = h('div', { class: 'card passage', style: 'padding:8px 10px' },
      h('div', { class: 'phead' }, h('b', {}, `段落 ${n + 1}`), h('span', { class: 'small muted' }, `${fmtTime(pl[0].st)}・${pl.length} 文・${passageDur(pl)} 秒`),
        h('span', { style: 'flex:1' }),
        h('button', { class: 'btn sm', html: ICON.play + '<span>聞く</span>', onclick: () => { sp.load(ep.lines); sp.play(a); } }),
        h('button', { class: 'btn sm', html: ICON.headphones + '<span>練習</span>', onclick: () => go('passage', { ep: epId, n }) })));
    for (let i = a; i <= b; i++) {
      const l = ep.lines[i];
      const r = h('div', { class: 'ln bk' + (l.dq ? ' dq' : '') },
        h('button', { class: 'iconbtn play', 'aria-label': 'ここから再生', html: ICON.play, onclick: () => { sp.load(ep.lines); sp.play(i); } }),
        h('div', { style: 'flex:1;min-width:0', onclick: e => { if (e.target.closest('.w')) return; sp.load(ep.lines); sp.play(i); } }, sentenceEl(l)),
        h('div', { class: 'rowbtns' }, ankiBtn(l, true), h('button', { class: 'iconbtn', 'aria-label': 'シャドーイング', html: ICON.mic, onclick: () => shadowOne(l) })));
      rows[i] = r; card.append(r);
    }
    w.append(card);
  });
  const playBtn = h('button', { class: 'btn primary' });
  const prevBtn = h('button', { class: 'btn', style: 'flex:0 0 56px', 'aria-label': '前の文', html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/></svg>', onclick: () => sp.play(Math.max(0, sp.idx - 1)) });
  const nextBtn = h('button', { class: 'btn', style: 'flex:0 0 56px', 'aria-label': '次の文', html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>', onclick: () => sp.play(Math.min(ep.lines.length - 1, sp.idx + 1)) });
  const updBar = () => { playBtn.innerHTML = sp.playing ? ICON.stop + '<span>とめる</span>' : ICON.headphones + `<span>${sp.idx >= 0 ? 'つづきから聞く' : '最初から聞く'}</span>`; };
  playBtn.onclick = () => { if (sp.playing) { sp.stop(); updBar(); } else sp.play(sp.idx >= 0 ? sp.idx : 0); };
  updBar();
  setBar(w, prevBtn, playBtn, nextBtn);
}

// 章リスニング：章を最初から最後まで聞きながら、文字を追いかける（ライブ字幕のように）
const bookChapters = ep => secEpIds('book').filter(id => S.eps[id].book === ep.book).sort((a, b) => (S.eps[a].chn || 0) - (S.eps[b].chn || 0));
function viewListen(arg) {
  const eps = secEpIds('book');
  if (!eps.length) { toast('オーディオブックの章がありません。'); return go('home'); }
  const pos = S.settings.listenPos || (S.settings.listenPos = {});
  const epId = arg && eps.includes(arg.ep) ? arg.ep : eps.includes(S.settings.listenEp) ? S.settings.listenEp : eps[0];
  S.settings.listenEp = epId; saveSettings();
  const ep = S.eps[epId], lines = ep.lines, total = lines[lines.length - 1].en;
  const root = app(); root.innerHTML = '';
  const ankiSlot = h('div'); // 今の文を Anki に（再生中の文に合わせて入れかわる）
  root.append(topbar('章リスニング', { back: true, right: ankiSlot }));
  const w = h('div', { class: 'wrap has-bar listen' }); root.append(w);

  // 上：章の選択・速さ・先の文を見せるか・章の中の位置
  const sel = h('select', { onchange: () => go('listen', { ep: sel.value }) }, eps.map(e => h('option', { value: e, selected: e === epId }, `${S.eps[e].book ? S.eps[e].book + '・' : ''}${epLabel(e)}`)));
  const rateBtn = h('button', { class: 'chip' + (S.settings.rate < 1 ? ' on' : ''), onclick: () => { S.settings.rate = S.settings.rate < 1 ? 1 : 0.75; rateBtn.classList.toggle('on', S.settings.rate < 1); sp.audio.playbackRate = S.settings.rate; saveSettings(); } }, 'ゆっくり');
  const aheadBtn = h('button', { class: 'chip' + (S.settings.listenAhead ? ' on' : ''), onclick: () => { S.settings.listenAhead = !S.settings.listenAhead; aheadBtn.classList.toggle('on', S.settings.listenAhead); w.classList.toggle('ahead', S.settings.listenAhead); saveSettings(); } }, '先の文も表示');
  w.classList.toggle('ahead', !!S.settings.listenAhead);
  const timeTxt = h('span', { class: 'small muted', style: 'font-variant-numeric:tabular-nums' });
  const bar = h('i');
  const seek = h('div', { class: 'lv-seek', title: 'タップでその位置へ' }, bar);
  seek.addEventListener('click', e => { const r = seek.getBoundingClientRect(), t = (e.clientX - r.left) / r.width * total; let k = lines.findIndex(l => l.en >= t); playFrom(k < 0 ? lines.length - 1 : k); });
  w.append(h('div', { class: 'card lv-head' },
    h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, sel, rateBtn, aheadBtn),
    h('div', { class: 'row', style: 'gap:10px;align-items:center;margin-top:10px' }, seek, timeTxt)));

  // 本文：段落ごとに文を並べる
  const rows = [];
  const passages = ep.passages && ep.passages.length ? ep.passages : [[0, lines.length - 1]];
  const text = h('div', { class: 'lv-text' });
  for (const [a, b] of passages) {
    const par = h('div', { class: 'lv-par' });
    for (let i = a; i <= b; i++) {
      const l = lines[i];
      const r = h('div', { class: 'lv-s future' + (l.dq ? ' dq' : '') }, h('div', { class: 'lv-txt' }, sentenceEl(l)), ankiBtn(l, true));
      r.addEventListener('click', e => { if (e.target.closest('.w') && !r.classList.contains('future')) return; playFrom(i); });
      rows[i] = r; par.append(r);
    }
    text.append(par);
  }
  w.append(h('div', { class: 'card', style: 'padding:14px 12px' }, text));
  const endBox = h('div');
  w.append(endBox);

  // 再生
  let cur = -1, userScroll = 0, weights = [];
  const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const setCur = i => {
    cur = i;
    rows.forEach((r, k) => { r.classList.toggle('past', k < i); r.classList.toggle('cur', k === i); r.classList.toggle('future', k > i); if (k !== i) r.querySelectorAll('.said').forEach(x => x.classList.remove('said')); });
    const ws = [...rows[i].querySelectorAll('.w')], toks = lines[i].tk.filter(t => t.p !== 'sp');
    let acc = 0; const tot = toks.reduce((n, t) => n + t.s.length, 0) || 1;
    weights = ws.map((el, k) => { acc += (toks[k] ? toks[k].s.length : 1); return [el, acc / tot]; });
    ankiSlot.replaceChildren(ankiBtn(lines[i], 'top'));
    if (Date.now() - userScroll > 4000) rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
    pos[epId] = i; saveSettings();
  };
  const sp = seqPlayer({
    onLine: (l, i) => { setCur(i); updBar(); },
    onEnd: () => { updBar(); finished(); },
  });
  sp.load(lines);
  const tick = () => {
    if (cur < 0) return;
    const l = lines[cur], abs = (l.cs || 0) + sp.audio.currentTime * 1000;
    const frac = sp.playing ? Math.min(1, Math.max(0, (abs - l.st) / Math.max(1, l.en - l.st))) : null;
    if (frac != null) for (const [el, f] of weights) el.classList.toggle('said', f - 0.5 / (weights.length || 1) <= frac);
    const now = sp.playing ? Math.min(total, abs) : l.st;
    bar.style.width = `${100 * now / total}%`; timeTxt.textContent = `${fmt(now)} / ${fmt(total)}`;
  };
  const timer = setInterval(tick, 80); // requestAnimationFrame se para si la pestaña no se ve
  CLEANUP.push(() => clearInterval(timer));
  const markScroll = () => { userScroll = Date.now(); };
  addEventListener('wheel', markScroll, { passive: true }); addEventListener('touchmove', markScroll, { passive: true });
  CLEANUP.push(() => { removeEventListener('wheel', markScroll); removeEventListener('touchmove', markScroll); });
  const playFrom = i => { endBox.innerHTML = ''; userScroll = 0; sp.load(lines); sp.play(i); };

  // 章の終わり：次の章があれば続けて再生
  const chs = bookChapters(ep), next = chs[chs.indexOf(epId) + 1];
  const finished = () => {
    rows.forEach(r => { r.classList.remove('cur', 'future'); r.classList.add('past'); r.querySelectorAll('.said').forEach(x => x.classList.remove('said')); });
    pos[epId] = 0; saveSettings();
    endBox.innerHTML = '';
    endBox.append(h('div', { class: 'card', style: 'text-align:center' },
      h('div', { style: 'font-weight:800;font-size:18px' }, 'この章はおしまい！'),
      h('div', { class: 'small muted', style: 'margin:4px 0 12px' }, next ? `5秒後に次の章「${epLabel(next)}」へ` : 'おつかれさまでした。'),
      next ? h('button', { class: 'btn primary', onclick: () => go('listen', { ep: next, auto: true }) }, '次の章へ') : null));
    endBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (next) { const t = setTimeout(() => go('listen', { ep: next, auto: true }), 5000); CLEANUP.push(() => clearTimeout(t)); }
  };

  // 下のバー
  const playBtn = h('button', { class: 'btn primary' });
  const prevBtn = h('button', { class: 'btn', style: 'flex:0 0 56px', 'aria-label': '前の文', html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/></svg>', onclick: () => playFrom(Math.max(0, cur - 1)) });
  const nextBtn = h('button', { class: 'btn', style: 'flex:0 0 56px', 'aria-label': '次の文', html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>', onclick: () => playFrom(Math.min(lines.length - 1, cur + 1)) });
  const updBar = () => { playBtn.innerHTML = sp.playing ? ICON.stop + '<span>一時停止</span>' : ICON.headphones + `<span>${cur > 0 ? 'つづきから聞く' : '最初から聞く'}</span>`; };
  playBtn.onclick = () => { if (sp.playing) { sp.stop(); updBar(); } else playFrom(cur >= 0 ? cur : 0); };
  setBar(w, prevBtn, playBtn, nextBtn);

  // 前回の続きの位置を表示（自動再生は次の章に進んだときだけ）
  const start = Math.min(pos[epId] || 0, lines.length - 1);
  if (start > 0 || (arg && arg.auto)) setCur(start);
  updBar();
  if (arg && arg.auto) playFrom(start);
}

// 段落リスニング：段落を通して聞く → 文を確認 → 自己評価
function pickPassage() {
  const ids = selEps().filter(id => S.eps[id].passages && S.eps[id].passages.length);
  const cands = [];
  for (const id of ids) S.eps[id].passages.forEach((_, n) => {
    const p = S.prog[`${id}#p${n}`]; let wgt = !p ? 1.5 : 1 + (p.due <= Date.now() ? 3 : 0) + Math.min(p.fail, 4) * 1.5; if (p && p.ivl >= 7) wgt *= 0.3;
    cands.push([id, n, wgt]);
  });
  if (!cands.length) return null;
  let tot = cands.reduce((a, c) => a + c[2], 0), r = Math.random() * tot;
  for (const c of cands) { r -= c[2]; if (r <= 0) return { ep: c[0], n: c[1] }; }
  return { ep: cands[0][0], n: cands[0][1] };
}
function viewPassage(arg) {
  arg = arg && S.eps[arg.ep] ? arg : pickPassage();
  if (!arg) { toast('段落のある章がありません。'); return go('home'); }
  const ep = S.eps[arg.ep], n = arg.n, lines = passageLines(ep, n), pid = `${arg.ep}#p${n}`;
  const root = app(); root.innerHTML = '';
  root.append(topbar('段落リスニング', { back: true }));
  const w = h('div', { class: 'wrap has-bar' }); root.append(w);
  const prog = S.prog[pid];
  w.append(h('div', { class: 'card' },
    h('div', { class: 'small muted' }, `${ep.book || ''}・${epLabel(arg.ep)}`),
    h('div', { style: 'font-size:20px;font-weight:800;margin:2px 0 6px' }, `段落 ${n + 1} / ${ep.passages.length}`),
    h('div', { class: 'small muted' }, `${lines.length} 文・約 ${passageDur(lines)} 秒${prog ? `・前回：${prog.last ? new Date(prog.last).toLocaleDateString('ja-JP') : ''}` : '・はじめて'}`)));
  const status = h('div', { class: 'listen-status' });
  const dots = h('div', { class: 'dots' }, lines.map(() => h('i')));
  const bigBtn = h('button', { class: 'bigplay', 'aria-label': '再生' });
  const rateBtn = h('button', { class: 'chip' + (S.settings.rate < 1 ? ' on' : ''), onclick: () => { S.settings.rate = S.settings.rate < 1 ? 1 : 0.75; rateBtn.classList.toggle('on', S.settings.rate < 1); saveSettings(); } }, 'ゆっくり');
  w.append(h('div', { class: 'card', style: 'text-align:center' }, bigBtn, status, dots, h('div', { class: 'chips', style: 'justify-content:center;margin-top:10px' }, rateBtn),
    h('p', { class: 'small muted', style: 'margin:10px 0 0' }, 'まず文字を見ないで最後まで聞いてみよう。何回聞いてもOK。')));
  const textBox = h('div');
  w.append(textBox);
  let revealed = false, plays = 0;
  const rows = [];
  const sp = seqPlayer({
    onLine: (l, i) => { const k = lines.indexOf(l); dots.querySelectorAll('i').forEach((d, j) => { d.classList.toggle('on', j === k); if (j < k) d.classList.add('done'); }); rows.forEach((r, j) => r && r.classList.toggle('playing', j === k)); status.textContent = `${k + 1} / ${lines.length} 文目`; upd(); },
    onEnd: () => { plays++; dots.querySelectorAll('i').forEach(d => { d.classList.remove('on'); d.classList.add('done'); }); status.textContent = plays === 1 ? 'どのくらい分かった？ 文字を見て確かめよう。' : `${plays} 回聞きました`; rows.forEach(r => r && r.classList.remove('playing')); upd(); },
  });
  sp.load(lines);
  const upd = () => { bigBtn.innerHTML = sp.playing ? ICON.stop : ICON.play; bigBtn.classList.toggle('on', sp.playing); };
  bigBtn.onclick = () => { if (sp.playing) { sp.stop(); upd(); } else { dots.querySelectorAll('i').forEach(d => d.classList.remove('done')); sp.load(lines); sp.play(0); } };
  upd(); status.textContent = '▶ を押して聞く';
  const reveal = () => {
    revealed = true; textBox.innerHTML = '';
    const card = h('div', { class: 'card' });
    lines.forEach((l, j) => {
      const r = h('div', { class: 'ln bk' + (l.dq ? ' dq' : '') },
        h('button', { class: 'iconbtn play', 'aria-label': '再生', html: ICON.play, onclick: () => { sp.load([l]); sp.play(0); } }),
        h('div', { style: 'flex:1;min-width:0' }, sentenceEl(l)),
        h('div', { class: 'rowbtns' }, ankiBtn(l, true), h('button', { class: 'iconbtn', 'aria-label': 'シャドーイング', html: ICON.mic, onclick: () => shadowOne(l) })));
      rows[j] = r; card.append(r);
    });
    const seen = new Set(), gl = [];
    for (const l of lines) for (const g of l.gr || []) if (S.grammar[g[0]] && !gBasic(g[0]) && !seen.has(g[0])) { seen.add(g[0]); gl.push(g[0]); }
    gl.sort((a, b) => lvRank(gLv(b)) - lvRank(gLv(a)));
    if (gl.length) card.append(h('div', { class: 'section-title' }, 'この段落の文法'), h('div', { class: 'gchips', style: 'margin-top:0' }, gl.slice(0, 12).map(id => h('button', { class: 'gchip', onclick: () => grammarSheet(id) }, lvBadge(gLv(id)), ' ', S.grammar[id][0]))));
    card.append(h('div', { class: 'meta-line' }, '言葉をタップすると意味が出ます'));
    textBox.append(card);
    const rate = (ok, label) => {
      grade({ id: pid }, ok, 'passage');
      toast(label);
      const hasNext = n + 1 < ep.passages.length;
      setBar(w, h('button', { class: 'btn', onclick: () => go('passage') }, 'ランダム'), hasNext ? h('button', { class: 'btn primary', onclick: () => go('passage', { ep: arg.ep, n: n + 1 }) }, '次の段落') : h('button', { class: 'btn primary', onclick: () => go('home') }, 'ホーム'));
    };
    setBar(w, h('button', { class: 'btn', onclick: () => rate(false, 'また練習しよう') }, '分からない'), h('button', { class: 'btn', onclick: () => rate(null, 'もう少し！') }, 'だいたい'), h('button', { class: 'btn primary', onclick: () => rate(true, 'すばらしい！') }, 'よく分かった'));
    textBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  setBar(w, h('button', { class: 'btn primary', onclick: reveal }, '文字を見る'));
}

const VIEWS = { listen: viewListen, wordquiz: viewWordQuiz, wordsum: viewWordSummary, stats: viewStats, ankibox: viewAnkiBox, passage: viewPassage, home: viewHome, settings: viewSettings, reader: viewReader, vocab: viewVocab, summary: viewSummary, glist: viewGrammarList };

// ================= 起動 =================
(async () => {
  try { await loadAll(); } catch (e) { app().textContent = 'データベースを開けませんでした：' + e.message; return; }
  go('home');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
})();
