import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { useAuth } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { authAPI } from "../api/auth";
import toast from "react-hot-toast";
import { ArrowLeft, UserPlus, AlertCircle, Mail, Lock, User, Building2, Shield } from "lucide-react";

export default function AdminAddUsers() {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    businessName: "",
    role: "USER",
  });

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-500 mt-1">Only administrators can access this page.</p>
          <button onClick={() => navigate("/dashboard")} className="mt-4 text-sm text-slate-700 underline">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.email || !formData.password) {
      toast.error("Name, username, email, and password are required");
      return;
    }
    setIsLoading(true);
    try {
      const res = await authAPI.signup({
        name: formData.name,
        username: formData.username || undefined,
        email: formData.email,
        password: formData.password,
        businessName: formData.businessName || undefined,
        role: formData.role,
      });
      toast.success(`User created successfully: ${formData.email}`);
      setFormData({ name: "", username: "", email: "", password: "", businessName: "", role: "USER" });
    } catch (err) {
      const msg = err.response?.data?.message
        || (err.response?.data?.fieldErrors ? Object.values(err.response.data.fieldErrors).join(", ") : null)
        || "Failed to create user";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Add User" backTo="/admin/users-list" />
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-slate-900">Create User Account</h1>
            <p className="text-sm text-slate-500 mt-1">The user will be able to login with these credentials and set up their business.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="text" name="name" value={formData.name} onChange={handleChange}
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="text" name="username" value={formData.username} onChange={handleChange}
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" placeholder="Defaults to email if empty" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input type="password" name="password" value={formData.password} onChange={handleChange}
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                  <select name="role" value={formData.role} onChange={handleChange}
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 bg-white appearance-none">
                    <option value="USER">Client</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Business Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="text" name="businessName" value={formData.businessName} onChange={handleChange}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400" />
              </div>
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full bg-gradient-to-r from-slate-700 to-slate-800 text-white font-medium py-2.5 rounded-lg hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {isLoading ? (
                <><LoadingDots className="text-white" /> Creating...</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Create User</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
