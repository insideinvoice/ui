import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import InvoiceNav from "./Navigation/InvoiceNav";

export default function RefundPolicy() {
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
      <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
      <p className="text-sm text-slate-500 mb-6">
        Last Updated: October 3, 2026
      </p>

      <p className="mb-6">
        This Refund Policy explains our policies regarding refunds,
        cancellations, and billing for <strong>Inside Invoice</strong>, a
        product of <strong>2X+1</strong>.
      </p>

      {/* 1 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">1. Free Plan</h2>
      <ul className="list-disc ml-6">
        <li>No subscription charges</li>
        <li>No refunds applicable</li>
        <li>Account can be cancelled anytime</li>
        <li>Data retained for 90 days after cancellation</li>
      </ul>

      {/* 2 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        2. Paid Plans (Premium / Enterprise)
      </h2>

      <h3 className="font-semibold mt-4">Refund Eligibility</h3>
      <ul className="list-disc ml-6">
        <li>Requested within 7 days of first purchase</li>
        <li>Technical issues unresolved within 48 hours</li>
        <li>Service discontinuation</li>
      </ul>

      <h3 className="font-semibold mt-4">Not Eligible for Refund</h3>
      <ul className="list-disc ml-6">
        <li>More than 7 days since purchase</li>
        <li>Partial billing periods</li>
        <li>Account terminated for violations</li>
        <li>Subscription renewals or upgrades</li>
      </ul>

      {/* 3 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        3. 7-Day Money-Back Guarantee
      </h2>
      <p>
        First-time subscribers may request a full refund within 7 days of
        purchase. Requests must be submitted through the support portal and are
        reviewed within 2–3 business days.
      </p>

      {/* 4 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        4. Cancellation Policy
      </h2>
      <ul className="list-disc ml-6">
        <li>Cancel anytime via dashboard</li>
        <li>No refunds for partial periods</li>
        <li>Access remains until billing cycle ends</li>
        <li>Data retained for 90 days</li>
      </ul>

      {/* 5 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        5. Failed Payments & Suspensions
      </h2>
      <ul className="list-disc ml-6">
        <li>Payment retried up to 3 times</li>
        <li>Account may be suspended after failures</li>
        <li>No refunds for interruptions due to failed payments</li>
      </ul>

      {/* 6 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">6. Refund Processing</h2>
      <ul className="list-disc ml-6">
        <li>Reviewed within 2–3 business days</li>
        <li>Processed within 7–14 business days</li>
        <li>Refunded to original payment method only</li>
      </ul>

      {/* 7 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        7. Special Circumstances
      </h2>
      <p>
        Major service outages (24+ hours) may qualify for prorated credits.
        Billing errors and unauthorized charges are refunded after verification.
      </p>

      {/* 8 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">8. Chargebacks</h2>
      <p>
        Please contact support before initiating a chargeback. Chargebacks may
        result in immediate account termination and additional fees.
      </p>

      {/* 9 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">9. GST & Taxes</h2>
      <p>
        GST is charged as per Indian law and is non-refundable. Refunds apply
        only to the base subscription amount.
      </p>

      {/* 10 */}
      <h2 className="text-xl font-semibold mt-8 mb-2">
        10. Data Export & Retention
      </h2>
      <ul className="list-disc ml-6">
        <li>Export invoices, reports, and customer data before cancellation</li>
        <li>Data retained for 90 days post-cancellation</li>
        <li>Data may be permanently deleted after retention period</li>
      </ul>

      {/* Contact */}
      <h2 className="text-xl font-semibold mt-8 mb-2">Contact for Refunds</h2>
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
