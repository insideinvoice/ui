import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createWorker } from "tesseract.js";
import AppNavbar from "../components/AppNavbar";
import PageHeader from "../components/PageHeader";
import { Camera, Upload, RotateCcw, Loader2, AlertCircle, ScanLine } from "lucide-react";
import toast from "react-hot-toast";

const GEMINI_KEY = "AQ.Ab8RN6IV4_H9qOPPQHuw7s-_fZSzxzvoIHCjiSxYdqCTgnd42g";

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function canvasToDataUrl(canvas) {
  return canvas.toDataURL("image/png");
}

function canvasToBase64(canvas) {
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}

function drawToCanvas(img, maxSize) {
  const canvas = document.createElement("canvas");
  let w = img.width;
  let h = img.height;
  if (w > maxSize || h > maxSize) {
    if (w > h) { h = (h * maxSize) / w; w = maxSize; }
    else { w = (w * maxSize) / h; h = maxSize; }
  }
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

function applyGrayscale(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  const data = d.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(d, 0, 0);
}

function applySharpen(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  const src = new Float32Array(d.data);
  const data = d.data;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kIdx = (ky + 1) * 3 + (kx + 1);
          const pIdx = ((y + ky) * w + (x + kx)) * 4;
          r += src[pIdx] * kernel[kIdx];
          g += src[pIdx + 1] * kernel[kIdx];
          b += src[pIdx + 2] * kernel[kIdx];
        }
      }
      data[idx] = Math.min(255, Math.max(0, r));
      data[idx + 1] = Math.min(255, Math.max(0, g));
      data[idx + 2] = Math.min(255, Math.max(0, b));
    }
  }
  ctx.putImageData(d, 0, 0);
}

function applyAdaptiveThreshold(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  const data = d.data;
  const grays = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    grays[i] = data[i * 4];
  }
  const radius = Math.max(1, Math.round(Math.min(w, h) / 20));
  const c = 10;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            sum += grays[ny * w + nx];
            count++;
          }
        }
      }
      const avg = sum / count;
      const idx = (y * w + x) * 4;
      const val = grays[y * w + x] > avg - c ? 255 : 0;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }
  ctx.putImageData(d, 0, 0);
}

function applyBinarize(ctx, w, h, threshold) {
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = d.data[i] > threshold ? 255 : 0;
    d.data[i] = v;
    d.data[i + 1] = v;
    d.data[i + 2] = v;
  }
  ctx.putImageData(d, 0, 0);
}

function applyNoiseRemoval(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h);
  const src = new Uint8Array(d.data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      let blackCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (src[((y + dy) * w + (x + dx)) * 4] === 0) blackCount++;
        }
      }
      if (blackCount < 3) {
        d.data[idx] = 255;
        d.data[idx + 1] = 255;
        d.data[idx + 2] = 255;
      }
    }
  }
  ctx.putImageData(d, 0, 0);
}

function preprocessImage(canvas, ctx, variant) {
  const w = canvas.width;
  const h = canvas.height;

  applyGrayscale(ctx, w, h);

  if (variant === "sharpen") {
    applySharpen(ctx, w, h);
    applyAdaptiveThreshold(ctx, w, h);
  } else if (variant === "binary") {
    applyBinarize(ctx, w, h, 140);
    applyNoiseRemoval(ctx, w, h);
  } else if (variant === "adaptive") {
    applyAdaptiveThreshold(ctx, w, h);
  } else {
    applyBinarize(ctx, w, h, 160);
  }
  return canvasToDataUrl(canvas);
}

