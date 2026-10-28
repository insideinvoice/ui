import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import InvoiceNav from "./Navigation/InvoiceNav";
import api from "../api/axios";
import { User, Mail, Phone, MessageSquare, Send, ArrowLeft } from "lucide-react";

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
       await api.post("/contact", {
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

   const inputBase =
     "w-full bg-white border rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 border-slate-200 hover:border-slate-300";

   return (
     <>
       <InvoiceNav
         scrolled={true}
         isMenuOpen={isMenuOpen}
         setIsMenuOpen={setIsMenuOpen}
       />
       <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 pt-24">
         <div className="max-w-xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
           <Link
             to="/"
             className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 font-medium mb-5 transition-colors"
           >
             <ArrowLeft className="w-4 h-4" aria-hidden="true" />
             Back to Home
           </Link>
           <h1
             className="text-2xl sm:text-3xl font-bold mb-2 text-slate-900 tracking-tight"
             style={{ fontFamily: "'Space Grotesk', sans-serif" }}
           >
             Contact Inside Invoice
           </h1>
           <p className="text-slate-500 mb-6 text-sm">
             Have a question or need help? Our team is always happy to assist you.
           </p>

           {submitted && (
             <div className="mb-5 p-4 bg-green-50 border border-green-200/80 rounded-lg">
               <h3 className="font-semibold text-green-800 mb-1 text-sm">
                 Thank you for contacting Inside Invoice
               </h3>
               <p className="text-[13px] text-green-700">
                 We've received your message and one of our team members will
                 surely get back to you shortly.
               </p>
             </div>
           )}

           {error && (
             <div className="mb-5 p-3.5 bg-red-50 border border-red-200/80 rounded-lg text-[13px] text-red-700">
               {error}
             </div>
           )}

           {/* Card header strip */}
           <div className="bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] rounded-2xl border border-slate-200/70 overflow-hidden">
             <div className="px-5 sm:px-7 py-4 border-b border-slate-100 bg-slate-50/60">
               <div className="flex items-center gap-2.5">
                 <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                   <Send className="w-4 h-4 text-white" aria-hidden="true" />
                 </div>
                 <div>
                   <p
                     className="text-sm font-semibold text-slate-900 leading-tight"
                     style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                   >
                     Send us a message
                   </p>
                   <p className="text-xs text-slate-500 mt-0.5">
                     We usually reply within one business day.
                   </p>
                 </div>
               </div>
             </div>

             <form onSubmit={handleSubmit} className="px-5 sm:px-7 py-5 space-y-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label
                     htmlFor="contact-name"
                     className="block text-[13px] font-medium mb-1.5 text-slate-700"
                   >
                     Full Name
                   </label>
                   <div className="relative">
                     <User
                       className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                       aria-hidden="true"
                     />
                     <input
                       id="contact-name"
                       type="text"
                       name="name"
                       required
                       autoComplete="name"
                       value={form.name}
                       onChange={handleChange}
                       placeholder="Enter your name"
                       className={inputBase}
                     />
                   </div>
                 </div>

                 <div>
                   <label
                     htmlFor="contact-phone"
                     className="block text-[13px] font-medium mb-1.5 text-slate-700"
                   >
                     Phone Number
                   </label>
                   <div className="relative">
                     <Phone
                       className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                       aria-hidden="true"
                     />
                     <input
                       id="contact-phone"
                       type="tel"
                       name="phone"
                       required
                       autoComplete="tel"
                       value={form.phone}
                       onChange={handleChange}
                       placeholder="Enter your phone number"
                       className={inputBase}
                     />
                   </div>
                 </div>
               </div>

               <div>
                 <label
                   htmlFor="contact-email"
                   className="block text-[13px] font-medium mb-1.5 text-slate-700"
                 >
                   Email Address
                 </label>
                 <div className="relative">
                   <Mail
                     className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                     aria-hidden="true"
                   />
                   <input
                     id="contact-email"
                     type="email"
                     name="email"
                     required
                     autoComplete="email"
                     value={form.email}
                     onChange={handleChange}
                     placeholder="Enter your email"
                     className={inputBase}
                   />
                 </div>
               </div>

               <div>
                 <label
                   htmlFor="contact-message"
                   className="block text-[13px] font-medium mb-1.5 text-slate-700"
                 >
                   Message
                 </label>
                 <div className="relative">
                   <MessageSquare
                     className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none"
                     aria-hidden="true"
                   />
                   <textarea
                     id="contact-message"
                     name="message"
                     required
                     value={form.message}
                     onChange={handleChange}
                     placeholder="Tell us how we can help you..."
                     rows="4"
                     className={`${inputBase} pl-9 resize-y min-h-[104px]`}
                   />
                 </div>
               </div>

               <button
                 type="submit"
                 disabled={submitting}
                 className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px] shadow-sm"
               >
                 <Send className="w-4 h-4" aria-hidden="true" />
                 {submitting ? "Sending..." : "Send Message"}
               </button>

               <p className="text-xs text-center text-slate-400">
                 Thank you for choosing Inside Invoice
               </p>
             </form>
           </div>
         </div>
       </div>
     </>
   );
 }
