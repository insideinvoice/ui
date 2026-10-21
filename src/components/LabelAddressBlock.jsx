import { MapPin } from "lucide-react";
import { INDIAN_STATES } from "../utils/indianStates";

// Same medium-scale form tokens as AddProduct: 40px controls, one border per
// element, violet focus language.
const inputClass =
  "w-full h-10 px-3.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200";
const selectClass = inputClass + " pr-8 cursor-pointer";

export default function LabelAddressBlock({ title, value, onChange }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Card header — inline icon, same rhythm as AddProduct */}
      <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5">
        <MapPin className="w-4 h-4 text-violet-600 shrink-0" />
        <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">{title}</h2>
      </div>
      <div className="px-5 sm:px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input aria-label={`${title} name`} placeholder="Name" value={value.name || ""} onChange={(e) => onChange({ ...value, name: e.target.value })}
          className={"sm:col-span-2 " + inputClass} />
        <textarea aria-label={`${title} address`} placeholder="Address lines (one per line)" rows={3} value={(value.addressLines || []).join("\n")}
          onChange={(e) => onChange({ ...value, addressLines: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          className="sm:col-span-2 w-full min-h-[76px] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400/80 bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition-all duration-200 resize-none" />
        <input aria-label={`${title} company`} placeholder="Company" value={value.company || ""} onChange={(e) => onChange({ ...value, company: e.target.value })}
          className={"sm:col-span-2 " + inputClass} />
        <input aria-label={`${title} city`} placeholder="City" value={value.city || ""} onChange={(e) => onChange({ ...value, city: e.target.value })}
          className={inputClass} />
        <select aria-label={`${title} state`} value={value.state || ""} onChange={(e) => onChange({ ...value, state: e.target.value })}
          className={selectClass}>
          <option value="">State</option>
          {value.state && !INDIAN_STATES.includes(value.state) && <option value={value.state}>{value.state}</option>}
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input aria-label={`${title} pincode`} placeholder="Pincode e.g. 560001" value={value.pincode || ""} onChange={(e) => onChange({ ...value, pincode: e.target.value })}
          className={inputClass} />
        <input aria-label={`${title} country`} placeholder="Country (India)" value={value.country || ""} onChange={(e) => onChange({ ...value, country: e.target.value })}
          className={inputClass} />
        <input aria-label={`${title} phone`} type="tel" inputMode="numeric" placeholder="+91 phone" value={value.phone || ""} onChange={(e) => onChange({ ...value, phone: e.target.value })}
          className={"sm:col-span-2 " + inputClass} />
      </div>
    </div>
  );
}
