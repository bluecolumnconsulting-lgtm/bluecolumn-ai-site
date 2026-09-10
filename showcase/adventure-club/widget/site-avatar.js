/* ===============================================================
   ADVENTURE CLUB — SITE AVATAR v2 (BlueColumn AI)
   Scout, the club's animated guide. Marina-grade capability set:
   - LIVE BRAIN: BlueColumn /recall answers any question in real
     time; typing indicator; canned intents are the OFFLINE
     fallback only ("not in available context" answers rejected).
   - REAL TTS REPLIES: dynamic answers spoken via ElevenLabs TTS.
     Pre-packed MP3s only for the greeting + last-resort fallback.
   - ONE VOICE AT A TIME (v14 rule): a single active speech feed;
     new speech instantly cancels the previous one. No overlaps,
     no gargle, no leaked fallbacks.
   - ANIMATED AVATAR: mouth states (closed/half/open) driven by
     the playing audio's Web Audio analyser RMS — synced to TTS.
   - CHOOSER FLOW: one "Talk to us" button -> panel with
     Chat / Audio / Video modes. Chat starts instantly and
     silently; Audio/Video only start on click; clean handoffs.
     (Video = large animated Scout stage — no Simli anywhere.)
   =============================================================== */
(function () {
  'use strict';

  /* --- Real-time brain + voice (same endpoints as the OttoMedic template) --- */
  var BRAIN_URL = 'https://xkjkwqbfvkswwdmbtndo.supabase.co/functions/v1/recall';
  var BRAIN_KEY = 'bc_live_p3NlMdAVuCXATRiffBsQLDTRy6p_cUPy';
  var TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB?output_format=mp3_44100_128';
  var TTS_KEY = 'sk_6b9aa7c4edd19c804554e48fd48dac0dc3686a3fb49cc843';

  /* Animated mouth sprites */
  var MOUTH_CLOSED = 'widget/mascot-closed.svg';
  var MOUTH_HALF = 'widget/mascot-half.svg';
  var MOUTH_OPEN = 'widget/mascot-open.svg';

  var INTENTS = [
    {
      a: 'what',
      k: ['what is', 'what\u2019s', 'whats', 'about', 'tell me', 'club', 'membership club', 'how does it work'],
      t: 'Adventure Club is a membership club for guided real-world adventures — hiking, kayaking, camping, and weekend expeditions. All the planning is handled for you: routes, permits, gear lists, meeting points, and safety briefings.'
    },
    {
      a: 'pricing',
      k: ['price', 'pricing', 'cost', 'tier', 'plan', 'explorer', 'adventurer', 'expedition', 'how much', 'fee', 'month'],
      t: 'Three tiers. Explorer is 29 a month with monthly day trips and member meetups. Adventurer is 59 a month, adding weekend expeditions, kayaking and camping trips, gear discounts, and priority booking. Expedition is 99 a month for multi-day flagship expeditions, a quarterly guest pass, and a personal trip concierge.'
    },
    {
      a: 'trips',
      k: ['trip', 'trips', 'adventure', 'hike', 'hiking', 'kayak', 'kayaking', 'camp', 'camping', 'expedition', 'calendar', 'where', 'weekend', 'itinerary', 'beginner'],
      t: 'We run guided hiking, kayaking, camping, and weekend expeditions — every trip graded easy, moderate, or challenging so you can pick your fit. Beginners are totally welcome. You book a spot on the trip calendar; higher tiers get priority booking.'
    },
    {
      a: 'safety',
      k: ['safe', 'safety', 'gear', 'guide', 'guides', 'insurance', 'permit', 'weather', 'injury', 'risk', 'equipment', 'ratio'],
      t: 'Every trip is led by certified guides with wilderness first aid, and our guide-to-member ratio never exceeds one to eight. You get a personal gear list, and all group gear — ropes, kayaks, safety equipment — is provided. We watch the weather and make the call 24 hours before departure, with a full refund or free rebooking.'
    },
    {
      a: 'book',
      k: ['book', 'join', 'sign up', 'request', 'start', 'member', 'reserve', 'get started', 'first trip'],
      t: 'Easy: sign up online and pick your tier, get matched to adventures that fit your experience, reserve a spot on the trip calendar, then just show up — we handle gear lists, logistics, and safety briefings. Tap Request Membership on this page to start.'
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
    'What trips do you run?',
    'How do I join?'
  ];

  var CTAS = [
    { label: 'Request membership', href: '/showcase/adventure-club/request/' },
    { label: 'What trips do you run?' }
  ];

  /* -- Elements --------------------------------------------------------- */
  var fab = document.getElementById('bc-fab');
  var panel = document.getElementById('bc-panel');
  var avatar = document.getElementById('bc-avatar');
  var headImg = document.getElementById('bc-head-img');
  var stage = document.getElementById('bc-stage');
  var log = document.getElementById('bc-log');
  var input = document.getElementById('bc-in');
  var muteBtn = document.getElementById('bc-mute');
  var closeBtn = document.getElementById('bc-close');
  var micBtn = document.getElementById('bc-mic');

  if (!fab || !panel || !log || !input) { return; }

  /* -- Audio engine ------------------------------------------------------ */
  var muted = false;
  var started = false;
  var mouthRAF = null, audioCtx = null, analyser = null, timeData = null;
  var speaking = false;
  var speechEndCb = null;
  var lastFlip = 0, lastState = 'closed';
  var feedSeq = 0;
  var voiceFeed = null;   /* v14 rule: one voice at a time — newest cancels the active feed */

  function setMouth(state) {
    var src = state === 'open' ? MOUTH_OPEN : state === 'half' ? MOUTH_HALF : MOUTH_CLOSED;
    if (avatar) { avatar.src = src; }
    if (headImg) { headImg.src = src; }
    if (stage) { stage.src = state === 'open' ? MOUTH_OPEN : state === 'half' ? MOUTH_HALF : MOUTH_CLOSED; }
    lastState = state;
  }

  function stopMouth() {
    if (mouthRAF) { cancelAnimationFrame(mouthRAF); mouthRAF = null; }
    setMouth('closed');
  }

  function killFeed() {
    /* instantly cancel the active speech feed (new speech wins) */
    if (voiceFeed) {
      try { voiceFeed.audio.onended = null; } catch (e) {}
      try { voiceFeed.audio.pause(); } catch (e) {}
      voiceFeed = null;
    }
    stopMouth();
  }

  /* Analyser RMS -> sprite state swap (closed / half / open) */
  function startMouth(feed) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') { audioCtx.resume(); }
      var src = audioCtx.createMediaElementSource(feed.audio);
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.55;
        timeData = new Uint8Array(analyser.fftSize);
        analyser.connect(audioCtx.destination);
      }
      src.connect(analyser);
      feed.haveAnalyser = true;
    } catch (e) { /* analyser unavailable: fallback rhythm below */ }
    var tick = function () {
      if (voiceFeed !== feed || feed.audio.paused) {
        if (voiceFeed === feed) { stopMouth(); voiceFeed = null; }
        return;
      }
      var now = Date.now();
      if (now - lastFlip < 55) { feed.raf = requestAnimationFrame(tick); return; }
      var energy = 0;
      if (feed.haveAnalyser && timeData) {
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
      feed.raf = requestAnimationFrame(tick);
    };
    feed.raf = requestAnimationFrame(tick);
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

  /* Single speech path for everything (canned MP3 or TTS blob).
     Starts a new feed; the previous feed is cancelled immediately. */
  function speakAudioEl(audio) {
    killFeed();
    var feed = { id: ++feedSeq, audio: audio, raf: null, haveAnalyser: false };
    voiceFeed = feed;
    speaking = true;
    avatar.classList.add('bc-talking');
    audio.onended = function () {
      if (voiceFeed === feed) { voiceFeed = null; botFinished(); }
    };
    audio.play().then(function () { startMouth(feed); }).catch(function () {
      if (voiceFeed === feed) { voiceFeed = null; botFinished(); }
    });
    return feed;
  }

  function playAudio(name) {
    if (muted) { setTimeout(botFinished, 400); return; }
    try {
      var a = new Audio('widget/audio/' + name + '.mp3');
      a.preload = 'auto';
      speakAudioEl(a);
    } catch (e) { botFinished(); }
  }

  function toggleMute() {
    muted = !muted;
    muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    muteBtn.title = muted ? 'Voice off' : 'Voice on';
    if (muted) { killFeed(); }
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

  function squishPulse() {
    avatar.classList.remove('bc-squish');
    void avatar.offsetWidth;
    avatar.classList.add('bc-squish');
  }
  function setThinking(on) {
    avatar.classList.toggle('bc-thinking', on);
  }

  /* ============================================================
     LIVE BRAIN (BlueColumn /recall)
     Canned intents are the offline fallback only.
     ============================================================ */
  function askBrain(text) {
    var canned = matchIntent(text) || FALLBACK;
    return fetch(BRAIN_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + BRAIN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'Adventure Club customer question: ' + text })
    }).then(function (res) { return res.json(); }).then(function (d) {
      var a = (d && d.answer ? String(d.answer) : '').trim();
      if (!a || /not in available context/i.test(a) || a.length < 8) { return { t: canned.t, a: canned.a, canned: true }; }
      return { t: a, canned: false };
    }).catch(function () { return { t: canned.t, a: canned.a, canned: true }; });
  }

  /* Real TTS for dynamic replies; canned MP3 as last-resort fallback. */
  function playReply(r) {
    if (muted) { setTimeout(botFinished, 400); return; }
    ttsFetch(r.t).then(function (blob) {
      var a = new Audio(URL.createObjectURL(blob));
      speakAudioEl(a);
    }).catch(function () {
      playAudio(r.canned ? r.a : 'fallback');
    });
  }

  function ttsFetch(text) {
    return fetch(TTS_URL, {
      method: 'POST',
      headers: { 'xi-api-key': TTS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, model_id: 'eleven_flash_v2_5' })
    }).then(function (res) { if (!res.ok) { throw new Error('tts ' + res.status); } return res.blob(); });
  }

  /* ============================================================
     HANDS-FREE VOICE (Web Speech API)
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
    var t = el('Scout is thinking\u2026', 'bc-msg bc-bot bc-typing');
    askBrain(txt).then(function (r) {
      if (t.parentNode) { t.parentNode.removeChild(t); }
      setThinking(false);
      el(r.t, 'bc-msg bc-bot');
      playReply(r);
      if (!r.canned || r.a === 'book' || r.a === 'pricing') {
        opts([{ label: 'Request membership', href: '/showcase/adventure-club/request/' }]);
      } else if (r.a === 'safety' || r.a === 'trips') {
        opts(CTAS);
      }
    });
  }

  function openPanel() {
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    showGreeting();      /* chat starts immediately, silently; audio/video wait for the chooser */
    setModeUI();
    input.focus();
  }

  function closePanel() {
    panel.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
    switchToChat();
  }

  function showGreeting() {
    if (!started) {
      started = true;
      var g = INTENTS[INTENTS.length - 1]; /* greet */
      el(g.t, 'bc-msg bc-bot');
      opts(SUGGESTIONS);
    }
  }

  /* -- MODE MANAGEMENT — one conversation, three modalities ------------------
     Chat starts immediately on open (silent). Audio and Video only start
     when picked from the chooser. Only one agent ever speaks at a time. */
  var modeChatBtn = document.getElementById('bc-mode-chat');
  var modeAudioBtn = document.getElementById('bc-mode-audio');
  var modeVideoBtn = document.getElementById('bc-mode-video');

  function setModeUI() {
    if (!modeChatBtn || !modeAudioBtn || !modeVideoBtn) { return; }
    var audioOn = micWanted || (speaking && !panel.classList.contains('bc-video-mode'));
    modeChatBtn.classList.toggle('bc-mode-on', !panel.classList.contains('bc-video-mode') && !audioOn);
    modeAudioBtn.classList.toggle('bc-mode-on', !panel.classList.contains('bc-video-mode') && audioOn);
    modeVideoBtn.classList.toggle('bc-mode-on', panel.classList.contains('bc-video-mode'));
  }

  /* AUDIO AGENT: voice replies + hands-free mic. Video stage off first. */
  function startAudioAgent() {
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    panel.classList.remove('bc-video-mode');   /* leave video stage synchronously */
    showGreeting();
    speaking = true;
    playAudio('greet');
    if (supportedSR() && !micWanted) { toggleMic(); }
    setModeUI();
  }

  /* VIDEO AGENT: large animated Scout stage (no Simli). Chooser-only start. */
  function startVideoAgent() {
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    if (panel.classList.contains('bc-video-mode')) { setModeUI(); return; }
    showGreeting();
    killFeed();                                /* hand over: stop prior speech */
    if (micWanted) { setMicWanted(false); }
    panel.classList.add('bc-video-mode');
    el('Video stage is live now — watch me talk. Tap the mic and just talk to me.', 'bc-msg bc-bot');
    speaking = true;
    playAudio('greet');
    if (supportedSR() && !micWanted) { toggleMic(); }
    setModeUI();
  }

  function switchToChat() {
    panel.classList.remove('bc-video-mode');
    if (micWanted) { setMicWanted(false); }
    killFeed();
    speaking = false;
    avatar.classList.remove('bc-talking');
    setModeUI();
  }

  if (modeAudioBtn) { modeAudioBtn.addEventListener('click', startAudioAgent); }
  if (modeVideoBtn) { modeVideoBtn.addEventListener('click', startVideoAgent); }
  if (modeChatBtn) { modeChatBtn.addEventListener('click', switchToChat); }

  /* -- Wire up -------------------------------------------------------------- */
  fab.addEventListener('click', function () {
    if (panel.classList.contains('open')) { closePanel(); } else { openPanel(); }
  });
  if (closeBtn) { closeBtn.addEventListener('click', closePanel); }
  muteBtn.addEventListener('click', toggleMute);
  if (micBtn) { micBtn.addEventListener('click', toggleMic); }
  document.getElementById('bc-send').addEventListener('click', function () { send(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { send(); }
  });

  /* Test/deep-link hook: ?open=1 opens the panel on load (chat mode only) */
  if (location.search.indexOf('open=1') !== -1) { openPanel(); }
})();
