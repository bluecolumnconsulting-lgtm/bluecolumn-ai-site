/* ===============================================================
   ADVENTURE CLUB — SITE AVATAR v1 (BlueColumn AI)
   Animated-mascot demo assistant. No Simli / no video transport.
   Scout, the club's cartoon guide, talks through canned ElevenLabs
   MP3s while a Web Audio analyser drives his mouth sprite states:
   RMS -> closed / half / open (FenceBot-style viseme simplification).
   Two ways to talk:
   - TYPE: text chat (always available)
   - TALK: hands-free voice conversation (Web Speech API mic in,
     spoken answers out, auto re-listen for back-and-forth)
   Fallback chain: voice MP3 -> text only.
   =============================================================== */
(function () {
  'use strict';

  /* Brand + agent brain -------------------------------------------------- */
  var MOUTH_CLOSED = 'widget/mascot-closed.svg';
  var MOUTH_HALF = 'widget/mascot-half.svg';
  var MOUTH_OPEN = 'widget/mascot-open.svg';

  var INTENTS = [
    {
      a: 'what',
      k: ['what is', 'what\u2019s', 'whats', 'about', 'tell me', 'club', 'membership club', 'how does it work'],
      t: 'Adventure Club is a membership club for guided adventures — hiking, kayaking, camping trips, and weekend expeditions. One membership plans every weekend for you: routes, permits, gear lists, and certified guides.'
    },
    {
      a: 'pricing',
      k: ['price', 'pricing', 'cost', 'tier', 'plan', 'explorer', 'ridgeline', 'summit', 'how much', 'fee', 'month', 'year'],
      t: 'Three tiers. Explorer is 899 a year with two adventures a month. Ridgeline is 1,149 with four, and weekend flexibility. Summit is 1,399 for the full expedition calendar. Every tier includes certified guides, permits, and packing lists.'
    },
    {
      a: 'trips',
      k: ['trip', 'trips', 'adventure', 'hike', 'hiking', 'kayak', 'kayaking', 'camp', 'camping', 'expedition', 'calendar', 'where', 'weekend', 'itinerary'],
      t: 'This month: a sunrise kayak on the lake, a beginner-friendly rim hike, an overnight basecamp under dark skies, and our flagship three-day summit expedition. Members pick their trips right from the calendar — spots are held for you.'
    },
    {
      a: 'safety',
      k: ['safe', 'safety', 'gear', 'guide', 'guides', 'insurance', 'permit', 'beginner', 'injury', 'risk', 'equipment'],
      t: 'Every trip is led by a certified guide, wilderness first aid trained, with permits and insurance included. Group sizes stay small, every route has a vetted plan B, and you get a packing list for every outing. You bring the boots — we handle the rest.'
    },
    {
      a: 'book',
      k: ['book', 'join', 'sign up', 'request', 'start', 'member', 'invite', 'reserve', 'get started'],
      t: 'Ready to get out there? Tap Request Membership on this page, pick your tier, and we will call you within 24 hours to plan your first adventure. Your first trip is money-back guaranteed.'
    },
    {
      a: 'greet',
      k: ['hello', 'hi', 'hey', 'yo', 'scout', 'who are you', 'your name'],
      t: 'Hey, I\u2019m Scout, your Adventure Club guide. Ask me about membership tiers, upcoming trips, safety and gear, or how to book your first weekend.'
    }
  ];

  var FALLBACK = {
    a: 'fallback',
    t: 'Ask me about membership tiers, upcoming trips, safety and gear, or how to book your first adventure. I\u2019m here to help.'
  };

  var SUGGESTIONS = [
    'What is Adventure Club?',
    'What does membership cost?',
    'What trips are coming up?',
    'How do I join?'
  ];

  var CTAS = [
    { label: 'Request membership', href: 'request/' },
    { label: 'What trips are coming up?' }
  ];

  /* -- Elements --------------------------------------------------------- */
  var fab = document.getElementById('bc-fab');
  var panel = document.getElementById('bc-panel');
  var avatar = document.getElementById('bc-avatar');
  var headImg = document.getElementById('bc-head-img');
  var log = document.getElementById('bc-log');
  var input = document.getElementById('bc-in');
  var muteBtn = document.getElementById('bc-mute');
  var closeBtn = document.getElementById('bc-close');
  var micBtn = document.getElementById('bc-mic');
  var modeChat = document.getElementById('bc-mode-chat');
  var modeAudio = document.getElementById('bc-mode-audio');

  if (!fab || !panel || !log || !input) { return; }

  /* -- Audio engine ------------------------------------------------------ */
  var muted = false;
  var currentAudio = null;
  var started = false;
  var mouthRAF = null, audioCtx = null, analyser = null, timeData = null;
  var speaking = false;
  var speechEndCb = null;
  var lastFlip = 0, lastState = 'closed';

  function setMouth(state) {
    var src = state === 'open' ? MOUTH_OPEN : state === 'half' ? MOUTH_HALF : MOUTH_CLOSED;
    if (avatar) { avatar.src = src; }
    if (headImg) { headImg.src = src; }
    lastState = state;
  }

  function stopMouth() {
    if (mouthRAF) { cancelAnimationFrame(mouthRAF); mouthRAF = null; }
    setMouth('closed');
  }

  /* Analyser RMS -> sprite state swap (closed / half / open) */
  function startMouth() {
    if (!currentAudio) { return; }
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') { audioCtx.resume(); }
      var src = audioCtx.createMediaElementSource(currentAudio);
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.55;
        timeData = new Uint8Array(analyser.fftSize);
        analyser.connect(audioCtx.destination);
      }
      src.connect(analyser);
    } catch (e) { /* analyser unavailable: fallback rhythm below */ }
    var haveAnalyser = !!analyser;
    var tick = function () {
      if (!currentAudio || currentAudio.paused) { stopMouth(); return; }
      var now = Date.now();
      if (now - lastFlip < 55) { mouthRAF = requestAnimationFrame(tick); return; }
      var energy = 0;
      if (haveAnalyser && timeData) {
        analyser.getByteTimeDomainData(timeData);
        var sum = 0, i;
        for (i = 0; i < timeData.length; i++) {
          var v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        energy = Math.sqrt(sum / timeData.length);
      } else {
        energy = 0.5 + 0.5 * Math.sin(now / 90); /* fallback rhythm */
      }
      var state = energy > 0.085 ? 'open' : energy > 0.032 ? 'half' : 'closed';
      if (state !== lastState) { setMouth(state); lastFlip = now; }
      mouthRAF = requestAnimationFrame(tick);
    };
    mouthRAF = requestAnimationFrame(tick);
  }

  function botFinished() {
    speaking = false;
    avatar.classList.remove('bc-talking');
    stopMouth();
    var cb = speechEndCb;
    speechEndCb = null;
    if (cb) { cb(); }
    if (micWanted) { setTimeout(pauseListeningThenResume, 350); }
  }

  function playAudio(name) {
    if (muted) { setTimeout(botFinished, 400); return; }
    try {
      stopMouth();
      if (currentAudio) { currentAudio.pause(); currentAudio.onended = null; }
      currentAudio = new Audio('widget/audio/' + name + '.mp3');
      currentAudio.preload = 'auto';
      avatar.classList.add('bc-talking');
      currentAudio.onended = botFinished;
      currentAudio.play().then(startMouth).catch(function () { botFinished(); });
    } catch (e) {
      botFinished();
    }
  }

  function toggleMute() {
    muted = !muted;
    muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    muteBtn.title = muted ? 'Voice off' : 'Voice on';
    if (muted && currentAudio) { currentAudio.pause(); }
  }

  /* -- Message helpers ---------------------------------------------------- */
  function el(text, cls) {
    var d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function opts(arr) {
    var w = document.createElement('div');
    w.className = 'bc-opts';
    arr.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = a.label || a;
      b.onclick = function () { if (a.href) { window.location.href = a.href; } else { send(a.label || a); } };
      w.appendChild(b);
    });
    log.appendChild(w);
    log.scrollTop = log.scrollHeight;
  }

  /* -- Column mascot squish states ---------------------------------------- */
  function squishPulse() {
    avatar.classList.remove('bc-squish');
    void avatar.offsetWidth;
    avatar.classList.add('bc-squish');
  }
  function setThinking(on) {
    avatar.classList.toggle('bc-thinking', on);
  }

  /* ============================================================
     HANDS-FREE VOICE (Web Speech API)
     Mic on = continuous conversation: listen -> reply spoken ->
     listen again, until mic toggled off. Typing still works.
     ============================================================ */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recog = null;
  var micOn = false;
  var micWanted = false;

  function supportedSR() { return !!SR; }
  var supported = supportedSR();

  function inAppBrowser() {
    var ua = navigator.userAgent || '';
    return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok/i.test(ua);
  }

  function buildRecognizer() {
    var r = new SR();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = function (ev) {
      var t = ev.results[0][0].transcript.trim();
      if (t) { send(t); }
    };
    r.onerror = function (ev) {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        micWanted = false; setMicUI(false);
        el('Microphone access is blocked — enable it in your browser settings to talk hands-free.', 'bc-msg bc-bot');
      }
    };
    r.onend = function () {
      setMicUI(micWanted);
      if (micWanted && !speaking) {
        setTimeout(function () { try { recog.start(); } catch (e) {} }, 300);
      }
    };
    return r;
  }

  function pauseListeningThenResume() {
    if (!micWanted) { return; }
    setTimeout(function () {
      if (micWanted && !speaking) {
        try { recog && recog.start(); } catch (e) {}
      }
    }, 250);
  }

  function setMicUI(on) {
    micBtn.classList.toggle('bc-mic-on', on);
    micBtn.title = on ? 'Listening — tap to stop' : 'Talk hands-free';
    input.placeholder = on ? 'Listening... just talk' : 'Ask about adventures...';
  }

  function setMicWanted(on) {
    micWanted = on;
    micOn = on;
    if (on) {
      if (muted) { toggleMute(); }   /* voice chat implies sound on */
      recog = recog || buildRecognizer();
      try { recog.start(); setMicUI(true); } catch (e) { /* already started */ }
    } else {
      try { recog && recog.stop(); } catch (e) {}
      setMicUI(false);
    }
  }

  function toggleMic() {
    if (!supported) {
      if (inAppBrowser()) {
        el('Voice input is blocked in this in-app browser — open the page in Safari and the mic will work.', 'bc-msg bc-bot');
      } else {
        el('Voice input needs Chrome, Edge, or Safari 14.5+. Typing works everywhere.', 'bc-msg bc-bot');
      }
      return;
    }
    setMicWanted(!micWanted);
  }

  /* -- Conversation flow --------------------------------------------------- */
  function matchIntent(text) {
    var low = text.toLowerCase();
    for (var i = 0; i < INTENTS.length; i++) {
      var intent = INTENTS[i];
      for (var j = 0; j < intent.k.length; j++) {
        if (low.indexOf(intent.k[j]) !== -1) { return intent; }
      }
    }
    return null;
  }

  function send(txt) {
    txt = (txt || input.value).trim();
    if (!txt) { return; }
    el(txt, 'bc-msg bc-user');
    input.value = '';
    squishPulse();
    setThinking(true);
    var r = matchIntent(txt) || FALLBACK;
    setTimeout(function () {
      setThinking(false);
      el(r.t, 'bc-msg bc-bot');
      speaking = true;
      playAudio(r.a);
      if (r.a === 'book' || r.a === 'pricing') {
        opts(CTAS);
      }
    }, 620);
  }

  function openPanel() {
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    if (!started) {
      started = true;
      var g = INTENTS[INTENTS.length - 1]; /* greet */
      el(g.t, 'bc-msg bc-bot');
      speaking = true;
      playAudio('greet');
      opts(SUGGESTIONS);
    }
    input.focus();
  }

  function closePanel() {
    panel.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
    if (micWanted) { setMicWanted(false); }
  }

  /* -- Wire up -------------------------------------------------------------- */
  fab.addEventListener('click', function () {
    if (panel.classList.contains('open')) { closePanel(); } else { openPanel(); }
  });
  if (closeBtn) { closeBtn.addEventListener('click', closePanel); }
  muteBtn.addEventListener('click', toggleMute);
  if (micBtn) { micBtn.addEventListener('click', toggleMic); }
  if (modeChat) {
    modeChat.addEventListener('click', function () {
      modeChat.classList.add('bc-mode-on');
      if (modeAudio) { modeAudio.classList.remove('bc-mode-on'); }
      if (micWanted) { setMicWanted(false); }
    });
  }
  if (modeAudio) {
    modeAudio.addEventListener('click', function () {
      modeAudio.classList.add('bc-mode-on');
      if (modeChat) { modeChat.classList.remove('bc-mode-on'); }
      toggleMic();
    });
  }
  document.getElementById('bc-send').addEventListener('click', function () { send(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { send(); }
  });
})();
