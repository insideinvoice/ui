import { Link } from "react-router-dom";
import React, { useState, useEffect } from "react";
import InvoiceNav from "../Navigation/InvoiceNav";

const GSTCalculator = () => {
  // Calculator State
  const [amount, setAmount] = useState(1000);
  const [taxRate, setTaxRate] = useState(18);
  const [isCustomRate, setIsCustomRate] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [calculationMode, setCalculationMode] = useState("exclusive"); // 'exclusive' or 'inclusive'
  const [userType, setUserType] = useState("Buyer");
  const year = new Date().getFullYear();

  // Results State
  const [results, setResults] = useState({
    netPrice: 0,
    grossPrice: 0,
    totalTax: 0,
    cgst: 0,
    sgst: 0,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Calculation Logic
  useEffect(() => {
    const price = parseFloat(amount) || 0;
    const rate = parseFloat(taxRate) || 0;

    let totalTax = 0;
    let net = 0;
    let gross = 0;

    if (calculationMode === "exclusive") {
      // Add GST to Net Price
      totalTax = (price * rate) / 100;
      net = price;
      gross = price + totalTax;
    } else {
      // Remove GST from Gross Price
      totalTax = price - price * (100 / (100 + rate));
      gross = price;
      net = price - totalTax;
    }

    setResults({
      netPrice: net,
      grossPrice: gross,
      totalTax: totalTax,
      cgst: totalTax / 2,
      sgst: totalTax / 2,
    });
  }, [amount, taxRate, calculationMode]);

  // Helper for currency formatting
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  // Simple Section Component - Made Lighter
  const ContentSection = ({ title, children }) => {
    return (
      <div className="mb-6 p-6 rounded-2xl bg-white border border-slate-50 hover:border-slate-100 hover:shadow-lg hover:shadow-slate-50/50 transition-all duration-300">
        <h3 className="text-lg font-bold text-slate-700 mb-2 font-heading">
          {title}
        </h3>
        <div className="text-slate-500 leading-relaxed text-sm">{children}</div>
      </div>
    );
  };

  return (
    <>
      <InvoiceNav
        scrolled={true}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />{" "}
      {/* Injecting Fonts */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
          .font-heading { font-family: 'Outfit', sans-serif; }
          .font-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        `}
      </style>
      {/* Background - Very light gray/slate tint */}
      <div className="min-h-screen bg-slate-50/50 font-body text-slate-600 py-12 px-4 mt-16">
        <div className="max-w-6xl mx-auto pt-24">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <span aria-hidden="true">←</span> Back to Home
        </Link>
          {/* --- CALCULATOR CARD --- */}
          {/* Removed heavy shadow, used distinct border and white bg */}
          <div className="bg-white rounded-[24px] shadow-xl shadow-slate-200/60 overflow-hidden mb-12 border border-slate-100">
            {/* Header - Centered and Clean */}
            <div className="p-8 text-center bg-white">
              <span className="inline-block py-1 px-3 rounded-full bg-slate-50 text-slate-500 text-[11px] font-bold tracking-wider uppercase mb-3">
                Free Tool
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800 font-heading">
                GST Calculator
              </h1>
              <p className="text-slate-400 mt-2 text-sm">
                Calculate GST for India instantly
              </p>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* LEFT SIDE: INPUTS */}
              <div className="p-8 lg:w-3/5 space-y-8">
                {/* User Type - Lighter Tabs */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    I am a
                  </label>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {["Buyer", "Manufacturer", "Wholesaler"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setUserType(type)}
                        className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                          userType === type
                            ? "bg-white text-slate-600 shadow-sm border border-slate-100"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tax Mode - Lighter Buttons */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Calculation Mode
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setCalculationMode("exclusive")}
                      className={`py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 border ${
                        calculationMode === "exclusive"
                          ? "border-slate-500 bg-slate-50 text-slate-600"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Excluding GST
                    </button>
                    <button
                      onClick={() => setCalculationMode("inclusive")}
                      className={`py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 border ${
                        calculationMode === "inclusive"
                          ? "border-slate-500 bg-slate-50 text-slate-600"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Including GST
                    </button>
                  </div>
                </div>

                {/* Amount - Cleaner Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    {calculationMode === "exclusive"
                      ? "Net Price"
                      : "Gross Price"}
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-lg font-medium">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-2xl text-slate-700 focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* GST Rate - Softer Buttons */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    GST Rate
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {[5, 12, 18, 28].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setTaxRate(rate);
                          setIsCustomRate(false);
                        }}
                        className={`flex-1 py-3 rounded-xl font-semibold text-sm border transition-all duration-200 ${
                          taxRate === rate && !isCustomRate
                            ? "border-slate-500 bg-slate-500 text-white shadow-md shadow-slate-500/20"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-200 hover:text-slate-500"
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                    <div className="relative w-20">
                      <input
                        type="number"
                        placeholder="%"
                        value={isCustomRate ? taxRate : ""}
                        onClick={() => setIsCustomRate(true)}
                        onChange={(e) => {
                          setTaxRate(e.target.value);
                          setIsCustomRate(true);
                        }}
                        className={`w-full h-full px-2 rounded-xl border text-center font-bold text-sm outline-none transition-all ${
                          isCustomRate
                            ? "border-slate-500 text-slate-600 bg-slate-50"
                            : "border-slate-200 text-slate-500 bg-white focus:border-slate-300"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: RESULTS - LIGHT THEME */}
              {/* Changed from dark slate/black to soft gray/slate gradient */}
              <div className="bg-slate-50 border-l border-slate-100 p-8 lg:w-2/5 flex flex-col justify-center relative">
                <div className="space-y-6">
                  {/* Top Result */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">
                      Total Tax Amount
                    </p>
                    <p className="text-2xl font-bold text-red-500 font-heading">
                      {formatCurrency(results.totalTax)}
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">
                          CGST ({parseFloat(taxRate / 2)}%)
                        </span>
                        <span className="font-medium text-slate-700">
                          {formatCurrency(results.cgst)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">
                          SGST ({parseFloat(taxRate / 2)}%)
                        </span>
                        <span className="font-medium text-slate-700">
                          {formatCurrency(results.sgst)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Final Result */}
                  <div className="bg-slate-600 p-6 rounded-2xl shadow-lg shadow-slate-500/20 text-white relative overflow-hidden">
                    {/* Soft glow effect */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

                    <p className="text-slate-100 text-xs uppercase tracking-wider font-semibold mb-2 relative z-10">
                      Total Payable Amount
                    </p>
                    <p className="text-4xl font-bold font-heading relative z-10">
                      {formatCurrency(results.grossPrice)}
                    </p>
                    <p className="text-slate-200 text-xs mt-2 relative z-10">
                      {calculationMode === "exclusive"
                        ? "Base Amount + Tax"
                        : "Includes all taxes"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* --- CONTENT SECTION (Light & Clean) --- */}
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Main Article */}
            <div className="lg:col-span-8 bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
              <section className="mb-10">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 font-heading">
                  What is GST?
                </h2>
                <p className="text-slate-500 mb-6 leading-relaxed font-light">
                  GST (Goods and Services Tax) is an indirect tax used in India
                  on the supply of goods and services. It is a comprehensive,
                  multistage, destination-based tax.
                </p>

                {/* Lighter Info Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                    <div className="bg-white p-2 rounded-full shadow-sm text-slate-500">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 text-sm">
                        One Nation, One Tax
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Replaced multiple indirect taxes like VAT, excise duty,
                        etc.
                      </p>
                    </div>
                  </div>
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                    <div className="bg-white p-2 rounded-full shadow-sm text-emerald-500">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-700 text-sm">
                        Easy Compliance
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Online registration and return filing has made it
                        easier.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 font-heading">
                  GST Rate Slabs
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    {
                      rate: "5%",
                      desc: "Household necessities",
                      color:
                        "bg-emerald-50 text-emerald-700 border-emerald-100",
                    },
                    {
                      rate: "12%",
                      desc: "Computers, Processed food",
                      color: "bg-slate-50 text-slate-700 border-slate-100",
                    },
                    {
                      rate: "18%",
                      desc: "Hair oil, soaps, toothpaste",
                      color: "bg-indigo-50 text-indigo-700 border-indigo-100",
                    },
                    {
                      rate: "28%",
                      desc: "Luxury items, automobiles",
                      color: "bg-rose-50 text-rose-700 border-rose-100",
                    },
                  ].map((slab, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border ${slab.color}`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-heading">
                          {slab.rate}
                        </span>
                      </div>
                      <p className="text-xs opacity-80 mt-1">{slab.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-slate-800 mb-4 font-heading">
                  Calculation Formulas
                </h2>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                        To Add GST
                      </h5>
                      <p className="font-mono text-sm text-slate-600 bg-white p-3 rounded border border-slate-200">
                        GST Amount = (Original Cost * GST%) / 100
                        <br />
                        Net Price = Original Cost + GST Amount
                      </p>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                        To Remove GST
                      </h5>
                      <p className="font-mono text-sm text-slate-600 bg-white p-3 rounded border border-slate-200">
                        GST Amount = Original Cost - [Original Cost *{" "}
                        {`{100 / (100 + GST%)}`}]
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Sidebar / FAQ - Minimalist */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm sticky top-8">
                <h3 className="text-lg font-bold text-slate-800 mb-4 font-heading">
                  Frequently Asked Questions
                </h3>
                <div className="divide-y divide-slate-100">
                  {[
                    {
                      q: "Who needs to pay GST?",
                      a: "Businesses with turnover exceeding Rs. 40 lakhs (Rs. 10 lakhs for NE states) must register.",
                    },
                    {
                      q: "What is ITC?",
                      a: "Input Tax Credit means claiming the credit of the GST paid on purchase of Goods and Services.",
                    },
                  ].map((faq, index) => (
                    <details key={index} className="group py-4">
                      <summary className="flex justify-between items-center font-medium text-slate-700 cursor-pointer list-none text-sm hover:text-slate-600">
                        <span>{faq.q}</span>
                        <span className="text-slate-400 transition-transform group-open:rotate-180">
                          <svg
                            fill="none"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 9l-7 7-7-7"
                            ></path>
                          </svg>
                        </span>
                      </summary>
                      <div className="text-slate-500 text-xs leading-relaxed mt-2 pl-2 border-l-2 border-slate-100">
                        {faq.a}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-16 border-t border-slate-200 pt-8 pb-4 text-center">
            <p className="text-slate-400 text-xs font-medium">
              © {year} Inside Invoice by 2X+1. All rights reserved.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default GSTCalculator;
