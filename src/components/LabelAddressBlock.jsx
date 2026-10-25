import { MapPin } from "lucide-react";
import { INDIAN_STATES } from "../utils/indianStates";
import { COUNTRIES, dialCodeFor, stateLabelFor, postalLabelFor } from "../utils/countries";

// Same medium-scale form tokens as AddProduct: 40px controls, one border per
// element, violet focus language.
const inputClass =
  "w-full h-10 px-3.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200";
const selectClass = inputClass + " pr-8 cursor-pointer";
const labelClass = "block text-xs font-medium text-slate-600 mb-1.5";

/**
 * Ship-from / Ship-to address block for shipping labels — international by
 * default: any ISO country can be selected, the subdivision field adapts
 * (Indian state list for India, free-text region everywhere else), the postal
 * field is labelled for the destination, and the phone hint carries the
 * country's dialling code.
 */
export default function LabelAddressBlock({ title, value, onChange }) {
  const country = value.country || "";
  const india = country === "India";
  const dial = dialCodeFor(country);
  const set = (patch) => onChange({ ...value, ...patch });

  // Country change: drop a subdivision that belongs to the country being
  // replaced (a foreign region cannot sit in India's list, and vice versa).
  const handleCountry = (e) => {
    const next = e.target.value;
    const prev = value.state || "";
    const stale = (next === "India" && prev && !INDIAN_STATES.includes(prev))
      || (next !== "India" && INDIAN_STATES.includes(prev));
    onChange({ ...value, country: next, state: stale ? "" : prev });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Card header — inline icon, same rhythm as AddProduct */}
      <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
        <MapPin className="w-4 h-4 text-violet-600 shrink-0" />
        <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">{title}</h2>
      </div>
      <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${title}-name`}>Name</label>
          <input id={`${title}-name`} placeholder="Recipient or contact name" value={value.name || ""}
            onChange={(e) => set({ name: e.target.value })} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${title}-address`}>Address</label>
          <textarea id={`${title}-address`} placeholder="Street, building, area — one line each" rows={3}
            value={(value.addressLines || []).join("\n")}
            onChange={(e) => set({ addressLines: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            className="w-full min-h-[76px] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200 resize-none" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${title}-company`}>Company (optional)</label>
          <input id={`${title}-company`} placeholder="Company or organisation" value={value.company || ""}
            onChange={(e) => set({ company: e.target.value })} className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor={`${title}-city`}>City</label>
          <input id={`${title}-city`} placeholder="City / locality" value={value.city || ""}
            onChange={(e) => set({ city: e.target.value })} className={inputClass} />
        </div>

        {india ? (
          <div>
            <label className={labelClass} htmlFor={`${title}-state`}>State</label>
            <select id={`${title}-state`} value={value.state || ""} onChange={(e) => set({ state: e.target.value })}
              className={selectClass}>
              <option value="">Select state</option>
              {(value.state && !INDIAN_STATES.includes(value.state)) && (
                <option value={value.state}>{value.state}</option>
              )}
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className={labelClass} htmlFor={`${title}-state`}>{stateLabelFor(country)}</label>
            <input id={`${title}-state`} placeholder={stateLabelFor(country)} value={value.state || ""}
              onChange={(e) => set({ state: e.target.value })} className={inputClass} />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor={`${title}-postal`}>{postalLabelFor(country)}</label>
          <input id={`${title}-postal`}
            placeholder={india ? "e.g. 560001" : "e.g. 78701 / SW1A 1AA"} value={value.pincode || ""}
            onChange={(e) => set({ pincode: e.target.value })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${title}-country`}>Country / territory</label>
          <select id={`${title}-country`} value={country} onChange={handleCountry} className={selectClass}>
            <option value="">Select country</option>
            {country && !COUNTRIES.some(([n]) => n === country) && <option value={country}>{country}</option>}
            {COUNTRIES.map(([n]) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor={`${title}-phone`}>Phone</label>
          <input id={`${title}-phone`} type="tel" inputMode="tel" value={value.phone || ""}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder={dial ? `${dial} 555 0123 456` : "Phone with country code, e.g. +1 555 0123"}
            className={inputClass} />
          <p className="mt-1 text-[11px] text-slate-400">
            {dial ? `Dialling code for ${country}: ${dial} — include it so carriers can call across borders.`
              : "Select a country to see its dialling code. Carriers may call before delivery."}
          </p>
        </div>
      </div>
    </div>
  );
}
