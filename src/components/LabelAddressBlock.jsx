import { INDIAN_STATES } from "../utils/indianStates";

export default function LabelAddressBlock({ title, value, onChange }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input placeholder="Name" value={value.name || ""} onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="col-span-1 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
        <input placeholder="Company" value={value.company || ""} onChange={(e) => onChange({ ...value, company: e.target.value })}
          className="col-span-1 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
        <textarea placeholder="Address lines (one per line)" rows={3} value={(value.addressLines || []).join("\n")}
          onChange={(e) => onChange({ ...value, addressLines: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          className="col-span-1 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
        <input placeholder="City" value={value.city || ""} onChange={(e) => onChange({ ...value, city: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
        <select value={value.state || ""} onChange={(e) => onChange({ ...value, state: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white">
          <option value="">Select state…</option>
          {value.state && !INDIAN_STATES.includes(value.state) && <option value={value.state}>{value.state}</option>}
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="Pincode e.g. 560001" value={value.pincode || ""} onChange={(e) => onChange({ ...value, pincode: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
        <input placeholder="Country (India)" value={value.country || ""} onChange={(e) => onChange({ ...value, country: e.target.value })}
          className="border border-slate-300 rounded-lg px-3 py-2 text-xs" />
        <input placeholder="+91 phone" value={value.phone || ""} onChange={(e) => onChange({ ...value, phone: e.target.value })}
          className="col-span-1 sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-xs" />
      </div>
    </div>
  );
}
