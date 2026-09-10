/* ===============================================================
   THE BLUE COLUMN - SITE AVATAR (BlueColumn AI)
   Demo voice assistant for the Living Pages landing site.
   - Answers come from the INTENTS array below (no API calls).
   - Voice replies are pre-rendered MP3s in audio/ (ElevenLabs,
     rendered offline; no keys in this repo).
   - The column mascot squishes: idle breathing, squish-pulse on
     user messages, faster squish while thinking, settles on reply.
   =============================================================== */
(function () {
  'use strict';

  var INTENTS = [
    {
      a: 'what',
      k: ['what is', 'living page', 'livingpage', 'how does it work', 'what does it do', 'explain'],
      t: 'A Living Page is a website that talks with visitors instead of making them fill out forms. It answers questions, qualifies leads, and books appointments while you are on the job, around the clock.'
    },
    {
      a: 'cost',
      k: ['price', 'cost', 'how much', 'pricing', 'rate', 'plan', 'essential', 'lead engine', 'fee'],
      t: 'AlwaysOn Essential is $497 setup plus $97/mo. AlwaysOn Lead Engine is $997 setup plus $197/mo and adds a managed lead list for your trade and service area. Setup is one-time, month to month, no contracts.'
    },
    {
      a: 'setup',
      k: ['fast', 'setup', 'set up', 'how long', 'timeline', 'launch', 'live', 'start', 'weeks', 'days'],
      t: 'About 30 days end to end. Onboarding in week one, training in weeks two and three, then live with monitoring in week four. We handle the build, the run, and the management the whole way.'
    },
    {
      a: 'examples',
      k: ['example', 'show me', 'demo', 'portfolio', 'see one', 'proof', 'who', 'built'],
      t: 'See the Proof of Work section on this page: The Rewards Club, Project Home Spark, and Fence Craft Hub are live now, plus niche demos like Panhandle Watersports.'
    },
    {
      a: 'greet',
      k: ['hello', 'hi', 'hey', 'yo', 'sup', 'who are you', 'your name'],
      t: 'Hi. I am the Blue Column, the demo assistant on this page. Ask me what a Living Page is, what it costs, how fast setup is, or to see examples.'
    }
  ];

  var FALLBACK = {
    a: 'fallback',
    t: 'I know what a Living Page is, pricing, setup time, and where to find examples. Try one of those, or use the Build your Living Page button to get in touch.'
  };

  var SUGGESTIONS = [
    'What is a Living Page?',
    'What does it cost?',
    'How fast is setup?',
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

  if (!fab || !panel || !log || !input) { return; }

  /* -- Audio engine: pre-rendered MP3 per intent -------------- */
  var muted = false;
  var currentAudio = null;
  var started = false;
  var mouthRAF = null, audioCtx = null, analyser = null, mouthData = null;

  /* Video-bot mouth: Web Audio energy drives visible squash-and-stretch
     on the Blue Column while it speaks (same engine as Skippy). */
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
      var sy = 1 + energy * 0.28;   /* tall on loud */
      var sx = 1 - energy * 0.20;   /* narrow on loud */
      avatar.style.transform = 'scaleY(' + sy.toFixed(3) + ') scaleX(' + sx.toFixed(3) + ')';
      mouthRAF = requestAnimationFrame(tick);
    };
    mouthRAF = requestAnimationFrame(tick);
  }

  function playAudio(name) {
    if (muted) { return; }
    try {
      stopMouth();
      if (currentAudio) { currentAudio.pause(); }
      currentAudio = new Audio('audio/' + name + '.mp3');
      avatar.classList.add('bc-talking');
      currentAudio.onended = function () { stopMouth(); avatar.classList.remove('bc-talking'); };
      currentAudio.play().then(startMouth).catch(function () { stopMouth(); avatar.classList.remove('bc-talking'); });
    } catch (e) {
      stopMouth();
      avatar.classList.remove('bc-talking');
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
      b.textContent = a;
      b.onclick = function () { send(a); };
      w.appendChild(b);
    });
    log.appendChild(w);
    log.scrollTop = log.scrollHeight;
  }

  /* -- Column mascot squish states ---------------------------- */
  /* idle: gentle breathing (CSS). squish-pulse: one-shot on user
     message. thinking: fast squish loop. replying: settles. */
  function squishPulse() {
    avatar.classList.remove('bc-squish');
    void avatar.offsetWidth; /* restart animation */
    avatar.classList.add('bc-squish');
  }

  function setThinking(on) {
    avatar.classList.toggle('bc-thinking', on);
  }

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
      playAudio(r.a);
      if (r.a === 'cost') {
        opts(['Build your Living Page']);
        var buttons = log.querySelectorAll('.bc-opts button');
        var last = buttons[buttons.length - 1];
        last.onclick = function () { window.location.href = 'funnel/'; };
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
      playAudio('greet');
      opts(SUGGESTIONS);
    }
    input.focus();
  }

  function closePanel() {
    panel.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
  }

  /* -- Wire up ------------------------------------------------ */
  fab.addEventListener('click', function () {
    if (panel.classList.contains('open')) { closePanel(); } else { openPanel(); }
  });
  if (closeBtn) { closeBtn.addEventListener('click', closePanel); }
  muteBtn.addEventListener('click', toggleMute);
  document.getElementById('bc-send').addEventListener('click', function () { send(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { send(); }
  });
})();