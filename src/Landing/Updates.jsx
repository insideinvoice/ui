import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import InvoiceNav from "./Navigation/InvoiceNav";

const updates = [
  {
    version: "2.3.0",
    date: "Sep 2026",
    changes: [
      "Added barcode & QR code generators",
      "Added GST calculator tool",
      "PWA install support",
      "Improved invoice analytics dashboard",
    ],
  },
  {
    version: "2.2.1",
    date: "Jul 2026",
    changes: [
      "Fixed invoice PDF alignment issues",
      "Improved mobile responsiveness",
      "Minor performance optimizations",
    ],
  },
  {
    version: "2.2.0",
    date: "Apr 2026",
    changes: [
      "Added refund & privacy policy pages",
      "Improved SEO meta tags",
      "Updated dashboard UI",
    ],
  },
  {
    version: "2.1.0",
    date: "Jan 2026",
    changes: [
      "Introduced GST reports",
      "Download invoices in PDF & Excel",
      "Improved invoice search",
    ],
  },
  {
    version: "2.0.0",
    date: "Sep 2025",
    changes: [
      "Major UI redesign",
      "Improved performance",
      "Better onboarding experience",
    ],
  },
  {
    version: "1.0.0",
    date: "Jul 2025",
    changes: [
      "Initial release",
      "Create & manage invoices",
      "Basic customer management",
    ],
  },
];

export default function Updates() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <InvoiceNav scrolled={true} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <span aria-hidden="true">←</span> Back to Home
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Product Updates</h1>
        <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">What's new in Inside Invoice</p>

        <div className="space-y-6 sm:space-y-8">
          {updates.map((update) => (
            <div
              key={update.version}
              className="border-l-4 border-slate-900 pl-4 sm:pl-6"
            >
              <h2 className="text-lg sm:text-xl font-semibold">
                v{update.version}
                <span className="text-sm text-gray-500 ml-2">
                  ({update.date})
                </span>
              </h2>

              <ul className="list-disc ml-5 mt-2 sm:mt-3 space-y-1 text-gray-700 text-sm sm:text-base">
                {update.changes.map((change, index) => (
                  <li key={index}>{change}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
