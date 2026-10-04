import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({ open, title, message, confirmLabel, confirmVariant, onConfirm, onCancel }) {
  if (!open) return null;

  const isDanger = confirmVariant === "danger";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
            isDanger ? "bg-red-50 border border-red-100" : "bg-indigo-50 border border-indigo-100"
          }`}>
            <AlertTriangle className={`w-6 h-6 ${isDanger ? "text-red-500" : "text-indigo-500"}`} />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h3>

          {/* Message */}
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 mx-6" />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 min-h-[44px] text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 rounded-lg transition-all duration-150 shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 min-h-[44px] text-sm font-semibold rounded-lg transition-all duration-150 shadow-sm active:scale-[0.98] ${
              isDanger
                ? "bg-red-600 text-white hover:bg-red-700 shadow-red-600/25 hover:shadow-red-600/40"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/25 hover:shadow-indigo-600/40"
            }`}
          >
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
