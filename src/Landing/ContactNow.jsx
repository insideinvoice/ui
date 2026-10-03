import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import InvoiceNav from "./Navigation/InvoiceNav";
import axios from "axios";

 export default function ContactNow() {
   const [form, setForm] = useState({
     name: "",
     email: "",
     phone: "",
     message: "",
   });
   const [isMenuOpen, setIsMenuOpen] = useState(false);

   const [submitted, setSubmitted] = useState(false);
   const [submitting, setSubmitting] = useState(false);
   const [error, setError] = useState("");

   const handleChange = (e) => {
     setForm({ ...form, [e.target.name]: e.target.value });
   };

   const handleSubmit = async (e) => {
     e.preventDefault();
     setSubmitting(true);
     setError("");

      try {
        await axios.post("/contact", {
         name: form.name,
         email: form.email,
         phone: form.phone,
         message: form.message,
       });
       setSubmitted(true);
       setForm({ name: "", email: "", phone: "", message: "" });
     } catch (err) {
       setError(err.response?.data?.message || "Something went wrong. Please try again.");
     } finally {
       setSubmitting(false);
     }
   };

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
       <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 pt-24">
         <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
            <span aria-hidden="true">←</span> Back to Home
          </Link>
           <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Contact Inside Invoice</h1>
           <p className="text-slate-500 mb-6 sm:mb-8 text-sm sm:text-base">
             Have a question or need help? Our team is always happy to assist you.
           </p>

           {submitted && (
             <div className="mb-6 p-4 sm:p-6 bg-green-50 border border-green-200 rounded-xl">
               <h3 className="font-semibold text-green-800 mb-1">
                 Thank you for contacting Inside Invoice
               </h3>
               <p className="text-sm text-green-700">
                 We've received your message and one of our team members will
                 surely get back to you shortly.
               </p>
             </div>
           )}

           {error && (
             <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
               {error}
             </div>
           )}

          <form
            onSubmit={handleSubmit}
            className="bg-white shadow-sm rounded-xl p-4 sm:p-6 space-y-4 border border-slate-100"
          >
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700">Full Name</label>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Enter your name"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700">Email Address</label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700">Phone Number</label>
              <input
                type="tel"
                name="phone"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter your phone number"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700">Message</label>
              <textarea
                name="message"
                required
                value={form.message}
                onChange={handleChange}
                placeholder="Tell us how we can help you..."
                rows="4"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-slate-800 to-slate-700 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-slate-500/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 min-h-[48px] text-base"
            >
              {submitting ? "Sending..." : "Send Message"}
            </button>

            <p className="text-xs text-center text-slate-400 pt-1">
              Thank you for choosing Inside Invoice
            </p>
         </form>
        </div>
       </div>
     </>
   );
 }
