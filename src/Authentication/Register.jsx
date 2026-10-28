import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import LoadingDots from "../components/LoadingDots";
import { useAuth } from "../context/AuthContext";
import {
  User,
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
import {
  validateRegisterForm,
  normalizeEmail,
  mapApiFieldErrors,
} from "./registerValidation";

/**
 * Public self-service registration. Mirrors the Login split-screen design.
 * POSTs { name, email, password, confirmPassword } to /api/auth/register —
 * the server derives the username, provisions the initial business and
 * always creates a standard USER account. On success the session is stored
 * exactly like a login and the user continues into the existing first-login
 * business-setup journey. (Google sign-up lands with the OAuth task.)
 */
export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const year = new Date().getFullYear();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [focus, setFocus] = useState({});

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});

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
    const newErrors = validateRegisterForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Guarded by isLoading too, but an early return keeps double-submits from
    // even reaching the state update (fast double-click on touch devices).
    if (isLoading) return;
    if (!validateForm()) return;
    setIsLoading(true);
    setApiError("");

    try {
      const res = await register({
        name: formData.name.trim(),
        email: normalizeEmail(formData.email),
        password: formData.password,
      });
      // No session yet — park the visitor on the OTP screen with the address
      // pre-filled. The session is minted by /verify-email once the code is
      // entered; from there the normal journey (business setup) continues.
      // Carry the server's resend cooldown so the verify screen starts its
      // countdown honest to the backend's per-account 15-minute throttle.
      const wait = res?.resendAfterSeconds ?? 900;
      navigate(
        `/verify-email?email=${encodeURIComponent(normalizeEmail(formData.email))}&wait=${wait}`
      );
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;
      if (status === 400 && body?.fieldErrors) {
        setErrors((prev) => ({ ...prev, ...mapApiFieldErrors(body.fieldErrors) }));
      }
      setApiError(
        body?.message ||
          body?.error ||
          "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = (field) =>
    `w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
      errors[field]
        ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
        : "border-slate-200 hover:border-slate-300"
    }`;

  const iconClass = (field) =>
    `absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focus[field] ? "text-indigo-500" : "text-slate-400"}`;

  const fieldError = (field) =>
    errors[field] && (
      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {errors[field]}
      </p>
    );

  return (
    <div
      className="min-h-[100dvh] flex lg:bg-slate-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* ===== LEFT PANEL — Brand (desktop only) ===== */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between p-10 xl:p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
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
                BY GRITX
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
              Start billing today.
              <br />
              <span className="text-indigo-400">Grow without limits.</span>
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
                Create your InsideInvoice account
              </h1>
              <p className="text-[13px] text-slate-500 mt-1">
                Set up your account and start using InsideInvoice right away
              </p>
            </div>

            {/* API error banner */}
            {apiError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200/80 rounded-lg flex items-center gap-2 text-red-700 text-[13px]">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                {apiError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full name */}
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Full name
                </label>
                <div className="relative group">
                  <div className={iconClass("name")}>
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    onFocus={() => setFocus((f) => ({ ...f, name: true }))}
                    onBlur={() => setFocus((f) => ({ ...f, name: false }))}
                    autoComplete="name"
                    maxLength={100}
                    className={fieldClass("name")}
                    placeholder="Your full name"
                  />
                </div>
                {fieldError("name")}
              </div>

              {/* Email */}
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Email address
                </label>
                <div className="relative group">
                  <div className={iconClass("email")}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onFocus={() => setFocus((f) => ({ ...f, email: true }))}
                    onBlur={() => setFocus((f) => ({ ...f, email: false }))}
                    autoComplete="email"
                    maxLength={255}
                    className={fieldClass("email")}
                    placeholder="email@insideinvoice.com"
                  />
                </div>
                {fieldError("email")}
              </div>

              {/* Password */}
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Password
                </label>
                <div className="relative group">
                  <div className={iconClass("password")}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onFocus={() => setFocus((f) => ({ ...f, password: true }))}
                    onBlur={() => setFocus((f) => ({ ...f, password: false }))}
                    autoComplete="new-password"
                    maxLength={100}
                    className={`${fieldClass("password")} pr-10`}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-10 h-10 flex items-center justify-center rounded-md transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {fieldError("password")}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Confirm password
                </label>
                <div className="relative group">
                  <div className={iconClass("confirmPassword")}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    onFocus={() =>
                      setFocus((f) => ({ ...f, confirmPassword: true }))
                    }
                    onBlur={() =>
                      setFocus((f) => ({ ...f, confirmPassword: false }))
                    }
                    autoComplete="new-password"
                    maxLength={100}
                    className={`${fieldClass("confirmPassword")} pr-10`}
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-10 h-10 flex items-center justify-center rounded-md transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {fieldError("confirmPassword")}
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
                    Creating your account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Link to login */}
            <p className="mt-5 text-center text-[13px] text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-slate-900 font-semibold hover:underline"
              >
                Sign in
              </Link>
            </p>

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
