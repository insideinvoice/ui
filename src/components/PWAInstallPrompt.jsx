import { useState, useEffect, useCallback } from "react";
import { Download, X } from "lucide-react";
import insideInvoiceLogo from "../assets/inside-invoice-logo.svg";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    const dismissedUntil = localStorage.getItem("pwa_install_dismissed_until");
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return;

    if (isIOS()) {
      setShowIOSHint(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroidPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowAndroidPrompt(false);
    if (outcome === "accepted") {
      localStorage.setItem("pwa_install_dismissed_until", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowAndroidPrompt(false);
    setShowIOSHint(false);
    setDismissed(true);
    localStorage.setItem("pwa_install_dismissed_until", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }, []);

  if (isStandalone()) return null;

  if (showAndroidPrompt && deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[998] pb-[env(safe-area-inset-bottom,0px)] sm:left-auto sm:right-4 sm:w-80">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 flex items-center gap-3">
            <img src={insideInvoiceLogo} alt="Inside Invoice" className="w-10 h-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">Install Inside Invoice</p>
            <p className="text-xs text-slate-500">Add to home screen for quick access</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleInstall}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={handleDismiss}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showIOSHint) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[998] pb-[env(safe-area-inset-bottom,0px)] sm:left-auto sm:right-4 sm:w-80">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <img src={insideInvoiceLogo} alt="Inside Invoice" className="w-10 h-10 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Add to Home Screen</p>
              <p className="text-xs text-slate-500 mt-0.5">Tap the <strong>Share</strong> icon in Safari, then select <strong>Add to Home Screen</strong> for quick access.</p>
            </div>
            <button onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={handleDismiss}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
