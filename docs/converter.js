// Noji .ofc -> Anki import, entirely in the browser.
// Mirrors noji_to_anki.py. Works in the browser (window.NojiConverter) and in Node (for tests).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/fflate.js'), require('./vendor/fzstd.js'));
  } else {
    root.NojiConverter = factory(root.fflate, root.fzstd);
  }
})(typeof self !== 'undefined' ? self : this, function (fflate, fzstd) {
  'use strict';

  const DOWNLOAD_CONCURRENCY = 4;
  const DOWNLOAD_TIMEOUT_MS = 30000;

  function basename(path) {
    return path.split('/').pop();
  }

  function isMacJunk(path) {
    return path.startsWith('__MACOSX/') || basename(path).startsWith('._');
  }

  function cleanHtml(text) {
    if (text === undefined || text === null) return '';
    return String(text).replace(/\t/g, ' ').replace(/\n/g, '<br>');
  }

  // A file name we can safely put into a zip (no folders, no tricks)
  function isSafeFilename(name) {
    return name && name !== '.' && name !== '..' && !/[\\/:*?"<>|\x00-\x1f]/.test(name);
  }

  // "öff_r_2026.ofc" -> "öff_r_2026"
  function deckBaseName(fileName) {
    return fileName.replace(/\.ofc$/i, '');
  }

  // 1. Find the deck data and attachments inside the .ofc (a zip file)
  function readOfc(ofcBytes) {
    const wanted = ['deck_data.json', 'deck_export_data', 'attachments.zip'];
    let files;
    try {
      files = fflate.unzipSync(ofcBytes, {
        filter: (f) => !isMacJunk(f.name) && wanted.includes(basename(f.name)),
      });
    } catch (e) {
      throw new Error("This file doesn't look like a Noji export. Please choose the .ofc file you exported from Noji.");
    }

    const found = {};
    for (const [path, bytes] of Object.entries(files)) found[basename(path)] = bytes;

    let deckJsonBytes;
    if (found['deck_data.json']) {
      deckJsonBytes = found['deck_data.json'];
    } else if (found['deck_export_data']) {
      try {
        deckJsonBytes = fzstd.decompress(found['deck_export_data']);
      } catch (e) {
        throw new Error("The deck data inside this file couldn't be unpacked. The export may be damaged. Try exporting it from Noji again.");
      }
    } else {
      throw new Error("No deck data found in this file. Please choose the .ofc file you exported from Noji.");
    }

    let data;
    try {
      data = JSON.parse(new TextDecoder().decode(deckJsonBytes));
    } catch (e) {
      throw new Error("The deck data couldn't be read. The export may be damaged. Try exporting it from Noji again.");
    }
    if (!Array.isArray(data)) {
      throw new Error("The deck data has an unexpected format.");
    }

    return { data, attachmentsZip: found['attachments.zip'] || null };
  }

  // 2. Build the Anki rows and collect the images the cards use
  function buildCards(data, label) {
    const deckMap = new Map(data.map((deck) => [String(deck.id), deck.name]));

    function fullDeckName(deck) {
      const ancestry = deck.ancestry || '/';
      const names = [];
      for (const id of ancestry.replace(/^\/+|\/+$/g, '').split('/')) {
        if (/^\d+$/.test(id) && deckMap.has(String(Number(id)))) names.push(deckMap.get(String(Number(id))));
      }
      names.push(deck.name);
      return names.join('::');
    }

    const rows = [];
    const mediaUrls = new Map();
    for (const deck of data) {
      const deckName = fullDeckName(deck);
      for (const note of deck.notes || []) {
        const fields = note.fields || {};
        let front = cleanHtml(fields.front_side);
        let back = cleanHtml(fields.back_side);

        for (const att of note.note_attachments || []) {
          const url = att && att.attachment && att.attachment.media_file && att.attachment.media_file.url;
          if (!url) continue;
          const filename = basename(url);
          mediaUrls.set(filename, url);
          const imgTag = `<img src="${filename}">`;
          if (att.field_name === 'front_side') front += `<br>${imgTag}`;
          else back += `<br>${imgTag}`;
        }

        if (label && !front.startsWith(label)) front = label + front;
        rows.push(`${front}\t${back}\t${deckName}`);
      }
    }

    const txt = '#separator:tab\n#html:true\n#deck column:3\n' + rows.map((r) => r + '\n').join('');
    return { txt, cardCount: rows.length, deckCount: data.length, mediaUrls };
  }

  // 3. Take the images the cards use out of attachments.zip
  function extractMedia(attachmentsZip, mediaUrls) {
    const media = new Map();
    if (!attachmentsZip) return media;
    const files = fflate.unzipSync(attachmentsZip, {
      filter: (f) => !isMacJunk(f.name) && mediaUrls.has(basename(f.name)),
    });
    for (const [path, bytes] of Object.entries(files)) {
      if (bytes.length) media.set(basename(path), bytes);
    }
    return media;
  }

  // 4. Download images that are missing from the export
  async function downloadMissing(mediaUrls, media, onProgress, fetchImpl) {
    const doFetch = fetchImpl || fetch;
    const missing = [...mediaUrls].filter(([name]) => !media.has(name));
    const failed = [];
    let done = 0;

    async function fetchOne([name, url]) {
      if (!/^https:\/\//i.test(url) || !isSafeFilename(name)) {
        failed.push(name);
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
      try {
        const response = await doFetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        media.set(name, new Uint8Array(await response.arrayBuffer()));
      } catch (e) {
        failed.push(name);
      } finally {
        clearTimeout(timer);
        done++;
        if (onProgress) onProgress(done, missing.length);
      }
    }

    const queue = missing.slice();
    const workers = Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, queue.length) }, async () => {
      while (queue.length) await fetchOne(queue.shift());
    });
    await Promise.all(workers);
    return { downloaded: missing.length - failed.length, failed };
  }

  // 5. Pack everything into one zip: anki_<name>/anki_import_<name>.txt + attachments/
  function buildZip(baseName, txt, media) {
    const folder = `anki_${baseName}`;
    const entries = {
      [`${folder}/anki_import_${baseName}.txt`]: [fflate.strToU8(txt), { level: 6 }],
    };
    for (const [name, bytes] of media) {
      if (isSafeFilename(name)) entries[`${folder}/attachments/${name}`] = [bytes, { level: 0 }];
    }
    return fflate.zipSync(entries);
  }

  // Everything in one go. onStep(stepId, detail) reports progress to the page.
  async function convert(ofcBytes, fileName, options) {
    const { label = '', onStep = () => {}, fetchImpl } = options || {};
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

    onStep('unpack');
    await tick();
    const { data, attachmentsZip } = readOfc(ofcBytes);

    onStep('cards');
    await tick();
    const { txt, cardCount, deckCount, mediaUrls } = buildCards(data, label);

    onStep('images');
    await tick();
    const media = extractMedia(attachmentsZip, mediaUrls);
    const fromExport = media.size;

    let failed = [];
    if (media.size < mediaUrls.size) {
      onStep('download', { done: 0, total: mediaUrls.size - media.size });
      ({ failed } = await downloadMissing(mediaUrls, media, (done, total) => onStep('download', { done, total }), fetchImpl));
    }

    onStep('zip');
    await tick();
    const baseName = deckBaseName(fileName);
    const zipBytes = buildZip(baseName, txt, media);

    return {
      zipBytes,
      zipName: `anki_${baseName}.zip`,
      txtName: `anki_import_${baseName}.txt`,
      cardCount,
      deckCount,
      imageTotal: mediaUrls.size,
      imagesReady: mediaUrls.size - failed.length,
      imagesDownloaded: media.size - fromExport,
      failed,
    };
  }

  return { convert, readOfc, buildCards, extractMedia, downloadMissing, buildZip, deckBaseName };
});
