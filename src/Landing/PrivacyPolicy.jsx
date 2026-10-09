import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import InvoiceNav from "./Navigation/InvoiceNav";

export default function PrivacyPolicy() {
  const year = new Date().getFullYear();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <InvoiceNav scrolled={true} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 text-slate-700 leading-relaxed" style={{ paddingTop: "5rem" }}>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <span aria-hidden="true">←</span> Back to Home
        </Link>
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-6">
        Last Updated: October 3, 2026
      </p>

      <p className="mb-6">
        Welcome to <strong>Inside Invoice</strong> ("we", "our", or "us"), a
        product of <strong>2X+1</strong>. We are committed to protecting your
        privacy and ensuring the security of your personal information.
      </p>

      {/* 1 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        1. Information We Collect
      </h2>

      <h3 className="font-semibold mt-4">1.1 Personal Information</h3>
      <ul className="list-disc ml-6 mt-2">
        <li>Full name</li>
        <li>Email address</li>
        <li>Phone number</li>
        <li>Business name and details</li>
        <li>GST Identification Number (GSTIN)</li>
        <li>Business address</li>
        <li>Payment information (via secure third-party processors)</li>
      </ul>

      <h3 className="font-semibold mt-4">1.2 Business Data</h3>
      <ul className="list-disc ml-6 mt-2">
        <li>Invoice data</li>
        <li>Customer information</li>
        <li>Inventory data</li>
        <li>Transaction records</li>
        <li>Payment history</li>
        <li>Business analytics and reports</li>
      </ul>

      <h3 className="font-semibold mt-4">1.3 Technical Information</h3>
      <ul className="list-disc ml-6 mt-2">
        <li>IP address</li>
        <li>Browser and device details</li>
        <li>Operating system</li>
        <li>Login timestamps</li>
        <li>Cookies and tracking technologies</li>
      </ul>

      {/* 2 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        2. How We Use Your Information
      </h2>
      <ul className="list-disc ml-6">
        <li>Account creation and management</li>
        <li>Invoice generation and GST compliance</li>
        <li>Payment processing</li>
        <li>Customer support</li>
        <li>Product improvement and analytics</li>
        <li>Security and fraud prevention</li>
      </ul>

      {/* 3 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        3. Data Storage & Security
      </h2>
      <p>
        Your data is stored securely using industry-standard encryption, regular
        audits, access controls, and backup strategies.
      </p>

      {/* 4 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">4. Data Sharing</h2>
      <p className="mb-2">
        We <strong>do not sell</strong> your personal data.
      </p>
      <ul className="list-disc ml-6">
        <li>Cloud providers</li>
        <li>Payment processors (Razorpay, Stripe, PayPal)</li>
        <li>Analytics services</li>
      </ul>

      {/* Rights */}
      <h2 className="text-xl font-semibold mt-8 mb-2">5. Your Rights</h2>
      <ul className="list-disc ml-6">
        <li>Access and update your data</li>
        <li>Download your data</li>
        <li>Delete your account</li>
        <li>Opt-out of marketing</li>
      </ul>

      {/* Contact */}
      <h2 className="text-xl font-semibold mt-8 mb-2">Contact Information</h2>
      <p>
        Email:{" "}
        <a
          href="mailto:privacy@insideinvoice.com"
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