async function extractWithGemini(base64Image) {
  const prompt = `You are extracting structured invoice data from a photo of a handwritten or printed bill. Extract the following fields ONLY if they are actually visible in the image — do not guess or invent values. Return ONLY valid JSON, no markdown formatting, no extra text, in this exact shape: {"customerName": string or null, "customerPhone": string or null, "invoiceDate": string in YYYY-MM-DD format or null, "items": [{"description": string or null, "hsnSac": string or null, "quantity": number or null, "rate": number or null}]}. Extract every line item visible, in the order they appear on the bill. If a field is illegible, cut off, or not present, use null rather than guessing.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64Image } },
        ],
      }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResult) throw new Error("No extraction result returned");

  return JSON.parse(textResult);
}

function cleanOcrText(text) {
  return text
    .replace(/[|\[\]{}()_=+`~@#$^&*<>\/\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(str) {
  if (!str) return null;
  let s = str.replace(/[^0-9.,]/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(/,/g, "");
  }
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

function extractItemsFromLines(lines) {
  const items = [];

  for (const line of lines) {
    const cleaned = cleanOcrText(line);
    if (!cleaned || cleaned.length < 3) continue;

    if (cleaned.match(/^(total|sub.?total|grand.?total|amount|tax|gst|discount|round|net|balance|due|received)/i)) continue;
    if (cleaned.match(/^(invoice|bill|date|phone|mobile|email|address|gst|pan|name|customer)/i)) continue;
    if (cleaned.match(/^[•\-\*]\s*$/)) continue;

    let qtyVal = null;
    let rateVal = null;
    let desc = cleaned;

    const qtyRatePatterns = [
      { pattern: /(\d+[\.,]?\d*)\s*[xX*]\s*(\d+[\.,]?\d*)/ },
      { pattern: /^(\d+)\s+(\d+[\.,]?\d*)\s+(\d+[\.,]?\d*)/ },
      { pattern: /^\d+\s+\d+/ },
    ];

    for (const p of qtyRatePatterns) {
      const m = cleaned.match(p.pattern);
      if (m) {
        const nums = cleaned.match(/\d+[\.,]?\d*/g);
        if (nums && nums.length >= 2) {
          const prevNum = parseNumber(nums[0]);
          const lastNum = parseNumber(nums[nums.length - 1]);
          if (p.pattern.toString().includes("[xX*]")) {
            qtyVal = prevNum;
            rateVal = lastNum;
            desc = cleaned.replace(m[0], "").trim();
          } else if (p.pattern.toString().includes("\\d+\\s+\\d+")) {
            const midNum = nums.length >= 3 ? parseNumber(nums[1]) : null;
            if (midNum && midNum > prevNum) {
              qtyVal = prevNum;
              rateVal = midNum;
              desc = cleaned.replace(
                new RegExp(`^${nums[0]}\\s+${nums[1]}`), ""
              ).trim();
            }
          }
          break;
        }
      }
    }

    if (qtyVal && rateVal) {
      let textPrefix = desc
        .replace(/\s*\d+[\.,]?\d*\s*[xX*]\s*\d+[\.,]?\d*/, "")
        .replace(/^[•\-\*\d.\s]+/, "")
        .trim();
      if (!textPrefix || textPrefix.length < 2) {
        const splitted = cleaned.split(/\s+/);
        let textParts = [];
        let seenQty = false;
        for (const part of splitted) {
          if (!seenQty && part.match(/^\d+[\.,]?\d*$/)) {
            seenQty = true;
            continue;
          }
          if (seenQty) continue;
          if (part.match(/^[xX*]$/)) continue;
          if (part.length > 1 && isNaN(parseFloat(part))) textParts.push(part);
        }
        textPrefix = textParts.join(" ").trim();
      }
      items.push({
        description: textPrefix || null,
        hsnSac: null,
        quantity: qtyVal,
        rate: rateVal,
      });
    }
  }

  if (items.length === 0) {
    for (const line of lines) {
      const nums = line.match(/\d+[\.,]?\d*/g);
      if (nums && nums.length >= 2) {
        const lastTwo = nums.slice(-2);
        const rateCand = parseNumber(lastTwo[1]);
        const qtyCand = parseNumber(lastTwo[0]);
        if (rateCand && qtyCand && rateCand < 100000) {
          const desc = line.replace(/\d+[\.,]?\d*/g, "").replace(/\s+/g, " ").trim();
          if (desc.length > 2) {
            items.push({
              description: desc,
              hsnSac: null,
              quantity: qtyCand,
              rate: rateCand,
            });
          }
        }
      }
    }
  }

  if (items.length === 0) {
    for (const line of lines) {
      if (
        line.length > 3 &&
        line.length < 60 &&
        !line.match(/^[\d\s.,₹$]+$/) &&
        !line.match(/^(total|sub.?total|grand.?total|amount|tax|gst)/i) &&
        !line.match(/^[•\-\*]/)
      ) {
        const nums = line.match(/\d+[\.,]?\d*/g);
        items.push({
          description: line.replace(/\d+[\.,]?\d*/g, "").replace(/\s+/g, " ").trim(),
          hsnSac: null,
          quantity: null,
          rate: nums ? parseNumber(nums[nums.length - 1]) : null,
        });
      }
    }
  }

  return items;
}

async function runOcrWorker(imageDataUrl, psm) {
  const worker = await createWorker("eng", 1, { logger: () => {} });
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: "",
  });
  const { data } = await worker.recognize(imageDataUrl);
  await worker.terminate();
  return data;
}

