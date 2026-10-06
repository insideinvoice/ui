import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import {
  Plus, List, Users, UserPlus, Package, FileText,
  Settings, LogOut, CreditCard, UserCheck, Shield, ClipboardList
} from "lucide-react";

export default function MorePage() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <AppNavbar />
      <div className="px-3 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Menu</h1>

        {/* Quick Actions */}
        <div className="mb-6">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Quick Actions</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "New Invoice", icon: Plus, path: "/invoice", gradient: "from-blue-500 to-blue-600" },
              { label: "Delivery Challan", icon: ClipboardList, path: "/delivery-challans/new", gradient: "from-teal-500 to-teal-600" },
              { label: "Add Customer", icon: UserPlus, path: "/customers/new", gradient: "from-emerald-500 to-emerald-600" },
              { label: "Add Product", icon: Package, path: "/products/new", gradient: "from-amber-500 to-orange-500" },
              { label: "Templates", icon: FileText, path: "/invoice-templates", gradient: "from-purple-500 to-purple-600" },
            ].map((card) => (
              <div key={card.label} onClick={() => navigate(card.path)}
                className={`bg-gradient-to-br ${card.gradient} rounded-xl p-4 cursor-pointer active:scale-[0.97] transition-transform shadow-sm`}>
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-semibold text-white">{card.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Manage */}
        <div className="mb-6">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Manage</div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {[
              { label: "View Invoices", icon: List, path: "/invoices" },
              { label: "New Delivery Challan", icon: ClipboardList, path: "/delivery-challans/new" },
              { label: "Delivery Challans", icon: List, path: "/delivery-challans" },
              { label: "View Customers", icon: Users, path: "/customers" },
              { label: "Product Items", icon: Package, path: "/products" },
              { label: "Payments", icon: CreditCard, path: "/payments" },
              ...(isAdmin ? [
                { label: "All Users", icon: UserCheck, path: "/admin/users-list", badge: "Admin" },
                { label: "Registered Products", icon: Package, path: "/admin/products", badge: "Admin" },
                { label: "All Invoices", icon: FileText, path: "/admin/invoices", badge: "Admin" },
                { label: "All Customers", icon: Users, path: "/admin/customers", badge: "Admin" },
              ] : []),
            ].map((item, i, arr) => (
              <button key={item.label} onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 w-full px-4 py-3.5 text-sm text-slate-700 active:bg-slate-50 transition-colors text-left min-h-[48px] ${i < arr.length - 1 ? "border-b border-slate-100" : ""}`}>
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-slate-500" />
                </div>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{item.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="mb-6">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Account</div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-white">{user?.name?.[0]?.toUpperCase() || "U"}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{user?.name}</div>
                  <div className="text-[11px] text-slate-400">{user?.email || user?.phone}</div>
                </div>
                {isAdmin && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => navigate("/settings")}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-sm text-slate-700 active:bg-slate-50 transition-colors text-left min-h-[48px] border-b border-slate-100">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                <Settings className="w-4 h-4 text-slate-500" />
              </div>
              Settings
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-sm text-red-600 active:bg-red-50 transition-colors text-left min-h-[48px]">
              <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                <LogOut className="w-4 h-4 text-red-500" />
              </div>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
