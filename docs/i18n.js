// Page language: ?lang=xx, otherwise the browser's preferred languages.
// The English text lives in index.html; lang/*.js hold the other languages for every
// element marked with data-i18n, plus the texts app.js shows while converting.
// Button and menu names follow Noji's and Anki's own labels in each language.
(function () {
  'use strict';

  const LANGS = window.NOJI_LANGS || {};
  // Order of the language menu
  const MENU = ['en', 'de', 'pt-BR', 'es', 'fr', 'it'];

  // Texts app.js builds while converting. {name} is replaced with a value.
  const TEXT_EN = {
    convertTitle: 'Convert it here',
    readyTitle: 'Your deck is ready',
    downloading: 'Downloading missing images',
    downloadingCount: 'Downloading {total} missing {images} from Noji ({done} of {total})',
    image: 'image',
    images: 'images',
    progressOne: '1 card keeps its learning progress.',
    progressMany: '{count} cards keep their learning progress.',
    failedTitle: "{count} of {total} images couldn't be found.",
    more: '…and {count} more',
    copy: 'Copy',
    copied: 'Copied',
    selectCopy: 'Select & copy',
    errorGeneric: 'Something went wrong while converting this file.',
    'error.not-noji': "This file doesn't look like a Noji export. Please choose the .ofc file you exported from Noji.",
    'error.unpack': "The deck data inside this file couldn't be unpacked. The export may be damaged. Try exporting it from Noji again.",
    'error.no-data': 'No deck data found in this file. Please choose the .ofc file you exported from Noji.',
    'error.unreadable': "The deck data couldn't be read. The export may be damaged. Try exporting it from Noji again.",
    'error.format': 'The deck data has an unexpected format.',
  };

  // "pt-BR", "pt-PT" and "pt" all get Brazilian Portuguese, "de-AT" gets German, ...
  function supported(tag) {
    const lower = String(tag || '').toLowerCase();
    const base = lower.split('-')[0];
    if (base === 'en') return 'en';
    const codes = Object.keys(LANGS);
    return codes.find((code) => code.toLowerCase() === lower)
      || codes.find((code) => code.toLowerCase().split('-')[0] === base);
  }

  function pickLanguage() {
    const fromUrl = supported(new URLSearchParams(location.search).get('lang'));
    if (fromUrl) return fromUrl;
    for (const tag of navigator.languages || [navigator.language]) {
      const code = supported(tag);
      if (code) return code;
    }
    return 'en';
  }

  const lang = pickLanguage();
  const pack = LANGS[lang];

  function t(key, vars) {
    const text = (pack && pack.text[key]) || TEXT_EN[key] || key;
    return text.replace(/\{(\w+)\}/g, (_, name) => (vars && name in vars ? vars[name] : `{${name}}`));
  }

  function buildMenu() {
    const select = document.getElementById('lang-select');
    if (!select) return;
    select.replaceChildren(...MENU.filter((code) => code === 'en' || LANGS[code]).map((code) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = code === 'en' ? 'English' : LANGS[code].name;
      option.selected = code === lang;
      return option;
    }));
    const current = document.getElementById('lang-current');
    if (current) current.textContent = lang.split('-')[0].toUpperCase();
    select.addEventListener('change', () => {
      const url = new URL(location.href);
      url.searchParams.set('lang', select.value);
      location.href = url.toString();
    });
  }

  function apply() {
    document.documentElement.lang = lang;
    buildMenu();
    if (!pack) return;
    document.title = pack.title;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const html = pack.page[el.dataset.i18n];
      if (html !== undefined) el.innerHTML = html;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':');
        const value = pack.attr[key] !== undefined ? pack.attr[key] : pack.page[key];
        if (value !== undefined) el.setAttribute(attr, value);
      }
    });
  }

  apply();
  window.I18N = { lang, t, locale: pack ? pack.locale : 'en-US' };
})();
