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

  const DAY_MS = 86400000;
  const ROLLOVER_HOUR = 4; // Anki's default: a new day starts at 4 am

  // Start of the current Anki day (local time), used as the collection's creation time,
  // so "today" is day 0 and review due dates are days relative to it
  function ankiDayStart(nowMs) {
    const d = new Date(nowMs);
    d.setHours(ROLLOVER_HOUR, 0, 0, 0);
    if (d.getTime() > nowMs) d.setDate(d.getDate() - 1);
    return d.getTime();
  }

  // Calendar days between two moments in local time
  function localDayDiff(fromMs, toMs) {
    const day = (ms) => { const d = new Date(ms); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS; };
    return day(toMs) - day(fromMs);
  }

  // Anki card columns (type, queue, due, ivl, factor, left) for a card's progress
  function scheduling(progress, newPosition, dayStartMs, nowMs) {
    const card = { type: 0, queue: 0, due: newPosition, ivl: 0, factor: 0, left: 0 };
    if (progress && progress.state === 'review') {
      Object.assign(card, {
        type: 2, queue: 2, due: localDayDiff(dayStartMs, progress.due),
        ivl: progress.intervalDays, factor: progress.ease,
      });
    } else if (progress && (progress.state === 'learning' || progress.state === 'relearning')) {
      // Learning steps of a day or more are scheduled by day, shorter ones by timestamp
      const byDay = progress.due - nowMs >= DAY_MS;
      const relearning = progress.state === 'relearning';
      Object.assign(card, {
        type: relearning ? 3 : 1, queue: byDay ? 3 : 1,
        due: byDay ? localDayDiff(dayStartMs, progress.due) : Math.floor(progress.due / 1000),
        ivl: relearning ? progress.intervalDays : 0, factor: progress.ease,
        left: relearning ? 1 : progress.stepsLeft, // Anki relearns in one step by default
      });
    }
    if (progress && progress.frozen) card.queue = -1; // frozen in Noji = suspended in Anki
    return card;
  }

  // Noji exports a card's current state but not its review history. Anki's FSRS needs at
  // least one past review to work out how well a card is known, so learned cards get an
  // estimated entry: a "Good" on the day of the last review (next review minus interval),
  // plus the "Again" for cards that were forgotten and are being relearned.
  // Rows: [time ms, ease, ivl, lastIvl, factor]
  function estimatedReviews(progress, nowMs) {
    if (!progress || !progress.intervalDays) return [];
    const ivl = progress.intervalDays;
    const intervalMs = progress.intervalMinutes * 60000;
    if (progress.state === 'review') {
      // Noji rounds the next review to the start of a day, so the last review was up to a day later
      return [[Math.min(progress.due - intervalMs + DAY_MS / 2, nowMs), 3, ivl, 0, progress.ease]];
    }
    if (progress.state === 'relearning') {
      const lapse = Math.min(progress.due - 60000, nowMs); // Noji shows a forgotten card again after 1 minute
      // Anki and Noji lower the ease by 20 percentage points on a lapse
      return [[lapse - intervalMs, 3, ivl, 0, progress.ease + 200], [lapse, 1, -60, ivl, progress.ease]];
    }
    return [];
  }

  // notes: [{ guid, front, back, deckName, progress }], media: Map(filename -> bytes)
  async function buildApkg(SQL, notes, media) {
    const nowMs = Date.now();
    const now = Math.floor(nowMs / 1000);
    const dayStartMs = ankiDayStart(nowMs);

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
        Math.floor(dayStartMs / 1000), nowMs, nowMs, JSON.stringify(conf), JSON.stringify({ [MODEL_ID]: modelObject(firstDeckId, now) }),
        JSON.stringify(decks), JSON.stringify(DECK_CONFIG), '{}',
      ]);

      const insertNote = db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, -1, \'\', ?, ?, ?, 0, \'\')');
      const insertCard = db.prepare('INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, ?, ?, ?, ?, ?, 0, 0, ?, 0, 0, 0, \'\')');
      const insertReview = db.prepare('INSERT INTO revlog VALUES (?, ?, -1, ?, ?, ?, ?, 0, 1)');
      const usedReviewIds = new Set();
      db.run('BEGIN');
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        const sortField = stripHtml(n.front);
        const noteId = nowMs + i;
        insertNote.run([noteId, n.guid, MODEL_ID, now, `${n.front}\x1f${n.back}`, sortField, await checksum(sortField)]);
        const c = scheduling(n.progress, i + 1, dayStartMs, nowMs);
        insertCard.run([noteId, noteId, deckIds.get(n.deckName), now, c.type, c.queue, c.due, c.ivl, c.factor, c.left]);
        for (const [time, ease, ivl, lastIvl, factor] of estimatedReviews(n.progress, nowMs)) {
          let id = Math.round(time); // the review id is its timestamp and must be unique
          while (usedReviewIds.has(id)) id++;
          usedReviewIds.add(id);
          insertReview.run([id, noteId, ease, ivl, lastIvl, factor]);
        }
      }
      db.run('COMMIT');
      insertNote.free();
      insertCard.free();
      insertReview.free();

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
