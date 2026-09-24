/* Keep the presentation screen in panel mode only while a panel is visible.
   The original runtime counts hidden, lazily constructed panels as live. */
(function () {
  'use strict';
  var screen = document.getElementById('ol-screen');
  var host = document.getElementById('outloud-content-panel');
  if (!screen || !host || typeof MutationObserver !== 'function') return;

  function syncPanelState() {
    var visible = Array.prototype.some.call(host.children, function (child) {
      return !child.classList.contains('ol-hidden') && !child.hidden;
    });
    screen.classList.toggle('panel-live', visible);
  }
  new MutationObserver(syncPanelState).observe(host, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'hidden']
  });
  syncPanelState();
})();
