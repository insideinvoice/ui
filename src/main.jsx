import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}
if ("caches" in window) {
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name));
  });
}

/* iOS Safari: when a text field is focused the soft keyboard covers the lower
   viewport. Dim the bottom tab bar (the only bar that overlaps the keyboard)
   via the kb-open class — never the top navbar. Class toggling only (no body
   padding), so the layout never shifts and floating controls (e.g. Add Item)
   stay put. */
(function () {
  var root = document.documentElement;
  var vv = window.visualViewport;

  var sync = function () {
    // kb-open is set ONLY when a text-entry field is focused AND the soft
    // keyboard has actually shrunk the visual viewport. Tapping a select or
    // checkbox (e.g. the Delivery Challan toolbar) must never set it — browser
    // chrome animation around those taps can transiently skew the viewport
    // math, and an earlier version of this rule blurred the whole top navbar,
    // which users reported as the navbar "disappearing".
    var el = document.activeElement;
    var tag = el && el.tagName;
    var isTextEntry =
      tag === "TEXTAREA" ||
      (tag === "INPUT" &&
        el.type !== "checkbox" &&
        el.type !== "radio" &&
        el.type !== "button" &&
        el.type !== "submit" &&
        el.type !== "reset" &&
        el.type !== "file" &&
        el.type !== "range" &&
        el.type !== "color");
    var keyboardOpen = false;
    if (vv && window.innerHeight > 0) {
      keyboardOpen = vv.height < window.innerHeight - 150;
    }
    if (isTextEntry && keyboardOpen) {
      root.classList.add("kb-open");
    } else {
      root.classList.remove("kb-open");
    }
  };

  document.addEventListener("focusin", sync);
  document.addEventListener("focusout", function () {
    setTimeout(sync, 0);
  });
  if (vv) {
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
  }
  window.addEventListener("resize", sync);
})();
