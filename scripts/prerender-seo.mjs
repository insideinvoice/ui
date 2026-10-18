/*
 * Vite serves one SPA shell for every route. After the normal build, create a
 * route-specific shell for each public page so crawlers and link-preview
 * clients receive the correct title, description, canonical, social URL and a
 * static copy of the page's visible content BEFORE JavaScript runs.
 *
 * Two things matter here:
 *
 * 1. Canonical / sitemap agreement. The static host serves a directory index
 *    for each route, so `/gst-calculator` is permanently redirected (308) to
 *    `/gst-calculator/`. A canonical that points at the no-slash form therefore
 *    points at a redirecting URL, which Google treats as a conflicting
 *    canonical and drops from the index. Every emitted canonical, og:url and
 *    sitemap entry must use the trailing-slash form that actually returns 200.
 *
 * 2. Static body content. The body is an empty `#root` that React fills in.
 *    React uses createRoot (not hydrateRoot), so it REPLACES whatever is in
 *    `#root` on mount. That lets us ship real, crawlable text in the initial
 *    HTML for search engines, while users still get the interactive app.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const root = new URL("../dist/", import.meta.url);
const baseFile = new URL("index.html", root);
const siteUrl = "https://www.insideinvoice.com";
const defaultDescription =
  "Create professional GST invoices and streamline billing with Inside Invoice. Manage products, customers, payments, and business records in one web-based platform.";

/** Canonical form used by the static host: directory URLs end in a slash. */
function canonicalFor(path) {
  return path === "/" ? `${siteUrl}/` : `${siteUrl}${path}/`;
}

function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Inside Invoice",
    url: `${siteUrl}/`,
    logo: `${siteUrl}/logo.svg`,
  };
}

function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Inside Invoice",
    url: `${siteUrl}/`,
    description: defaultDescription,
  };
}

/** Wrap a list of sections in the static content block the crawler reads. */
function renderStaticContent({ heading, intro, sections = [], faqs = [] }) {
  const sectionHtml = sections
    .map(
      (section) =>
        `<section><h2>${section.heading}</h2>` +
        (section.paragraph ? `<p>${section.paragraph}</p>` : "") +
        (section.items && section.items.length
          ? `<ul>${section.items.map((item) => `<li>${item}</li>`).join("")}</ul>`
          : "") +
        `</section>`,
    )
    .join("\n");

  const faqHtml = faqs.length
    ? `<section><h2>Frequently asked questions</h2>` +
      faqs
        .map((faq) => `<div><h3>${faq.question}</h3><p>${faq.answer}</p></div>`)
        .join("") +
      `</section>`
    : "";

  return (
    `<div data-static-seo="true">` +
    `<h1>${heading}</h1>` +
    `<p>${intro}</p>` +
    sectionHtml +
    faqHtml +
    `</div>`
  );
}

