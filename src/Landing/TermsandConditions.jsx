import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import InvoiceNav from "./Navigation/InvoiceNav";

export default function TermsandConditions() {
  const year = new Date().getFullYear();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <InvoiceNav scrolled={true} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 text-slate-700 leading-relaxed" style={{ paddingTop: "calc(5rem + env(safe-area-inset-top, 0px))" }}>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <span aria-hidden="true">←</span> Back to Home
        </Link>
      <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
      <p className="text-sm text-slate-500 mb-6">
        Last Updated: October 3, 2026
      </p>

      <p className="mb-6">
        Welcome to <strong>Inside Invoice</strong>, a product of{" "}
        <strong>2X+1</strong>. By accessing or using our GST billing and invoice
        management application, you agree to be bound by these Terms and
        Conditions (“Terms”).
      </p>

      {/* 1 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">1. Definitions</h2>
      <ul className="list-disc ml-6">
        <li>
          <strong>Service</strong>: Inside Invoice web application and services
        </li>
        <li>
          <strong>User</strong>: Any person or entity using the Service
        </li>
        <li>
          <strong>Account</strong>: Your registered Inside Invoice account
        </li>
        <li>
          <strong>Subscription</strong>: Your selected service plan
        </li>
      </ul>

      {/* 2 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        2. Eligibility & Account Registration
      </h2>
      <ul className="list-disc ml-6">
        <li>Must be at least 18 years old</li>
        <li>Must operate a legitimate business</li>
        <li>One account per business entity</li>
        <li>You are responsible for account security</li>
      </ul>

      {/* 3 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        3. Service Plans & Pricing
      </h2>
      <p>
        Inside Invoice offers free and paid subscription plans. Pricing, billing
        cycles, renewals, and refunds are governed by the plan selected at the
        time of purchase.
      </p>

      {/* 4 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        4. Acceptable Use Policy
      </h2>

      <h3 className="font-semibold mt-4">Permitted Use</h3>
      <ul className="list-disc ml-6">
        <li>Generate GST-compliant invoices</li>
        <li>Manage inventory and customers</li>
        <li>Track payments and reports</li>
      </ul>

      <h3 className="font-semibold mt-4">Prohibited Use</h3>
      <ul className="list-disc ml-6">
        <li>Illegal or fraudulent activities</li>
        <li>Uploading malicious software</li>
        <li>Attempting to hack or reverse engineer</li>
        <li>Reselling or sublicensing the Service</li>
      </ul>

      {/* 5 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        5. Intellectual Property
      </h2>
      <p>
        All trademarks, designs, software, and branding belong to{" "}
        <strong>2X+1</strong>. You retain ownership of your business data.
      </p>

      {/* 6 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">6. Data & Privacy</h2>
      <p>
        You own your data. We act as a data processor and protect your
        information using industry-standard security practices. Refer to our
        Privacy Policy for details.
      </p>

      {/* 7 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        7. Service Availability
      </h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted access.
        Features may be modified or discontinued at any time.
      </p>

      {/* 8 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        8. Limitation of Liability
      </h2>
      <p>
        The Service is provided <strong>“as is”</strong>. To the maximum extent
        permitted by law, our liability is limited to the amount paid by you in
        the last 12 months.
      </p>

      {/* 9 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">9. GST Compliance</h2>
      <p>
        You are responsible for GST filings and compliance. Inside Invoice
        provides tools but does not offer tax or legal advice.
      </p>

      {/* 10 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">10. Termination</h2>
      <ul className="list-disc ml-6">
        <li>You may cancel at any time</li>
        <li>We may suspend accounts for violations</li>
        <li>Outstanding fees remain payable</li>
      </ul>

      {/* 11 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        11. Governing Law & Disputes
      </h2>
      <p>
        These Terms are governed by Indian law. Disputes will be resolved
        through arbitration under the Arbitration and Conciliation Act, 1996.
      </p>

      {/* Contact */}
      <h2 className="text-xl font-semibold mt-8 mb-2">Contact Information</h2>
      <p>
        Email:{" "}
        <a
          href="mailto:insideinvoice87@gmail.com"
          className="text-blue-600 underline"
        >
          insideinvoice87@gmail.com
        </a>
      </p>

      <p className="mt-10 text-sm text-slate-500">
        © {year} Inside Invoice by 2X+1. All rights reserved.
      </p>
    </div>
    </div>
  );
}
