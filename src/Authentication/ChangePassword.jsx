import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";

export default function ChangePassword() {
  const { loading, user } = useAuth();
  const navigate = useNavigate();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    setApiError("");
    setSuccessMessage("");
    setErrors({});
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  }, [loading]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.currentPassword) newErrors.currentPassword = "Current password is required";
    if (!formData.newPassword) newErrors.newPassword = "New password is required";
    if (!formData.confirmPassword) newErrors.confirmPassword = "Confirm password is required";
    if (formData.newPassword && formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }
    if (formData.newPassword && formData.confirmPassword && formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setApiError("");
    setSuccessMessage("");

    try {
      const res = await api.put("/auth/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      setSuccessMessage(res.data?.message || "Password changed successfully");
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setApiError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent navigation away without changing password
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!formData.currentPassword && !formData.newPassword && !formData.confirmPassword) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [formData.currentPassword, formData.newPassword, formData.confirmPassword]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-white py-8">
      <div className="max-w-md mx-auto w-full">
        <div className="bg-white shadow-md rounded-lg p-8 sm:p-10 border border-slate-200">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {user?.mustChangePassword === true ? "Change Temporary Password" : "Change Password"}
          </h2>

          {apiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200/80 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" /> {apiError}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 mr-2" /> {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Current password
              </label>
              <div className={`relative group`}>
                <div
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${showCurrentPassword ? "text-indigo-500" : "text-slate-400"}`}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  onFocus={() => setShowCurrentPassword(true)}
                  onBlur={() => setShowCurrentPassword(false)}
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                    errors.currentPassword
                      ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-10 h-10 flex items-center justify-center rounded-md transition-colors"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                New password
              </label>
              <div className={`relative group`}>
                <div
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${showNewPassword ? "text-indigo-500" : "text-slate-400"}`}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showNewPassword ? "text" : "password"}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  onFocus={() => setShowNewPassword(true)}
                  onBlur={() => setShowNewPassword(false)}
                  autoComplete="new-password"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                    errors.newPassword
                      ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-10 h-10 flex items-center justify-center rounded-md transition-colors"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.newPassword}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Confirm password
              </label>
              <div className={`relative group`}>
                <div
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${showConfirmPassword ? "text-indigo-500" : "text-slate-400"}`}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  onFocus={() => setShowConfirmPassword(true)}
                  onBlur={() => setShowConfirmPassword(false)}
                  autoComplete="confirm-password"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                    errors.confirmPassword
                      ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-10 h-10 flex items-center justify-center rounded-md transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px] shadow-sm mt-1"
            >
              {isLoading ? (
                <>
                  <LoadingDots className="text-white" />
                  Changing...
                </>
              ) : (
                "Change password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}