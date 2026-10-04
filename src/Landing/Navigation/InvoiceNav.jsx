import { Menu, X } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

export default function InvoiceNav({ scrolled, setIsMenuOpen, isMenuOpen }) {
  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white border-b border-slate-200" : "bg-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-slate-700 via-gray-700 to-slate-900 rounded-lg flex items-center justify-center shadow-md overflow-hidden">
                <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="8" r="2.5" fill="white" />
                  <rect x="8.5" y="12" width="3" height="12" rx="1.5" fill="white" />
                  <circle cx="20" cy="11" r="1.8" fill="white" opacity="0.9" />
                  <rect x="18.6" y="15" width="2.8" height="9" rx="1.4" fill="white" opacity="0.9" />
                </svg>
              </div>
              <div className="hidden sm:flex flex-col shrink-0">
                <span className="text-sm font-bold text-slate-800 leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Inside Invoice
                </span>
                <span className="text-[8px] text-slate-500 font-semibold tracking-wider leading-tight">
                  BY 2X+1
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/contact" className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors font-medium">
              Contact
            </Link>
            <Link to="/login" className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors font-medium">
              Login
            </Link>
            <Link to="/login" className="ml-2">
              <button className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 shadow-sm">
                Start Billing
              </button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 text-slate-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu - opens top to bottom */}
      <div
        aria-hidden={!isMenuOpen}
        className={`md:hidden w-full overflow-hidden bg-white border-t border-slate-100 shadow-xl transition-all duration-300 ease-out ${
          isMenuOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0 border-transparent pointer-events-none"
        }`}
      >
        <div
          className={`transition-transform duration-300 ease-out ${
            isMenuOpen ? "translate-y-0" : "-translate-y-4"
          }`}
        >
          <Link
            to="/contact"
            className={`block px-4 py-3 text-slate-700 hover:bg-slate-50 transition-all duration-300 ease-out font-semibold min-h-[44px] ${
              isMenuOpen ? "opacity-100 delay-75" : "opacity-0"
            }`}
          >
            Contact
          </Link>
          <Link
            to="/login"
            className={`block px-4 py-3 text-slate-700 hover:bg-slate-50 transition-all duration-300 ease-out font-semibold min-h-[44px] ${
              isMenuOpen ? "opacity-100 delay-100" : "opacity-0"
            }`}
          >
            Login
          </Link>
          <div className={`px-4 pt-2 pb-4 transition-opacity duration-300 ease-out ${isMenuOpen ? "opacity-100 delay-150" : "opacity-0"}`}>
            <Link to="/login" className="block">
              <button className="w-full px-6 py-3 bg-slate-900 text-white rounded-xl font-bold min-h-[48px] text-sm hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 shadow-sm">
                Start Billing
              </button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
