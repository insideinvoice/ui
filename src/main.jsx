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

/* iOS Safari: when a form field is focused the soft keyboard covers the lower
   viewport. Hide/blur the fixed app navbars so their content is not visible
   behind the focused field. Uses class toggling only (no body padding), so the
   layout never shifts and floating controls (e.g. Add Item) stay put. */
(function () {
  var root = document.documentElement;
  var isField = function (el) {
    return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  };

  var sync = function () {
    if (isField(document.activeElement)) {
      root.classList.add("kb-open");
    } else {
      root.classList.remove("kb-open");
    }
  };

  document.addEventListener("focusin", sync);
  document.addEventListener("focusout", function () {
    setTimeout(sync, 0);
  });
  window.addEventListener("blur", function () {
    root.classList.remove("kb-open");
  });
})();
