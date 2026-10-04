import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { useAuth } from "../context/AuthContext";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  FileText,
  Shield,
  Zap,
} from "lucide-react";
import insideInvoiceLogo from "../assets/inside-invoice-logo.svg";

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const year = new Date().getFullYear();

  const isForgotMode = location.pathname === "/forgot-password";

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    setApiError("");
    setSuccessMessage("");
  }, [location.pathname]);

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
    if (!formData.email) newErrors.email = "Email or username is required";
    if (!isForgotMode && !formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    setApiError("");

    try {
      if (isForgotMode) {
        setSuccessMessage("If the email exists in our system, a reset link will be sent.");
      } else {
        const data = await login(formData.email, formData.password, rememberMe);
        navigate(data.businessSetupCompleted ? "/dashboard" : "/business-setup");
      }
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || "Something went wrong. Please try again.";
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] min-h-[100dvh] flex lg:bg-slate-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* ===== LEFT PANEL — Brand (desktop only) ===== */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between p-10 xl:p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10 group-hover:bg-white/15 transition-colors shrink-0">
              <img src={insideInvoiceLogo} alt="" className="w-6 h-6" />
            </div>
            <div className="flex flex-col shrink-0">
              <span
                className="text-white font-bold text-lg leading-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Inside Invoice
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider leading-tight">
                BY 2X+1
              </span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2
              className="text-3xl xl:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Invoice smarter.
              <br />
              <span className="text-indigo-400">Grow faster.</span>
            </h2>
            <p className="text-slate-400 mt-4 text-sm leading-relaxed max-w-sm">
              Create professional GST invoices, track payments, manage
              customers, and run your billing — all from one place.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: FileText, text: "GST-compliant invoices in seconds" },
              { icon: Shield, text: "Secure cloud backup & data protection" },
              { icon: Zap, text: "Instant PDF generation & sharing" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-indigo-400" />
                </div>
                <span className="text-sm text-slate-300">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-slate-500 text-xs">
            &copy; {year} Inside Invoice. All rights reserved.
          </p>
        </div>
      </div>

      {/* ===== RIGHT PANEL — Form ===== */}
      <div className="flex-1 flex flex-col bg-white lg:bg-slate-50 relative">
        {/* Mobile top bar */}
        <div className="lg:hidden px-5 pt-5 pb-2">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
              <img src={insideInvoiceLogo} alt="" className="w-5 h-5" />
            </div>
            <span
              className="font-bold text-slate-900 text-sm"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Inside Invoice
            </span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 lg:py-0">
          <div className="w-full max-w-[360px]">
            {/* Heading */}
            <div className="mb-6">
              <h1
                className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {isForgotMode ? "Reset your password" : "Welcome back"}
              </h1>
              <p className="text-[13px] text-slate-500 mt-1">
                {isForgotMode
                  ? "Enter your email and we'll send you a reset link"
                  : "Sign in to your account to continue"}
              </p>
            </div>

            {/* Error / Success */}
            {apiError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200/80 rounded-lg flex items-center gap-2 text-red-700 text-[13px]">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                {apiError}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg flex items-center gap-2 text-emerald-700 text-[13px]">
                <svg
                  className="w-4 h-4 flex-shrink-0 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {successMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Email address
                </label>
                <div className={`relative group`}>
                  <div
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${emailFocused ? "text-indigo-500" : "text-slate-400"}`}
                  >
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    autoComplete="username"
                    className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                      errors.email
                        ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    placeholder="email@insideinvoice.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              {!isForgotMode && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-medium text-slate-600">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[13px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className={`relative group`}>
                    <div
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${passwordFocused ? "text-indigo-500" : "text-slate-400"}`}
                    >
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      autoComplete="current-password"
                      className={`w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                        errors.password
                          ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-10 h-10 flex items-center justify-center rounded-md transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.password}
                    </p>
                  )}
                </div>
              )}

              {/* Remember me (login only) */}
              {!isForgotMode && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label
                    htmlFor="remember"
                    className="text-[13px] text-slate-600 cursor-pointer select-none"
                  >
                    Keep me signed in
                  </label>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px] shadow-sm mt-1"
              >
                {isLoading ? (
                  <>
                    <LoadingDots className="text-white" />
                    Signing in...
                  </>
                ) : (
                  <>
                    {isForgotMode ? "Send reset link" : "Sign in"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Sign up link */}
            {!isForgotMode && (
              <p className="mt-5 text-center text-[13px] text-slate-500">
                Don&apos;t have an account?{" "}
                <Link
                  to="/"
                  className="text-slate-900 font-semibold hover:underline"
                >
                  Get started
                </Link>
              </p>
            )}

            {isForgotMode && (
              <p className="mt-5 text-center text-[13px] text-slate-500">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="text-slate-900 font-semibold hover:underline"
                >
                  Sign in
                </Link>
              </p>
            )}

            {/* Footer */}
            <div className="mt-8 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Shield className="w-3 h-3" />
                <span>Secured with 256-bit encryption</span>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs">
                <Link
                  to="/privacy-policy"
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms-and-condition"
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
