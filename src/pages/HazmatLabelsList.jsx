import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import PageHeader from "../components/PageHeader";
import { labelAPI } from "../api/auth";
import toast from "react-hot-toast";
import { Search, Flame, Plus, Download, Printer, Pencil } from "lucide-react";
import { downloadLabelPdf, printLabelPdf } from "../utils/labelPdf";
import { useAuth } from "../context/AuthContext";

// Segmented status filter. The filter runs client-side over the loaded page,
// so switching a tab is instant (no refetch) and the counts on each tab are
// real. Search still goes to the server, debounced, exactly as before.
const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "GENERATED", label: "Generated" },
  { value: "PRINTED", label: "Printed" },
  { value: "VOID", label: "Void" },
];

const STATUS_PILL = {
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-500/15",
  GENERATED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  PRINTED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  VOID: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const StatusPill = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ring-1 ring-inset ${STATUS_PILL[status] || STATUS_PILL.DRAFT}`}
  >
    <span className="h-1 w-1 rounded-full bg-current" />
    {status}
  </span>
);

// 32px ghost icon buttons — the table's action cluster stays quiet until
// hovered instead of two chunky text buttons on every row.
const iconBtn =
  "h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:ring-1 hover:ring-slate-200 transition-all";

// CLASS_DIAMOND → "Class diamond" for the Type column.
const humanize = (v) =>
  String(v || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function HazmatLabelsList() {
  const navigate = useNavigate();
  const { documentAccess } = useAuth();
  const canCreate = documentAccess?.hazmatLabel !== false;
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async (query) => {
    try {
      setLoading(true);
      const res = await labelAPI.hazmat.list({ size: 100, sortBy: "createdAt", sortDir: "desc", q: query });
      setLabels(res.data.data?.content || []);
    } catch {
      toast.error("Failed to load labels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const counts = useMemo(() => {
    const c = { "": labels.length };
    labels.forEach((l) => {
      c[l.status] = (c[l.status] || 0) + 1;
    });
    return c;
  }, [labels]);

  const shown = useMemo(
    () => (status ? labels.filter((l) => l.status === status) : labels),
    [labels, status]
  );

  const clearFilters = () => {
    setStatus("");
    setQ("");
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader
          title="Hazmat Labels"
          subtitle="UN-compliant dangerous goods labels, ready to print"
          className="mb-4"
        />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Toolbar: identity + count on the left, search and the primary
              action on the right. Everything 32px tall so the bar reads as
              one calm line instead of a stack of large controls. */}
          <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 border-b border-slate-200">
            <span className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-600/15 grid place-items-center shrink-0">
              <Flame className="w-4 h-4" />
            </span>
            <h2 className="text-[13px] font-semibold text-slate-900">All labels</h2>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold tabular-nums ring-1 ring-inset ring-slate-500/10">
              {labels.length}
            </span>

            <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search labels"
                  aria-label="Search hazmat labels"
                  className="w-full sm:w-48 md:w-56 h-8 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all"
                />
              </div>
              {canCreate && (
                <button
                  onClick={() => navigate("/labels/hazmat/new")}
                  className="h-8 shrink-0 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> New Label
                </button>
              )}
            </div>
          </div>

          {/* Status segmented control — instant, client-side, with counts */}
          <div className="px-4 sm:px-5 py-2 flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const active = status === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                  className={`h-7 shrink-0 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
                    active
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/70"
                  }`}
                >
                  {tab.label}
                  <span className={`tabular-nums text-[10px] ${active ? "text-indigo-600" : "text-slate-400"}`}>
                    {counts[tab.value] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingDots className="text-slate-400" />
            </div>
          ) : shown.length === 0 ? (
            labels.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center">
                  <Flame className="w-5 h-5 text-slate-400" />
                </div>
                <p className="mt-3 text-[13px] font-semibold text-slate-700">No hazmat labels yet</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Labels you create appear here, ready to print or download.
                </p>
                {canCreate && (
                  <button
                    onClick={() => navigate("/labels/hazmat/new")}
                    className="mt-4 h-8 inline-flex items-center justify-center gap-1.5 px-3.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Label
                  </button>
                )}
              </div>
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] font-semibold text-slate-600">No labels in “{status}”</p>
                <p className="mt-1 text-[11px] text-slate-400">Try another status or clear the search.</p>
                <button
                  onClick={clearFilters}
                  className="mt-3 h-8 px-3.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Label #</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">UN No.</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Proper Shipping Name</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Class / PG</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Type</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Created</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => canCreate && navigate(`/labels/hazmat/${l.id}/edit`)}
                      className={`transition-colors hover:bg-slate-50/80 ${canCreate ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-800 whitespace-nowrap">
                        {l.labelNumber}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {l.unNumber || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-[240px] truncate">
                        {l.properShippingName || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {l.classOrDivision || l.hazardClass || "—"}
                        {l.packingGroup && (
                          <span className="text-slate-400"> / {l.packingGroup}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                        {humanize(l.labelType) || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill status={l.status} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">
                        {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canCreate && (
                            <button
                              type="button"
                              title="Edit label"
                              aria-label="Edit label"
                              onClick={() => navigate(`/labels/hazmat/${l.id}/edit`)}
                              className={iconBtn}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Download PDF"
                            aria-label="Download PDF"
                            onClick={() => downloadLabelPdf(() => labelAPI.hazmat.pdf(l.id), `${l.labelNumber}.pdf`)}
                            className={iconBtn}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Print"
                            aria-label="Print label"
                            onClick={() => printLabelPdf(() => labelAPI.hazmat.pdf(l.id))}
                            className={iconBtn}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
