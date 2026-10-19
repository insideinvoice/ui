import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import {
  ArrowLeft, BookOpen, Rocket, FileText, Users, Package,
  IndianRupee, BarChart3, Settings, ShieldCheck, Headphones,
} from "lucide-react";
import InvoiceNav from "./Navigation/InvoiceNav";

export default function Documentation() {
  const year = new Date().getFullYear();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <>
      <InvoiceNav
        scrolled={true}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-10 text-slate-800 w-full">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </span>
          Inside Invoice Documentation
        </h1>

        <p className="mb-6">
          Welcome to <strong>Inside Invoice</strong>, a GST-compliant billing
          and invoice management platform built for Indian businesses.
        </p>

        {/* Getting Started */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5" />
            </span>
            Getting Started
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Sign up on Inside Invoice using your business email</li>
            <li>Login to access your dashboard</li>
            <li>Complete your business profile and GST details</li>
          </ul>
        </section>

        {/* Invoice Management */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </span>
            Invoice Management
          </h2>

          <h3 className="text-xl font-medium mt-4 mb-2">Create an Invoice</h3>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Go to Dashboard → Create Invoice</li>
            <li>Select or add a customer</li>
            <li>Add products/services with GST rates</li>
            <li>
              Click <strong>Generate Tax Invoice</strong>
            </li>
          </ol>

          <h3 className="text-xl font-medium mt-4 mb-2">
            View & Download Invoice
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Navigate to Invoices → All Invoices</li>
            <li>Preview invoice</li>
            <li>Download PDF or print</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">
            Edit / Delete Invoice
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Edit invoice before finalization</li>
            <li>Delete invoices carefully (cannot be recovered)</li>
          </ul>
        </section>

        {/* Customers */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </span>
            Customer Management
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Add customers with GSTIN and address</li>
            <li>Edit or delete customer details</li>
            <li>Auto-fill customer data in invoices</li>
          </ul>
        </section>

        {/* Products */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </span>
            Product &amp; Services
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Add products/services with HSN/SAC</li>
            <li>Set GST rates and pricing</li>
            <li>Reuse items across invoices</li>
          </ul>
        </section>

        {/* Payments */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5" />
            </span>
            Payments &amp; Tracking
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Mark invoices as Paid / Pending / Partial</li>
            <li>Track outstanding payments</li>
            <li>Filter invoices by payment status</li>
          </ul>
        </section>

        {/* Reports */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </span>
            Reports &amp; Analytics
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Sales reports</li>
            <li>GST summaries</li>
            <li>Monthly & yearly sales</li>
            <li>Export reports as PDF / Excel</li>
          </ul>
        </section>

        {/* Settings */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5" />
            </span>
            Business Settings
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Business profile & GST details</li>
            <li>Invoice numbering & prefix</li>
            <li>Terms, notes & declarations</li>
          </ul>
        </section>

        {/* Security */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            Security &amp; Privacy
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Secure authentication</li>
            <li>Encrypted data storage</li>
            <li>Your data belongs to you</li>
          </ul>
        </section>

        {/* Support */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5" />
            </span>
            Support
          </h2>
          <p>
            Email: <strong>insideinvoice87@gmail.com</strong>
          </p>
          <p>Business Hours: Mon–Fri, 9 AM – 6 PM IST</p>
        </section>

        <footer className="border-t pt-6 text-sm text-slate-500">
          © {year} Inside Invoice by Gritx. All rights reserved.
        </footer>
      </div>
    </>
  );
}
