(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const { t, locale } = window.I18N;
  const picker = $('picker');
  const drop = $('drop');
  const fileInput = $('file');
  const progress = $('progress');
  const result = $('result');
  const errorBox = $('error');
  const steps = [...progress.querySelectorAll('li')];
  let downloadUrls = [];

  // Load SQLite (needed for the .apkg) in the background right away
  const sqlReady = initSqlJs({ locateFile: (file) => `vendor/${file}` }).catch((e) => {
    console.error('Could not load SQLite, falling back to text file + images', e);
    return null;
  });

  function objectUrl(bytes, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    downloadUrls.push(url);
    return url;
  }

  function show(view) {
    picker.hidden = view !== 'picker';
    progress.hidden = view !== 'progress';
    result.hidden = view !== 'result';
    if (view !== 'picker') errorBox.hidden = true;
    $('convert-title').textContent = view === 'result' ? t('readyTitle') : t('convertTitle');
  }

  function setStep(id, detail) {
    const index = steps.findIndex((li) => li.dataset.step === id);
    steps.forEach((li, i) => {
      li.classList.toggle('done', i < index);
      li.classList.toggle('active', i === index);
    });
    if (id === 'download') {
      const li = steps[index];
      li.hidden = false;
      li.textContent = t('downloadingCount', { total: detail.total, done: detail.done, images: t(detail.total === 1 ? 'image' : 'images') });
    }
  }

  function resetSteps() {
    steps.forEach((li) => li.classList.remove('done', 'active'));
    const downloadStep = steps.find((li) => li.dataset.step === 'download');
    downloadStep.hidden = true;
    downloadStep.textContent = t('downloading');
  }

  // Anonymous usage count (GoatCounter). Only the event name is sent, never anything from the deck.
  function track(path, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title, event: true });
    } catch (e) { /* counting must never break the converter */ }
  }

  // "N decks converted" in the hero: conversions before tracking started plus GoatCounter's public count
  const CONVERTED_BEFORE_TRACKING = 30;
  let convertedCount = CONVERTED_BEFORE_TRACKING;
  function showConvertedCount() {
    $('deck-count').textContent = convertedCount.toLocaleString(locale);
  }
  fetch('https://nojitoanki.goatcounter.com/counter/converted.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const tracked = data ? parseInt(String(data.count).replace(/\D/g, ''), 10) : NaN;
      if (tracked > 0) {
        convertedCount += tracked;
        showConvertedCount();
      }
    })
    .catch(() => { /* keep the starting number */ });

  function showError(message) {
    show('picker');
    $('error-text').textContent = message;
    errorBox.hidden = false;
  }

  async function handleFile(file) {
    if (!file) return;
    downloadUrls.forEach((url) => URL.revokeObjectURL(url));
    downloadUrls = [];
    resetSteps();
    show('progress');
    setStep('read');

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const r = await NojiConverter.convert(bytes, file.name, {
        label: $('label').value,
        onStep: setStep,
        SQL: await sqlReady,
        ApkgBuilder,
      });

      const zipUrl = objectUrl(r.zipBytes, 'application/zip');
      const link = $('download');
      const zipLink = $('download-zip');
      if (r.apkgBytes) {
        link.href = objectUrl(r.apkgBytes, 'application/octet-stream');
        link.download = r.apkgName;
        zipLink.href = zipUrl;
        zipLink.download = r.zipName;
      } else {
        link.href = zipUrl;
        link.download = r.zipName;
      }
      $('r-file').textContent = link.download;
      $('zip-option').hidden = !r.apkgBytes;
      $('r-no-apkg').hidden = !!r.apkgBytes;
      $('r-progress').hidden = !(r.apkgBytes && r.progressCount);
      $('r-progress-title').textContent = r.progressCount === 1
        ? t('progressOne')
        : t('progressMany', { count: r.progressCount.toLocaleString(locale) });

      $('r-cards').textContent = r.cardCount.toLocaleString(locale);
      $('r-decks').textContent = r.deckCount.toLocaleString(locale);
      $('r-images').textContent = r.imageTotal === r.imagesReady
        ? r.imageTotal.toLocaleString(locale)
        : `${r.imagesReady} / ${r.imageTotal}`;

      const failedBox = $('r-failed');
      failedBox.hidden = r.failed.length === 0;
      if (r.failed.length) {
        $('r-failed-title').textContent = t('failedTitle', { count: r.failed.length, total: r.imageTotal });
        const list = $('r-failed-list');
        list.replaceChildren(...r.failed.slice(0, 5).map((name) => {
          const li = document.createElement('li');
          li.textContent = name;
          return li;
        }));
        if (r.failed.length > 5) {
          const li = document.createElement('li');
          li.textContent = t('more', { count: r.failed.length - 5 });
          list.append(li);
        }
      }
      show('result');
      track('converted', 'Deck converted');
      convertedCount += 1;
      showConvertedCount();
    } catch (e) {
      console.error(e);
      track('conversion-failed', 'Conversion failed');
      showError(e.code ? t(`error.${e.code}`) : t('errorGeneric'));
    } finally {
      fileInput.value = '';
    }
  }

  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, () => drop.classList.remove('dragging')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  });
  // Dropping a file next to the drop zone shouldn't open it in the browser
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // After the first download, thank the user and point to Buy Me a Coffee (once per visit)
  const thanks = $('thanks');
  let thanksShown = false;
  function showThanks(isApkg) {
    if (thanksShown || !thanks.showModal) return;
    thanksShown = true;
    thanks.querySelector('p').hidden = !isApkg;
    setTimeout(() => thanks.showModal(), 800);
  }
  $('download').addEventListener('click', () => showThanks($('download').download.endsWith('.apkg')));
  $('download-zip').addEventListener('click', () => showThanks(false));
  // Close when clicking the dark background around the popup
  thanks.addEventListener('click', (e) => {
    const r = thanks.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) thanks.close();
  });
  $('thanks-coffee').addEventListener('click', () => thanks.close());

  $('again').addEventListener('click', () => {
    show('picker');
    fileInput.focus();
  });

  // Mac / Windows / Linux tabs, starting with the visitor's system
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', selected);
      $(t.getAttribute('aria-controls')).hidden = !selected;
    });
  }
  tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab)));
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/win/i.test(platform)) selectTab($('tab-win'));
  else if (/linux/i.test(platform) && !/android/i.test(navigator.userAgent)) selectTab($('tab-linux'));

  document.querySelectorAll('.copy').forEach((button) => button.addEventListener('click', async () => {
    const text = button.previousElementSibling.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = t('copied');
    } catch (e) {
      button.textContent = t('selectCopy');
    }
    setTimeout(() => { button.textContent = t('copy'); }, 1500);
  }));
})();
