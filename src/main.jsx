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

/* iOS Safari: when keyboard is shown, add padding-bottom to body so form fields
   are not obscured and the user doesn't see "Dashboard Invoice customers more menu below" */
(function() {
  var_inputs = ['input', 'textarea', 'select'];
  var lastFocused = null;
  var uid = setInterval(function() {
    var active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
      if (lastFocused !== active) {
        lastFocused = active;
        var rect = active.getBoundingClientRect();
        var vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        var keyboardHeight = vh - rect.bottom;
        if (keyboardHeight > 0) {
          document.body.style.paddingBottom = keyboardHeight + 'px';
        } else {
          document.body.style.paddingBottom = '0';
        }
      }
    } else {
      lastFocused = null;
      document.body.style.paddingBottom = '0';
    }
  }, 150);
  window.addEventListener('blur', function() {
    document.body.style.paddingBottom = '0';
    lastFocused = null;
  });
})();
