import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, FileText, Mail, RefreshCw, Shield, Zap } from "lucide-react";
import insideInvoiceLogo from "../assets/inside-invoice-logo.svg";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../api/auth";

/**
 * Step 2 of sign-up: enter the 6-digit code mailed to the address.
 *
 * The account already exists at this point but CANNOT sign in — the backend
 * answers 403 EMAIL_NOT_VERIFIED on /auth/login until this screen accepts the
 * code. On success the server mints the session, so the visitor continues into
 * the ordinary first-run journey (business setup if it is still outstanding).
 *
 * Reaching this screen with no ?email= still works: the address becomes an
 * editable field, so a user who closed the tab can come back, type it in and
 * hit "Resend" — no account lookup is exposed to them either way.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyEmail } = useAuth();

  const initialEmail = useMemo(
    () => (searchParams.get("email") || "").trim().toLowerCase(),
    [searchParams]
  );

  // Server-driven resend cooldown (per-account 15-min throttle). Passed from
  // the register response so the countdown is honest from first paint, and
  // refreshed from every resend response below.
  const initialWait = useMemo(() => {
    const w = Number(searchParams.get("wait"));
    return Number.isFinite(w) && w > 0 ? Math.min(w, 900) : 0;
  }, [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [emailLocked] = useState(() => Boolean(initialEmail));
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(initialWait);
  const [justResent, setJustResent] = useState(false);
  const inputsRef = useRef([]);
  const submittingRef = useRef(false);

  const otp = digits.join("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Land with the first empty box focused so typing just works.
  useEffect(() => {
    const t = setTimeout(() => inputsRef.current[0]?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // Resend countdown — also the honest mirror of the server's mail throttle.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const setDigit = useCallback((index, value) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (error) setError("");
    setJustResent(false);
  }, [error]);

  /** One box can receive a whole pasted/autofilled code — spread it and jump on. */
  const handleChange = (index, raw) => {
    const value = raw.replace(/\D/g, "");
    if (!value) {
      setDigit(index, "");
      return;
    }
    const next = [...digits];
    let cursor = index;
    for (const ch of value) {
      if (cursor > 5) break;
      next[cursor] = ch;
      cursor += 1;
    }
    setDigits(next);
    if (error) setError("");
    setJustResent(false);
    const target = inputsRef.current[Math.min(cursor, 5)];
    target?.focus();
    // Auto-submit the moment the 6th digit lands — no button click needed.
    if (next.every((d) => d !== "")) autoSubmit(next.join(""));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        inputsRef.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    text.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    if (error) setError("");
    inputsRef.current[Math.min(text.length, 5)]?.focus();
    // A full 6-digit paste should verify immediately, like typing the last digit.
    if (text.length === 6) autoSubmit(text);
  };

  const submitOtp = async (code) => {
    if (!email) {
      setError("Enter the email address you signed up with.");
      return;
    }
    if (code.length !== 6) {
      setError("Please enter all 6 digits of the code.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await verifyEmail({ email, otp: code });
      // Confirmation before we hand off to the app — the redirect is instant,
      // so without this the user never sees that the code was accepted.
      toast.success("Email verified! Your account is ready.", { id: "email-verified" });
      // Normal flow resumes exactly where a login would have dropped them.
      navigate(data.businessSetupCompleted ? "/dashboard" : "/business-setup", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || "Something went wrong. Please try again.";
      if (status === 429) {
        setError("Too many attempts from this device. Please wait a minute and try again.");
      } else if (/already verified/i.test(message)) {
        // The backend refuses to mint a session from this screen (it is
        // unauthenticated), so the only way in is an ordinary sign-in. Send
        // them there instead of leaving a dead end.
        toast.info("Your email is already verified — please sign in.");
        navigate("/login", { replace: true });
        return;
      } else {
        setError(message);
      }
      // A wrong/expired/burned code never carries over — clear the boxes.
      setDigits(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoading) return;
    submitOtp(otp);
  };

  // Auto-submit the instant the 6th digit lands (typed or pasted). The ref
  // guard (not the async isLoading state) stops a fast second call from firing
  // before React re-renders with isLoading=true.
  const autoSubmit = (code) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    submitOtp(code).finally(() => { submittingRef.current = false; });
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    try {
      const res = await authAPI.resendVerification({ email });
      // Same wording either way — the server deliberately never reveals
      // whether the address has an account. The resend response carries the
      // honest per-account wait (15-min throttle), so count down from that.
      const wait = res?.data?.data?.resendAfterSeconds ?? 900;
      toast.success("If that address can receive mail, a new code is on its way.");
      setDigits(["", "", "", "", "", ""]);
      setJustResent(true);
      setCooldown(Math.max(Number(wait) || 0, 0));
      inputsRef.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not resend the code. Please try again.");
    }
  };

  /** "847s" is ugly at 15 minutes — render m:ss (e.g. "14:07"). */
  const formatCooldown = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const fieldClass = (invalid) =>
    `w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
      invalid
        ? "border-red-400 bg-red-50/50 focus:ring-red-500/20 focus:border-red-400"
        : "border-slate-200 hover:border-slate-300"
    }`;

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
              One code away.
              <br />
              <span className="text-indigo-400">Then start billing.</span>
            </h2>
            <p className="text-slate-400 mt-4 text-sm leading-relaxed max-w-sm">
              We sent a 6-digit code to your inbox. Entering it confirms the
              address belongs to you and unlocks your account.
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
            &copy; {new Date().getFullYear()} Inside Invoice. All rights reserved.
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
                Verify your email
              </h1>
              <p className="text-[13px] text-slate-500 mt-1">
                {emailLocked
                  ? <>We sent a 6-digit code to <span className="font-semibold text-slate-700">{email}</span></>
                  : "Enter the email you signed up with, then the 6-digit code we sent"}
              </p>
            </div>

            {/* API error banner */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200/80 rounded-lg flex items-center gap-2 text-red-700 text-[13px]">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
            {justResent && !error && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg flex items-center gap-2 text-emerald-700 text-[13px]">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                <span>A new code is on its way — the previous one no longer works.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email — editable only when the visitor arrived without ?email= */}
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Email address
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value.trim().toLowerCase());
                      if (error) setError("");
                    }}
                    readOnly={emailLocked}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={`${fieldClass(Boolean(error) && !email)} ${emailLocked ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}`}
                  />
                </div>
                {emailLocked && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Wrong address?{" "}
                    <Link to="/register" className="text-slate-600 font-semibold hover:underline">
                      Create a different account
                    </Link>
                  </p>
                )}
              </div>

              {/* 6-digit code */}
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                  Verification code
                </label>
                <div className="flex gap-2 justify-between" onPaste={handlePaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputsRef.current[i] = el; }}
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={6}
                      value={d}
                      aria-label={`Digit ${i + 1} of 6`}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      disabled={isLoading}
                      className={`w-full h-12 text-center text-lg font-bold font-mono text-slate-900 bg-slate-50/80 border rounded-lg transition-all duration-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${
                        error
                          ? "border-red-400 bg-red-50/50"
                          : d
                            ? "border-indigo-300 bg-white"
                            : "border-slate-200 hover:border-slate-300"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  The code expires in 10 minutes.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Verify &amp; continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Resend */}
              <div className="flex items-center justify-between text-[13px]">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </Link>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || !email}
                  className="inline-flex items-center gap-1.5 text-slate-600 font-semibold hover:text-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cooldown > 0 ? "animate-none" : ""}`} />
                  {cooldown > 0 ? `Resend in ${formatCooldown(cooldown)}` : "Resend code"}
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Shield className="w-3 h-3" />
                <span>Secured with 256-bit encryption</span>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs">
                <Link to="/privacy-policy" className="text-slate-400 hover:text-slate-600 transition-colors">
                  Privacy
                </Link>
                <Link to="/terms-and-condition" className="text-slate-400 hover:text-slate-600 transition-colors">
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
