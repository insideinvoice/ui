import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const SITE_URL = "https://www.insideinvoice.com";

const DEFAULT_DESCRIPTION =
  "Create professional GST invoices and manage billing, products, customers, payments, and business records with Inside Invoice.";
const SOCIAL_IMAGE = `${SITE_URL}/og-image.png`;
const BRAND_LOGO = `${SITE_URL}/logo.svg`;

const INDEXABLE_PAGES = {
  "/": {
    title: "InsideInvoice — GST Invoice & Billing Software for Indian Businesses",
    description:
      "Create professional GST invoices and streamline billing with Inside Invoice. Manage products, customers, payments, and business records in one web-based platform.",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Inside Invoice",
        url: SITE_URL,
        logo: BRAND_LOGO,
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Inside Invoice",
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Inside Invoice",
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        description: DEFAULT_DESCRIPTION,
      },
    ],
  },
  "/gst-calculator": {
    title: "GST Calculator for India | Inside Invoice",
    description:
      "Calculate GST for India with the Inside Invoice online GST calculator. Check tax amounts for common billing and invoice calculations.",
  },
  "/qr-generator": {
    title: "Free QR Code Generator Online | Inside Invoice",
    description:
      "Create QR codes for text, URLs, phone numbers, WhatsApp, and contact details with the free Inside Invoice QR code generator.",
  },
  "/barcode-generator": {
    title: "Online Barcode Generator | Inside Invoice",
    description:
      "Generate product barcodes online with Inside Invoice for product identification, sales workflows, and business records.",
  },
  "/business-card": {
    title: "Business Card Maker Online | Inside Invoice",
    description:
      "Create a professional digital business card with Inside Invoice and share your business contact details easily.",
  },
  "/documentation": {
    title: "Inside Invoice Documentation | GST Billing Help",
    description:
      "Read Inside Invoice documentation for getting started, creating GST invoices, managing products and customers, and using billing tools.",
  },
  "/help": {
    title: "Inside Invoice Help Center | GST Billing Support",
    description:
      "Find practical guides and answers for creating GST invoices, sharing documents, managing customers, and tracking payments in Inside Invoice.",
  },
  "/contact": {
    title: "Contact Inside Invoice | GST Billing Support",
    description:
      "Contact the Inside Invoice team for questions about GST invoicing, billing workflows, account setup, and product support.",
  },
  "/updates": {
    title: "Inside Invoice Product Updates",
    description:
      "See the latest Inside Invoice product updates, improvements, and changes to GST invoicing and business billing tools.",
  },
  "/privacy-policy": {
    title: "Privacy Policy | Inside Invoice",
    description: "Read the Inside Invoice privacy policy and learn how application data is handled.",
  },
  "/terms-and-condition": {
    title: "Terms and Conditions | Inside Invoice",
    description: "Read the terms and conditions for using Inside Invoice services and billing tools.",
  },
  "/refund-policy": {
    title: "Refund Policy | Inside Invoice",
    description: "Read the Inside Invoice refund policy and related service terms.",
  },
};

const NO_INDEX_PATHS = new Set([
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
  "/invoice-templates",
  "/payments",
  "/settings",
  "/more",
]);

function isNoIndexPath(pathname) {
  return (
    NO_INDEX_PATHS.has(pathname) ||
    pathname.startsWith("/invoice/") ||
    pathname.startsWith("/customers/") ||
    pathname.startsWith("/products/") ||
    pathname.startsWith("/delivery-challans") ||
    pathname.startsWith("/labels/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/i/")
  );
}

function getPageMetadata(pathname) {
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  const page = INDEXABLE_PAGES[normalizedPath];
  if (page) {
    return {
      ...page,
      robots: "index,follow",
      canonical: `${SITE_URL}${normalizedPath}`,
    };
  }

  if (isNoIndexPath(normalizedPath)) {
    return {
      title: normalizedPath.startsWith("/i/") ? "Shared Invoice | Inside Invoice" : "Inside Invoice",
      description: DEFAULT_DESCRIPTION,
      robots: "noindex,nofollow,noarchive",
      canonical: null,
      structuredData: null,
    };
  }

  return {
    title: "Page not found | Inside Invoice",
    description: "The requested Inside Invoice page could not be found.",
    robots: "noindex,follow,noarchive",
    canonical: null,
    structuredData: null,
  };
}

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function removeMeta(attribute, key) {
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove();
}

function setCanonical(href) {
  const links = [...document.head.querySelectorAll('link[rel="canonical"]')];
  if (!href) {
    links.forEach((link) => link.remove());
    return;
  }
  let link = links[0];
  links.slice(1).forEach((duplicate) => duplicate.remove());
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.dataset.seoCanonical = "true";
  link.href = href;
}

function setStructuredData(value) {
  const existing = document.head.querySelector('script[data-seo-structured-data="true"]');
  if (!value) {
    existing?.remove();
    return;
  }
  const script = existing || document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.seoStructuredData = "true";
  script.textContent = JSON.stringify(value);
  if (!existing) document.head.appendChild(script);
}

export default function SeoHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = getPageMetadata(pathname);
    document.title = metadata.title;
    document.documentElement.lang = "en";

    upsertMeta("name", "description", metadata.description);
    upsertMeta("name", "robots", metadata.robots);
    upsertMeta("property", "og:title", metadata.title);
    upsertMeta("property", "og:description", metadata.description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "Inside Invoice");
    upsertMeta("property", "og:image", SOCIAL_IMAGE);
    upsertMeta("property", "og:image:alt", "Inside Invoice GST invoice and billing software");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", metadata.title);
    upsertMeta("name", "twitter:description", metadata.description);
    upsertMeta("name", "twitter:image", SOCIAL_IMAGE);

    if (metadata.canonical) {
      upsertMeta("property", "og:url", metadata.canonical);
    } else {
      removeMeta("property", "og:url");
    }
    setCanonical(metadata.canonical);
    setStructuredData(metadata.structuredData);
  }, [pathname]);

  return null;
}
