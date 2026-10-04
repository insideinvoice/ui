import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, AlertCircle, CheckCircle, Info, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";
import LoadingDots from "../components/LoadingDots";
import insideInvoiceLogo from "../assets/inside-invoice-logo.svg";
import api from "../api/axios";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = email, 2 = OTP, 3 = new password, 4 = success
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auto-redirect on success after 15 seconds
  useEffect(() => {
    if (step !== 4) return;
    if (countdown <= 0) {
      navigate("/login");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown, navigate]);

  // Resend cooldown timer (5 minutes)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Focus OTP input when step 2
  useEffect(() => {
    if (step === 2 && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setEmailError("Email is required");
      return;
    }
    setEmailError("");
    setIsLoading(true);
    setApiError("");

    try {
      await api.post("/auth/forgot-password", { email });
      setStep(2);
      setResendCooldown(300);
    } catch (err) {
      setApiError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setOtpError("Please enter the 6-digit code");
      return;
    }
    setOtpError("");
    setIsLoading(true);
    setApiError("");

    try {
      await api.post("/auth/verify-otp", { email, otp });
      setStep(3);
    } catch (err) {
      setOtpError(err.response?.data?.message || "Invalid or expired code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    let valid = true;

    if (!newPassword || newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      valid = false;
    } else {
      setPasswordError("");
    }

    if (newPassword !== confirmPassword) {
      setConfirmError("Passwords do not match");
      valid = false;
    } else {
      setConfirmError("");
    }

    if (!valid) return;

    setIsLoading(true);
    setApiError("");

    try {
      await api.post("/auth/reset-password", { email, otp, newPassword });
      setStep(4);
      setCountdown(15);
    } catch (err) {
      setApiError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    setApiError("");

    try {
      await api.post("/auth/forgot-password", { email });
      setOtp("");
      setOtpError("");
      setResendCooldown(300);
    } catch (err) {
      setApiError(err.response?.data?.message || "Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles = {
    1: "Forgot password?",
    2: "Check your email",
    3: "Set new password",
    4: "Password reset!",
  };

  const stepSubtitles = {
    1: "Enter your email and we'll send you a verification code.",
    2: `We've sent a 6-digit code to ${email}`,
    3: "Your new password must be different from your previous password.",
    4: "Your password has been updated successfully.",
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
          {/* Back to Sign in */}
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-700 font-medium transition-colors mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign in
          </button>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {stepTitles[step]}
            </h1>
            {step === 1 && (
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
            )}
          </div>
          <p className="text-slate-500 text-[13px] mb-6">{stepSubtitles[step]}</p>

          {apiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-[13px]">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              {apiError}
            </div>
          )}

          {/* Step 1: Enter Email */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
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
                    <LoadingDots className="text-white" />
                    Sending code...
                  </>
                ) : (
                  "Send verification code"
                )}
              </button>
            </form>
          )}

          {/* Step 2: Enter OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  6-digit verification code
                </label>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(val);
                    if (otpError) setOtpError("");
                  }}
                  className={`w-full py-3 bg-slate-50/80 border rounded-lg text-center text-2xl font-bold tracking-[0.4em] text-slate-900 placeholder:text-slate-300 placeholder:tracking-normal placeholder:text-base placeholder:font-normal transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                    otpError
                      ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  placeholder="000000"
                />
                {otpError && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {otpError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px] shadow-sm"
              >
                {isLoading ? (
                  <>
                    <LoadingDots className="text-white" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verify code
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[13px]">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading || resendCooldown > 0}
                  className={`font-medium flex items-center gap-1.5 ${
                    resendCooldown > 0
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-indigo-600 hover:underline"
                  }`}
                >
                  {resendCooldown > 0 ? (
                    <>
                      <LoadingDots className="text-slate-400" />
                      Resend in {Math.floor(resendCooldown / 60)}:{(resendCooldown % 60).toString().padStart(2, "0")}
                    </>
                  ) : (
                    "Resend code"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp("");
                    setApiError("");
                    setResendCooldown(0);
                  }}
                  className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Change email
                </button>
              </div>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-11 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                      passwordError
                        ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNewPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {passwordError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (confirmError) setConfirmError("");
                    }}
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-11 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                      confirmError
                        ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {confirmError && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {confirmError}
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
                    <LoadingDots className="text-white" />
                    Resetting...
                  </>
                ) : (
                  "Reset password"
                )}
              </button>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-slate-600 text-[13px] mb-6">
                You can now login with your new password.
              </p>

              <button
                onClick={() => navigate("/login")}
                className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 text-sm min-h-[44px] shadow-sm mb-3"
              >
                Go to login now
              </button>

              <p className="text-slate-400 text-[12px]">
                Redirecting to login in <span className="font-semibold text-slate-600">{countdown}s</span>...
              </p>
            </div>
          )}
        </div>

        {/* Back to login / signup */}
        {step !== 4 && (
          <div className="mt-5 flex items-center justify-center text-[13px]">
            <Link to="/login" className="text-slate-500 hover:text-slate-700 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
