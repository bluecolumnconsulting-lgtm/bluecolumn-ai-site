/* The runtime expects a ScreenDirector, but this version intentionally
   has no rotating cards. Plan-driven content still uses ContentDirector. */
(function () {
  'use strict';
  window.OUTLOUD = window.OUTLOUD || {};
  function MinimalScreenDirector() {}
  MinimalScreenDirector.prototype.start = function () {};
  window.OUTLOUD.ScreenDirector = MinimalScreenDirector;
})();
