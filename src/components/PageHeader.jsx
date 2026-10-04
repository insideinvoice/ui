import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PageHeader({ title, backTo = "/dashboard", children }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 mb-6">
      <button onClick={() => navigate(backTo)}
        className="w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all flex-shrink-0">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h1 className="text-lg font-bold text-slate-800">{title}</h1>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
