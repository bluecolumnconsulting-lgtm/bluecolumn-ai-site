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
  var avatar = new O.AvatarDirector(bus, O.CONFIG.avatar);
  var content = new O.ContentDirector(bus);
  var planner = new O.ResponsePlanner(bus, memory);
  var orch = new O.Orchestrator(bus, { input: input, speech: speech, avatar: avatar, content: content, memory: memory, planner: planner });

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
  bus.on('state.change', function (env) {
    if (stateChip) { stateChip.textContent = env.payload.state; stateChip.setAttribute('data-state', env.payload.state); }
  });
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
  avatar.attach(F('ol-avatar-stage'));
  content.mount();
  orch.sessionStart();
  addMsg('outloud', "Hey, I'm OutLoud — this page is me. Ask me anything: what OutLoud does, what it costs, how it works — or say book a demo and I'll take your details.");
  /* Greeting runs through the full pipeline as a validated plan turn
     (internal=true keeps it off the transcript; the line above is the copy). */
  setTimeout(function () {
    bus.publish('transcript.final', { text: 'hello', internal: true });
  }, 600);

  window.OutLoudRuntime = { bus: bus, orch: orch, memory: memory, planner: planner, content: content, avatar: avatar, speech: speech, input: input };
})();