async function extractWithOCR(img) {
  const preprocessVariants = ["sharpen", "binary", "adaptive", "default"];
  const psmModes = ["4", "6"];

  let bestResult = null;
  let bestScore = -1;

  for (const variant of preprocessVariants) {
    const { canvas, ctx } = drawToCanvas(img, 2000);
    const processedUrl = preprocessImage(canvas, ctx, variant);

    for (const psm of psmModes) {
      try {
        const data = await runOcrWorker(processedUrl, psm);
        const text = data.text || "";
        const words = data.words || [];
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const confidenceSum = words.reduce((s, w) => s + (w.confidence || 0), 0);
        const avgConfidence = words.length > 0 ? confidenceSum / words.length : 0;
        const numCount = (text.match(/\d+/g) || []).length;
        const lineCount = lines.length;
        const score = avgConfidence * 0.4 + numCount * 5 + lineCount * 2;

        if (score > bestScore) {
          bestScore = score;
          bestResult = { text, lines, words };
        }
      } catch (e) {
        console.warn(`OCR failed for variant=${variant} psm=${psm}:`, e);
      }
    }
  }

  if (!bestResult) throw new Error("All OCR passes failed");

  const text = bestResult.text;
  const lines = bestResult.lines;

  let customerName = null;
  let customerPhone = null;
  let invoiceDate = null;
  let items = [];

  const phonePatterns = [
    /(?:ph|phone|mobile|cell|tel|contact|call)[:\s]*(\+?\d[\d\s\-()]{7,}\d)/i,
    /\b(\d{10})\b/,
    /\b(\+91[\s\-]?\d{10})\b/,
    /\b(\d{5}[\s\-]?\d{5})\b/,
  ];
  for (const p of phonePatterns) {
    const m = text.match(p);
    if (m) {
      customerPhone = m[1].replace(/[\s\-()]/g, "").slice(-10);
      if (customerPhone.length === 10) break;
    }
  }

  const datePatterns = [
    /(\d{1,2})[\/\-\.]([A-Za-z]{3,})[\/\-\.](\d{4})/,
    /(\d{4})[\/\-\.]([A-Za-z]{3,})[\/\-\.](\d{1,2})/,
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
    /(\d{1,2})\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})/i,
  ];
  for (const p of datePatterns) {
    const m = text.match(p);
    if (m) {
      const monthMap = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
      const monthKey = (m[2] || "").toLowerCase().slice(0, 3);
      if (monthMap[monthKey]) {
        const day = m[1].padStart(2, "0");
        const year = m[3] || m[1];
        invoiceDate = `${year}-${monthMap[monthKey]}-${day}`;
      } else if (m[1] && m[2] && m[3]) {
        let a = m[1], b = m[2], y = m[3];
        if (y.length === 2) y = "20" + y;
        if (parseInt(a) > 31) { [a, b] = [b, a]; }
        if (parseInt(a) > 12) { [b, a] = [a, b]; }
        const month = b.padStart(2, "0");
        const day = a.padStart(2, "0");
        if (parseInt(month) >= 1 && parseInt(month) <= 12 && parseInt(day) >= 1 && parseInt(day) <= 31) {
          invoiceDate = `${y}-${month}-${day}`;
        }
      }
      if (invoiceDate) break;
    }
  }

  items = extractItemsFromLines(lines);

  if (items.length === 0) {
    for (const line of lines) {
      const parts = line.split(/\s{2,}/);
      if (parts.length >= 3) {
        const lastNum = parseNumber(parts[parts.length - 1]);
        const secondLast = parseNumber(parts[parts.length - 2]);
        if (lastNum && secondLast && lastNum < 100000) {
          items.push({
            description: parts.slice(0, -2).join(" ").trim(),
            hsnSac: null,
            quantity: null,
            rate: lastNum,
          });
        }
      }
    }
  }

  if (!customerName) {
    const skipWords = [
      "total", "sub", "amount", "tax", "gst", "bill", "invoice", "date",
      "phone", "mobile", "email", "address", "qty", "rate", "item",
      "description", "hsn", "sac", "sl", "no", "particulars", "name",
      "customer", "our", "gstin", "pan", "aadhar", "delivery", "payment",
      "terms", "reference", "order", "shipping", "billing", "m/s", "m/s."
    ];
    const nameCandidates = [];
    for (const line of lines) {
      const cleaned = cleanOcrText(line);
      if (
        cleaned.length > 3 &&
        cleaned.length < 45 &&
        !cleaned.match(/^\d/) &&
        !skipWords.some((sw) => cleaned.toLowerCase().startsWith(sw)) &&
        !cleaned.match(/^[•\-\*]/)
      ) {
        nameCandidates.push(cleaned);
      }
    }
    if (nameCandidates.length > 0) {
      const topSection = nameCandidates.slice(0, 3);
      customerName = topSection.find((n) => n.length > 5 && !n.match(/\d/)) || topSection[0];
    }
  }

  return { customerName, customerPhone, invoiceDate, items };
}

