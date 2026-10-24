import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PageHeader({ title, icon: Icon, subtitle, backTo = "/dashboard", showBack = true, children, className = "mb-6" }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof backTo === "number") {
      navigate(backTo);
    } else if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate(backTo);
    }
  };
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showBack && (
        <button onClick={goBack}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      {Icon && (
        <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-800 text-white shadow-sm flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-base sm:text-lg font-bold text-slate-800 truncate">
          {title}
        </h1>
        {subtitle && <p className="text-[11px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
