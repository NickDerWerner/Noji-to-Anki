(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const picker = $('picker');
  const drop = $('drop');
  const fileInput = $('file');
  const progress = $('progress');
  const result = $('result');
  const errorBox = $('error');
  const steps = [...progress.querySelectorAll('li')];
  let downloadUrl = null;

  function show(view) {
    picker.hidden = view !== 'picker';
    progress.hidden = view !== 'progress';
    result.hidden = view !== 'result';
    if (view !== 'picker') errorBox.hidden = true;
    $('step1-title').textContent = view === 'result' ? 'Your deck is ready' : 'Choose your Noji export';
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
      li.textContent = `Downloading ${detail.total} missing ${detail.total === 1 ? 'image' : 'images'} from Noji (${detail.done} of ${detail.total})`;
    }
  }

  function resetSteps() {
    steps.forEach((li) => li.classList.remove('done', 'active'));
    const downloadStep = steps.find((li) => li.dataset.step === 'download');
    downloadStep.hidden = true;
    downloadStep.textContent = 'Downloading missing images';
  }

  function showError(message) {
    show('picker');
    $('error-text').textContent = message;
    errorBox.hidden = false;
  }

  async function handleFile(file) {
    if (!file) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    resetSteps();
    show('progress');
    setStep('read');

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const r = await NojiConverter.convert(bytes, file.name, {
        label: $('label').value,
        onStep: setStep,
      });

      downloadUrl = URL.createObjectURL(new Blob([r.zipBytes], { type: 'application/zip' }));
      const link = $('download');
      link.href = downloadUrl;
      link.download = r.zipName;

      $('r-cards').textContent = r.cardCount.toLocaleString();
      $('r-decks').textContent = r.deckCount.toLocaleString();
      $('r-images').textContent = r.imageTotal === r.imagesReady
        ? r.imageTotal.toLocaleString()
        : `${r.imagesReady} / ${r.imageTotal}`;
      $('r-file').textContent = r.zipName;

      const failedBox = $('r-failed');
      failedBox.hidden = r.failed.length === 0;
      if (r.failed.length) {
        $('r-failed-title').textContent = `${r.failed.length} of ${r.imageTotal} images couldn't be found.`;
        const list = $('r-failed-list');
        list.replaceChildren(...r.failed.slice(0, 5).map((name) => {
          const li = document.createElement('li');
          li.textContent = name;
          return li;
        }));
        if (r.failed.length > 5) {
          const li = document.createElement('li');
          li.textContent = `…and ${r.failed.length - 5} more`;
          list.append(li);
        }
      }
      show('result');
    } catch (e) {
      console.error(e);
      showError(e.message || 'Something went wrong while converting this file.');
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
      button.textContent = 'Copied';
    } catch (e) {
      button.textContent = 'Select & copy';
    }
    setTimeout(() => { button.textContent = 'Copy'; }, 1500);
  }));
})();
