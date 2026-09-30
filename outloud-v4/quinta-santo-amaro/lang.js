/* ===============================================================
   Quinta de Santo Amaro — BILINGUAL LAYER (PT / EN)
   A language switch for the whole page, mirroring the PT|EN control
   on quintasantoamaro.pt.

   Switching language does four things:
     1. Swaps every [data-i18n] text, placeholder and document title.
     2. Swaps the suggested-question chips.
     3. Points the live brain at the right language via
        CONFIG.business.ragPrefix (the backend answers in that language).
     4. Points the static catalog at the right language via
        CONFIG.client.language.

   The VOICE never changes: it is a native European Portuguese voice,
   so Portuguese reads native and English reads with a Portuguese
   accent — exactly as requested.

   Loaded BEFORE runtime.js; reaches into the runtime afterwards via
   window.OutLoudRuntime once it exists.
   =============================================================== */
(function () {
  'use strict';

  var TITLE = {
    pt: 'Quinta de Santo Amaro | Casamentos, Eventos e Vinhos na Bairrada',
    en: 'Quinta de Santo Amaro | Weddings, Events and Wines in Bairrada'
  };
  var DESC = {
    pt: 'Quinta de Santo Amaro — uma casa com história desde 1544, no coração da Bairrada. Casamentos, eventos e vinhos entre jardins e vinhas. Fale com o nosso assistente de IA.',
    en: 'Quinta de Santo Amaro — a historic estate in the heart of Bairrada since 1544. Weddings, events and wines among gardens and vineyards. Talk to our AI assistant.'
  };

  var DICT = {
    pt: {
      skip: 'Ir para a demonstração',
      tagline: 'Casamentos, eventos e vinhos · desde 1544',
      intro: 'Uma casa com história desde 1544, no coração da Bairrada. Faça uma pergunta — o nosso assistente responde com a sua própria voz.',
      talk: 'Falar',
      asklabel: 'Faça uma pergunta à Quinta',
      askph: 'Ou escreva uma pergunta…',
      listenph: 'A ouvir… fale ou escreva',
      stop: 'Parar resposta',
      soundon: 'Som: ligado',
      soundoff: 'Som: desligado',
      hint: 'O microfone só é pedido quando toca em Falar.',
      footright: 'Falar com o nosso assistente',
      listening: 'A ouvir'
    },
    en: {
      skip: 'Skip to demo',
      tagline: 'Weddings, events & wines · since 1544',
      intro: 'A house with history dating back to 1544, in the heart of Bairrada. Ask a question — our assistant answers in its own voice.',
      talk: 'Talk',
      asklabel: 'Ask the Quinta a question',
      askph: 'Or type a question…',
      listenph: 'Listening… just talk, or type',
      stop: 'Stop answer',
      soundon: 'Sound: on',
      soundoff: 'Sound: off',
      hint: 'Microphone access is requested only when you tap Talk.',
      footright: 'Talk to our assistant',
      listening: 'Listening'
    }
  };

  var STATE_LABELS = {
    pt: { IDLE: 'Pronto quando quiser', LISTENING: 'A ouvir…', PROCESSING: 'A pensar…', RESPONDING: 'A falar…', CANCELLED: 'Parado' },
    en: { IDLE: 'Ready when you are', LISTENING: 'Listening…', PROCESSING: 'Thinking…', RESPONDING: 'Speaking…', CANCELLED: 'Stopped' }
  };

  var current = 'pt';

  function qs(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  var qsLang = (qs('lang') || '').toLowerCase();
  if (qsLang === 'en' || qsLang === 'pt') { current = qsLang; }
  else {
    try { var s = localStorage.getItem('qsa-lang'); if (s === 'en' || s === 'pt') { current = s; } } catch (e) {}
  }

  function txt(lang) { return DICT[lang] || DICT.pt; }

  function setText(sel, val) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
      el.textContent = val;
    });
  }

  function apply(lang) {
    if (lang !== 'en') { lang = 'pt'; }
    current = lang;
    var t = txt(lang);
    var C = window.OUTLOUD && window.OUTLOUD.CONFIG;

    document.documentElement.setAttribute('lang', lang === 'pt' ? 'pt-PT' : 'en');
    document.title = TITLE[lang];
    var md = document.querySelector('meta[name="description"]');
    if (md) { md.setAttribute('content', DESC[lang]); }

    /* static copy */
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      var k = el.getAttribute('data-i18n');
      if (t[k] != null) { el.textContent = t[k]; }
    });
    var textIn = document.getElementById('ol-text-in');
    if (textIn) {
      var micOn = document.getElementById('ol-mic');
      var on = micOn && micOn.classList.contains('on');
      textIn.placeholder = on ? t.listenph : t.askph;
    }

    /* config: language for the brain + static catalog */
    if (C) {
      C.client.language = (lang === 'pt') ? 'pt-PT' : 'en';
      var i18n = C.client.i18n && C.client.i18n[lang];
      if (i18n) {
        C.business.ragPrefix = i18n.ragPrefix;
        C.client.chips = i18n.chips.slice(0);
        C.client.greeting = i18n.greeting;
        /* live-swap the chips already rendered by runtime.js */
        var chips = document.querySelectorAll('.ol-chip');
        Array.prototype.forEach.call(chips, function (c, i) {
          if (i18n.chips[i]) { c.textContent = i18n.chips[i]; }
        });
      }
    }

    /* toggle button state */
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      var active = b.getAttribute('data-lang') === lang;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });

    /* state chip, in the active language */
    var chip = document.getElementById('ol-state');
    if (chip) {
      var st = chip.getAttribute('data-state') || 'IDLE';
      chip.textContent = STATE_LABELS[lang][st] || st;
    }

    try { localStorage.setItem('qsa-lang', lang); } catch (e) {}

    /* tell the runtime (presentation screen, etc.) the language changed */
    try {
      if (window.OutLoudRuntime && window.OutLoudRuntime.bus) {
        window.OutLoudRuntime.bus.publish('lang.change', { lang: lang });
      }
    } catch (e) {}
  }

  function wire() {
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      b.addEventListener('click', function () {
        var lang = b.getAttribute('data-lang');
        if (lang && lang !== current) { apply(lang); }
      });
    });
  }

  /* Reach into the runtime once it exists: keep the state chip and the
     mic placeholder in the active language, and don't let runtime.js
     overwrite them with English. */
  var hooked = false;
  function hookRuntime() {
    if (hooked) { return; }
    if (window.OutLoudRuntime && window.OutLoudRuntime.bus) {
      hooked = true;
      window.OutLoudRuntime.bus.on('state.change', function (env) {
        var chip = document.getElementById('ol-state');
        if (chip) { chip.textContent = STATE_LABELS[current][env.payload.state] || env.payload.state; }
      });
      var mic = document.getElementById('ol-mic');
      if (mic) {
        mic.addEventListener('click', function () {
          var t = txt(current);
          var on = mic.classList.contains('on');
          var lbl = mic.querySelector('.ol-btn-label');
          if (lbl) { lbl.textContent = on ? t.listening : t.talk; }
          var textIn = document.getElementById('ol-text-in');
          if (textIn) { textIn.placeholder = on ? t.listenph : t.askph; }
        });
      }
      var sound = document.getElementById('ol-sound');
      if (sound) {
        sound.addEventListener('click', function () {
          var t = txt(current);
          var on = sound.getAttribute('aria-pressed') === 'true';
          var lbl = sound.querySelector('.ol-btn-label');
          if (lbl) { lbl.textContent = on ? t.soundon : t.soundoff; }
        });
      }
      return;
    }
    setTimeout(hookRuntime, 60);
  }

  window.QSA_LANG = { apply: apply, current: function () { return current; } };

  document.addEventListener('DOMContentLoaded', function () {
    /* let runtime.js finish its boot before we re-assert chips/lang */
    wire();
    apply(current);
    setTimeout(function () { apply(current); hookRuntime(); }, 0);
  });
})();