export default function InvoiceUpload() {
  const navigate = useNavigate();
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setError(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, []);

  const navigateWithResult = useCallback((result) => {
    const today = new Date().toISOString().split("T")[0];
    const items = (result.items || []).map((item) => ({
      itemName: item.description || "",
      hsn: item.hsnSac || "",
      qty: item.quantity != null ? String(item.quantity) : "",
      rate: item.rate != null ? String(item.rate) : "",
      gstPercentage: "18",
      taxableValue: 0,
      taxAmount: 0,
      total: 0,
    }));
    if (items.length === 0) {
      items.push({ itemName: "", hsn: "", qty: "", rate: "", gstPercentage: "18", taxableValue: 0, taxAmount: 0, total: 0 });
    }
    navigate("/invoice", {
      state: {
        prefilled: true,
        customerName: result.customerName || "",
        customerPhone: result.customerPhone || "",
        invoiceDate: result.invoiceDate || today,
        items,
      },
    });
  }, [navigate]);

  const handleExtract = useCallback(async () => {
    if (!selectedFile) return;
    setExtracting(true);
    setError(null);

    try {
      const img = await loadImage(selectedFile);

      try {
        toast.loading("Trying AI extraction...", { id: "extract" });
        const { canvas } = drawToCanvas(img, 1600);
        const base64 = canvasToBase64(canvas);
        const result = await extractWithGemini(base64);
        toast.success("AI extraction successful!", { id: "extract" });
        navigateWithResult(result);
        return;
      } catch (aiErr) {
        console.warn("Gemini failed:", aiErr);
      }

      toast.loading("AI unavailable — running advanced OCR...", { id: "extract" });
      const ocrResult = await extractWithOCR(img);
      toast.success("OCR extraction complete!", { id: "extract" });
      navigateWithResult(ocrResult);
    } catch (err) {
      console.error("All extraction methods failed:", err);
      toast.dismiss("extract");
      setError("Couldn't read this bill — try a clearer photo or enter manually.");
    } finally {
      setExtracting(false);
    }
  }, [selectedFile, navigateWithResult]);

  const handleReset = useCallback(() => {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-gray-100">
      <AppNavbar />
      <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 max-w-[1900px] mx-auto">
        <PageHeader title="Upload Invoice" />

        <div className="max-w-lg mx-auto mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            {!preview ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 text-center">
                  Take a photo or upload an image of your bill to auto-fill the invoice form.
                </p>
                <p className="text-[11px] text-slate-400 text-center -mt-2">
                  Uses AI first, falls back to OCR if unavailable
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
                  >
                    <Camera className="w-8 h-8 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Take Photo</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
                  >
                    <Upload className="w-8 h-8 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Upload File</span>
                  </button>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-slate-200">
                  <img src={preview} alt="Bill preview" className="w-full max-h-80 object-contain bg-slate-50" />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    disabled={extracting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50 min-h-[44px]"
                  >
                    <RotateCcw className="w-4 h-4" /> Retake
                  </button>
                  <button
                    onClick={handleExtract}
                    disabled={extracting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm min-h-[44px]"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Reading your bill...
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-4 h-4" /> Extract Data
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <button
                    onClick={() => navigate("/invoice")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-all min-h-[44px]"
                  >
                    Enter Manually
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
