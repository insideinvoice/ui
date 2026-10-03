import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, AlertCircle, CheckCircle, Info } from "lucide-react";
import insideInvoiceLogo from "../assets/inside-invoice-logo.svg";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setEmailError("Email is required");
      return;
    }
    setEmailError("");
    setIsLoading(true);
    setApiError("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(data.message || "If an account exists with this email, reset instructions have been sent.");
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setApiError(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setApiError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <Link to="/" className="flex flex-col items-center gap-3 mb-8 group">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm group-hover:shadow-md transition-shadow">
            <img src={insideInvoiceLogo} alt="Inside Invoice" className="w-7 h-7" />
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="text-slate-900 font-bold text-lg leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Inside Invoice
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider leading-tight">
              BY 2X+1
            </span>
          </div>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Forgot password?
            </h1>
            <div className="relative group">
              <Info className="w-4 h-4 text-slate-400 hover:text-indigo-500 transition-colors cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg">
                Facing issues contact:{" "}
                <a href="mailto:insideinvoice87@gmail.com" className="text-indigo-400 hover:underline">
                  insideinvoice87@gmail.com
                </a>
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-slate-900 rotate-45" />
              </div>
            </div>
          </div>
          <p className="text-slate-500 text-[13px] mb-6">
            Enter your email and we'll send you a temporary password.
          </p>

          {apiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-[13px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              {apiError}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-[13px]">
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${emailFocused ? "text-indigo-500" : "text-slate-400"}`}>
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  autoComplete="email"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                    emailError
                      ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  placeholder="email@insideinvoice.com"
                />
              </div>
              {emailError && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {emailError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px] shadow-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        </div>

        {/* Back to login */}
        <p className="mt-5 text-center text-[13px] text-slate-500">
          Remember your password?{" "}
          <Link to="/login" className="text-slate-900 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
