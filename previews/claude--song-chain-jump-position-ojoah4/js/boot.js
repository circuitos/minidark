/* ============================================================================
   ███ UI / BOOT ███  boot.js — earliest script: creates the MDS namespace and
   loads the MP3 encoder (lamejs) from cdnjs. Lives in a file (not inline) so
   the page's CSP can stay 'self' + cdnjs with no 'unsafe-inline'.

   lamejs is the app's ONLY external dependency, and an optional one: export
   degrades gracefully to WAV-only with a visible notice if this fails to
   load (see js/ui/exportui.js). Path verified against the lamejs 1.2.0 npm
   package (the same file cdnjs mirrors).
   ========================================================================== */
window.MDS = window.MDS || {};
MDS.LAME_STATE = "loading";

(function () {
  "use strict";
  var s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.0/lame.min.js";
  // SRI pins the exact lamejs 1.2.0 build (sha512 of the npm artifact cdnjs
  // mirrors): a tampered or swapped CDN response now fails closed into the
  // same WAV-only fallback as a network error, instead of executing.
  s.integrity = "sha512-oL3Sqp+n3hHwik4T/KloWyCk4AZ74phPamKnN618oy4MyRNq5zAycIVtZTUTrKizSYdxkhpN3XQxh7ms9nMYmA==";
  s.crossOrigin = "anonymous";
  s.async = true;
  s.onload = function () { MDS.LAME_STATE = "ok"; };
  s.onerror = function () { MDS.LAME_STATE = "failed"; };
  document.head.appendChild(s);
})();
