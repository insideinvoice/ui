import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import InvoiceNav from "./Navigation/InvoiceNav";

export default function InsideInvoiceVideoTutorials() {
  const year = new Date().getFullYear();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <InvoiceNav scrolled={true} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 text-slate-800 text-center" style={{ paddingTop: "calc(5rem + env(safe-area-inset-top, 0px))" }}>
        <div className="text-left">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
            <span aria-hidden="true">←</span> Back to Home
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Video Tutorials</h1>

        <p className="text-sm sm:text-lg text-slate-600 mb-6 sm:mb-8">
          We're making great progress! Our step-by-step video tutorials are
          currently under production.
        </p>

        <div className="bg-slate-100 border border-dashed border-slate-300 rounded-2xl p-6 sm:p-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3">Stay Tuned!</h2>
          <p className="text-slate-600 mb-4 text-sm sm:text-base">
            Soon you'll be able to watch guided videos on how to:
          </p>

          <ul className="list-disc text-left max-w-md mx-auto pl-5 sm:pl-6 space-y-1.5 sm:space-y-2 text-slate-600 text-sm sm:text-base">
            <li>Create GST-compliant invoices</li>
            <li>Manage customers and products</li>
            <li>Track payments and reports</li>
            <li>Configure business and GST settings</li>
          </ul>

          <p className="mt-5 sm:mt-6 text-xs sm:text-sm text-slate-500">
            New videos will be announced here and via email notifications.
          </p>
        </div>

        <footer className="mt-8 sm:mt-10 text-xs sm:text-sm text-slate-500">
          &copy; {year} Inside Invoice by 2X+1. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
