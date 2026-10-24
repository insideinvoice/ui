import React from "react";
import { ScrollText } from "lucide-react";
import { parseTermsList } from "../utils/termsConditions";

/**
 * Terms & Conditions card for the app pages (invoice create form, invoice
 * view): the business's saved defaults (Settings owns the data —
 * businesses.terms_conditions, V40), rendered as a numbered list. Always
 * visible with a "No terms added yet." empty state so the card is a stable
 * anchor above Notes on both pages; the printed documents render
 * InvoiceTermsRow instead, which collapses away entirely when empty.
 */
const TermsCard = ({ business, className = "" }) => {
  const terms = parseTermsList(business?.termsConditions);
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <ScrollText className="w-4 h-4 text-slate-600" />
        <h2 className="text-sm font-bold text-slate-800">Terms &amp; Conditions</h2>
      </div>
      {terms.length > 0 ? (
        <ol className="list-decimal list-inside space-y-1.5">
          {terms.map((t, i) => (
            <li key={i} className="text-sm text-slate-600 leading-snug">{t}</li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-400 italic">No terms added yet.</p>
      )}
    </div>
  );
};

export default TermsCard;
