import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Styled listbox dropdown (replaces the raw native <select> look):
 * a 40px trigger with an animated chevron and a check-marked popup menu.
 * Closes on outside click / Escape / selection. Options may carry an icon.
 */
export default function SelectMenu({
  value,
  onChange,
  options,
  ariaLabel = "Select option",
  minWidth = 140,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={rootRef} className={`relative ${className}`} style={{ minWidth }}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-500 transition-colors"
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected?.icon ? (
            <selected.icon className="w-3.5 h-3.5 text-violet-600 shrink-0" />
          ) : null}
          <span className="truncate">{selected?.label}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full mt-1 z-30 min-w-full bg-white rounded-xl shadow-lg border border-slate-200 py-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 min-h-[40px] text-left text-xs transition-colors ${
                  active
                    ? "text-violet-700 bg-violet-50 font-bold"
                    : "text-slate-700 hover:bg-slate-50 font-semibold"
                }`}
              >
                {opt.icon ? (
                  <opt.icon
                    className={`w-3.5 h-3.5 shrink-0 ${active ? "text-violet-600" : "text-slate-400"}`}
                  />
                ) : null}
                <span className="flex-1 truncate">{opt.label}</span>
                {active && <Check className="w-3.5 h-3.5 shrink-0 text-violet-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
