(function () {
  'use strict';
  var rt = window.OutLoudRuntime;
  if (!rt) return;
  var bus = rt.bus, screen = document.getElementById('ol-screen');
  var host = document.getElementById('outloud-content-panel');
  var feedback = document.getElementById('ol-response-space');
  var stop = document.getElementById('ol-stop');
  var mic = document.getElementById('ol-mic');
  var pendingTimer = 0;

  function syncPanelState() {
    if (!screen || !host) return;
    var visible = Array.prototype.some.call(host.children, function (child) {
      return !child.classList.contains('ol-hidden') && !child.hidden;
    });
    screen.classList.toggle('panel-live', visible);
  }
  if (host && typeof MutationObserver === 'function') {
    new MutationObserver(syncPanelState).observe(host, {
      childList:true, subtree:true, attributes:true,
      attributeFilter:['class','hidden']
    });
    syncPanelState();
  }

  bus.on('transcript.partial', function (event) {
    feedback.textContent = 'Hearing: ' + event.payload.text;
  });
  bus.on('transcript.final', function () {
    feedback.textContent = 'Getting your answer…';
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(function () {
      if (rt.orch.state === 'PROCESSING' || rt.orch.state === 'RESPONDING') {
        feedback.textContent = 'Still working on your answer…';
      }
    }, 3500);
  });
  bus.on('speech.chunk.start', function () {
    clearTimeout(pendingTimer);
    feedback.textContent = '';
  });
  bus.on('state.change', function (event) {
    var state = event.payload.state;
    stop.hidden = state !== 'RESPONDING' && state !== 'PROCESSING';
    if (state === 'IDLE' || state === 'LISTENING' || state === 'CANCELLED') {
      clearTimeout(pendingTimer);
      if (state !== 'LISTENING') feedback.textContent = '';
    }
  });
  bus.on('error', function () {
    clearTimeout(pendingTimer);
    feedback.textContent = '';
  });

  stop.addEventListener('click', function () {
    rt.orch.cancel(true);
    feedback.textContent = '';
  });

  /* Start video on the Talk gesture, in parallel with browser mic setup.
     Keep sprite/voice fallback if WebRTC or the avatar service fails. */
  mic.addEventListener('click', function () {
    mic.setAttribute('aria-label', mic.classList.contains('on')
      ? 'Turn microphone off' : 'Turn microphone on');
    if (!mic.classList.contains('on')) return;
    var sink = rt.speech && rt.speech.sink;
    if (sink && typeof sink.start === 'function') {
      var gate = document.querySelector('.ol-tap-gate');
      if (gate) gate.remove();
      sink.start().catch(function () { /* sprite fallback stays available */ });
    }
  });
})();
