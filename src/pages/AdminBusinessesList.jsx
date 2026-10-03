import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import { adminAPI } from "../api/auth";
import { ArrowLeft, Building2 } from "lucide-react";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";

export default function AdminBusinessesList() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getAllBusinesses()
      .then((res) => setBusinesses(res.data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Registered Businesses" />
        <p className="text-xs text-slate-500 -mt-4 mb-6">{businesses.length} total</p>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Spinner size={24} />
          </div>
        ) : businesses.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Business Name</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Owner</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Email</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Phone</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">GST</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Website</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Invoice Prefix</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Address</th>
                    <th className="text-left py-3 px-6 text-[10px] font-medium text-slate-500 uppercase whitespace-nowrap">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6 text-xs font-medium whitespace-nowrap">
                        <button onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}
                          className="text-slate-800 hover:text-indigo-600 hover:underline transition-colors text-left">
                          {b.businessName}
                        </button>
                      </td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.ownerName || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.email || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.phone || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.gstIn || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.website || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">{b.invoicePrefix || "-"}</td>
                      <td className="py-3 px-6 text-xs text-slate-600">{[b.addressLine1, b.addressLine2, b.city, b.state, b.pincode].filter(Boolean).join(", ") || "-"}</td>
                      <td className="py-3 px-6 text-xs whitespace-nowrap">
                        <button onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs">
                          View Invoices
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100">
              {businesses.map((b) => (
                <div key={b.id} className="p-4" onClick={() => navigate(`/admin/businesses/${b.id}/invoices`)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">{b.businessName}</span>
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/businesses/${b.id}/invoices`); }}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium min-h-[44px] flex items-center">
                      View Invoices
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Owner:</span> {b.ownerName || "-"}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Email:</span> {b.email || "-"}
                    </div>
                    <div className="min-h-[44px] flex items-center gap-1">
                      <span className="font-medium text-slate-600">Phone:</span> {b.phone || "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 text-center py-16">No businesses registered yet</p>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1 { font-family: 'Space Grotesk', sans-serif; }
      `}</style>
    </div>
  );
}
