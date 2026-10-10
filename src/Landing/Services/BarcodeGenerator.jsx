import React, { useState, useEffect, useRef, useCallback } from "react";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";
import InvoiceNav from "../Navigation/InvoiceNav";
import { Link } from "react-router-dom";

const BarcodeGenerator = () => {
  // State
  const [itemName, setItemName] = useState("My Product");
  const [itemCode, setItemCode] = useState("123456789");
  const [barcodeSize, setBarcodeSize] = useState(2); // Scale factor
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const canvasRef = useRef(null);

  // Generate Barcode on change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const generateBarcode = useCallback(() => {
    if (canvasRef.current) {
      try {
        JsBarcode(canvasRef.current, itemCode, {
          format: "CODE128",
          lineColor: "#000",
          width: barcodeSize,
          height: 100,
          displayValue: true,
          fontSize: 20,
          background: "#ffffff",
          marginTop: 20, // Space for item name if we were drawing it manually, but JsBarcode draws the code
          marginBottom: 20,
        });
      } catch {
        // Handle invalid characters for certain barcode formats
        console.error("Invalid input for barcode");
      }
    }
  }, [itemCode, barcodeSize]);
  useEffect(() => {
    generateBarcode();
  }, [generateBarcode]);

  // --- DOWNLOAD FUNCTIONS ---

  const downloadImage = (format) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary canvas to draw the Item Name + Barcode together
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");

    // Set dimensions (add space at top for Item Name)
    const padding = 40;
    tempCanvas.width = canvas.width + padding;
    tempCanvas.height = canvas.height + 60; // Extra height for text

    // Fill white background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw Item Name Text
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.fillText(itemName, tempCanvas.width / 2, 40);

    // Draw the Barcode from the main canvas onto temp canvas
    ctx.drawImage(canvas, padding / 2, 50);

    const link = document.createElement("a");
    link.download = `${itemName.replace(/\s+/g, "_")}_barcode.${format}`;
    link.href = tempCanvas.toDataURL(
      `image/${format === "jpg" ? "jpeg" : "png"}`
    );
    link.click();
  };

  const downloadPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF();

    pdf.setFontSize(16);
    pdf.text(itemName, 105, 40, { align: "center" });
    pdf.addImage(imgData, "PNG", 55, 50, 100, 50); // x, y, w, h
    pdf.save(`${itemName.replace(/\s+/g, "_")}_barcode.pdf`);
  };

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
            Online Barcode Generator
          </h1>
          <p className="text-gray-600">
            Generate unlimited barcodes and manage product sales with Inside
            Invoice.
          </p>
        </div>

        {/* --- GENERATOR SECTION --- */}
        <div className="flex flex-col md:flex-row gap-8 bg-white shadow-lg rounded-xl p-6 border border-gray-200 mb-16">
          {/* Left: Inputs */}
          <div className="w-full md:w-1/2 space-y-6">
            <div>
              <label className="block mb-2 font-bold text-gray-700">
                Item Name
              </label>
              <input
                type="text"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. T-Shirt Blue L"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-2 font-bold text-gray-700">
                Item Code (Data)
              </label>
              <input
                type="text"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 123456789"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-2 font-bold text-gray-700">Size</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setBarcodeSize(1)}
                  className={`flex-1 py-2 rounded border ${
                    barcodeSize === 1
                      ? "bg-blue-100 border-blue-500 text-blue-700"
                      : "bg-gray-50"
                  }`}
                >
                  Small
                </button>
                <button
                  onClick={() => setBarcodeSize(2)}
                  className={`flex-1 py-2 rounded border ${
                    barcodeSize === 2
                      ? "bg-blue-100 border-blue-500 text-blue-700"
                      : "bg-gray-50"
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setBarcodeSize(3)}
                  className={`flex-1 py-2 rounded border ${
                    barcodeSize === 3
                      ? "bg-blue-100 border-blue-500 text-blue-700"
                      : "bg-gray-50"
                  }`}
                >
                  Large
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Adjusting size helps with printing resolution.
              </p>
            </div>
          </div>

          {/* Right: Preview & Download */}
          <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
            <div className="bg-white p-6 shadow-sm border rounded mb-6 text-center w-full overflow-hidden flex flex-col items-center">
              <h3 className="text-lg font-bold mb-2">{itemName}</h3>
              <canvas ref={canvasRef} className="max-w-full"></canvas>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
              <button
                onClick={() => downloadImage("png")}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-semibold text-sm"
              >
                Download PNG
              </button>
              <button
                onClick={() => downloadImage("jpg")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded font-semibold text-sm"
              >
                Download JPG
              </button>
              <button
                onClick={downloadPDF}
                className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-semibold text-sm"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {/* --- CONTENT SECTION --- */}
        <div className="prose max-w-none text-gray-700 space-y-12">
          {/* Steps */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              How to generate a online barcode using Inside Invoice?
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <span className="font-bold text-blue-700 block mb-2">
                  Step 1
                </span>
                <p>Enter Your Item Information in Barcode Generator Tool.</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <span className="font-bold text-blue-700 block mb-2">
                  Step 2
                </span>
                <p>Click on inputs to auto-create your barcode instantly.</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <span className="font-bold text-blue-700 block mb-2">
                  Step 3
                </span>
                <p>
                  Choose the size of your barcode then download in PNG, JPG or
                  PDF.
                </p>
              </div>
            </div>
          </section>

          {/* Intro */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Free Barcode generator online.
            </h2>
            <p className="mb-4">
              Using the free barcode generator by Inside Invoice, you can create
              barcodes for every item in your inventory with a few simple steps.
              You can also use a barcode generator to create barcodes that lets
              users scan for shipping details or for payment links that can act
              as a convenient way to get payments digitally.
            </p>
          </section>

          {/* Definitions */}
          <section className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                What is a barcode?
              </h3>
              <p>
                A barcode encrypts information about an item. It gets generated
                by using parallel bars of black and white. The thickness of
                parallel bars and space between them is read by a barcode
                scanner. It helps decrypt the data stored within a barcode. To
                decrypt the data, a barcode scanner is required. Using it, you
                can read the information stored in a barcode instantly.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Why do businesses use barcodes?
              </h3>
              <p>
                Barcodes make it seamless for businesses and corporations. Some
                benefits of using barcodes are listed below.
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <strong>Monitoring assets:</strong> Easily track the movement
                  of portable assets.
                </li>
                <li>
                  <strong>Tracking inventory:</strong> Check expiry dates and
                  identify products using serial codes.
                </li>
                <li>
                  <strong>Delivery Challan:</strong> Scan barcode info on
                  packages for logistics checks.
                </li>
              </ul>
            </div>
          </section>

          {/* Benefits */}
          <section className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              How can barcodes help in managing inventory?
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold mb-1">Saving time :</h4>
                <p className="text-sm">
                  Using a barcode sticker, you can make it quicker for your
                  employees to feed information into your system.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-1">Helping monitor stock item :</h4>
                <p className="text-sm">
                  Store the batch number, expiry dates, and other product
                  information easily using barcodes generated online.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-1">
                  Providing better customer service :
                </h4>
                <p className="text-sm">
                  Quickly bill your customers by using barcodes generated by the
                  Inside Invoice app. It can help you provide better customer
                  service by eliminating the requirement of typing data in each
                  bill.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-1">Reducing errors :</h4>
                <p className="text-sm">
                  Barcodes essentially eliminate the risk of manual entry
                  errors. It can help you reduce the chances of making any
                  expensive mistake.
                </p>
              </div>
            </div>
            <p className="text-center font-semibold text-blue-600 mt-6">
              Provide convenience to your customers by enabling barcode
              generator now!
            </p>
          </section>

          {/* Testimonials */}
          <section className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Reviews from our customers!
            </h2>
            <blockquote className="italic text-lg text-gray-600 max-w-2xl mx-auto">
              " I generated barcodes for my inventory items using the Inside
              Invoice online barcode generator. It was an easy task. I have
              decided to use the Inside Invoice app for creating barcodes for my
              business. "
            </blockquote>
            <p className="font-bold mt-4">- Fahad Pasha</p>
          </section>

          {/* Call to Action */}
          <div className="bg-blue-600 text-white rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">
              So what are you waiting for?
            </h2>
            <p className="mb-6">
              Take your business to the next level with Inside Invoice!
            </p>
            <Link to="/login">
              <button className="bg-white text-blue-700 font-bold py-3 px-8 rounded-full hover:bg-gray-100 transition shadow-lg">
                Get Started Now
              </button>
            </Link>
          </div>

          {/* FAQ */}
          <section className="bg-gray-100 p-8 rounded-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {[
                {
                  q: "What to do once I generate a barcode using Inside Invoice?",
                  a: "Once generated, you can start using your barcode for your requirements. Print it and attach it to the package or an inventory item as required in your business.",
                },
                {
                  q: "Is the barcode different from SKU?",
                  a: "Barcode is a specially generated code that can be read using a barcode scanner only. However, SKU is a unique alphanumeric code used to assist internal references. Being alphanumeric, you need not scan SKU to read it.",
                },
                {
                  q: "How to select the best type of barcode for my business?",
                  a: "Consider three parameters: The scanner you are using, the type of data you need to store, and the industry standards you are obliged to meet.",
                },
                {
                  q: "What is the difference between 1D and 2D barcodes?",
                  a: "The visible difference is that 1D barcodes have vertical parallel lines. However, in 2D barcodes (like QR codes), both vertical and horizontal patterns exist.",
                },
                {
                  q: "Are the barcodes generated unique to my business?",
                  a: "This free tool generates a visual barcode from the code you enter. It does not provide GS1 registration. If your industry requires GS1 standards, register with GS1 India separately.",
                },
                {
                  q: "Is it free to use the Inside Invoice barcode generator?",
                  a: "Yes, using the Inside Invoice barcode generator is free of cost. You can create unlimited barcodes for your business.",
                },
              ].map((faq, i) => (
                <details
                  key={i}
                  className="group bg-white p-4 rounded-lg shadow-sm"
                >
                  <summary className="flex justify-between items-center font-medium cursor-pointer list-none">
                    <span>{faq.q}</span>
                    <span className="transition group-open:rotate-180">
                      <svg
                        fill="none"
                        height="24"
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
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
          <div className="mt-16 border-t pt-8 text-center text-sm text-gray-500">
            <p>
              Copyright © {new Date().getFullYear()} Inside Invoice by 2X+1. All
              rights reserved.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default BarcodeGenerator;
