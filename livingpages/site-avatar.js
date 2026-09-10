/* ===============================================================
   THE BLUE COLUMN - SITE AVATAR v3 (BlueColumn AI)
   Interactive demo assistant for the Living Pages landing site.
   Three ways to talk:
   - TYPE: text chat (always available)
   - TALK: hands-free voice conversation (Web Speech API mic in,
     spoken answers out, auto re-listen for back-and-forth)
   - VIDEO: Simli real-time talking head — replies are streamed
     as PCM16/16kHz into the WebRTC session so the avatar speaks
     them live, lip-synced server-side.
   Fallback chain: video -> local MP3 voice -> text only.
   =============================================================== */
(function () {
  'use strict';

  /* Simli demo credentials (demo tier key, public demo widget) */
  var SIMLI_API_KEY = '5e2ucm…hzyf';
  var SIMLI_FACE_ID = 'tmp9i8bbq7c';

  var INTENTS = [
    {
      a: 'what',
      k: ['what is', 'living page', 'livingpage', 'how does it work', 'what does it do', 'explain'],
      t: 'A Living Page is a website that talks with visitors instead of making them fill out forms. It answers questions, qualifies leads, and books appointments automatically — 24/7. This page you are on right now is a demo of exactly that.'
    },
    {
      a: 'signup',
      k: ['sign up', 'signup', 'sign-up', 'get started', 'register', 'create account', 'my account', 'build my', 'get one'],
      t: 'Signing up is simple: every BlueColumn account includes a Living Page. Click Create your free account, register with your email, and your Living Page goes live with it. No card required.'
    },
    {
      a: 'cost',
      k: ['price', 'cost', 'how much', 'pricing', 'rate', 'plan', 'essential', 'lead engine', 'fee', 'expensive'],
      t: 'Every BlueColumn account includes a Living Page — free to start, no card required. Prefer we build and manage everything for you? AlwaysOn Essential is 497 setup plus 97 a month, done for you.'
    },
    {
      a: 'setup',
      k: ['fast', 'set up', 'how long', 'timeline', 'launch', 'live', 'weeks', 'days', 'onboard'],
      t: 'About 30 days end to end. Onboarding in week one, training in weeks two and three, then live with monitoring in week four. We handle the build, the run, and the management the whole way.'
    },
    {
      a: 'examples',
      k: ['example', 'show me', 'demo', 'portfolio', 'see one', 'proof', 'who', 'built'],
      t: 'See the Proof of Work section on this page: The Rewards Club, Project Home Spark, and Fence Craft Hub are live now, plus niche demos like Panhandle Watersports.'
    },
    {
      a: 'channels',
      k: ['channel', 'text', 'email', 'phone', 'sms', 'follow up', 'follow-up', 'call'],
      t: 'Your Living Page talks with customers on your website, then follows up by text, email, or phone. One brain, every channel — and it remembers every conversation.'
    },
    {
      a: 'bluecolumn',
      k: ['bluecolumn', 'blue column', 'memory', 'remember', 'smarter', 'intelligence'],
      t: 'BlueColumn is the memory layer underneath every Living Page. It remembers every conversation, so your page gets smarter every single day.'
    },
    {
      a: 'greet',
      k: ['hello', 'hi', 'hey', 'yo', 'sup', 'who are you', 'your name'],
      t: 'Hi. I am the Blue Column, the live demo assistant on this page. Ask me what a Living Page is, how signing up works, what it costs, or what channels it covers.'
    }
  ];

  var FALLBACK = {
    a: 'fallback',
    t: 'I can explain what a Living Page is, how signup works, pricing, setup time, channels, and where to see examples. Try one of those — or hit Create your free account below.'
  };

  var SUGGESTIONS = [
    'What is a Living Page?',
    'How do I sign up?',
    'What does it cost?',
    'Show me examples'
  ];

  /* -- Elements ----------------------------------------------- */
  var fab = document.getElementById('bc-fab');
  var panel = document.getElementById('bc-panel');
  var avatar = document.getElementById('bc-avatar');
  var log = document.getElementById('bc-log');
  var input = document.getElementById('bc-in');
  var muteBtn = document.getElementById('bc-mute');
  var closeBtn = document.getElementById('bc-close');
  var videoBtn = document.getElementById('bc-video');
  var micBtn = document.getElementById('bc-mic');
  var videoWrap = document.getElementById('bc-video-wrap');
  var videoEl = document.getElementById('bc-video-el');
  var simliAudio = document.getElementById('bc-simli-audio');

  if (!fab || !panel || !log || !input) { return; }

  /* -- Audio engine (audio-bot mode) -------------------------- */
  var muted = false;
  var currentAudio = null;
  var started = false;
  var mouthRAF = null, audioCtx = null, analyser = null, mouthData = null;
  var speaking = false;      /* bot is currently talking */
  var speechEndCb = null;    /* fired when the bot finishes talking */

  function stopMouth() {
    if (mouthRAF) { cancelAnimationFrame(mouthRAF); mouthRAF = null; }
    avatar.style.transform = '';
  }
  function startMouth() {
    if (!currentAudio) { return; }
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (!analyser) {
        var src = audioCtx.createMediaElementSource(currentAudio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyser.connect(audioCtx.destination);
        mouthData = new Uint8Array(analyser.frequencyBinCount);
      }
    } catch (e) { /* analyser unavailable: CSS rhythm still applies */ }
    var tick = function () {
      if (!currentAudio || currentAudio.paused) { stopMouth(); return; }
      var energy = 0.5 + 0.5 * Math.sin(Date.now() / 80);
      if (analyser && mouthData) {
        analyser.getByteFrequencyData(mouthData);
        var sum = 0, i;
        for (i = 2; i < 40; i++) { sum += mouthData[i]; }
        energy = sum / 38 / 255;
      }
      var sy = 1 + energy * 0.28;
      var sx = 1 - energy * 0.20;
      avatar.style.transform = 'scaleY(' + sy.toFixed(3) + ') scaleX(' + sx.toFixed(3) + ')';
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
    if (micOn) { setTimeout(pauseListeningThenResume, 350); }
  }

  function playAudio(name) {
    if (muted) { setTimeout(botFinished, 400); return; }
    /* VIDEO MODE: stream the reply into the Simli avatar */
    if (videoMode.on && simliReady()) {
      speakThroughSimli('audio/' + name + '.mp3');
      return;
    }
    /* AUDIO MODE: local playback + squish mouth */
    try {
      stopMouth();
      if (currentAudio) { currentAudio.pause(); }
      currentAudio = new Audio('audio/' + name + '.mp3');
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

  /* -- Message helpers ---------------------------------------- */
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

  /* -- Column mascot squish states ---------------------------- */
  function squishPulse() {
    avatar.classList.remove('bc-squish');
    void avatar.offsetWidth;
    avatar.classList.add('bc-squish');
  }
  function setThinking(on) {
    avatar.classList.toggle('bc-thinking', on);
  }

  /* ============================================================
     VIDEO AVATAR (Simli WebRTC)
     ============================================================ */
  var videoMode = { on: false };
  var simliClient = null;

  function simliReady() {
    return !!(simliClient && videoMode.on);
  }

  /* Decode MP3 -> 16kHz mono PCM16, then stream to Simli in paced
     6000-byte chunks (~187ms each, slightly under real time).
     Calls botFinished() once the avatar should be done speaking. */
  async function speakThroughSimli(url) {
    try {
      var ab = await fetch(url).then(function (r) { return r.arrayBuffer(); });
      var decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
      var decoded = await decodeCtx.decodeAudioData(ab);
      if (decodeCtx.close) { decodeCtx.close(); }
      var durMs = decoded.duration * 1000;
      var len = Math.max(1, Math.ceil(decoded.duration * 16000));
      var off = new OfflineAudioContext(1, len, 16000);
      var src = off.createBufferSource();
      src.buffer = decoded;
      src.connect(off.destination);
      src.start();
      var rendered = await off.startRendering();
      var ch = rendered.getChannelData(0);
      var pcm = new Int16Array(ch.length);
      for (var i = 0; i < ch.length; i++) {
        var v = Math.max(-1, Math.min(1, ch[i]));
        pcm[i] = v < 0 ? v * 32768 : v * 32767;
      }
      var bytes = new Uint8Array(pcm.buffer);
      var CHUNK = 6000, pos = 0;
      var iv = setInterval(function () {
        if (!simliReady()) { clearInterval(iv); botFinished(); return; }
        if (pos >= bytes.length) { clearInterval(iv); return; }
        var end = Math.min(pos + CHUNK, bytes.length);
        try { simliClient.sendAudioData(bytes.slice(pos, end)); } catch (e) { clearInterval(iv); botFinished(); }
        pos = end;
      }, 175);
      /* schedule the end-of-speech hook from real audio duration */
      setTimeout(function () { if (speaking) { botFinished(); } }, durMs + 900);
    } catch (e) { botFinished(); }
  }

  async function startSimli() {
    var res = await fetch('https://api.simli.ai/startAudioToVideoSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: SIMLI_API_KEY,
        faceId: SIMLI_FACE_ID,
        handleSilence: true,
        maxSessionLength: 600,
        maxIdleTime: 180
      })
    });
    if (!res.ok) { throw new Error('Simli token ' + res.status); }
    var data = await res.json();
    /* Real ICE servers when the SDK can fetch them (helps mobile NAT) */
    var ice = null;
    try { ice = await SimliLib.generateIceServers(SIMLI_API_KEY); } catch (e) {}
    function makeClient(transport) {
      return new SimliLib.SimliClient(
        data.session_token,
        videoEl,
        simliAudio,
        ice,
        SimliLib.LogLevel ? SimliLib.LogLevel.WARN : undefined,
        transport
      );
    }
    /* Try livekit first, fall back to p2p transport */
    try {
      simliClient = makeClient('livekit');
      await simliClient.start();
    } catch (e1) {
      try { if (simliClient && simliClient.stop) { simliClient.stop(); } } catch (e) {}
      simliClient = makeClient('p2p');
      await simliClient.start();
    }
    /* iOS/Safari: autoplay needs an explicit play() inside the gesture chain */
    try { await videoEl.play(); } catch (e) {}
    try { await simliAudio.play(); } catch (e) {}
  }

  /* In-app browsers (Facebook/Instagram/etc.) often block WebRTC */
  function inAppBrowser() {
    var ua = navigator.userAgent || '';
    return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok/i.test(ua);
  }

  async function toggleVideo() {
    if (videoMode.on) {
      videoMode.on = false;
      panel.classList.remove('bc-video-mode');
      videoBtn.textContent = '\u{1F3A5}';
      videoBtn.title = 'Talking video avatar';
      try { if (simliClient && simliClient.close) { simliClient.close(); } } catch (e) {}
      simliClient = null;
      el('Switched back to voice mode.', 'bc-msg bc-bot');
      return;
    }
    videoBtn.textContent = '\u2026';
    if (inAppBrowser()) {
      videoBtn.textContent = '\u{1F3A5}';
      el('This in-app browser blocks live video. Open this page in Safari (or Chrome) and the talking avatar will work.', 'bc-msg bc-bot');
      return;
    }
    if (!window.RTCPeerConnection) {
      videoBtn.textContent = '\u{1F3A5}';
      el('This browser does not support live video (WebRTC). Voice mode still works — or open the page in Safari.', 'bc-msg bc-bot');
      return;
    }
    try {
      await startSimli();
      videoMode.on = true;
      panel.classList.add('bc-video-mode');
      videoBtn.textContent = '\u{1F4A1}';
      videoBtn.title = 'Video avatar on — click to turn off';
      el('Video avatar is live now — watch me talk. Tap the mic and just talk to me.', 'bc-msg bc-bot');
    } catch (e) {
      videoBtn.textContent = '\u{1F3A5}';
      var why = (e && (e.message || e.reason || e)) ? String(e.message || e.reason || e) : 'unknown';
      el('Video could not connect (' + why + '). Voice mode still works. If you keep seeing this, open the page in Safari.', 'bc-msg bc-bot');
    }
  }

  /* ============================================================
     HANDS-FREE VOICE (Web Speech API)
     Mic on = continuous conversation: listen -> reply spoken ->
     listen again, until mic toggled off. Typing still works.
     ============================================================ */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recog = null;
  var micOn = false;
  var micWanted = false;   /* user intent, survives transient errors */

  function supportedSR() { return !!SR; }

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
      /* no-speech / aborted: just let onend handle the resume */
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
    /* called when the bot finishes talking: mic picks back up */
    if (!micWanted) { return; }
    setTimeout(function () {
      if (micWanted && !speaking) {
        try { recog && recog.start(); } catch (e) {}
      }
    }, 250);
  }

  function setMicUI(on) {
    micBtn.classList.toggle('bc-mic-on', on);
    micBtn.textContent = on ? '\u{1F3A4}' : '\u{1F3A4}';
    micBtn.title = on ? 'Listening — tap to stop' : 'Talk hands-free';
    input.placeholder = on ? 'Listening... just talk' : 'Ask about Living Pages...';
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
    micWanted = !micWanted;
    micOn = micWanted;
    if (micWanted) {
      if (muted) { toggleMute(); }           /* voice chat implies sound on */
      recog = recog || buildRecognizer();
      try { recog.start(); setMicUI(true); } catch (e) { /* already started */ }
    } else {
      try { recog && recog.stop(); } catch (e) {}
      setMicUI(false);
      input.placeholder = 'Ask about Living Pages...';
    }
  }
  var supported = supportedSR();

  /* -- Conversation flow -------------------------------------- */
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
      if (r.a === 'cost' || r.a === 'signup') {
        opts([
          { label: 'Create your free account', href: '/signup' },
          { label: 'How does signup work?' }
        ]);
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
    if (micWanted) { toggleMic(); }   /* stop mic when panel closes */
  }

  /* -- Wire up ------------------------------------------------ */
  fab.addEventListener('click', function () {
    if (panel.classList.contains('open')) { closePanel(); } else { openPanel(); }
  });
  if (closeBtn) { closeBtn.addEventListener('click', closePanel); }
  muteBtn.addEventListener('click', toggleMute);
  if (videoBtn) { videoBtn.addEventListener('click', toggleVideo); }
  if (micBtn) { micBtn.addEventListener('click', toggleMic); }
  document.getElementById('bc-send').addEventListener('click', function () { send(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { send(); }
  });
})();
