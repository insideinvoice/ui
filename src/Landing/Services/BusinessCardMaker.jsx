import { Link } from "react-router-dom";
import React, { useState, useRef, useEffect } from "react";
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  Upload,
  Download,
  Check,
  Sparkles,
  Zap,
  Briefcase,
} from "lucide-react";
import { toPng, toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import InvoiceNav from "../Navigation/InvoiceNav";

// Template configurations — module scope so the 1100-line array is built
// once instead of on every keystroke/ re-render of the page.
  const TEMPLATES = [
    {
      id: 1,
      name: "Navy Executive",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 flex flex-col justify-between overflow-hidden">
          <div className="overflow-hidden">
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-8 mb-2 object-contain brightness-0 invert"
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
            <h2 className="text-xl font-bold leading-tight break-words line-clamp-2">
              {data.businessName}
            </h2>
          </div>
          <div className="space-y-1 text-xs text-blue-100">
            {data.phone1 && (
              <div className="flex items-center gap-2">
                <Phone size={12} className="shrink-0" />
                <span className="truncate">{data.phone1}</span>
              </div>
            )}
            {data.email && (
              <div className="flex items-start gap-2">
                <Mail size={12} className="shrink-0 mt-0.5" />
                <span className="break-all leading-tight line-clamp-2">
                  {data.email}
                </span>
              </div>
            )}
            {data.website && (
              <div className="flex items-start gap-2">
                <Globe size={12} className="shrink-0 mt-0.5" />
                <span className="break-all leading-tight line-clamp-1">
                  {data.website}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 2,
      name: "Mint Fresh",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-tr from-emerald-400 to-teal-500 p-5 flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-white mb-1 leading-tight break-words line-clamp-2">
                {data.businessName}
              </h2>
              <div className="w-16 h-1 bg-white rounded-full"></div>
            </div>
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-10 object-contain shrink-0"
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
          </div>
          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-3 space-y-1 text-xs text-white font-medium">
            {data.phone1 && <div className="truncate">{data.phone1}</div>}
            {data.email && (
              <div className="break-all leading-tight line-clamp-2">
                {data.email}
              </div>
            )}
            {data.website && (
              <div className="break-all leading-tight line-clamp-1">
                {data.website}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 3,
      name: "Sunset Glow",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 p-6 overflow-hidden">
          <div className="bg-white h-full rounded-xl p-4 flex flex-col justify-between shadow-2xl">
            <div className="text-center overflow-hidden">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-10 mx-auto mb-2 object-contain"
                />
              )}
              <h2 className="text-xl font-extrabold bg-gradient-to-r from-orange-500 to-purple-600 bg-clip-text text-transparent break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs text-gray-700 text-center">
              {data.phone1 && <div className="truncate">{data.phone1}</div>}
              {data.email && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.email}
                </div>
              )}
              {data.website && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.website}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      name: "Royal Purple",
      component: (data) => (
        <div className="w-full h-full bg-purple-600 flex overflow-hidden">
          <div className="w-3/5 p-5 flex flex-col justify-between text-white">
            <div className="overflow-hidden">
              <h2 className="text-xl font-bold mb-2 break-words leading-tight line-clamp-3">
                {data.businessName}
              </h2>
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-6 object-contain brightness-0 invert"
                />
              )}
            </div>
            <div className="space-y-1 text-xs">
              {data.phone1 && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="shrink-0" />
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-2">
                  <Mail size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-2">
                    {data.email}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="w-2/5 bg-purple-800 p-5 flex items-center justify-center">
            <Sparkles size={48} className="text-purple-300" />
          </div>
        </div>
      ),
    },
    {
      id: 5,
      name: "Coral Wave",
      component: (data) => (
        <div className="w-full h-full bg-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div
              className="absolute w-48 h-48 rounded-full opacity-20 bg-red-400"
              style={{ top: "-80px", left: "-80px" }}
            ></div>
            <div
              className="absolute w-56 h-56 rounded-full opacity-20 bg-red-500"
              style={{ bottom: "-80px", right: "-80px" }}
            ></div>
          </div>
          <div className="relative p-5 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start gap-2">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-8 object-contain shrink-0"
                />
              )}
              <h2 className="text-xl font-bold text-right text-red-500 break-words leading-tight line-clamp-2 flex-1">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs text-red-600">
              {data.phone1 && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="shrink-0" />
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-2">
                  <Mail size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-2">
                    {data.email}
                  </span>
                </div>
              )}
              {data.website && (
                <div className="flex items-start gap-2">
                  <Globe size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.website}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 6,
      name: "Tech Blue",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 p-1 overflow-hidden">
          <div className="bg-slate-900 h-full p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={20} className="text-cyan-400 shrink-0" />
                {data.logo && (
                  <img
                    src={data.logo}
                    alt="Logo"
                    className="h-6 object-contain brightness-0 invert"
                  />
                )}
              </div>
              <h2 className="text-xl font-black text-white tracking-tight leading-tight break-words line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs text-cyan-100 font-mono">
              {data.phone1 && <div className="truncate">// {data.phone1}</div>}
              {data.email && (
                <div className="break-all leading-tight line-clamp-1">
                  // {data.email}
                </div>
              )}
              {data.website && (
                <div className="break-all leading-tight line-clamp-1">
                  // {data.website}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 7,
      name: "Golden Luxury",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-br from-yellow-50 to-amber-100 p-5 overflow-hidden">
          <div className="border-4 border-yellow-600 h-full p-4 flex flex-col justify-between relative">
            <div className="absolute top-2 right-2 w-12 h-12 border-2 border-yellow-600 transform rotate-45"></div>
            <div className="text-center relative z-10 overflow-hidden">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-10 mx-auto mb-2 object-contain"
                />
              )}
              <h2 className="text-xl font-bold text-yellow-900 break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs text-yellow-800 text-center relative z-10">
              {data.phone1 && <div className="truncate">{data.phone1}</div>}
              {data.email && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.email}
                </div>
              )}
              {data.website && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.website}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 8,
      name: "Forest Green",
      component: (data) => (
        <div className="w-full h-full bg-green-800 text-white p-5 flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-tight break-words line-clamp-2">
                {data.businessName}
              </h2>
              <div className="flex gap-1 mt-2">
                <div className="w-8 h-1 bg-green-400"></div>
                <div className="w-8 h-1 bg-green-300"></div>
                <div className="w-8 h-1 bg-green-200"></div>
              </div>
            </div>
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-10 object-contain brightness-0 invert shrink-0"
              />
            )}
          </div>
          <div className="bg-green-900 bg-opacity-50 rounded-lg p-2 space-y-1 text-xs">
            {data.phone1 && (
              <div className="flex items-center gap-2">
                <Phone size={12} className="text-green-300 shrink-0" />
                <span className="truncate">{data.phone1}</span>
              </div>
            )}
            {data.email && (
              <div className="flex items-start gap-2">
                <Mail size={12} className="text-green-300 shrink-0 mt-0.5" />
                <span className="break-all leading-tight line-clamp-1">
                  {data.email}
                </span>
              </div>
            )}
            {data.website && (
              <div className="flex items-start gap-2">
                <Globe size={12} className="text-green-300 shrink-0 mt-0.5" />
                <span className="break-all leading-tight line-clamp-1">
                  {data.website}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 9,
      name: "Rose Pink",
      component: (data) => (
        <div className="w-full h-full bg-white flex overflow-hidden">
          <div className="w-1/3 bg-gradient-to-b from-pink-400 to-rose-500 flex items-center justify-center">
            {data.logo ? (
              <img
                src={data.logo}
                alt="Logo"
                className="h-14 object-contain p-2"
              />
            ) : (
              <div className="w-16 h-16 bg-white bg-opacity-30 rounded-full"></div>
            )}
          </div>
          <div className="flex-1 p-4 flex flex-col justify-between bg-gradient-to-br from-pink-50 to-white">
            <div className="overflow-hidden">
              <h2 className="text-xl font-bold text-rose-600 break-words leading-tight line-clamp-3">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs text-rose-700">
              {data.phone1 && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="shrink-0" />
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-2">
                  <Mail size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-2">
                    {data.email}
                  </span>
                </div>
              )}
              {data.website && (
                <div className="flex items-start gap-2">
                  <Globe size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.website}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 10,
      name: "Crimson Bold",
      component: (data) => (
        <div className="w-full h-full bg-red-600 p-5 overflow-hidden">
          <div className="border-4 border-white h-full p-3 flex flex-col justify-between text-white">
            <div className="text-center overflow-hidden">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-8 mx-auto mb-2 object-contain brightness-0 invert"
                />
              )}
              <h2 className="text-xl font-black uppercase tracking-widest break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="text-center space-y-1 text-xs font-bold">
              {data.phone1 && <div className="truncate">{data.phone1}</div>}
              {data.email && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.email}
                </div>
              )}
              {data.website && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.website}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 11,
      name: "Ocean Breeze",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-tr from-blue-400 via-cyan-300 to-teal-400 p-5 flex items-center justify-center overflow-hidden">
          <div className="bg-white bg-opacity-90 backdrop-blur-md rounded-2xl p-5 w-full h-full flex flex-col justify-between shadow-xl">
            <div className="overflow-hidden">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-8 mb-2 object-contain"
                />
              )}
              <h2 className="text-xl font-bold text-cyan-700 break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs text-cyan-900">
              {data.phone1 && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="shrink-0" />
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-2">
                  <Mail size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-2">
                    {data.email}
                  </span>
                </div>
              )}
              {data.website && (
                <div className="flex items-start gap-2">
                  <Globe size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.website}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 12,
      name: "Midnight Black",
      component: (data) => (
        <div className="w-full h-full bg-black text-white p-5 flex flex-col justify-between overflow-hidden">
          <div className="overflow-hidden">
            <h2 className="text-2xl font-thin tracking-widest mb-2 break-words leading-tight line-clamp-2">
              {data.businessName}
            </h2>
            <div className="w-full h-px bg-gradient-to-r from-white via-gray-500 to-transparent"></div>
          </div>
          <div className="flex justify-between items-end gap-2">
            <div className="space-y-1 text-[10px] text-gray-400 flex-1 min-w-0">
              {data.phone1 && <div className="truncate">T: {data.phone1}</div>}
              {data.email && (
                <div className="break-all leading-tight line-clamp-1">
                  E: {data.email}
                </div>
              )}
              {data.website && (
                <div className="break-all leading-tight line-clamp-1">
                  W: {data.website}
                </div>
              )}
            </div>
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-10 object-contain brightness-0 invert shrink-0"
              />
            )}
          </div>
        </div>
      ),
    },
    {
      id: 13,
      name: "Lavender Dreams",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-br from-purple-200 via-pink-200 to-purple-300 p-5 flex flex-col justify-between overflow-hidden">
          <div className="text-center overflow-hidden">
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-10 mx-auto mb-2 object-contain"
              />
            )}
            <h2 className="text-2xl font-light text-purple-800 break-words leading-tight line-clamp-2">
              {data.businessName}
            </h2>
            <div className="flex justify-center gap-2 mt-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            </div>
          </div>
          <div className="text-center space-y-1 text-xs text-purple-700">
            {data.phone1 && <div className="truncate">{data.phone1}</div>}
            {data.email && (
              <div className="break-all leading-tight line-clamp-1">
                {data.email}
              </div>
            )}
            {data.website && (
              <div className="break-all leading-tight line-clamp-1">
                {data.website}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 14,
      name: "Neon Cyber",
      component: (data) => (
        <div className="w-full h-full bg-gray-900 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-5 left-5 w-32 h-32 border-2 border-cyan-400 rounded-full"></div>
            <div className="absolute bottom-5 right-5 w-24 h-24 border-2 border-pink-400 rounded-full"></div>
          </div>
          <div className="relative flex flex-col justify-between h-full">
            <div className="overflow-hidden">
              <h2 className="text-xl font-black text-transparent bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-6 mt-2 object-contain brightness-0 invert"
                />
              )}
            </div>
            <div className="space-y-1 text-xs text-cyan-300 font-mono">
              {data.phone1 && (
                <div className="flex items-center gap-2">
                  <span className="text-pink-400 shrink-0">►</span>
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-2">
                  <span className="text-pink-400 shrink-0 mt-0.5">►</span>
                  <span className="break-all leading-tight line-clamp-1">
                    {data.email}
                  </span>
                </div>
              )}
              {data.website && (
                <div className="flex items-start gap-2">
                  <span className="text-pink-400 shrink-0 mt-0.5">►</span>
                  <span className="break-all leading-tight line-clamp-1">
                    {data.website}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 15,
      name: "Tangerine Pop",
      component: (data) => (
        <div className="w-full h-full bg-white p-5 overflow-hidden">
          <div className="h-full border-l-8 border-orange-500 pl-4 flex flex-col justify-between">
            <div className="overflow-hidden">
              <div className="flex items-center gap-3 mb-2">
                {data.logo && (
                  <img
                    src={data.logo}
                    alt="Logo"
                    className="h-8 object-contain"
                  />
                )}
                <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0"></div>
              </div>
              <h2 className="text-xl font-extrabold text-orange-600 break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 space-y-1 text-xs text-orange-800">
              {data.phone1 && (
                <div className="flex items-center gap-2 font-semibold">
                  <Phone size={12} className="shrink-0" />
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-2 font-semibold">
                  <Mail size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.email}
                  </span>
                </div>
              )}
              {data.website && (
                <div className="flex items-start gap-2 font-semibold">
                  <Globe size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.website}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 16,
      name: "Slate Professional",
      component: (data) => (
        <div className="w-full h-full bg-slate-700 p-5 flex flex-col justify-between text-white overflow-hidden">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold mb-1 break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
              <div className="w-16 h-0.5 bg-slate-400"></div>
            </div>
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-8 object-contain brightness-0 invert shrink-0"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {data.phone1 && (
              <div className="bg-slate-600 p-1.5 rounded">
                <Phone size={10} className="mb-1 block" />
                <span className="truncate block">{data.phone1}</span>
              </div>
            )}
            {data.email && (
              <div className="bg-slate-600 p-1.5 rounded">
                <Mail size={10} className="mb-1 block" />
                <span className="break-all leading-tight line-clamp-1">
                  {data.email}
                </span>
              </div>
            )}
            {data.website && (
              <div className="bg-slate-600 p-1.5 rounded col-span-2">
                <Globe size={10} className="mb-1 block" />
                <span className="break-all leading-tight line-clamp-1">
                  {data.website}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 17,
      name: "Indigo Wave",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 relative overflow-hidden">
          <div
            className="absolute bottom-0 left-0 w-full h-24 bg-white bg-opacity-10 backdrop-blur-sm pointer-events-none"
            style={{ clipPath: "polygon(0 40%, 100% 0, 100% 100%, 0 100%)" }}
          ></div>
          <div className="relative p-5 flex flex-col justify-between h-full text-white">
            <div className="flex justify-between items-start gap-2">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-8 object-contain brightness-0 invert shrink-0"
                />
              )}
              <h2 className="text-lg font-bold text-right break-words leading-tight line-clamp-2 flex-1">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs">
              {data.phone1 && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="shrink-0" />
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-2">
                  <Mail size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.email}
                  </span>
                </div>
              )}
              {data.website && (
                <div className="flex items-start gap-2">
                  <Globe size={12} className="shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.website}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 18,
      name: "Lime Energy",
      component: (data) => (
        <div className="w-full h-full bg-lime-400 p-1 overflow-hidden">
          <div className="bg-white h-full p-4 flex flex-col justify-between">
            <div>
              <div className="bg-lime-400 inline-block px-3 py-1 rounded-full mb-2">
                {data.logo && (
                  <img
                    src={data.logo}
                    alt="Logo"
                    className="h-5 object-contain"
                  />
                )}
              </div>
              <h2 className="text-xl font-black text-lime-600 break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs text-gray-800 font-bold">
              {data.phone1 && (
                <div className="bg-lime-100 p-1.5 rounded flex items-center gap-2">
                  <Phone size={12} className="text-lime-600 shrink-0" />
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="bg-lime-100 p-1.5 rounded flex items-start gap-2">
                  <Mail size={12} className="text-lime-600 shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.email}
                  </span>
                </div>
              )}
              {data.website && (
                <div className="bg-lime-100 p-1.5 rounded flex items-start gap-2">
                  <Globe size={12} className="text-lime-600 shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.website}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 19,
      name: "Burgundy Classic",
      component: (data) => (
        <div className="w-full h-full bg-white p-5 overflow-hidden">
          <div className="border-4 border-red-900 h-full p-4 flex flex-col justify-between">
            <div className="text-center overflow-hidden">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-10 mx-auto mb-2 object-contain"
                />
              )}
              <h2 className="text-xl font-bold text-red-900 break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
              <div className="flex justify-center gap-1 mt-2">
                <div className="w-2 h-2 bg-red-900 transform rotate-45"></div>
                <div className="w-2 h-2 bg-red-900 transform rotate-45"></div>
                <div className="w-2 h-2 bg-red-900 transform rotate-45"></div>
              </div>
            </div>
            <div className="text-center space-y-1 text-xs text-red-900">
              {data.phone1 && <div className="truncate">{data.phone1}</div>}
              {data.email && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.email}
                </div>
              )}
              {data.website && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.website}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 20,
      name: "Turquoise Modern",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-r from-teal-500 to-cyan-500 flex overflow-hidden">
          <div className="w-2/3 bg-white p-5 flex flex-col justify-between">
            <div className="overflow-hidden">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-8 mb-2 object-contain"
                />
              )}
              <h2 className="text-xl font-bold text-teal-600 break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="space-y-1 text-xs text-gray-700">
              {data.phone1 && (
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-teal-500 shrink-0" />
                  <span className="truncate">{data.phone1}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-start gap-2">
                  <Mail size={12} className="text-teal-500 shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.email}
                  </span>
                </div>
              )}
              {data.website && (
                <div className="flex items-start gap-2">
                  <Globe size={12} className="text-teal-500 shrink-0 mt-0.5" />
                  <span className="break-all leading-tight line-clamp-1">
                    {data.website}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="w-1/3 flex items-center justify-center bg-transparent">
            <Briefcase size={48} className="text-white" />
          </div>
        </div>
      ),
    },
    {
      id: 21,
      name: "Charcoal Minimal",
      component: (data) => (
        <div className="w-full h-full bg-gray-800 text-white p-5 flex flex-col justify-between overflow-hidden">
          <div className="overflow-hidden">
            <h2 className="text-xl font-light tracking-wide mb-2 break-words leading-tight line-clamp-2">
              {data.businessName}
            </h2>
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-6 object-contain brightness-0 invert opacity-80"
              />
            )}
          </div>
          <div className="border-t border-gray-600 pt-2 space-y-1 text-xs text-gray-300">
            {data.phone1 && <div className="truncate">{data.phone1}</div>}
            {data.email && (
              <div className="break-all leading-tight line-clamp-1">
                {data.email}
              </div>
            )}
            {data.website && (
              <div className="break-all leading-tight line-clamp-1">
                {data.website}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 22,
      name: "Peach Soft",
      component: (data) => (
        <div className="w-full h-full bg-gradient-to-br from-orange-100 to-pink-100 p-5 flex flex-col justify-between overflow-hidden">
          <div className="text-center overflow-hidden">
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-10 mx-auto mb-2 object-contain"
              />
            )}
            <h2 className="text-xl font-semibold text-orange-600 break-words leading-tight line-clamp-2">
              {data.businessName}
            </h2>
          </div>
          <div className="bg-white bg-opacity-60 backdrop-blur-sm rounded-xl p-3 space-y-1 text-xs text-center text-orange-600">
            {data.phone1 && (
              <div className="font-medium truncate">{data.phone1}</div>
            )}
            {data.email && (
              <div className="font-medium break-all leading-tight line-clamp-1">
                {data.email}
              </div>
            )}
            {data.website && (
              <div className="font-medium break-all leading-tight line-clamp-1">
                {data.website}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 23,
      name: "Aqua Fresh",
      component: (data) => (
        <div className="w-full h-full bg-cyan-50 p-5 border-4 border-cyan-400 overflow-hidden">
          <div className="h-full flex flex-col justify-between">
            <div className="text-center overflow-hidden">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-8 mx-auto mb-2 object-contain"
                />
              )}
              <h2 className="text-xl font-bold text-cyan-700 break-words leading-tight line-clamp-2">
                {data.businessName}
              </h2>
            </div>
            <div className="text-center space-y-1 text-xs text-cyan-800">
              {data.phone1 && <div className="truncate">{data.phone1}</div>}
              {data.email && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.email}
                </div>
              )}
              {data.website && (
                <div className="break-all leading-tight line-clamp-1">
                  {data.website}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 24,
      name: "Bold Identity",
      component: (data) => (
        <div className="w-full h-full bg-gray-900 text-white p-5 flex flex-col justify-between overflow-hidden">
          <div className="flex justify-between items-start gap-2">
            <h2 className="text-xl font-bold break-words leading-tight line-clamp-2 flex-1 min-w-0">
              {data.businessName}
            </h2>
            {data.logo && (
              <img
                src={data.logo}
                alt="Logo"
                className="h-8 object-contain brightness-0 invert shrink-0"
              />
            )}
          </div>
          <div className="bg-white text-gray-900 p-3 rounded space-y-1 text-xs">
            {data.phone1 && (
              <div className="flex items-center gap-2">
                <Phone size={12} className="shrink-0" />
                <span className="truncate">{data.phone1}</span>
              </div>
            )}
            {data.email && (
              <div className="flex items-start gap-2">
                <Mail size={12} className="shrink-0 mt-0.5" />
                <span className="break-all leading-tight line-clamp-1">
                  {data.email}
                </span>
              </div>
            )}
            {data.website && (
              <div className="flex items-start gap-2">
                <Globe size={12} className="shrink-0 mt-0.5" />
                <span className="break-all leading-tight line-clamp-1">
                  {data.website}
                </span>
              </div>
            )}
            {data.address && (
              <div className="flex items-start gap-2">
                <MapPin size={12} className="shrink-0 mt-0.5" />
                <span className="break-words leading-tight line-clamp-2">
                  {data.address}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 25,
      name: "Professional Edge",
      component: (data) => (
        <div className="w-full h-full bg-white overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-gray-400 via-gray-600 to-gray-800"></div>
          <div
            className="p-5 flex flex-col justify-between"
            style={{ height: "calc(100% - 4px)" }}
          >
            <div className="flex justify-between items-start gap-2">
              {data.logo && (
                <img
                  src={data.logo}
                  alt="Logo"
                  className="h-10 object-contain shrink-0"
                />
              )}
              <div className="text-right flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 break-words leading-tight line-clamp-2">
                  {data.businessName}
                </h2>
              </div>
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex gap-4">
                <div className="space-y-1 min-w-0">
                  {data.phone1 && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="shrink-0" />
                      <span className="truncate">{data.phone1}</span>
                    </div>
                  )}
                  {data.phone2 && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="shrink-0" />
                      <span className="truncate">{data.phone2}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  {data.email && (
                    <div className="flex items-start gap-2">
                      <Mail size={12} className="shrink-0 mt-0.5" />
                      <span className="break-all leading-tight line-clamp-1">
                        {data.email}
                      </span>
                    </div>
                  )}
                  {data.website && (
                    <div className="flex items-start gap-2">
                      <Globe size={12} className="shrink-0 mt-0.5" />
                      <span className="break-all leading-tight line-clamp-1">
                        {data.website}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {data.address && (
                <div className="flex items-start gap-2 pt-1">
                  <MapPin size={12} className="shrink-0 mt-0.5" />
                  <span className="text-[10px] leading-tight break-words line-clamp-2">
                    {data.address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
  ];

const BusinessCardMaker = () => {
  const [formData, setFormData] = useState({
    businessName: "",
    phone1: "",
    phone2: "",
    email: "",
    website: "",
    address: "",
    logo: null,
  });

  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const cardRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle logo upload
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        setFormData((prev) => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate business card
  const handleGenerate = () => {
    if (
      !formData.businessName ||
      !formData.phone1 ||
      !formData.email ||
      !formData.address
    ) {
      alert("Please fill in all required fields");
      return;
    }
    setShowTemplates(true);
    if (!selectedTemplate) {
      setSelectedTemplate(TEMPLATES[0]);
    }
  };

  // Download as PNG
  const downloadPNG = async () => {
    if (cardRef.current) {
      try {
        const dataUrl = await toPng(cardRef.current, {
          quality: 1,
          pixelRatio: 3,
          width: 1050,
          height: 600,
        });
        const link = document.createElement("a");
        link.download = `${formData.businessName}-business-card.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("PNG download failed:", err);
      }
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  // Download as JPG
  const downloadJPG = async () => {
    if (cardRef.current) {
      try {
        const dataUrl = await toJpeg(cardRef.current, {
          quality: 1,
          pixelRatio: 3,
          width: 1050,
          height: 600,
        });
        const link = document.createElement("a");
        link.download = `${formData.businessName}-business-card.jpg`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("JPG download failed:", err);
      }
    }
  };

  // Download as PDF
  const downloadPDF = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        width: 1050,
        height: 600,
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [90, 50], // standard business card
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, 90, 50);
      pdf.save(`${formData.businessName}-business-card.pdf`);
    } catch (err) {
      console.error("PDF download failed:", err);
    }
  };

  return (
    <>
      <InvoiceNav
        scrolled={true}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />
      <div className="min-h-screen bg-gray-100 p-3 sm:p-6 mt-20">
        <div className="max-w-7xl mx-auto pt-24">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
          <span aria-hidden="true">←</span> Back to Home
        </Link>
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Business Card Maker
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Create professional business cards in seconds
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Form Section */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                Business Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="Enter business name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone 1 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone1"
                      value={formData.phone1}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone 2
                    </label>
                    <input
                      type="tel"
                      name="phone2"
                      value={formData.phone2}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm sm:text-base"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="contact@business.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="www.business.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="123 Business St, City, State 12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Logo
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-100 text-sm sm:text-base">
                      <Upload size={18} />
                      <span className="text-sm">Upload Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-12 object-contain border border-gray-200 rounded p-1"
                      />
                    )}
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  className="w-full bg-gray-900 text-white py-3 rounded-md hover:bg-gray-800 transition font-medium text-sm sm:text-base"
                >
                  Generate Business Card
                </button>
              </div>
            </div>

            {/* Preview Section */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                Preview
              </h2>

              {selectedTemplate ? (
                <div className="space-y-4">
                  <div
                    ref={cardRef}
                    className="mx-auto border-2 border-gray-200 rounded-lg overflow-hidden shadow-md relative"
                    style={{
                      width: "min(350px, 100%)",
                      height: "200px",
                      maxWidth: "100%",
                    }}
                  >
                    {selectedTemplate.component(formData)}
                  </div>

                  <div className="flex gap-2 justify-center flex-wrap">
                    <button
                      onClick={downloadPNG}
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition text-xs sm:text-sm"
                    >
                      <Download size={16} />
                      PNG
                    </button>
                    <button
                      onClick={downloadJPG}
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition text-xs sm:text-sm"
                    >
                      <Download size={16} />
                      JPG
                    </button>
                    <button
                      onClick={downloadPDF}
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition text-xs sm:text-sm"
                    >
                      <Download size={16} />
                      PDF
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 text-sm sm:text-base text-center px-4">
                    Fill the form and click Generate to see preview
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Template Selection */}
          {showTemplates && (
            <div className="mt-6 sm:mt-8 bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                Choose Template ({TEMPLATES.length} designs)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition hover:shadow-lg ${
                      selectedTemplate?.id === template.id
                        ? "border-gray-900 ring-2 ring-gray-900"
                        : "border-gray-200"
                    }`}
                    style={{
                      paddingBottom: "57.14%", // 100/175 aspect ratio
                      position: "relative",
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 w-full h-full"
                      style={{
                        transform: "scale(0.5)",
                        transformOrigin: "top left",
                        width: "200%",
                        height: "200%",
                      }}
                    >
                      <div style={{ width: "350px", height: "200px" }}>
                        {template.component(formData)}
                      </div>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <div className="absolute top-1 right-1 bg-gray-900 text-white rounded-full p-1 z-10">
                        <Check size={12} />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1.5 sm:p-2 z-10">
                      <p className="text-white text-[10px] sm:text-xs font-medium truncate">
                        {template.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BusinessCardMaker;