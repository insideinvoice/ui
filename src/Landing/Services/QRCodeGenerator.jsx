import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import InvoiceNav from "../Navigation/InvoiceNav";

const QRCodeGenerator = () => {
  const [activeTab, setActiveTab] = useState("URL");
  const [qrValue, setQrValue] = useState("https://www.insideinvoice.com");
    const [isMenuOpen, setIsMenuOpen] = useState(false);

  // State for specific inputs
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [waInput, setWaInput] = useState("");
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });

  // Handle Tab Switching
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "Text") setQrValue(textInput || " ");
    if (tab === "URL") setQrValue(urlInput || "https://");
    if (tab === "Phone") setQrValue(phoneInput ? `tel:${phoneInput}` : "tel:");
    if (tab === "WhatsApp")
      setQrValue(waInput ? `https://wa.me/${waInput}` : "https://wa.me/");
    if (tab === "Contact") updateVCard();
  };

  // Input Handlers
  const handleTextChange = (e) => {
    setTextInput(e.target.value);
    setQrValue(e.target.value);
  };

  const handleUrlChange = (e) => {
    setUrlInput(e.target.value);
    setQrValue(e.target.value);
  };

  const handlePhoneChange = (e) => {
    setPhoneInput(e.target.value);
    setQrValue(`tel:${e.target.value}`);
  };

  const handleWaChange = (e) => {
    setWaInput(e.target.value);
    setQrValue(`https://wa.me/${e.target.value}`);
  };

  const handleContactChange = (field, value) => {
    const newContact = { ...contact, [field]: value };
    setContact(newContact);
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${newContact.name}\nTEL:${newContact.phone}\nEMAIL:${newContact.email}\nEND:VCARD`;
    setQrValue(vcard);
  };

  const updateVCard = () => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL:${contact.phone}\nEMAIL:${contact.email}\nEND:VCARD`;
    setQrValue(vcard);
  };

  // --- DOWNLOAD FUNCTIONS ---

  const downloadJPG = () => {
    const canvas = document.getElementById("qr-gen");
    if (canvas) {
      const jpgUrl = canvas.toDataURL("image/jpeg", 1.0);
      const downloadLink = document.createElement("a");
      downloadLink.href = jpgUrl;
      downloadLink.download = "inside-invoice-qr.jpg";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const downloadPDF = () => {
    const canvas = document.getElementById("qr-gen");
    if (canvas) {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Add a title to the PDF
      pdf.setFontSize(20);
      pdf.text("Inside Invoice QR Code", 105, 40, { align: "center" });

      // Add the QR image (centered)
      // x, y, width, height
      pdf.addImage(imgData, "PNG", 55, 50, 100, 100);

      // Save
      pdf.save("inside-invoice-qr.pdf");
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

      <div className="max-w-6xl mx-auto px-6 pb-6 font-sans text-gray-800 pt-24">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-6 transition-colors">
        <span aria-hidden="true">←</span> Back to Home
      </Link>
        {/* --- HEADER --- */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">
            Free QR Code Generator Online!
          </h1>
          <p className="text-gray-600">
            Create unlimited QR codes using the Inside Invoice online QR code
            generator.
          </p>
        </div>

        {/* --- GENERATOR SECTION --- */}
        <div className="flex flex-col md:flex-row gap-8 bg-white shadow-lg rounded-xl p-6 border border-gray-200 mb-16">
          {/* Left: Input Controls */}
          <div className="w-full md:w-2/3">
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
              {["Text", "URL", "WhatsApp", "Phone", "Contact"].map((type) => (
                <button
                  key={type}
                  onClick={() => handleTabChange(type)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === type
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Input Fields */}
            <div className="min-h-[200px]">
              {activeTab === "Text" && (
                <div>
                  <label className="block mb-2 font-semibold">Enter Text</label>
                  <textarea
                    className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="4"
                    placeholder="Enter your text here..."
                    value={textInput}
                    onChange={handleTextChange}
                  ></textarea>
                </div>
              )}

              {activeTab === "URL" && (
                <div>
                  <label className="block mb-2 font-semibold">
                    Website URL
                  </label>
                  <input
                    type="url"
                    className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                    value={urlInput}
                    onChange={handleUrlChange}
                  />
                </div>
              )}

              {activeTab === "WhatsApp" && (
                <div>
                  <label className="block mb-2 font-semibold">
                    WhatsApp Number
                  </label>
                  <div className="flex items-center border rounded overflow-hidden">
                    <span className="bg-gray-100 px-3 py-3 border-r">+91</span>
                    <input
                      type="number"
                      className="w-full p-3 focus:outline-none"
                      placeholder="Enter 10-digit Phone No."
                      value={waInput}
                      onChange={handleWaChange}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    QR Code will open a WhatsApp chat with this number.
                  </p>
                </div>
              )}

              {activeTab === "Phone" && (
                <div>
                  <label className="block mb-2 font-semibold">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter Phone Number"
                    value={phoneInput}
                    onChange={handlePhoneChange}
                  />
                </div>
              )}

              {activeTab === "Contact" && (
                <div className="grid grid-cols-1 gap-4">
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full p-3 border rounded"
                    value={contact.name}
                    onChange={(e) =>
                      handleContactChange("name", e.target.value)
                    }
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="w-full p-3 border rounded"
                    value={contact.phone}
                    onChange={(e) =>
                      handleContactChange("phone", e.target.value)
                    }
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="w-full p-3 border rounded"
                    value={contact.email}
                    onChange={(e) =>
                      handleContactChange("email", e.target.value)
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview & Download */}
          <div className="w-full md:w-1/3 flex flex-col items-center justify-center bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
            <div className="bg-white p-4 shadow-sm border rounded mb-4">
              <QRCodeCanvas
                id="qr-gen"
                value={qrValue}
                size={200}
                level={"H"}
                includeMargin={true}
                // We use white background to ensure JPG generation isn't transparent
                bgColor={"#ffffff"}
              />
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Size: 950 x 950 px (Scalable)
            </p>

            <div className="w-full space-y-3">
              <button
                onClick={downloadJPG}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Download JPG
              </button>

              <button
                onClick={downloadPDF}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* --- INFORMATIONAL CONTENT (SEO / TEXT) --- */}
        <div className="prose max-w-none text-gray-700 space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              How to Create a QR Code for Free using Our QR Code Generator?
            </h2>
            <p className="mb-4">
              Creating QR codes is a simple process. You can use Inside Invoice
              online QR generator to create a QR code for your business
              requirements. Here are three simple steps that you have to follow
              to generate a QR code.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Select type of QR code:</strong> You can choose from
                multiple QR code options, including URL, plain text, WhatsApp,
                phone number, and contact (vCard).
              </li>
              <li>
                <strong>Fill in the details:</strong> Put in all the information
                that you need the QR code to save within itself. You can store a
                link to text contact data, or any other type of info. Once you
                have filled in data about the events, you can hit "Generate QR
                Code".
              </li>
              <li>
                <strong>Download QR Code:</strong> Once generated, You can
                choose your QR code in different sizes and formats & download
                it.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Free QR Code Generator Online!
            </h2>
            <p className="mb-4">
              Create unlimited QR codes using the Inside Invoice online QR code
              generator. You can select from different types of QR codes and use
              them according to your requirement. Using a Inside Invoice QR
              generator doesn't require you to pay.
            </p>
            <p>
              Provide convenience to your customers by enabling QR payments now!
              Download Inside Invoice.
            </p>
          </section>

          <section className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                What is a QR Code
              </h3>
              <p className="mb-4">
                A "QR" code stands for "quick response," which means that it
                provides instant access to all the information hidden in the
                code. Black and white pixel patterns get used for creating a
                unique design.
              </p>
              <p>
                QR codes are two-dimensional versions of barcodes. They get
                widely used across industries for providing quick access to all
                necessary information.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                What are the Benefits of Using a QR code?
              </h3>
              <p className="mb-4">
                QR codes are widely popular, and the reason behind this success
                is their versatility. You can use them together with payments,
                ask for feedback, improve the product or service engagement with
                your customers.
              </p>
              <p>
                You can use images and videos for promoting your business using
                discount coupons and event registrations. QR codes are
                adjustable with all types of requirements, and you can access
                the information of your QR code using your smartphone.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              What are the Different Types of QR Codes?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-4 border rounded bg-gray-50">
                <h4 className="font-bold mb-2">URL</h4>
                <p className="text-sm">
                  URLs help open links to a contact from a web page. You can use
                  it to Link your YouTube video.
                </p>
              </div>
              <div className="p-4 border rounded bg-gray-50">
                <h4 className="font-bold mb-2">VCard</h4>
                <p className="text-sm">
                  Use vCard QR codes to create your digital business card having
                  to save directly to phone feature.
                </p>
              </div>
              <div className="p-4 border rounded bg-gray-50">
                <h4 className="font-bold mb-2">Email</h4>
                <p className="text-sm">
                  Using email QR type, you can set a predefined message to get
                  delivered to the recipient to his email address.
                </p>
              </div>
              <div className="p-4 border rounded bg-gray-50">
                <h4 className="font-bold mb-2">WiFi</h4>
                <p className="text-sm">
                  Using a QR code for a Wi-Fi setup, you can eliminate the
                  requirement of manually typing the password.
                </p>
              </div>
              <div className="p-4 border rounded bg-gray-50">
                <h4 className="font-bold mb-2">SMS</h4>
                <p className="text-sm">
                  Send a predefined text message to any phone number using SMS
                  type QR code by simply scanning the QR code.
                </p>
              </div>
              <div className="p-4 border rounded bg-gray-50">
                <h4 className="font-bold mb-2">Plain Text</h4>
                <p className="text-sm">
                  Store up to 300 characters in any language and display them on
                  the screen when scanned.
                </p>
              </div>
            </div>
          </section>

          {/* --- FAQ SECTION --- */}
          <section className="bg-gray-100 p-8 rounded-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <details className="group">
                <summary className="flex justify-between items-center font-medium cursor-pointer list-none">
                  <span>What is a QR code generator?</span>
                  <span className="transition group-open:rotate-180">
                    <svg
                      fill="none"
                      height="24"
                      shapeRendering="geometricPrecision"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                      width="24"
                    >
                      <path d="M6 9l6 6 6-6"></path>
                    </svg>
                  </span>
                </summary>
                <p className="text-gray-600 mt-3 group-open:animate-fadeIn">
                  A QR code generator is a tool that gets used to create
                  different types of QR codes. You can use a QR code for various
                  purposes depending on the requirement.
                </p>
              </details>
              <div className="border-t border-gray-300 my-2"></div>

              <details className="group">
                <summary className="flex justify-between items-center font-medium cursor-pointer list-none">
                  <span>Is it free to create a QR code?</span>
                  <span className="transition group-open:rotate-180">
                    <svg
                      fill="none"
                      height="24"
                      shapeRendering="geometricPrecision"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                      width="24"
                    >
                      <path d="M6 9l6 6 6-6"></path>
                    </svg>
                  </span>
                </summary>
                <p className="text-gray-600 mt-3 group-open:animate-fadeIn">
                  Yes. You can create a static QR code instantly for free using
                  the Inside Invoice QR code generator. Once created, you can
                  use them forever without paying any fees.
                </p>
              </details>
              <div className="border-t border-gray-300 my-2"></div>

              <details className="group">
                <summary className="flex justify-between items-center font-medium cursor-pointer list-none">
                  <span>Do QR codes expire?</span>
                  <span className="transition group-open:rotate-180">
                    <svg
                      fill="none"
                      height="24"
                      shapeRendering="geometricPrecision"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                      width="24"
                    >
                      <path d="M6 9l6 6 6-6"></path>
                    </svg>
                  </span>
                </summary>
                <p className="text-gray-600 mt-3 group-open:animate-fadeIn">
                  No. The QR codes do not expire. You can use them for as long
                  as you want.
                </p>
              </details>
            </div>
          </section>
        </div>

        {/* Footer / Contact Placeholder */}
        <div className="mt-16 border-t pt-8 text-center text-sm text-gray-500">
          <p>
            Copyright © {new Date().getFullYear()} Inside Invoice by 2X+1. All
            rights reserved.
          </p>
        </div>
      </div>
    </>
  );
};

export default QRCodeGenerator;
