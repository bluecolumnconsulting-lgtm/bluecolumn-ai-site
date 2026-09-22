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
  var screen = new O.ScreenDirector(bus);   // ambient card rotation on the branded screen
  var avatar = new O.AvatarDirector(bus, O.CONFIG.avatar);
  var content = new O.ContentDirector(bus);
  var planner = new O.ResponsePlanner(bus, memory);
  var orch = new O.Orchestrator(bus, { input: input, speech: speech, avatar: avatar, content: content, memory: memory, planner: planner });
  speech.sink = simli;   // when Simli is live, speech blobs stream into the video session

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
  /* Ambient screen deck starts once the gate interaction lands the
     visitor (tap/typed) — the screen then never sits empty. */
  bus.on('transcript.final', function onceScreenStart() {
    screen.start();
    bus.off('transcript.final', onceScreenStart);
  });
  var gateEl0 = document.querySelector('.ol-tap-gate');
  if (gateEl0) {
    gateEl0.addEventListener('click', function () { setTimeout(function () { screen.start(); }, 1200); }, { once: true });
  }
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
    var stage = F('ol-avatar-stage');
    if (!stage || stage.querySelector('.ol-tap-gate')) { return; }
    gateEl = document.createElement('button');
    gateEl.type = 'button';
    gateEl.className = 'ol-tap-gate';
    gateEl.innerHTML = '<span class="ol-gate-word">Tap to meet OutLoud</span><span class="ol-gate-sub mono">live video agent · voice + answers</span>';
    gateEl.addEventListener('click', function () {
      removeGate();
      simli.start().then(function (ok) {
        if (ok) {
          addMsg('outloud', 'Video avatar is live — watch me talk.');
        } else {
          addMsg('outloud', 'Video could not connect (' + (simli.lastError || 'unknown') + '). Voice mode still works. If this is an in-app browser (Telegram etc.), copy this link and open it in Safari or Chrome.');
        }
        /* Greeting goes through whichever channel is now active. */
        bus.publish('transcript.final', { text: 'hello', internal: true });
      });
    });
    stage.appendChild(gateEl);
  }
  bus.on('simli.failed', function (env) {
    console.info('[outloud] simli failed:', env.payload.message);
  });
  /* Barge-in / sound-off clears the active Simli feed instantly. */
  bus.on('speech.cancelled', function () { simli.cancelFeed(); });
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

  /* ---------- boot sequence (spec: session lifecycle) ---------- */
  /* ORDER MATTERS: avatar.attach rebuilds the stage via innerHTML, so
     Simli's video/audio elements must be injected AFTER the sprite
     DOM exists — video rides inside #mascot-gaze. (Fixed 2026-09-21:
     simli.attach ran first and avatar.attach wiped its elements.) */
  avatar.attach(F('ol-avatar-stage'));
  simli.attach(F('ol-avatar-stage'));
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
  /* Typed input (or mic) before tapping the gate still works — and
     a real click IS a valid user gesture, so the Simli video starts
     here too. The sprite only ever shows if video cannot start. */
  bus.on('transcript.final', function onceStart(env) {
    if (!env.payload.internal) {
      removeGate();
      simli.start();
      bus.off('transcript.final', onceStart);
    }
  });

  window.OutLoudRuntime = { bus: bus, orch: orch, memory: memory, planner: planner, content: content, avatar: avatar, speech: speech, input: input };
})();
