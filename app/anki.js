'use strict';
// Anki用の .apkg をブラウザ内で作る（sql.js を使用）。genanki と同じ形式。
(function () {
  const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn); CREATE INDEX ix_cards_usn on cards (usn); CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid); CREATE INDEX ix_cards_sched on cards (did, queue, due); CREATE INDEX ix_revlog_cid on revlog (cid); CREATE INDEX ix_notes_csum on notes (csum);`;

  const CONF = { activeDecks: [1], addToCur: true, collapseTime: 1200, curDeck: 1, curModel: '1', dueCounts: true, estTimes: true, newBury: true, newSpread: 0, nextPos: 1, sortBackwards: false, sortType: 'noteFld', timeLim: 0 };
  const DCONF = { 1: { autoplay: true, id: 1, lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 }, maxTaken: 60, mod: 0, name: 'Default', new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true }, replayq: true, rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 }, timer: 0, usn: 0 } };
  const deckJson = (id, name) => ({ collapsed: false, conf: 1, desc: '', dyn: 0, extendNew: 0, extendRev: 50, id, lrnToday: [0, 0], mod: 0, name, newToday: [0, 0], revToday: [0, 0], timeToday: [0, 0], usn: -1 });

  const MODEL_ID = 1726000000011, DECK_ID = 1726000000002;
  const FIELDS = ['動画', '表の文', '文', '翻訳', '単語', '文法', '出典'];
  const CSS = `.card{font-family:"Noto Sans CJK JP","Hiragino Sans","Yu Gothic",sans-serif;font-size:20px;text-align:center;color:#1f2328;background:#f6f4ef;line-height:1.6}
.ja{font-size:30px;margin:12px 0}.tr{color:#3f7d6e;font-size:18px;margin:10px 0}.src{color:#888;font-size:13px;margin-top:14px}
.words,.gram{text-align:left;display:inline-block;font-size:16px;margin:8px 0}.words b{font-size:18px}
.media video{width:100%;max-width:640px;border-radius:12px;background:#000}
.nightMode .card,.card.nightMode{background:#15181b;color:#e8eaed}`;
  const QFMT = '<div class="media">{{動画}}</div>{{#表の文}}<div class="ja">{{表の文}}</div>{{/表の文}}';
  const AFMT = '{{FrontSide}}<hr id="answer">{{^表の文}}<div class="ja">{{文}}</div>{{/表の文}}<div class="tr">{{翻訳}}</div><div class="words">{{単語}}</div><div class="gram">{{文法}}</div><div class="src">{{出典}}</div>';

  function modelJson(now) {
    return {
      css: CSS, did: DECK_ID, id: String(MODEL_ID), latexPost: '\\end{document}', latexPre: '\\documentclass[12pt]{article}\\special{papersize=3in,5in}\\usepackage{amssymb,amsmath}\\pagestyle{empty}\\setlength{\\parindent}{0in}\\begin{document}', latexsvg: false,
      mod: now, name: '耳から日本語（動画）', req: [[0, 'any', [0]]], sortf: 2, tags: [], type: 0, usn: -1, vers: [],
      flds: FIELDS.map((name, ord) => ({ name, ord, font: 'Liberation Sans', media: [], rtl: false, size: 20, sticky: false })),
      tmpls: [{ name: '文カード', ord: 0, qfmt: QFMT, afmt: AFMT, bafmt: '', bqfmt: '', bfont: '', bsize: 0, did: null }],
    };
  }

  let SQL = null;
  async function sql() {
    if (!SQL) SQL = await initSqlJs({ locateFile: f => f });
    return SQL;
  }

  // items: [{guid, fields:[6 strings], tags:[..], media:{name: Blob}}]
  async function buildApkg(items, deckName) {
    const S = await sql();
    const db = new S.Database();
    db.run(SCHEMA);
    const now = Math.floor(Date.now() / 1000);
    const decks = { 1: deckJson(1, 'Default'), [DECK_ID]: deckJson(DECK_ID, deckName) };
    db.run('INSERT INTO col VALUES(null,?,?,?,?,?,?,?,?,?,?,?,?)', [now, now * 1000, now * 1000, 11, 0, 0, 0,
      JSON.stringify(CONF), JSON.stringify({ [MODEL_ID]: modelJson(now) }), JSON.stringify(decks), JSON.stringify(DCONF), '{}']);
    let id = Date.now();
    const media = {}, files = {};
    let mi = 0;
    items.forEach((it, k) => {
      const nid = id++, cid = id++;
      db.run('INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)', [nid, it.guid, MODEL_ID, now, -1, ' ' + it.tags.join(' ') + ' ', it.fields.join('\x1f'), it.fields[2].replace(/<[^>]+>/g, ''), 0, 0, '']);
      db.run('INSERT INTO cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [cid, nid, DECK_ID, 0, now, -1, 0, 0, k, 0, 0, 0, 0, 0, 0, 0, 0, '']);
      for (const [name, blob] of Object.entries(it.media || {})) { media[String(mi)] = name; files[String(mi)] = blob; mi++; }
    });
    const colBytes = db.export(); db.close();
    const zipIn = { 'collection.anki2': [colBytes, { level: 0 }], media: [fflate.strToU8(JSON.stringify(media)), { level: 0 }] };
    for (const [k, b] of Object.entries(files)) zipIn[k] = [new Uint8Array(await b.arrayBuffer()), { level: 0 }];
    return new Blob([fflate.zipSync(zipIn)], { type: 'application/octet-stream' });
  }

  window.AnkiExport = { buildApkg };
})();
