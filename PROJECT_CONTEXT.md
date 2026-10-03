# Inside Invoice Frontend - AI Context Guide

> **Purpose**: This document provides comprehensive context for AI assistants working on the Inside Invoice frontend. Read this file before making any changes to understand the project architecture, conventions, and patterns.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture & Patterns](#architecture--patterns)
- [Directory Structure](#directory-structure)
- [Routing Configuration](#routing-configuration)
- [Authentication Flow](#authentication-flow)
- [API Integration](#api-integration)
- [State Management](#state-management)
- [UI Components & Styling](#ui-components--styling)
- [Key Features](#key-features)
- [Development Guide](#development-guide)
- [Code Conventions](#code-conventions)
- [Common Tasks](#common-tasks)

---

## Project Overview

**Inside Invoice** is a **GST-compliant invoice management platform** frontend for Indian businesses. It enables users to create invoices, manage customers/products, generate PDFs, track payments, and provides admin capabilities.

### Key Features
- Multi-tenant invoice management with business isolation
- GST-compliant invoice generation with HSN/SAC codes
- Customer and product management with barcode scanning
- Payment tracking against invoices
- 15+ invoice templates with PDF export
- OCR/AI-powered invoice photo extraction (Google Gemini + Tesseract.js)
- Admin panel for platform management
- PWA support for mobile installation
- Offline retry queue for failed operations

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build Tool | Vite 7 |
| Routing | React Router DOM 7 |
| HTTP Client | Axios 1.16 |
| Styling | Tailwind CSS 3 |
| Icons | lucide-react + react-icons |
| Charts | Recharts 3 |
| PDF Generation | jsPDF + html2canvas + @react-pdf/renderer |
| QR Codes | qrcode.react |
| Barcodes | jsbarcode |
| OCR | Tesseract.js 7 |
| AI | Google Gemini 2.0 Flash |
| Notifications | react-hot-toast |
| Email | @emailjs/browser |

---

## Architecture & Patterns

### Component Architecture
- **Function components** with hooks (no class components)
- **No external state management** (no Redux/Zustand) - uses React Context + local state
- **Custom hooks** for shared logic
- **One component per file** pattern

### Layout Pattern
- **Desktop (lg+):** Fixed sidebar (240px) + main content with `lg:ml-60`
- **Mobile:** Top navbar + slide-out hamburger menu + fixed bottom tab bar (4 tabs)
- Safe area insets handled for iPhone notch/home indicator

### Data Flow
```
User Action → Component State → API Call → Backend → Response → State Update → UI Re-render
```

### API Pattern
- Centralized API modules in `src/api/auth.js`
- Axios interceptors for auth token injection
- All API calls return standardized `ApiResponse<T>` wrapper

### PDF Generation Pattern
- Standard invoices: jsPDF + html2canvas (captures HTML as image)
- React PDF: @react-pdf/renderer for structured PDF documents
- Thermal receipts: Browser print dialog (no PDF)

---

## Directory Structure

```
inside-invoice/
├── index.html                          # HTML entry point
├── package.json                        # Dependencies & scripts
├── vite.config.js                      # Vite configuration + dev proxy
├── tailwind.config.js                  # Tailwind CSS configuration
├── postcss.config.js                   # PostCSS configuration
├── eslint.config.js                    # ESLint configuration
├── netlify.toml                        # Netlify deployment config
├── nginx.conf                          # Nginx config for Docker
├── Dockerfile                          # Multi-stage Docker build
├── public/                             # Static assets
├── scripts/                            # Build scripts
│
└── src/
    ├── main.jsx                        # React entry point
    ├── App.jsx                         # Root component + routing
    ├── index.css                       # Global styles + Tailwind imports
    │
    ├── api/
    │   ├── axios.js                    # Axios instance + interceptors
    │   └── auth.js                     # All API service modules
    │
    ├── assets/                         # Images, logos, SVGs
    │
    ├── Authentication/
    │   └── Login.jsx                   # Login + forgot password
    │
    ├── components/                     # Reusable UI components
    │   ├── AppNavbar.jsx               # Sidebar + mobile nav + bottom tabs
    │   ├── ConfirmModal.jsx            # Confirmation dialog
    │   ├── InvoicePDF.jsx              # PDF download logic
    │   ├── InvoicePDFDocument.jsx      # React PDF document
    │   ├── InvoiceTemplateRenderer.jsx # Template rendering
    │   ├── InvoiceTemplateVariants.jsx # Template themes
    │   ├── InvoiceThermal.jsx          # Thermal receipt format
    │   ├── PageHeader.jsx              # Reusable page header
    │   ├── PWAInstallPrompt.jsx        # PWA install banner
    │   └── PaperSizeSelector.jsx       # Paper size options
    │
    ├── config/
    │   └── api.js                      # Base URL configuration
    │
    ├── constants/
    │   ├── indianStates.js             # States, delivery/payment terms
    │   └── paperSizes.js               # Paper sizes, templates, print settings
    │
    ├── context/
    │   └── AuthContext.jsx             # Auth context + provider
    │
    ├── Landing/                        # Marketing pages
    │   ├── gst-landing-final.jsx       # Main landing page
    │   ├── ContactNow.jsx
    │   ├── Documentation.jsx
    │   ├── PrivacyPolicy.jsx
    │   ├── TermsandConditions.jsx
    │   ├── RefundPolicy.jsx
    │   └── Services/                   # Utility tools
    │       ├── BarcodeGenerator.jsx
    │       ├── BusinessCardMaker.jsx
    │       ├── GSTCalculator.jsx
    │       └── QRCodeGenerator.jsx
    │
    ├── pages/                          # Application pages
    │   ├── Dashboard.jsx               # Main dashboard with charts
    │   ├── InvoiceForm.jsx             # Create/edit invoice
    │   ├── InvoiceView.jsx             # View single invoice
    │   ├── InvoicesList.jsx            # List all invoices
    │   ├── InvoiceTemplates.jsx        # Template selector
    │   ├── InvoiceUpload.jsx           # OCR/AI invoice extraction
    │   ├── AddCustomer.jsx             # Create customer
    │   ├── CustomersList.jsx           # List all customers
    │   ├── AddProduct.jsx              # Create product
    │   ├── ProductsList.jsx            # List all products
    │   ├── PaymentsList.jsx            # Payment tracking
    │   ├── BusinessSetup.jsx           # First-time business setup
    │   ├── Profile.jsx                 # Settings + business config
    │   ├── MorePage.jsx                # Mobile "more" menu
    │   └── Admin*.jsx                  # Admin panel pages
    │
    └── utils/
        ├── printInvoice.js             # Dynamic import for PDF generation
        └── retryQueue.js               # Offline sync queue in localStorage
```

---

## Routing Configuration

### Public Routes (no auth required)
| Path | Component | Description |
|------|-----------|-------------|
| `/` | `GSTBillingLanding` | Marketing landing page |
| `/login` | `Login` | Login page |
| `/forgot-password` | `Login` | Same component, toggled by URL |
| `/privacy-policy` | `PrivacyPolicy` | Privacy policy |
| `/terms-and-condition` | `TermsandConditions` | Terms of service |
| `/refund-policy` | `RefundPolicy` | Refund policy |
| `/updates` | `Updates` | Changelog/updates |
| `/contact` | `ContactNow` | Contact form |
| `/documentation` | `Documentation` | API/product docs |
| `/help` | `InsideInvoiceHelpCenter` | Help center |
| `/video` | `InsideInvoiceVideoTutorials` | Video tutorials |
| `/gst-calculator` | `GSTCalculator` | Utility tool |
| `/qr-generator` | `QRCodeGenerator` | Utility tool |
| `/barcode-generator` | `BarcodeGenerator` | Utility tool |
| `/business-card` | `BusinessCardMaker` | Utility tool |

### Protected Routes (wrapped in `<PrivateRoute>`)
| Path | Component | Description |
|------|-----------|-------------|
| `/business-setup` | `BusinessSetup` | First-time business setup |
| `/dashboard` | `Dashboard` | Main dashboard with charts |
| `/invoice` | `InvoiceForm` | Create new invoice |
| `/invoice/upload` | `InvoiceUpload` | OCR/AI invoice extraction |
| `/invoice/:id` | `InvoiceView` | View single invoice |
| `/invoices` | `InvoicesList` | List all invoices |
| `/customers/new` | `AddCustomer` | Create customer |
| `/customers` | `CustomersList` | List all customers |
| `/products/new` | `AddProduct` | Create product |
| `/products` | `ProductsList` | List all products |
| `/invoice-templates` | `InvoiceTemplates` | Template selector |
| `/payments` | `PaymentsList` | Payment tracking |
| `/settings` | `Profile` | Profile + business settings |
| `/more` | `MorePage` | Mobile "more" menu |

### Admin Routes (behind `PrivateRoute`)
| Path | Component | Description |
|------|-----------|-------------|
| `/admin/users` | `AdminAddUsers` | Admin: create user |
| `/admin/users-list` | `AdminUsersList` | Admin: list users |
| `/admin/businesses` | `AdminBusinessesList` | Admin: list businesses |
| `/admin/customers` | `AdminCustomersList` | Admin: list all customers |
| `/admin/products` | `AdminProductsList` | Admin: list all products |
| `/admin/invoices` | `AdminInvoicesList` | Admin: list all invoices |
| `/admin/businesses/:businessId/invoices` | `BusinessInvoices` | Admin: business invoices |
| `/admin/invoices/:id` | `AdminInvoiceView` | Admin: view invoice |

---

## Authentication Flow

### AuthContext (`src/context/AuthContext.jsx`)
**Provider:** `AuthProvider` wraps the entire app

**State managed:**
- `user` — full user object from API (name, email, role, selectedTemplate, businessSetupCompleted)
- `token` — JWT access token
- `loading` — initial hydration from localStorage
- `selectedTemplate` — invoice template preference

**Computed values:**
- `isAuthenticated` — `!!token`
- `isBusinessSetupComplete` — `user?.businessSetupCompleted`
- `isAdmin` — `user?.role === "ADMIN"`

### Token Storage
- Stored under key `ii_token` in `localStorage`
- Old key `token` is removed on app init (migration)
- Token is checked for expiration using JWT `exp` claim before restoring

### Login Flow
1. User submits email + password on `/login`
2. `authAPI.login({ email, password })` POST to `/api/auth/login`
3. Response contains `{ accessToken, ...userData }`
4. Token set in axios defaults and localStorage
5. User data stored in localStorage as JSON
6. Redirect to `/dashboard` if `businessSetupCompleted`, otherwise `/business-setup`

### Protected Route Behavior
- On mount, `AuthProvider` checks localStorage for existing valid token
- If valid, hydrates state and sets axios auth header
- If expired or missing, clears localStorage and shows login page
- `PrivateRoute` component checks `isAuthenticated` and redirects to `/login` if not

### Admin Role
- `user.role === "ADMIN"` enables admin sections in sidebar and dashboard
- Admin-specific routes all behind `PrivateRoute` (no separate admin route guard)

---

## API Integration

### Base URL Configuration
```javascript
// Production:
API_BASE_URL = 'https://insideinvoice-production.up.railway.app/api'

// Local development proxy (vite.config.js):
// '/api' -> 'http://localhost:8080'
```

### Axios Instance (`src/api/axios.js`)
- **Base URL:** from `config/api.js`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `withCredentials: true`
- **Request interceptor:** Attaches `Authorization: Bearer <token>` from localStorage
- **`setAuthToken(token)`:** Sets/removes token in both localStorage and axios defaults

### API Modules (`src/api/auth.js`)

#### Auth API (`/auth/*`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password |
| PUT | `/auth/profile` | Update profile |
| PUT | `/auth/change-password` | Change password |

#### Business API (`/business/*`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/business/setup` | Initial business setup |
| GET | `/business/me` | Get business profile |
| PUT | `/business/update` | Update business info |
| POST | `/business/signature` | Upload signature (multipart) |
| DELETE | `/business/signature` | Remove signature |

#### Customer API (`/customers/*`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/customers` | Create customer |
| GET | `/customers` | List all (with query params) |
| GET | `/customers/:id` | Get customer by ID |
| PUT | `/customers/:id` | Update customer |
| DELETE | `/customers/:id` | Delete customer |
| POST | `/customers/check` | Check if customer exists |

#### Product API (`/products/*`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/products` | Create product |
| GET | `/products` | List all |
| GET | `/products/:id` | Get by ID |
| PUT | `/products/:id` | Update |
| DELETE | `/products/:id` | Delete |
| GET | `/products/by-hsn/:hsn` | Lookup by HSN code |

#### Invoice API (`/invoices/*`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/invoices` | Create invoice |
| GET | `/invoices` | List all |
| GET | `/invoices/:id` | Get by ID |
| PUT | `/invoices/:id` | Update |
| DELETE | `/invoices/:id` | Delete |

#### Payment API (`/payments/*`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/payments` | Record payment |
| GET | `/payments` | List all |
| GET | `/payments/:id` | Get by ID |
| GET | `/payments/by-invoice/:invoiceId` | Get payments for invoice |
| DELETE | `/payments/:id` | Delete |

#### Admin API (`/admin/*`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/stats` | Platform statistics |
| GET | `/admin/analytics` | Analytics data |
| GET | `/admin/users` | All users |
| GET | `/admin/businesses` | All businesses |
| GET | `/admin/invoices` | All invoices |
| GET | `/admin/customers` | All customers |
| GET | `/admin/products` | All products |
| PUT | `/admin/users/:id/password` | Update user password |
| PUT | `/admin/users/:id/role` | Update user role |
| DELETE | `/admin/users/:id` | Delete user |

### External API Integration
- **Google Gemini AI**: Used in `InvoiceUpload.jsx` for extracting invoice data from photos
- **Tesseract.js**: Client-side OCR fallback when Gemini fails
- **EmailJS**: For sending emails from the browser (contact form)

---

## State Management

### Pattern: React Context + Local Component State

### Global State (via `AuthContext`)
- `user` — user profile data
- `token` — JWT access token
- `loading` — initial auth check status
- `selectedTemplate` — current invoice template
- `isAuthenticated`, `isBusinessSetupComplete`, `isAdmin` — derived booleans

### Local State Pattern
Each page manages its own state via `useState`/`useEffect`:
- **Dashboard:** stats, analytics, users, businesses, invoices (fetched on mount)
- **InvoiceForm:** customer, form fields, items array, business data (all local)
- **Profile:** display name, password, signature, business form, bank form (all local)

### Persistence (localStorage)
| Key | Purpose |
|-----|---------|
| `ii_token` | JWT token |
| `user` | Serialized user object |
| `invoice_template` | Selected template ID |
| `print_settings` | Per-document-type paper size + template |
| `ghost_mode` | Manual invoice number override flag |
| `show_seal` | Company seal toggle |
| `seal_type` | "round" or "stamp" |
| `invoice_sync_queue` | Offline retry queue (JSON array) |
| `pwa_install_dismissed_until` | PWA prompt cooldown timestamp |

---

## UI Components & Styling

### Styling Approach
- **Tailwind CSS 3** — primary styling (all components use utility classes)
- **No CSS modules or styled-components**
- **No third-party UI component library** (no shadcn, MUI, Ant Design)

### Design System
- **Color palette:** Slate-based with indigo accent
  - Primary: `slate-50/100/200/800/900`
  - Accent: `indigo-50/500/600/700`
- **Typography:** Inter (body) + Space Grotesk (headings) — loaded via Google Fonts
- **Border radius:** Consistent `rounded-lg` and `rounded-xl`
- **Shadows:** `shadow-sm` throughout
- **Mobile-first responsive:** `sm:`, `md:`, `lg:` breakpoints

### Icon Libraries
- **lucide-react** — primary icon library (used in every page/component)
- **react-icons** — secondary icon library (available but less used)

### Key Components
- `AppNavbar` — Sidebar + mobile nav + bottom tabs (handles responsive layout)
- `PageHeader` — Reusable page header with back button and actions
- `ConfirmModal` — Confirmation dialog for destructive actions
- `InvoiceTemplateRenderer` — Renders invoice in different template styles
- `PWAInstallPrompt` — Handles PWA installation prompts

---

## Key Features

### Offline Retry Queue (`src/utils/retryQueue.js`)
- Stores failed invoice creation attempts in localStorage
- Retries with up to 20 attempts per entry
- On app load, `processQueue()` syncs pending invoices
- Creates customer first if needed, then the invoice

### OCR + AI Invoice Extraction (`src/pages/InvoiceUpload.jsx`)
- **Primary:** Google Gemini 2.0 Flash API for structured data extraction
- **Fallback:** Tesseract.js OCR with multi-pass image preprocessing
- Extracts: customer name, phone, date, and line items
- Navigates to `/invoice` with prefilled data via React Router state

### Ghost Mode
- Toggle in Settings that allows manual invoice number entry
- Auto-increment resumes when disabled
- Stored in `localStorage` as `ghost_mode`

### Invoice Templates
- 15 templates defined in `constants/paperSizes.js` (template-1 through template-23)
- Templates rendered via `InvoiceTemplateRenderer` component
- Per-document-type paper size and template selection stored in localStorage

### Paper Size Support
- A4 Portrait/Landscape, A5, Letter — generates PDF via jsPDF + html2canvas
- Thermal 58mm/80mm — opens browser print dialog (receipt-style)

### HSN Barcode Scanning
- HSN/SAC input fields have barcode scanner support
- On Enter or blur, calls `productAPI.findByHsn()` to auto-fill item details
- Keyboard navigation: Enter advances to next field, Ctrl+Enter adds new item row

---

## Development Guide

### Running Locally

**Development Server:**
```bash
npm run dev
# Starts Vite dev server on port 5173
# Proxies /api to http://localhost:8080
```

**Production Build:**
```bash
npm run build    # Builds to dist/
npm run preview  # Preview production build
```

**Linting:**
```bash
npm run lint     # Run ESLint
```

### Prerequisites
- Node.js 20+
- Backend running on port 8080 (or configured API URL)

### Environment Setup
1. Clone repository
2. Run `npm install`
3. Ensure backend is running at `http://localhost:8080`
4. Run `npm run dev`

### Deployment

**Netlify:**
- SPA with `/* -> /index.html` redirect
- No-cache headers for HTML, immutable for assets

**Docker:**
- Multi-stage build: Node 20 build → Nginx alpine serve
- Nginx proxies `/api` to backend

**Backend:**
- Deployed on Railway (`insideinvoice-production.up.railway.app`)

---

## Code Conventions

### Naming Conventions
- **Files:** PascalCase for components (`Dashboard.jsx`), camelCase for utilities (`printInvoice.js`)
- **Components:** Function components with hooks (no class components)
- **API modules:** Organized by domain entity (`auth.js` contains all API modules)
- **Pages:** One component per file, exported as default
- **Styling:** Tailwind utility classes inline

### Component Pattern
```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SomeIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiModule } from '../api/auth';

function ComponentName() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await apiModule.getAll();
      setState(response.data.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64">Loading...</div>;

  return (
    <div className="p-4 sm:p-6">
      {/* Content */}
    </div>
  );
}

export default ComponentName;
```

### Tailwind Classes Pattern
- **Containers:** `p-4 sm:p-6 lg:p-8`
- **Cards:** `bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6`
- **Headings:** `text-xl sm:text-2xl font-bold text-gray-900`
- **Buttons:** `px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors`
- **Inputs:** `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`
- **Tables:** `min-w-full divide-y divide-gray-200`

### Error Handling Pattern
```jsx
try {
  const response = await apiModule.operation(data);
  toast.success('Operation successful');
  navigate('/some-page');
} catch (error) {
  const message = error.response?.data?.message || 'Operation failed';
  toast.error(message);
}
```

---

## Common Tasks

### Adding a New Page
1. Create new file in `src/pages/YourPage.jsx`
2. Add route in `src/App.jsx` (protected or public)
3. Add navigation link in `AppNavbar.jsx` if needed
4. Create API methods in `src/api/auth.js` if needed
5. Follow existing page patterns for styling and data fetching

### Adding a New API Endpoint
1. Add method to appropriate module in `src/api/auth.js`
2. Follow existing naming conventions
3. Use axios instance from `src/api/axios.js`
4. Handle errors with toast notifications

### Adding a New Component
1. Create in `src/components/YourComponent.jsx`
2. Use Tailwind for styling
3. Import icons from `lucide-react`
4. Export as default

### Modifying Invoice Templates
1. Edit `src/constants/paperSizes.js` for template definitions
2. Edit `src/components/InvoiceTemplateVariants.jsx` for template rendering
3. Edit `src/components/InvoiceTemplateRenderer.jsx` for template selection

### Adding a New Admin Page
1. Create page in `src/pages/AdminYourPage.jsx`
2. Add route in `src/App.jsx` (inside PrivateRoute)
3. Add navigation in `AppNavbar.jsx` admin section
4. Ensure admin role check in component

---

## Important Notes

1. **No State Library**: All state is managed via React Context + local state. Do not add Redux/Zustand unless explicitly requested.
2. **Server-Side Calculations**: Invoice totals are calculated by the backend. Frontend should not calculate totals.
3. **Multi-Tenancy**: All data is scoped by businessId from JWT. Never expose cross-tenant data.
4. **Mobile-First**: Always consider mobile layout. Use responsive Tailwind classes.
5. **Keyboard Navigation**: InvoiceForm has custom keyboard navigation. Preserve this behavior.
6. **Offline Support**: Retry queue handles failed operations. Do not break this pattern.
7. **PDF Generation**: Uses jsPDF + html2canvas. Changes to invoice HTML may affect PDF output.
8. **Template System**: 15 templates available. Changes affect all users using that template.

---

## Related Documentation
- `README.md` — Basic project setup instructions
- `vite.config.js` — Build configuration and dev proxy
- `tailwind.config.js` — Tailwind CSS customization
- `package.json` — All dependencies and scripts
- `netlify.toml` — Deployment configuration
- `nginx.conf` — Docker Nginx configuration
