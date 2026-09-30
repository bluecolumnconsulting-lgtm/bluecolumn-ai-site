/* ===============================================================
   OutLoud 2.0 — RUNTIME BOOTSTRAP
   Wires the layers in spec order:
     realtime input → session orchestrator →
     RAG (business-knowledge) + memory (customer-memory) →
     reasoning (response-planner) → rendering
       (speech-director + avatar-director + content-director)

   Also owns the page chrome: transcript rail, mic/sound toggles,
   state chip. Debug handle: window.OutLoudRuntime
   =============================================================== */
(function () {
  'use strict';
  var O = window.OUTLOUD;
  if (!O || !O.CONFIG) { return; }

  var bus = new O.EventBus();
  var memory = new O.SessionMemory();
  var input = new O.RealtimeInput(bus);
  var speech = new O.SpeechDirector(bus);
  var simli = new O.SimliDirector(bus);
  var anam = O.AnamDirector ? new O.AnamDirector(bus) : null;
  var screen = new O.ScreenDirector(bus);   // ambient card rotation on the branded screen
  var avatar = new O.AvatarDirector(bus, O.CONFIG.avatar);
  var content = new O.ContentDirector(bus);
  var planner = new O.ResponsePlanner(bus, memory);
  var orch = new O.Orchestrator(bus, { input: input, speech: speech, avatar: avatar, content: content, memory: memory, planner: planner });
  speech.sink = simli;   // default live sink; pickLiveDir() may switch it to Anam

  /* ---------- conversation controller ----------
     Port of OutLoud-conversation-controller (BlueColumn drop,
     2026-09-29). Rides the same bus events as the Orchestrator and
     adds: revision tokens for stale-turn detection, bounded replies
     (cleanReply cap applied by the planner), conversation history,
     avatar.state lifecycle, and InterruptiblePlayback (edge transport).
     Does not change lip-sync or the sink pipeline. */
  var session = null;
  if (O.ConversationSession && O.CONFIG.controller && O.CONFIG.controller.enabled) {
    session = new O.ConversationSession({ bus: bus, orch: orch, input: input, speech: speech, avatar: avatar, content: content });
  }
  bus.on('avatar.state', function (env) {
    /* Sprite-level reaction to the controller's avatar states; the
       speaking state stays owned by render()/lipSync. */
    if (env.payload.state === 'thinking') { avatar.setExpression('thinking', 0.5); }
    else if (env.payload.state === 'listening') { avatar.setExpression('friendly', 0.6); }
  });

  /* Live video director pick: Anam only when the page selects it
     (avatar.providers.anam.selected — /a/ boot configs set this for
     accounts that picked an Anam face) AND it is credentialed; Simli
     otherwise. The sprite rig stays underneath either way. */
  var liveDir = null;
  function pickLiveDir() {
    if (liveDir) { return liveDir; }
    var P = (O.CONFIG.avatar && O.CONFIG.avatar.providers && O.CONFIG.avatar.providers.anam) || null;
    if (anam && P && P.selected && anam.capable().ok) { liveDir = anam; }
    else if (simli.capable().ok) { liveDir = simli; }
    if (liveDir) { speech.sink = liveDir; }
    return liveDir;
  }

  /* ---------- DOM ---------- */
  function F(id) { return document.getElementById(id); }
  var log = F('ol-log'), textIn = F('ol-text-in'), sendBtn = F('ol-send');
  var micBtn = F('ol-mic'), soundBtn = F('ol-sound'), stateChip = F('ol-state');
  var srStatus = F('ol-sr-status');

  function addMsg(role, text, cls) {
    var li = document.createElement('li');
    li.className = 'ol-msg ol-' + role + (cls ? ' ' + cls : '');
    var stamp = document.createElement('span');
    stamp.className = 'ol-stamp mono';
    stamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var who = document.createElement('span');
    who.className = 'ol-who mono';
    who.textContent = role === 'visitor' ? 'Visitor' : 'OutLoud';
    var p = document.createElement('p');
    p.className = 'ol-talk';
    p.textContent = text;
    li.appendChild(stamp); li.appendChild(who); li.appendChild(p);
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    return li;
  }

  /* Partial transcript appears as a ghost line; finalized on chunk start. */
  var ghost = null;
  bus.on('transcript.partial', function (env) {
    if (!ghost) { ghost = addMsg('visitor', env.payload.text, 'ghost'); }
    else { ghost.querySelector('.ol-talk').textContent = env.payload.text; }
  });
  bus.on('transcript.final', function (env) {
    if (ghost && !env.payload.typed) { ghost.remove(); }
    ghost = null;
    if (!env.payload.internal) { addMsg('visitor', env.payload.text); }
  });
  bus.on('transcript.outloud', function (env) {
    var last = log.querySelector('.ol-msg.ol-outloud:last-child');
    if (last && last.getAttribute('data-resp') === env.payload.responseId) {
      last.querySelector('.ol-talk').textContent += ' ' + env.payload.text;
    } else {
      var li = addMsg('outloud', env.payload.text);
      li.setAttribute('data-resp', env.payload.responseId);
    }
    log.scrollTop = log.scrollHeight;
  });
  bus.on('speech.start', function (env) {
    if (env.payload.fallback) {
      addMsg('outloud', '[browser-voice fallback] OutLoud speaks with the ElevenLabs voice in production; this reply uses your browser voice.');
    }
  });

  /* ---------- chrome wiring ---------- */
  var STATE_LABELS = { IDLE: 'Ready when you are', LISTENING: 'Listening…', PROCESSING: 'Thinking…', RESPONDING: 'Speaking…', CANCELLED: 'Stopped' };
  bus.on('state.change', function (env) {
    if (stateChip) {
      stateChip.textContent = STATE_LABELS[env.payload.state] || env.payload.state;
      stateChip.setAttribute('data-state', env.payload.state);
    }
  });
  /* Suggested-question chips: one tap sends the question. */
  Array.prototype.forEach.call(document.querySelectorAll('.ol-chip'), function (chip) {
    chip.addEventListener('click', function () { input.type(chip.textContent.trim()); });
  });
  /* Client pages swap in their own suggested questions. */
  if (O.CONFIG.client.chips) {
    var chipEls = document.querySelectorAll('.ol-chip');
    Array.prototype.forEach.call(chipEls, function (c, i) {
      if (O.CONFIG.client.chips[i]) { c.textContent = O.CONFIG.client.chips[i]; } else { c.remove(); }
    });
  }
  /* Ambient screen deck starts on page load so the screen sits live
     beside the avatar above the fold — it never sits empty. */
  screen.start();
  /* Persistent Book a Demo CTA — every path into lead capture. */
  var bookCta = document.getElementById('ol-book-cta');
  if (bookCta) {
    bookCta.addEventListener('click', function () { input.type('book a demo'); });
  }

  /* ---------- Simli video avatar ----------
     Browsers block autoplay audio/video — the gate requires a real
     gesture. On tap: Simli session starts, gate goes away, and the
     greeting runs through the video face. If Simli cannot start,
     the sprite stage stays and the greeting speaks through it. */
  var gateEl = null;
  function removeGate() {
    if (gateEl && gateEl.parentNode) { gateEl.parentNode.removeChild(gateEl); }
    gateEl = null;
  }
  function showGate() {
    /* No tap gate — the avatar is visible the moment the page loads.
       The sprite shows first; the live video avatar starts on the
       visitor's first real interaction (typed question, mic, or a
       click on the avatar itself) — still a valid user gesture, so
       autoplay rules are satisfied. See trySimliStart below. */
  }
  bus.on('simli.failed', function (env) {
    console.info('[outloud] simli failed:', env.payload.message);
  });
  bus.on('anam.failed', function (env) {
    console.info('[outloud] anam failed:', env.payload.message);
    /* Anam was the selected video path but failed — fall back to Simli. */
    if (liveDir === anam) {
      liveDir = null;
      var d = pickLiveDir();
      if (d && d !== anam && d.start) { d.start(); }
    }
  });
  /* Barge-in / sound-off clears the active live-video feed instantly. */
  bus.on('speech.cancelled', function () { simli.cancelFeed(); if (anam) { anam.cancelFeed(); } });
  bus.on('error', function (env) { addMsg('outloud', env.payload.message); });
  bus.on('plan.validated', function (env) {
    if (env.payload.repairs && env.payload.repairs.length) {
      /* Repairs are runtime notes, not user-facing copy — show one quiet line. */
      console.info('[outloud] plan repairs:', env.payload.repairs);
    }
  });

  function setMicUI(on) {
    if (micBtn) {
      micBtn.classList.toggle('on', on);
      micBtn.setAttribute('aria-pressed', String(on));
      micBtn.querySelector('.ol-btn-label').textContent = on ? 'Listening' : 'Talk';
    }
    if (textIn) { textIn.placeholder = on ? 'Listening… just talk, or type' : 'Ask OutLoud anything, or press Talk'; }
  }
  if (micBtn) {
    micBtn.addEventListener('click', function () {
      if (!input.supported()) {
        addMsg('outloud', 'Voice input needs Chrome, Edge, or Safari 14.5+. Typing works everywhere.');
        return;
      }
      var on = !micBtn.classList.contains('on');
      setMicUI(on);
      orch.setMic(on);
    });
  }

  var soundOn = true;
  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      soundOn = !soundOn;
      soundBtn.setAttribute('aria-pressed', String(soundOn));
      soundBtn.querySelector('.ol-btn-label').textContent = 'Sound: ' + (soundOn ? 'on' : 'off');
      orch.setMuted(!soundOn);
    });
  }

  function sendTyped() {
    var t = textIn.value.trim();
    if (!t) { return; }
    textIn.value = '';
    input.type(t);
  }
  if (sendBtn) { sendBtn.addEventListener('click', sendTyped); }
  if (textIn) { textIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { sendTyped(); } }); }

  /* ---------- avatar picker removed from the public page ----------
     Visitors never choose a face here; the avatar is whatever the
     client picked in their OutLoud profile after signing in.
     (?avatar=<id> still works for internal previews via config.) */


  /* ---------- boot sequence (spec: session lifecycle) ---------- */
  /* ORDER MATTERS: avatar.attach rebuilds the stage via innerHTML, so
     Simli's video/audio elements must be injected AFTER the sprite
     DOM exists — video rides inside #mascot-gaze. (Fixed 2026-09-21:
     simli.attach ran first and avatar.attach wiped its elements.) */
  avatar.attach(F('ol-avatar-stage'));
  simli.attach(F('ol-avatar-stage'));
  /* Anam mounts only when this page selects it — no empty video shell otherwise. */
  if (anam) {
    var AP = (O.CONFIG.avatar && O.CONFIG.avatar.providers && O.CONFIG.avatar.providers.anam) || null;
    if (AP && AP.selected) { anam.attach(F('ol-avatar-stage')); }
  }
  content.mount();
  /* Presentation screen: standby sign shows when no panel is live. */
  var screenEl = document.getElementById('ol-screen');
  if (screenEl && typeof MutationObserver === 'function') {
    var panelHost = document.getElementById('outloud-content-panel');
    if (panelHost) {
      new MutationObserver(function () {
        screenEl.classList.toggle('panel-live', panelHost.childElementCount > 0);
      }).observe(panelHost, { childList: true });
    }
  }
  orch.sessionStart();
  /* Greeting runs through the full pipeline as a validated plan turn
     (internal=true keeps the trigger off the transcript). The reply
     lands on the transcript via the speech chunk walk, so voice and
     text can never disagree or double up.
     With the Simli video path, the greeting waits for the tap gate:
     a gesture is required before any audio may play. */
  showGate();
  /* No gate, no click: the live video avatar starts on page load,
     muted so browser autoplay rules let the face show with no
     gesture. The visitor's first interaction inside the demo (click,
     key, touch) unmutes the voice — and greets only if the
     conversation hasn't started. The sprite stays underneath as the
     fallback if the video cannot connect. */
  var bootDir = pickLiveDir();
  if (bootDir && bootDir.start) { bootDir.start(); }
  var audioUnlocked = false;
  function unlockAudio(e) {
    if (audioUnlocked) { return; }
    var t = e.target;
    if (!t || !t.closest || !t.closest('.experience')) { return; }
    audioUnlocked = true;
    document.removeEventListener('pointerdown', unlockAudio, true);
    document.removeEventListener('keydown', unlockAudio, true);
    document.removeEventListener('touchstart', unlockAudio, true);
    if (liveDir && liveDir.unmute) { liveDir.unmute(); }
    /* Retry if the boot attempt failed — a real gesture is on file now. */
    var retryDir = pickLiveDir();
    if (retryDir && retryDir.start) { retryDir.start(); }
    var log = document.getElementById('ol-log');
    if (!log || !log.childElementCount) {
      bus.publish('transcript.final', { text: 'hello', internal: true });
    }
  }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);
  document.addEventListener('touchstart', unlockAudio, true);

  window.OutLoudRuntime = { bus: bus, orch: orch, memory: memory, planner: planner, content: content, avatar: avatar, speech: speech, input: input, controller: session };
})();
