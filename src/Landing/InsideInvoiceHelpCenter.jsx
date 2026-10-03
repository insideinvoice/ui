import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import InvoiceNav from "./Navigation/InvoiceNav";

export default function InsideInvoiceHelpCenter() {
  const year = new Date().getFullYear();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <InvoiceNav scrolled={true} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 text-slate-800" style={{ paddingTop: "calc(5rem + env(safe-area-inset-top, 0px))" }}>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <span aria-hidden="true">←</span> Back to Home
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Inside Invoice Help Center</h1>
        <p className="mb-6 sm:mb-8 text-slate-600 text-sm sm:text-base">
          Find quick answers, step-by-step guides, and support resources to get
          the most out of Inside Invoice.
        </p>

        <section className="mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Quick Help</h2>
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            <HelpCard title="Create Your First Invoice" description="Learn how to generate a GST-compliant invoice in minutes." />
            <HelpCard title="Download & Share Invoices" description="Download invoices as PDF and share with customers." />
            <HelpCard title="Manage Customers" description="Add, edit, or delete customers with GSTIN details." />
            <HelpCard title="Track Payments" description="Mark invoices as paid, pending, or partial." />
          </div>
        </section>

        <section className="mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Popular Topics</h2>
          <ul className="list-disc pl-5 sm:pl-6 space-y-1.5 sm:space-y-2 text-sm sm:text-base">
            <li>How to edit or cancel an invoice</li>
            <li>GST calculation and tax breakdown</li>
            <li>Invoice numbering and prefixes</li>
            <li>Exporting reports (PDF / Excel)</li>
            <li>Data backup and security</li>
          </ul>
        </section>

        <section className="mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Troubleshooting</h2>
          <div className="space-y-3 sm:space-y-4">
            <TroubleItem question="Invoice not generating?" answer="Ensure all required fields like customer, items, and GST rates are filled correctly." />
            <TroubleItem question="Incorrect GST amount?" answer="Verify the GST percentage and HSN/SAC codes applied to products." />
            <TroubleItem question="Unable to download PDF?" answer="Check your internet connection and try again. If issue persists, contact support." />
          </div>
        </section>

        <section className="mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Account & Billing</h2>
          <ul className="list-disc pl-5 sm:pl-6 space-y-1.5 sm:space-y-2 text-sm sm:text-base">
            <li>Upgrade or downgrade your subscription</li>
            <li>View billing history and invoices</li>
            <li>Cancel your plan anytime</li>
            <li>Refund & cancellation policy</li>
          </ul>
        </section>

        <section className="mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Contact Support</h2>
          <div className="bg-slate-100 p-4 sm:p-6 rounded-xl sm:rounded-2xl text-sm sm:text-base">
            <p className="mb-2">Email: <strong>insideinvoice87@gmail.com</strong></p>
            <p className="mb-2">Hours: Mon-Fri, 9 AM - 6 PM IST</p>
            <p>Response Time: Within 24 hours</p>
          </div>
        </section>

        <section className="mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Self-Service Options</h2>
          <ul className="list-disc pl-5 sm:pl-6 space-y-1.5 sm:space-y-2 text-sm sm:text-base">
            <li>Update business & GST details</li>
            <li>Export or delete your data</li>
            <li>Deactivate account</li>
          </ul>
        </section>

        <footer className="border-t pt-6 text-sm text-slate-500">
          &copy; {year} Inside Invoice by 2X+1. All rights reserved.
        </footer>
      </div>
    </div>
  );
}

function HelpCard({ title, description }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow transition text-sm sm:text-base">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-slate-600 text-xs sm:text-sm">{description}</p>
    </div>
  );
}

function TroubleItem({ question, answer }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 text-sm sm:text-base">
      <h4 className="font-medium">{question}</h4>
      <p className="text-slate-600 mt-1 text-xs sm:text-sm">{answer}</p>
    </div>
  );
}
