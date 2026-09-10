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
  var SIMLI_API_KEY = '5e2ucmvyrlmkapwg4hzyf';
  var SIMLI_FACE_ID = '5fc23ea5-8175-4a82-aaaf-cdd8c88543dc';

  /* --- Real-time brain + voice (v11): no more set recordings --- */
  var BRAIN_URL = 'https://xkjkwqbfvkswwdmbtndo.supabase.co/functions/v1/recall';
  var BRAIN_KEY = 'bc_live_p3NlMdAVuCXATRiffBsQLDTRy6p_cUPy';
  var TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128';
  var TTS_KEY = 'sk_6b9aa7c4edd19c804554e48fd48dac0dc3686a3fb49cc843';

  var INTENTS = [
    {
      a: 'what',
      k: ['what is', 'ottomedic', 'otto medic', 'what\u2019s', 'whats', 'about', 'tell me', 'skimmer', 'product'],
      t: 'OttoMedic is the only skimmer that thinks for itself. It continuously monitors and adjusts to maintain optimal foam height — no sensors to calibrate, no controllers to tune. Install it, set your target foam height once, and never touch it again.'
    },
    {
      a: 'how',
      k: ['how does', 'how it works', 'mechanical', 'electronic', 'controller', 'sensor', 'technology', 'automation'],
      t: 'This is not software automation. OttoMedic uses a purely mechanical system to adjust water level automatically. Electronic controllers need calibration and fail. OttoMedic\u2019s mechanical regulation works perfectly from day one, and adapts to feeding, bioload, and temperature changes on its own.'
    },
    {
      a: 'prevents',
      k: ['prevent', 'overflow', 'problem', 'flood', 'fail', 'crash', 'risk', 'worry'],
      t: 'I have analyzed thousands of reef system failures. The big three: five gallons of skimmate on your floor from overflow, a pump running dry, and stressed corals that stop growing. OttoMedic eliminates all three. It prevents catastrophic overflow events before they happen.'
    },
    {
      a: 'setup',
      k: ['setup', 'set up', 'install', 'fitting', 'water level', 'start', 'begin', 'calibrate'],
      t: 'Setup is simple. Install it, set your target foam height once, done. No sensors to calibrate or fail. Tell me your tank and I will walk you through the exact fittings and water level requirements for your build.'
    },
    {
      a: 'bioload',
      k: ['bioload', 'feeding', 'feed', 'stock', 'temperature', 'adapt', 'change', 'heavy'],
      t: 'Bioload is exactly where OttoMedic shines. It automatically adapts to feeding schedules, bioload, and water temperature changes. Heavy feeding protocols, big stocking lists — it handles it, and stays steady when your system changes.'
    },
    {
      a: 'keepers',
      k: ['who', 'keeper', 'reef', 'coral', 'sps', 'livestock', 'quality', 'built'],
      t: 'OttoMedic is built for reef keepers who understand that stability is survival. If your livestock costs more than most people\u2019s entire tanks, this is the skimmer for you. Marine-grade stainless fittings, built to last.'
    },
    {
      a: 'greet',
      k: ['hello', 'hi', 'hey', 'marina', 'who are you', 'your name'],
      t: 'Hi, I\u2019m Marina, your OttoMedic specialist. Ask me how the skimmer works, why mechanical beats electronic, what it prevents, or how setup goes.'
    }
  ];

  var FALLBACK = {
    a: 'fallback',
    t: 'Ask me how OttoMedic works, why mechanical regulation beats electronic controllers, what problems it prevents, or how setup goes. I am here to help.'
  };

  var SUGGESTIONS = [
    'What is OttoMedic?',
    'How does it work?',
    'What problems does it prevent?',
    'How does setup go?'
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
  var AUTO_VIDEO = false;  /* separation of agents: panel = voice only; #bc-fab-video = dedicated video agent */
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
    if (videoStarting) { setTimeout(botFinished, 400); return; }
    /* VIDEO MODE: stream the reply into the Simli avatar */
    if (videoMode.on && simliReady()) {
      speakThroughSimli('widget/audio/' + name + '.mp3');
      return;
    }
    /* AUDIO MODE: local playback + squish mouth */
    try {
      stopMouth();
      if (currentAudio) { currentAudio.pause(); }
      currentAudio = new Audio('widget/audio/' + name + '.mp3');
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
  var videoStarting = false;   /* true while Simli connects — local MP3 output suppressed so the two agents never talk over each other */
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
      await simliStream(ab);
    } catch (e) { botFinished(); }
  }

  function speakTextThroughSimli(text) {
    ttsFetch(text).then(function (blob) { return blob.arrayBuffer(); }).then(function (ab) { return simliStream(ab); }).catch(function () { botFinished(); });
  }

  async function simliStream(ab) {
    try {
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
    videoStarting = true;
    try { if (currentAudio) { currentAudio.pause(); } } catch (ePre) {}
    try {
      await startSimli();
      videoMode.on = true;
      videoStarting = false;
      panel.classList.add('bc-video-mode');
      videoBtn.textContent = '\u{1F4A1}';
      videoBtn.title = 'Video avatar on — click to turn off';
      el('Video avatar is live now — watch me talk. Tap the mic and just talk to me.', 'bc-msg bc-bot');
    } catch (e) {
      videoStarting = false;
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
    input.placeholder = on ? 'Listening... just talk' : 'Ask Marina about OttoMedic...';
    setModeUI();
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
      input.placeholder = 'Ask Marina about OttoMedic...';
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
    var t = el('Marina is thinking…', 'bc-msg bc-bot bc-typing');
    askBrain(txt).then(function (r) {
      if (t.parentNode) { t.parentNode.removeChild(t); }
      setThinking(false);
      el(r.t, 'bc-msg bc-bot');
      speaking = true;
      playReply(r);
      if (!r.canned) {
        opts([{ label: 'Reserve yours — free assessment', href: '/showcase/project-home-spark/request/' }]);
      } else if (r.a === 'prevents' || r.a === 'setup') {
        opts([
          { label: 'Reserve yours — free assessment', href: '/showcase/project-home-spark/request/' },
          { label: 'How does it work?' }
        ]);
      }
    });
  }

  /* LIVE BRAIN: BlueColumn recall answers any question about the
     product in real time. Canned intents remain the offline fallback. */
  function askBrain(text) {
    var canned = matchIntent(text) || FALLBACK;
    return fetch(BRAIN_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + BRAIN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'OttoMedic reef skimmer customer question: ' + text })
    }).then(function (res) { return res.json(); }).then(function (d) {
      var a = (d && d.answer ? String(d.answer) : '').trim();
      if (!a || /not in available context/i.test(a) || a.length < 8) { return { t: canned.t, a: canned.a, canned: true }; }
      return { t: a, canned: false };
    }).catch(function () { return { t: canned.t, a: canned.a, canned: true }; });
  }

  /* Reply audio: real TTS in audio mode (squish mouth), streamed into
     the Simli avatar in video mode; canned MP3 as last-resort fallback. */
  function playReply(r) {
    if (muted || videoStarting) { setTimeout(botFinished, 400); return; }
    if (videoMode.on && simliReady()) { speakTextThroughSimli(r.t); return; }
    ttsFetch(r.t).then(function (blob) {
      try {
        stopMouth();
        if (currentAudio) { currentAudio.pause(); }
        currentAudio = new Audio(URL.createObjectURL(blob));
        avatar.classList.add('bc-talking');
        currentAudio.onended = botFinished;
        currentAudio.play().then(startMouth).catch(function () { botFinished(); });
      } catch (e2) { botFinished(); }
    }).catch(function () { playAudio(r.canned ? r.a : 'greet'); });
  }

  function ttsFetch(text) {
    return fetch(TTS_URL, {
      method: 'POST',
      headers: { 'xi-api-key': TTS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, model_id: 'eleven_flash_v2_5' })
    }).then(function (res) { if (!res.ok) { throw new Error('tts ' + res.status); } return res.blob(); });
  }

  function openPanel() {
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    showGreeting();      /* chat starts immediately; audio/video wait for the chooser */
    setModeUI();
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

  /* MODE MANAGEMENT — one conversation, three modalities (v9).
     Chat starts immediately on open. Audio and Video only start
     when the user picks them from the chooser. */
  function setModeUI() {
    var chatBtn = document.getElementById('bc-mode-chat');
    var audioBtn = document.getElementById('bc-mode-audio');
    var videoModeBtn = document.getElementById('bc-mode-video');
    if (!chatBtn || !audioBtn || !videoModeBtn) { return; }
    var audioOn = micWanted || (speaking && !videoMode.on);
    chatBtn.classList.toggle('bc-mode-on', !videoMode.on && !audioOn && !videoStarting);
    audioBtn.classList.toggle('bc-mode-on', !videoMode.on && audioOn && !videoStarting);
    videoModeBtn.classList.toggle('bc-mode-on', !!videoMode.on || videoStarting);
    audioBtn.disabled = videoStarting;
    videoModeBtn.disabled = videoStarting;
  }

  function showGreeting() {
    if (!started) {
      started = true;
      var g = INTENTS[INTENTS.length - 1]; /* greet */
      el(g.t, 'bc-msg bc-bot');
      opts(SUGGESTIONS);
    }
  }

  /* AUDIO AGENT: voice replies + hands-free mic. Video is switched
     off first if it was running, so only one agent ever speaks. */
  function startAudioAgent() {
    if (videoStarting) { return; }
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    if (videoMode.on) { toggleVideo(); }   /* synchronous off-path */
    showGreeting();
    speaking = true;
    playAudio('greet');
    if (supportedSR() && !micWanted) { toggleMic(); }
    setModeUI();
  }

  /* VIDEO AGENT: live avatar. Only starts from the chooser. */
  function startVideoAgent() {
    if (videoStarting) { return; }
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    if (videoMode.on) { setModeUI(); return; }
    showGreeting();
    /* hand over from the audio agent: stop its speech + mic */
    try { if (currentAudio) { currentAudio.pause(); } } catch (ePause) {}
    speaking = false;
    avatar.classList.remove('bc-talking');
    if (micWanted) { toggleMic(); }
    toggleVideo().then(function () {
      /* greet through Simli on success; falls back to local MP3 on failure */
      speaking = true;
      playAudio('greet');
      setModeUI();
    });
    setModeUI();
  }

  function switchToChat() {
    if (videoMode.on) { toggleVideo(); }
    if (micWanted) { toggleMic(); }
    try { if (currentAudio) { currentAudio.pause(); } } catch (eChat) {}
    speaking = false;
    avatar.classList.remove('bc-talking');
    setModeUI();
  }

  var modeChatBtn = document.getElementById('bc-mode-chat');
  var modeAudioBtn = document.getElementById('bc-mode-audio');
  var modeVideoBtn = document.getElementById('bc-mode-video');
  if (modeAudioBtn) { modeAudioBtn.addEventListener('click', startAudioAgent); }
  if (modeVideoBtn) { modeVideoBtn.addEventListener('click', startVideoAgent); }
  if (modeChatBtn) { modeChatBtn.addEventListener('click', switchToChat); }

  /* Test/deep-link hook: ?open=1 opens the panel on load (chat mode only) */
  if (location.search.indexOf('open=1') !== -1) { openPanel(); }
  if (micBtn) { micBtn.addEventListener('click', toggleMic); }
  document.getElementById('bc-send').addEventListener('click', function () { send(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { send(); }
  });
})();
