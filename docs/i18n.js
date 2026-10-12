// Page language: ?lang=de / ?lang=en, otherwise the browser's preferred languages.
// The English text lives in index.html; this file holds the German version of every
// element marked with data-i18n, plus the texts app.js shows while converting.
// Button and menu names follow Noji's and Anki's own German labels.
(function () {
  'use strict';

  const SUPPORTED = ['en', 'de'];

  function pickLanguage() {
    const param = new URLSearchParams(location.search).get('lang');
    if (SUPPORTED.includes(param)) return param;
    for (const tag of navigator.languages || [navigator.language || 'en']) {
      const base = String(tag).toLowerCase().split('-')[0];
      if (SUPPORTED.includes(base)) return base;
    }
    return 'en';
  }

  const lang = pickLanguage();

  // Static page text (innerHTML of each data-i18n element)
  const PAGE_DE = {
    'header.lang': 'EN',
    'header.coffee': '<span aria-hidden="true">☕</span> Kaffee spendieren',
    'hero.title': 'Noji-Karteikarten gratis in Anki umwandeln',
    'hero.text': 'Deine Karten, Bilder und Unterdecks, in etwa einer Minute bereit für den Import in Anki.',
    'counter': '<span aria-hidden="true">🎉</span> Bisher <b id="deck-count">30</b> Decks umgewandelt',

    'export.title': '<span class="num">1</span> Exportiere dein Deck aus Noji',
    'export.1': 'Öffne in Noji das Deck, das du umziehen willst, und gehe in seine <strong>„Einstellungen“</strong>.',
    'export.2': 'Wähle <strong>„Deck exportieren“</strong> und das Format <strong>„OFC“</strong>. <span class="muted">(Nicht CSV: Da fehlen die Bilder.)</span> Beim Export eines Decks sind alle Unterdecks automatisch dabei.',
    'export.3': '<strong>Wähle aus, dass dein Lernfortschritt mitgespeichert wird.</strong> Dann behalten deine Karten in Anki ihre Fälligkeiten und Intervalle, statt wieder bei null anzufangen.',
    'export.4': 'Gib deine E-Mail-Adresse ein. Noji schickt dir einen Download-Link, sobald die Datei fertig ist. Bei großen Decks kann das ein paar Minuten dauern.',
    'export.5': '<strong>Lade die <code>.ofc</code>-Datei innerhalb von 24 Stunden aus der E-Mail herunter.</strong> Danach löscht Noji sie.',

    'convert.title': 'Wandle es hier um',
    'drop.title': 'Zieh deine <code>.ofc</code>-Datei hierher',
    'drop.text': 'oder klicke, um sie auszuwählen',
    'options.summary': 'Optionen (brauchen die meisten nicht)',
    'options.label': 'Label vor jeder Karte',
    'options.help': 'Praktisch, wenn du mehrere Fächer gemischt lernst. Aus „Was ist eine Zelle?“ wird „Biologie: Was ist eine Zelle?“. Leer lassen für kein Label.',

    'step.read': 'Datei wird gelesen',
    'step.unpack': 'Deck wird entpackt',
    'step.cards': 'Karten werden erstellt',
    'step.images': 'Bilder werden gesammelt',
    'step.zip': 'Download wird gepackt',

    'stat.cards': 'Karten',
    'stat.decks': 'Decks',
    'stat.images': 'Bilder',
    'result.download': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/></svg> Anki-Deck herunterladen',
    'result.again': 'Andere Datei umwandeln',
    'result.zip': 'oder als Textdatei + Bilder (.zip) herunterladen',
    'result.progress': 'Schalte beim Import im Importfenster von Anki „Lernfortschritt (falls enthalten) ebenfalls importieren“ ein. Sonst kommen alle Karten als neue Karten an.',
    'result.noApkg': 'Dein Browser konnte keine Anki-Deck-Datei erstellen, deshalb bekommst du stattdessen eine Textdatei + Bilder. Siehe „Stattdessen die Textdatei verwenden“ weiter unten.',
    'result.failed': 'Diese Karten zeigen in Anki ein kaputtes Bild. Prüfe deine Internetverbindung und versuche es erneut, oder exportiere das Deck noch einmal aus Noji.',
    'error.title': 'Das hat nicht geklappt.',

    'import.title': '<span class="num">3</span> Importiere es in Anki',
    'import.1': '<strong>Doppelklicke auf die heruntergeladene <code>.apkg</code>-Datei.</strong> Anki öffnet sich und zeigt ein Importfenster. <span class="muted">(Oder öffne Anki selbst und gehe auf „Datei → Importieren …“.)</span>',
    'import.2': '<strong>Schalte „Lernfortschritt (falls enthalten) ebenfalls importieren“ ein</strong>, wenn du deinen Lernfortschritt mitexportiert hast. <strong>Nicht vergessen:</strong> Ohne diese Option kommen alle Karten als neue Karten an, und ein erneuter Import behebt das später nicht.',
    'import.3': '<strong>Klicke auf „Importieren“.</strong> Fertig: Deine Karten, Unterdecks und Bilder sind jetzt in Anki.',

    'manual.summary': 'Stattdessen die Textdatei verwenden',
    'manual.1': '<strong>Entpacke den Download.</strong> <span class="muted">Mac: Doppelklick. Windows: Rechtsklick → „Alle extrahieren“.</span> Du bekommst einen Ordner mit einer <code>.txt</code>-Datei und einem Ordner <code>attachments</code>.',
    'manual.2': '<strong>Importiere die Karten.</strong> Öffne Anki, gehe auf „Datei → Importieren …“ und wähle die <code>.txt</code>-Datei. Achte darauf, dass „HTML in Feldern zulassen“ aktiviert ist, und klicke dann auf „Importieren“.',
    'manual.3': '<strong>Kopiere die Bilder.</strong> Kopiere alles <em>innerhalb</em> des Ordners <code>attachments</code> in den Medienordner von Anki:',
    'manual.mac1': 'Drücke im Finder <code>⌘ Cmd</code> + <code>⇧ Shift</code> + <code>G</code>.',
    'manual.mac2': 'Füge <code>~/Library/Application Support/Anki2/Benutzer 1/collection.media</code> ein <button class="copy" type="button">Kopieren</button>',
    'manual.enter': 'Drücke Enter und füge die Bilder dort ein.',
    'manual.win1': 'Drücke <code>Win</code> + <code>R</code>.',
    'manual.win2': 'Füge <code>%APPDATA%\\Anki2\\Benutzer 1\\collection.media</code> ein <button class="copy" type="button">Kopieren</button>',
    'manual.linux1': 'Öffne <code>~/.local/share/Anki2/Benutzer 1/collection.media</code> <button class="copy" type="button">Kopieren</button>',
    'manual.linux2': 'Füge die Bilder dort ein.',
    'manual.profile': 'Wenn dein Anki-Profil nicht „Benutzer 1“ heißt, nimm stattdessen seinen Namen. In englischem Anki heißt es meist „User 1“.',

    'about.title': 'Hey <span aria-hidden="true">👋</span>',
    'about.1': 'Ich bin Nick und studiere Wirtschaftsinformatik an der Technischen Universität München (TUM).',
    'about.2': 'Ich hing auch in der Noji-App fest, und das hat mich echt genervt, vor allem als ihre Server mehrere Tage lang nicht liefen. Deshalb habe ich dieses Tool gebaut, damit der Umstieg auf Anki einfacher wird. Ich freue mich riesig, wenn es dir geholfen hat :)',
    'about.coffee': '<span aria-hidden="true">☕</span> Spendier mir einen Kaffee',
    'about.photo': 'Foto von Nick Werner',

    'faq.title': 'Fragen',
    'faq.export.q': 'Ich finde „Deck exportieren“ in Noji nicht, oder mein Deck lässt sich nicht exportieren',
    'faq.export.a': 'Noji lässt dich nur Decks exportieren, die du selbst erstellt hast. Decks, die du von jemand anderem importiert oder dupliziert hast, lassen sich nicht exportieren. Das ist eine Grenze von Noji, nicht von diesem Converter. Siehe <a href="https://help.noji.io/de/articles/11524889-export-your-decks">Nojis Hilfeartikel zum Export</a>.',
    'faq.upload.q': 'Wird mein Deck irgendwo hochgeladen?',
    'faq.upload.a': 'Nein. Die Umwandlung läuft komplett in deinem Browser, und deine Datei wird nie an einen Server geschickt. Aus dem Internet lädt die Seite nur Bilder, die in deinem Export fehlen, und die kommen direkt von Noji.',
    'faq.dupes.q': 'Ich habe dieses Deck schon einmal importiert. Bekomme ich doppelte Karten?',
    'faq.dupes.a': 'Nein. Wenn du die <code>.apkg</code> noch einmal importierst, aktualisiert Anki die vorhandenen Karten, statt sie ein zweites Mal anzulegen. Ihr Lernfortschritt in Anki bleibt dabei, wie er ist.',
    'faq.images.q': 'Manche Bilder werden in Anki als kaputtes Bild angezeigt',
    'faq.images.a': 'Mit der <code>.apkg</code> werden Bilder automatisch importiert. Wenn du stattdessen die Textdatei verwendet hast, prüfe, ob du die Dateien aus dem Ordner <code>attachments</code> dieses Downloads in <code>collection.media</code> kopiert hast. Jede Karte verweist auf eine Datei wie <code>c4915ef6-….jpg</code>, und genau diese Datei muss dort liegen. Dateien mit anderen Namen (zum Beispiel <code>409095344.jpg</code>) stammen aus einem anderen Import und funktionieren für diese Karten nicht.',
    'faq.cli.q': 'Kann ich das auch über die Kommandozeile nutzen?',
    'faq.cli.a': 'Ja. Derselbe Converter ist als Python-Skript auf <a href="https://github.com/NickDerWerner/Noji-to-Anki">GitHub</a> verfügbar.',
    'faq.progress.q': 'Wird mein Lernfortschritt aus Noji übernommen?',
    'faq.progress.a': 'Ja, wenn du ihn mitexportiert hast. Jede Karte behält ihren Status (neu, in Lernphase oder Wiederholung), ihre nächste Fälligkeit, ihr Intervall und ihre Leichtigkeit. Karten, die du kürzlich vergessen hast, bleiben in der Wiederholungsphase, und pausierte Karten werden in Anki zu ausgeschlossenen Karten. Wenn das Deck fertig ist, zeigt dir der Converter, wie viele Karten ihren Fortschritt behalten.',
    'faq.forgot.q': 'Ich habe vergessen, „Lernfortschritt (falls enthalten) ebenfalls importieren“ einzuschalten. Wie behebe ich das?',
    'faq.forgot.a': 'Lösche in Anki den gerade importierten Stapel (Zahnrad daneben, dann „Löschen“). Importiere die <code>.apkg</code> danach noch einmal, diesmal mit eingeschaltetem „Lernfortschritt (falls enthalten) ebenfalls importieren“. Erneut importieren, ohne vorher zu löschen, hilft nicht: Anki erkennt, dass die Karten schon existieren, und lässt sie als neue Karten.',
    'faq.due.q': 'Warum sind so viele Karten auf einmal fällig?',
    'faq.due.a': 'Deine Karten sind an denselben Tagen fällig wie in Noji. Wenn du eine Weile nicht gelernt hast, sind sie alle überfällig, genau wie sie es in Noji wären. Anki zeigt standardmäßig bis zu 200 Wiederholungen pro Tag, der Stapel verteilt sich also auf ein paar Tage. Das Limit kannst du in den Einstellungen des Stapels ändern.',
    'faq.frozen.q': 'Wo sind meine pausierten Karten?',
    'faq.frozen.a': 'In Noji pausierte Karten sind in Anki ausgeschlossen: Sie behalten ihren Fortschritt, kommen aber nicht zur Wiederholung. Öffne die „Kartenverwaltung“ und suche nach <code>is:suspended</code>, um sie zu finden. Markiere sie und wähle „Ausschließen/Nicht ausschließen“, um sie wieder zu lernen.',
    'faq.history.q': 'Werden mein Lernverlauf oder meine Serie übernommen?',
    'faq.history.a': 'Nein. Nojis Export enthält nur den aktuellen Stand jeder Karte, nicht die Liste deiner bisherigen Wiederholungen. Deine Serie und deine Noji-Statistiken lassen sich deshalb nicht übertragen. Damit Ankis FSRS-Algorithmus sofort mit deinen Karten arbeiten kann, bekommt jede gelernte Karte eine geschätzte Wiederholung an dem Tag, an dem du sie zuletzt in Noji gelernt hast.',
    'faq.later.q': 'Kann ich in Noji weiterlernen und später umziehen?',
    'faq.later.a': 'Ja, aber der Fortschritt wird nur beim ersten Import übernommen. Importierst du dasselbe Deck später noch einmal, aktualisiert Anki die Karteninhalte, behält aber den Fortschritt, den es schon hat. Um neueren Fortschritt aus Noji zu übernehmen, lösche den Stapel zuerst in Anki und importiere dann den neuen Export.',
    'faq.txt.q': 'Funktioniert der Lernfortschritt auch mit dem Textdatei-Download?',
    'faq.txt.a': 'Nein. Nur die <code>.apkg</code> kann Lernfortschritt enthalten. Mit der Textdatei kommen immer alle Karten als neue Karten an.',

    'thanks.title': 'Dein Deck wird heruntergeladen',
    'thanks.next': 'Doppelklicke als Nächstes auf die <code>.apkg</code>-Datei, um sie in Anki zu importieren.',
    'thanks.ask': 'Wenn dir das Zeit gespart hat, würde ich mich riesig über einen Kaffee freuen.',
    'thanks.coffee': '<span aria-hidden="true">☕</span> Spendier mir einen Kaffee',
    'thanks.close': 'Nein danke, schließen',

    'footer.made': 'Gemacht von Nick Werner · <a href="https://github.com/NickDerWerner/Noji-to-Anki">Open Source auf GitHub</a>',
    'footer.notAffiliated': 'Keine Verbindung zu Noji oder Anki.',
  };

  // Attributes (data-i18n-attr="attribute:key")
  const ATTR_DE = {
    'options.placeholder': 'z. B. Biologie: ',
  };

  // Texts app.js builds while converting. {name} is replaced with a value.
  const TEXT = {
    en: {
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
    },
    de: {
      convertTitle: 'Wandle es hier um',
      readyTitle: 'Dein Deck ist fertig',
      downloading: 'Fehlende Bilder werden geladen',
      downloadingCount: '{total} fehlende {images} werden von Noji geladen ({done} von {total})',
      image: 'Bild',
      images: 'Bilder',
      progressOne: '1 Karte behält ihren Lernfortschritt.',
      progressMany: '{count} Karten behalten ihren Lernfortschritt.',
      failedTitle: '{count} von {total} Bildern wurden nicht gefunden.',
      more: '…und {count} weitere',
      copy: 'Kopieren',
      copied: 'Kopiert',
      selectCopy: 'Markieren & kopieren',
      errorGeneric: 'Beim Umwandeln dieser Datei ist etwas schiefgelaufen.',
      'error.not-noji': 'Diese Datei sieht nicht nach einem Noji-Export aus. Bitte wähle die .ofc-Datei, die du aus Noji exportiert hast.',
      'error.unpack': 'Die Deck-Daten in dieser Datei ließen sich nicht entpacken. Der Export ist vielleicht beschädigt. Exportiere ihn noch einmal aus Noji.',
      'error.no-data': 'In dieser Datei wurden keine Deck-Daten gefunden. Bitte wähle die .ofc-Datei, die du aus Noji exportiert hast.',
      'error.unreadable': 'Die Deck-Daten ließen sich nicht lesen. Der Export ist vielleicht beschädigt. Exportiere ihn noch einmal aus Noji.',
      'error.format': 'Die Deck-Daten haben ein unerwartetes Format.',
    },
  };

  function t(key, vars) {
    const text = (TEXT[lang] && TEXT[lang][key]) || TEXT.en[key] || key;
    return text.replace(/\{(\w+)\}/g, (_, name) => (vars && name in vars ? vars[name] : `{${name}}`));
  }

  function apply() {
    document.documentElement.lang = lang;
    const toggle = document.getElementById('lang-switch');
    if (toggle) {
      toggle.href = `?lang=${lang === 'de' ? 'en' : 'de'}`;
      toggle.setAttribute('aria-label', lang === 'de' ? 'English' : 'Deutsch');
      toggle.title = toggle.getAttribute('aria-label');
    }
    if (lang !== 'de') return;
    document.title = 'Noji to Anki: Noji-Karteikarten in Anki umwandeln';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const html = PAGE_DE[el.dataset.i18n];
      if (html !== undefined) el.innerHTML = html;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':');
        const value = ATTR_DE[key] !== undefined ? ATTR_DE[key] : PAGE_DE[key];
        if (value !== undefined) el.setAttribute(attr, value);
      }
    });
  }

  apply();
  window.I18N = { lang, t, locale: lang === 'de' ? 'de-DE' : 'en-US' };
})();