function faqSchema(faqs) {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

const pages = [
  {
    path: "/",
    title: "InsideInvoice — GST Invoice & Billing Software for Indian Businesses",
    description: defaultDescription,
    content: {
      heading: "GST Invoice & Billing Software for Indian Businesses",
      intro:
        "Inside Invoice is a web-based GST invoicing and billing platform for Indian businesses. Create professional GST invoices, manage products and customers, record payments, and keep your business records in one place — from any browser, with no installation.",
      sections: [
        {
          heading: "GST invoicing made simple",
          paragraph:
            "Build compliant GST invoices with the right tax breakdown, save your products and customers once, and reuse them on every invoice.",
          items: [
            "Create GST invoices and delivery challans in your browser",
            "Save customers, products, and payment records",
            "Multiple invoice templates for different business needs",
            "Works on desktop and mobile with no app to install",
          ],
        },
        {
          heading: "Free online business tools",
          paragraph:
            "Alongside billing, Inside Invoice provides free tools that Indian businesses use every day.",
          items: [
            "GST calculator for India",
            "QR code generator",
            "Barcode generator",
            "Digital business card maker",
          ],
        },
      ],
      faqs: [
        {
          question: "What is Inside Invoice?",
          answer:
            "Inside Invoice is web-based GST invoice and billing software for Indian businesses. It lets you create invoices, manage products and customers, and track payments from any browser.",
        },
        {
          question: "Do I need to install anything?",
          answer:
            "No. Inside Invoice runs entirely in a web browser on desktop and mobile, so there is nothing to download or install.",
        },
        {
          question: "Is Inside Invoice free to use?",
          answer:
            "Inside Invoice offers free online tools such as a GST calculator, QR code generator, and barcode generator, alongside its invoicing and billing platform.",
        },
      ],
    },
    structuredData: [
      organizationSchema(),
      websiteSchema(),
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Inside Invoice",
        url: `${siteUrl}/`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        description: defaultDescription,
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      },
    ],
  },
  {
    path: "/gst-calculator",
    title: "GST Calculator for India | Inside Invoice",
    description:
      "Calculate GST for India with the Inside Invoice online GST calculator. Check tax amounts for common billing and invoice calculations.",
    content: {
      heading: "GST Calculator for India",
      intro:
        "Use the free Inside Invoice GST calculator to work out the GST amount for any invoice. Enter a value, choose whether it is inclusive or exclusive of GST, pick a GST rate, and see the tax and total instantly.",
      sections: [
        {
          heading: "How to use this GST calculator",
          items: [
            "Enter the amount in rupees.",
            "Choose whether the amount already includes GST.",
            "Select the GST rate that applies to your goods or services.",
            "Read the base amount, GST amount, and total.",
          ],
        },
        {
          heading: "Common GST rates in India",
          paragraph:
            "Choose the rate that matches your product or service. The calculator supports the standard GST slab rates used for billing and invoicing in India.",
          items: ["0%", "5%", "12%", "18%", "28%"],
        },
        {
          heading: "Inclusive vs exclusive GST",
          paragraph:
            "When an amount is GST inclusive, the tax is already inside the figure, so the calculator extracts it. When it is GST exclusive, the tax is added on top to produce the final invoice total.",
        },
      ],
      faqs: [
        {
          question: "How is GST calculated on an invoice?",
          answer:
            "For a GST exclusive amount, multiply the base value by the GST rate to get the tax, then add it to the base. For a GST inclusive amount, divide the total by one plus the rate to separate the tax from the base value.",
        },
        {
          question: "Which GST rates does this calculator support?",
          answer:
            "The calculator supports the common Indian GST slab rates of 0%, 5%, 12%, 18%, and 28%.",
        },
        {
          question: "Is the Inside Invoice GST calculator free?",
          answer:
            "Yes. The GST calculator is a free online tool and does not require an account.",
        },
      ],
    },
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "GST Calculator for India",
        url: canonicalFor("/gst-calculator"),
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web browser",
        description:
          "Free online GST calculator for India. Calculate inclusive and exclusive GST amounts for common invoice slab rates.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      },
    ],
  },
  {
    path: "/qr-generator",
    title: "Free QR Code Generator Online | Inside Invoice",
    description:
      "Create QR codes for text, URLs, phone numbers, WhatsApp, and contact details with the free Inside Invoice QR code generator.",
    content: {
      heading: "Free QR Code Generator Online",
      intro:
        "Generate a QR code for free with Inside Invoice. Turn a URL, plain text, phone number, WhatsApp link, or contact details into a QR code you can download and share.",
      sections: [
        {
          heading: "What you can encode",
          items: [
            "Website and payment URLs",
            "Plain text and notes",
            "Phone numbers",
            "WhatsApp chat links",
            "Contact details",
          ],
        },
        {
          heading: "How to generate a QR code",
          items: [
            "Choose the type of content.",
            "Enter your text, link, or number.",
            "Download the generated QR code image.",
          ],
        },
      ],
    },
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "QR Code Generator",
        url: canonicalFor("/qr-generator"),
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web browser",
        description: "Free online QR code generator for URLs, text, phone numbers, and WhatsApp links.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      },
    ],
  },
  {
    path: "/barcode-generator",
    title: "Online Barcode Generator | Inside Invoice",
    description:
      "Generate product barcodes online with Inside Invoice for product identification, sales workflows, and business records.",
    content: {
      heading: "Online Barcode Generator",
      intro:
        "Create product barcodes online with the free Inside Invoice barcode generator. Generate barcodes for product identification, stock records, and sales workflows.",
      sections: [
        {
          heading: "How to generate a barcode",
          items: [
            "Enter the product code or number.",
            "Generate the barcode.",
            "Download the image for labels and records.",
          ],
        },
        {
          heading: "Where barcodes are used",
          items: ["Product labels", "Stock and inventory records", "Point of sale workflows"],
        },
      ],
    },
  },
  {
    path: "/business-card",
    title: "Business Card Maker Online | Inside Invoice",
    description:
      "Create a professional digital business card with Inside Invoice and share your business contact details easily.",
    content: {
      heading: "Business Card Maker Online",
      intro:
        "Design a professional digital business card with Inside Invoice. Add your business name, contact details, and link, then share your card easily.",
      sections: [
        {
          heading: "Make a business card online",
          items: [
            "Add your business and contact details.",
            "Preview the card before sharing.",
            "Share your digital business card with customers.",
          ],
        },
      ],
    },
  },
  {
    path: "/documentation",
    title: "Inside Invoice Documentation | GST Billing Help",
    description:
      "Read Inside Invoice documentation for getting started, creating GST invoices, managing products and customers, and using billing tools.",
    content: {
      heading: "Inside Invoice Documentation",
      intro:
        "Read the Inside Invoice documentation to get started with GST invoicing and billing. Learn how to set up your business, create invoices, and manage products and customers.",
      sections: [
        {
          heading: "Getting started",
          items: [
            "Set up your business profile.",
            "Add your products and customers.",
            "Create and share your first GST invoice.",
          ],
        },
        {
          heading: "Billing features",
          items: ["GST invoices", "Delivery challans", "Payments", "Invoice templates"],
        },
      ],
    },
  },
  {
    path: "/help",
    title: "Inside Invoice Help Center | GST Billing Support",
    description:
      "Find practical guides and answers for creating GST invoices, sharing documents, managing customers, and tracking payments in Inside Invoice.",
    content: {
      heading: "Inside Invoice Help Center",
      intro:
        "Find practical guides and answers for common Inside Invoice tasks, including creating GST invoices, sharing documents, managing customers, and tracking payments.",
      sections: [
        {
          heading: "Popular topics",
          items: [
            "Creating a GST invoice",
            "Sharing an invoice with a customer",
            "Recording payments",
            "Managing customers and products",
          ],
        },
      ],
    },
  },
  {
    path: "/contact",
    title: "Contact Inside Invoice | GST Billing Support",
    description:
      "Contact the Inside Invoice team for questions about GST invoicing, billing workflows, account setup, and product support.",
    content: {
      heading: "Contact Inside Invoice",
      intro:
        "Contact the Inside Invoice team for questions about GST invoicing, billing workflows, account setup, and product support.",
    },
  },
  {
    path: "/updates",
    title: "Inside Invoice Product Updates",
    description:
      "See the latest Inside Invoice product updates, improvements, and changes to GST invoicing and business billing tools.",
    content: {
      heading: "Inside Invoice Product Updates",
      intro:
        "See the latest Inside Invoice product updates, improvements, and changes to GST invoicing and business billing tools.",
    },
  },
  {
    path: "/privacy-policy",
    title: "Privacy Policy | Inside Invoice",
    description: "Read the Inside Invoice privacy policy and learn how application data is handled.",
    content: {
      heading: "Privacy Policy",
      intro: "Read the Inside Invoice privacy policy and learn how application data is handled.",
    },
  },
  {
    path: "/terms-and-condition",
    title: "Terms and Conditions | Inside Invoice",
    description:
      "Read the terms and conditions for using Inside Invoice services and billing tools.",
    content: {
      heading: "Terms and Conditions",
      intro: "Read the terms and conditions for using Inside Invoice services and billing tools.",
    },
  },
  {
    path: "/refund-policy",
    title: "Refund Policy | Inside Invoice",
    description: "Read the Inside Invoice refund policy and related service terms.",
    content: {
      heading: "Refund Policy",
      intro: "Read the Inside Invoice refund policy and related service terms.",
    },
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

function structuredDataFor(page) {
  const schema = [...(page.structuredData || [])];
  const faq = page.content?.faqs ? faqSchema(page.content.faqs) : null;
  if (faq) schema.push(faq);
  return schema.length ? schema : null;
}

function renderPage(template, page) {
  const canonical = canonicalFor(page.path);
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
    return html;
  }

  const structuredData = structuredDataFor(page);
  if (structuredData) {
    html = html.replace(
      "</head>",
      `    <script type="application/ld+json" data-seo-structured-data="true">${JSON.stringify(structuredData)}</script>\n  </head>`,
    );
  }

  // Ship the page's real content in the initial HTML. React replaces the
  // contents of #root on mount, so users never see a layout change.
  if (page.content) {
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root">${renderStaticContent(page.content)}</div>`,
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

// Keep the deployed sitemap in exact agreement with the canonical URLs emitted
// above. This overwrites the copy Vite already copied into dist/.
const indexable = pages.filter((page) => !page.noindex);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexable.map((page) => `  <url><loc>${canonicalFor(page.path)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
await writeFile(new URL("sitemap.xml", root), sitemap);

console.log(
  `Pre-rendered ${indexable.length} public route shells and regenerated the sitemap with matching canonical URLs.`,
);
