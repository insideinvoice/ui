import { useState, useCallback } from "react";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { getPrintSettings, savePrintSettings, PAPER_SIZE_LIST, ALL_TEMPLATES, DEFAULT_PRINT_SETTINGS, getGlobalTemplate } from "../constants/paperSizes";
import toast from "react-hot-toast";
import { businessAPI } from "../api/auth";
import { ArrowLeft, Printer, FileText, FileSpreadsheet, ShoppingCart, Download, Save } from "lucide-react";

const DOC_TYPES = [
  { key: "TAX_INVOICE", label: "Tax Invoice", icon: FileText },
  { key: "PROFORMA_INVOICE", label: "Proforma Invoice", icon: FileText },
  { key: "QUOTATION", label: "Quotation", icon: FileSpreadsheet },
  { key: "PURCHASE_ORDER", label: "Purchase Order", icon: ShoppingCart },
];

export default function PrintSettings({ noWrapper }) {
  const [settings, setSettings] = useState(() => getPrintSettings());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePaperSizeChange = (docType, sizeId) => {
    setSettings((prev) => ({
      ...prev,
      [docType]: { ...prev[docType], paperSize: sizeId },
    }));
    setDirty(true);
  };

  const handleTemplateChange = (docType, templateId) => {
    setSettings((prev) => ({
      ...prev,
      [docType]: { ...prev[docType], template: templateId },
    }));
    setDirty(true);
  };

  const handleSave = useCallback(() => {
    setSaving(true);
    try {
      savePrintSettings(settings);
      businessAPI.updateInvoiceSettings({
        invoiceTemplate: getGlobalTemplate(),
        printSettings: JSON.stringify(settings),
      }).catch(() => {});
      setDirty(false);
      toast.success("Print settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const resetDefaults = () => {
    setSettings(structuredClone(DEFAULT_PRINT_SETTINGS));
    setDirty(true);
  };

  const thermalSizes = PAPER_SIZE_LIST.filter((s) => s.thermal);
  const standardSizes = PAPER_SIZE_LIST.filter((s) => !s.thermal);

  const docSettings = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Document Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">Paper size and template per document type</p>
        </div>
        <button onClick={resetDefaults}
          className="text-xs text-slate-500 hover:text-slate-700 underline whitespace-nowrap">
          Reset defaults
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {DOC_TYPES.map((doc) => {
          const config = settings[doc.key] || DEFAULT_PRINT_SETTINGS[doc.key];
          return (
            <div key={doc.key} className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <doc.icon className="w-3.5 h-3.5 text-slate-600" />
                </div>
                <div className="text-xs font-semibold text-slate-800">{doc.label}</div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Paper Size</label>
                  <select
                    value={config.paperSize}
                    onChange={(e) => handlePaperSizeChange(doc.key, e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white"
                  >
                    <optgroup label="Standard">
                      {standardSizes.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Thermal / POS">
                      {thermalSizes.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {!config.paperSize?.startsWith("THERMAL") && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Template Theme</label>
                    <select
                      value={config.template || getGlobalTemplate()}
                      onChange={(e) => handleTemplateChange(doc.key, e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white"
                    >
                      {ALL_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 justify-between p-3 bg-slate-50 rounded-lg">
        <div className="flex items-start gap-2 text-[11px] text-slate-500">
          <Download className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-slate-700">How it works</p>
            <p className="mt-0.5">Standard sizes (A4, A5, Letter) generate a PDF — choose a template theme for the layout. Thermal sizes (58mm, 80mm) open the browser print dialog.</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={!dirty || saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap self-stretch sm:self-auto justify-center ${
            dirty
              ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}>
          <Save className="w-3.5 h-3.5" />
          Save Setting
        </button>
      </div>
    </>
  );

  if (noWrapper) return docSettings;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <PageHeader title="Print Settings" />
      <div className="max-w-[1900px] mx-auto m-[5px] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">{docSettings}</div>
      </div>
    </div>
  );
}