/* OutLoud v2: transcript playback.
   Voice stand-in: the browser's built-in speechSynthesis.
   No keys, no network calls. Production swaps this for the
   ElevenLabs voice; the play-button interface stays the same. */
(function () {
  'use strict';

  var playBtns = [].slice.call(document.querySelectorAll('.play'));
  var soundToggle = document.getElementById('sound-toggle');
  var soundState = document.getElementById('sound-state');
  var srStatus = document.getElementById('sr-status');
  var synth = window.speechSynthesis;
  var soundOn = true;
  var currentBtn = null;

  var speechAvailable = !!(synth && synth.speak && typeof SpeechSynthesisUtterance !== 'undefined');

  function setStatus(text) {
    if (srStatus) { srStatus.textContent = text; }
  }

  function stopAll() {
    if (speechAvailable) { synth.cancel(); }
    playBtns.forEach(function (b) {
      b.classList.remove('playing');
      b.removeAttribute('data-live');
    });
    currentBtn = null;
  }

  function markPlaying(btn) {
    stopAll();
    btn.classList.add('playing');
    btn.setAttribute('data-live', 'playing');
    currentBtn = btn;
  }

  function playLine(btn) {
    var text = btn.getAttribute('data-say');
    if (!text) { return; }

    if (!soundOn) {
      setStatus('Sound is off. Use the sound toggle in the top bar to enable playback.');
      return;
    }

    if (!speechAvailable) {
      setStatus('This browser has no built-in speech. On an OutLoud site this line is spoken by an ElevenLabs voice.');
      return;
    }

    markPlaying(btn);
    setStatus('Playing: ' + text);

    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 1;

    // Prefer an English voice; don't fight the user's system default otherwise.
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    var en = voices.filter(function (v) { return /^en/i.test(v.lang); });
    if (en.length) { u.voice = en[0]; }

    u.onend = function () {
      if (currentBtn === btn) { stopAll(); }
      setStatus('Line finished.');
    };
    u.onerror = function () {
      if (currentBtn === btn) { stopAll(); }
      setStatus('Playback failed. On an OutLoud site this line is spoken by an ElevenLabs voice.');
    };

    synth.speak(u);
  }

  playBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (currentBtn === btn) { stopAll(); return; }
      playLine(btn);
    });
  });

  if (soundToggle) {
    soundToggle.addEventListener('click', function () {
      soundOn = !soundOn;
      soundToggle.setAttribute('aria-pressed', String(soundOn));
      soundState.textContent = soundOn ? 'on' : 'off';
      if (!soundOn) { stopAll(); }
    });
  }

  // Stop playback if the visitor navigates away mid-line.
  window.addEventListener('beforeunload', stopAll);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopAll(); }
  });

  // Some browsers load voices asynchronously; warm the list once.
  if (speechAvailable) {
    try { synth.getVoices(); } catch (e) {}
    synth.onvoiceschanged = function () {};
  }
})();
