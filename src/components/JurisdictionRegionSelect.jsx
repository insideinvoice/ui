import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { INDIAN_JURISDICTION_STATES, INDIAN_JURISDICTION_UTS } from "../constants/indianRegions";

/**
 * Searchable picker for the invoice-jurisdiction region (India's states and
 * union territories), grouped into "States" and "Union Territories" like the
 * feature spec requires. Keyboard: ArrowUp/ArrowDown to move, Enter to pick,
 * Escape to close, click-outside to close.
 */
export default function JurisdictionRegionSelect({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    // Focus the search box on open so typing filters immediately.
    searchRef.current?.focus();
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // 36 items total — plain computation is cheaper than memo bookkeeping.
  const q = query.trim().toLowerCase();
  const stateMatches = q
    ? INDIAN_JURISDICTION_STATES.filter((r) => r.toLowerCase().includes(q))
    : INDIAN_JURISDICTION_STATES;
  const utMatches = q
    ? INDIAN_JURISDICTION_UTS.filter((r) => r.toLowerCase().includes(q))
    : INDIAN_JURISDICTION_UTS;
  const flat = [...stateMatches, ...utMatches];
  const hasMatches = flat.length > 0;

  const openPanel = () => {
    if (disabled) return;
    setQuery("");
    setHighlight(-1);
    setOpen(true);
  };

  const pick = (region) => {
    onChange(region);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openPanel();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hasMatches) setHighlight((prev) => (prev + 1) % flat.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hasMatches) setHighlight((prev) => (prev <= 0 ? flat.length - 1 : prev - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (hasMatches) pick(flat[highlight >= 0 ? highlight : 0]);
    }
  };

  const renderGroup = (title, list, offset) => (
    <>
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
        {title}
      </div>
      {list.map((region, i) => {
        const flatIndex = offset + i;
        const selected = region === value;
        return (
          <button
            key={region}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseEnter={() => setHighlight(flatIndex)}
            onClick={() => pick(region)}
            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors ${
              flatIndex === highlight ? "bg-slate-100" : "hover:bg-slate-50"
            } ${selected ? "text-indigo-700 font-semibold" : "text-slate-700"}`}
          >
            <span className="truncate">{region}</span>
            {selected && <Check className="w-4 h-4 shrink-0 text-indigo-600" />}
          </button>
        );
      })}
    </>
  );

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-white text-left flex items-center justify-between gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400 ${
          value ? "border-slate-300 text-slate-800" : "border-slate-300 text-slate-400"
        }`}
      >
        <span className="truncate">{value || "Select a state or union territory"}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selected region"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(-1);
              }}
              placeholder="Search states & union territories"
              className="w-full text-sm focus:outline-none"
            />
          </div>
          <div role="listbox" aria-label="Jurisdiction region" className="max-h-64 overflow-auto">
            {hasMatches ? (
              <>
                {stateMatches.length > 0 && renderGroup("States", stateMatches, 0)}
                {utMatches.length > 0 && renderGroup("Union Territories", utMatches, stateMatches.length)}
              </>
            ) : (
              <div className="px-3 py-6 text-center text-xs text-slate-400">No matching region</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
