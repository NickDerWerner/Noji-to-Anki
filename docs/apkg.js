// Builds an Anki package (.apkg) in the browser: a zip with an SQLite collection
// (legacy schema 11, the format genanki and older Anki versions write), a "media"
// index and the images as numbered files. Any Anki 2.1+ can import it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/fflate.js'));
  } else {
    root.ApkgBuilder = factory(root.fflate);
  }
})(typeof self !== 'undefined' ? self : this, function (fflate) {
  'use strict';

  // Fixed, so importing several Noji decks reuses the same note type
  const MODEL_ID = 1760000000001;
  const MODEL_NAME = 'Noji Basic';

  const SCHEMA = `
    CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null,
      ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null,
      models text not null, decks text not null, dconf text not null, tags text not null);
    CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null,
      usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null,
      flags integer not null, data text not null);
    CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null,
      mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null,
      ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null,
      odue integer not null, odid integer not null, flags integer not null, data text not null);
    CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null,
      ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
    CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
    CREATE INDEX ix_notes_usn on notes (usn);
    CREATE INDEX ix_cards_usn on cards (usn);
    CREATE INDEX ix_revlog_usn on revlog (usn);
    CREATE INDEX ix_cards_nid on cards (nid);
    CREATE INDEX ix_cards_sched on cards (did, queue, due);
    CREATE INDEX ix_revlog_cid on revlog (cid);
    CREATE INDEX ix_notes_csum on notes (csum);
  `;

  const CSS = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}
.card img { max-width: 100%; height: auto; }
`;

  function deckObject(id, name, now) {
    return {
      id, name, mod: now, usn: -1, desc: '', dyn: 0, conf: 1, collapsed: false, browserCollapsed: false,
      extendNew: 0, extendRev: 0, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0],
    };
  }

  function modelObject(did, now) {
    const field = (name, ord) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] });
    return {
      id: MODEL_ID, name: MODEL_NAME, type: 0, mod: now, usn: -1, sortf: 0, did, tags: [], vers: [],
      flds: [field('Front', 0), field('Back', 1)],
      tmpls: [{
        name: 'Card 1', ord: 0, did: null, bqfmt: '', bafmt: '',
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
      }],
      req: [[0, 'any', [0]]],
      css: CSS,
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
    };
  }

  const DECK_CONFIG = {
    1: {
      id: 1, name: 'Default', mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
      new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
      lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
      rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 200 },
    },
  };

  // What Anki uses for the sort field and duplicate check: the text without HTML
  function stripHtml(html) {
    return html
      .replace(/<img[^>]*src=["']?([^"'>]+)["']?[^>]*>/gi, ' $1 ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .trim();
  }

  async function checksum(text) {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
    const hex = [...new Uint8Array(digest).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return parseInt(hex, 16);
  }

  // notes: [{ guid, front, back, deckName }], media: Map(filename -> bytes)
  async function buildApkg(SQL, notes, media) {
    const nowMs = Date.now();
    const now = Math.floor(nowMs / 1000);

    // One Anki deck per full deck name, plus any missing parents ("A::B" needs "A")
    const deckIds = new Map();
    let nextDeckId = nowMs;
    const addDeck = (name) => {
      if (deckIds.has(name)) return;
      const parts = name.split('::');
      for (let i = 1; i < parts.length; i++) addDeck(parts.slice(0, i).join('::'));
      deckIds.set(name, nextDeckId++);
    };
    notes.forEach((n) => addDeck(n.deckName));

    const decks = { 1: deckObject(1, 'Default', now) };
    for (const [name, id] of deckIds) decks[id] = deckObject(id, name, now);
    const firstDeckId = deckIds.size ? deckIds.values().next().value : 1;

    const conf = {
      activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true,
      dueCounts: true, curModel: String(MODEL_ID), nextPos: notes.length + 1, sortType: 'noteFld',
      sortBackwards: false, addToCur: true,
    };

    const db = new SQL.Database();
    try {
      db.run(SCHEMA);
      db.run('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)', [
        now, nowMs, nowMs, JSON.stringify(conf), JSON.stringify({ [MODEL_ID]: modelObject(firstDeckId, now) }),
        JSON.stringify(decks), JSON.stringify(DECK_CONFIG), '{}',
      ]);

      const insertNote = db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, -1, \'\', ?, ?, ?, 0, \'\')');
      const insertCard = db.prepare('INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, \'\')');
      db.run('BEGIN');
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        const sortField = stripHtml(n.front);
        const noteId = nowMs + i;
        insertNote.run([noteId, n.guid, MODEL_ID, now, `${n.front}\x1f${n.back}`, sortField, await checksum(sortField)]);
        insertCard.run([noteId, noteId, deckIds.get(n.deckName), now, i + 1]);
      }
      db.run('COMMIT');
      insertNote.free();
      insertCard.free();

      const mediaIndex = {};
      const entries = { 'collection.anki2': [db.export(), { level: 6 }] };
      let i = 0;
      for (const [name, bytes] of media) {
        mediaIndex[i] = name;
        entries[String(i)] = [bytes, { level: 0 }];
        i++;
      }
      entries.media = [fflate.strToU8(JSON.stringify(mediaIndex)), { level: 6 }];
      return fflate.zipSync(entries);
    } finally {
      db.close();
    }
  }

  return { buildApkg, stripHtml, MODEL_ID };
});
