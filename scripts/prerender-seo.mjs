/*
 * Vite serves one SPA shell for every route. After the normal build, create a
 * small route-specific shell for each public page so crawlers and link preview
 * clients receive the correct title, description, canonical, and social URL
 * before JavaScript renders the page. The React app remains the source of the
 * visible page and routing behavior.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const root = new URL("../dist/", import.meta.url);
const baseFile = new URL("index.html", root);
const siteUrl = "https://www.insideinvoice.com";
const defaultDescription =
  "Create professional GST invoices and streamline billing with Inside Invoice. Manage products, customers, payments, and business records in one web-based platform.";

const pages = [
  {
    path: "/",
    title: "InsideInvoice — GST Invoice & Billing Software for Indian Businesses",
    description: defaultDescription,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Inside Invoice",
        url: siteUrl,
        logo: `${siteUrl}/logo.svg`,
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Inside Invoice",
        url: siteUrl,
        description: defaultDescription,
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Inside Invoice",
        url: siteUrl,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        description: defaultDescription,
      },
    ],
  },
  {
    path: "/gst-calculator",
    title: "GST Calculator for India | Inside Invoice",
    description: "Calculate GST for India with the Inside Invoice online GST calculator. Check tax amounts for common billing and invoice calculations.",
  },
  {
    path: "/qr-generator",
    title: "Free QR Code Generator Online | Inside Invoice",
    description: "Create QR codes for text, URLs, phone numbers, WhatsApp, and contact details with the free Inside Invoice QR code generator.",
  },
  {
    path: "/barcode-generator",
    title: "Online Barcode Generator | Inside Invoice",
    description: "Generate product barcodes online with Inside Invoice for product identification, sales workflows, and business records.",
  },
  {
    path: "/business-card",
    title: "Business Card Maker Online | Inside Invoice",
    description: "Create a professional digital business card with Inside Invoice and share your business contact details easily.",
  },
  {
    path: "/documentation",
    title: "Inside Invoice Documentation | GST Billing Help",
    description: "Read Inside Invoice documentation for getting started, creating GST invoices, managing products and customers, and using billing tools.",
  },
  {
    path: "/help",
    title: "Inside Invoice Help Center | GST Billing Support",
    description: "Find practical guides and answers for creating GST invoices, sharing documents, managing customers, and tracking payments in Inside Invoice.",
  },
  {
    path: "/contact",
    title: "Contact Inside Invoice | GST Billing Support",
    description: "Contact the Inside Invoice team for questions about GST invoicing, billing workflows, account setup, and product support.",
  },
  {
    path: "/updates",
    title: "Inside Invoice Product Updates",
    description: "See the latest Inside Invoice product updates, improvements, and changes to GST invoicing and business billing tools.",
  },
  {
    path: "/privacy-policy",
    title: "Privacy Policy | Inside Invoice",
    description: "Read the Inside Invoice privacy policy and learn how application data is handled.",
  },
  {
    path: "/terms-and-condition",
    title: "Terms and Conditions | Inside Invoice",
    description: "Read the terms and conditions for using Inside Invoice services and billing tools.",
  },
  {
    path: "/refund-policy",
    title: "Refund Policy | Inside Invoice",
    description: "Read the Inside Invoice refund policy and related service terms.",
  },
  // Exact non-public routes get a noindex shell as well. Dynamic private
  // routes remain protected by the application and are not added to the
  // sitemap; /i/* is routed to /i/index.html by the static host configs.
  ...[
    "/login",
    "/forgot-password",
    "/change-password",
    "/video",
    "/business-setup",
    "/dashboard",
    "/invoice",
    "/invoices",
    "/customers",
    "/products",
    "/delivery-challans",
    "/invoice-templates",
    "/payments",
    "/labels",
    "/settings",
    "/more",
    "/admin",
    "/i",
  ].map((path) => ({
    path,
    title: "Inside Invoice",
    description: defaultDescription,
    noindex: true,
  })),
];

function escapeAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderPage(template, page) {
  const canonical = `${siteUrl}${page.path === "/" ? "/" : page.path}`;
  let html = template
    .replace(/<title>.*?<\/title>/s, `<title>${escapeAttribute(page.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(" \/>)/, `$1${escapeAttribute(page.description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(" \/>)/, `$1${escapeAttribute(page.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(" \/>)/, `$1${escapeAttribute(page.description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(" \/>)/, `$1${canonical}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(" \/>)/, `$1${escapeAttribute(page.title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(" \/>)/, `$1${escapeAttribute(page.description)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(" \/>)/, `$1${canonical}$2`);

  if (page.noindex) {
    html = html
      .replace(/(<meta name="robots" content=")[^"]*(" \/>)/, '$1noindex,nofollow,noarchive$2')
      .replace(/\s*<link rel="canonical"[^>]* \/>/, "")
      .replace(/\s*<meta property="og:url"[^>]* \/>/, "");
  }

  if (page.structuredData) {
    html = html.replace(
      "</head>",
      `    <script type="application/ld+json" data-seo-structured-data="true">${JSON.stringify(page.structuredData)}</script>\n  </head>`,
    );
  }
  return html;
}

const template = await readFile(baseFile, "utf8");
for (const page of pages) {
  const output = page.path === "/"
    ? baseFile
    : new URL(`${page.path.slice(1)}/index.html`, root);
  await mkdir(dirname(output.pathname), { recursive: true });
  await writeFile(output, renderPage(template, page));
}

console.log(`Pre-rendered route metadata shells for ${pages.length} routes.`);
