import { Download, Printer } from "lucide-react";

export default function PdfPreview({ pdfUrl, error, onDownload, onPrint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5 bg-slate-50">
        <span className="w-2 h-2 rounded-full bg-rose-400" />
        <span className="ml-auto flex items-center gap-1.5">
          {onDownload && (
            <button type="button" onClick={onDownload} title="Download PDF"
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-all">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {onPrint && (
            <button type="button" onClick={onPrint} title="Print PDF"
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-all">
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      </div>
      {error ? (
        <p className="p-4 text-xs text-amber-600 bg-amber-50">Cannot render the label with the current values.</p>
      ) : pdfUrl ? (
        <iframe
          title="label-preview"
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
          className="w-full bg-[#e5e7eb]"
          style={{ height: "70vh" }}
        />
      ) : (
        <div className="p-10 text-center text-xs text-slate-400">
          Fill the form to see the rendered label.
        </div>
      )}
    </div>
  );
}
