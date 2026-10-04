import toast from "react-hot-toast";

export async function downloadLabelPdf(fetcher, filename) {
  try {
    const res = await fetcher();
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    toast.error("PDF download failed");
  }
}

export async function printLabelPdf(fetcher) {
  try {
    const res = await fetcher();
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        window.open(url, "_blank");
      }
      setTimeout(() => {
        try {
          document.body.removeChild(frame);
        } catch {
          // already removed
        }
        URL.revokeObjectURL(url);
      }, 1500);
    };
    document.body.appendChild(frame);
  } catch {
    toast.error("Could not print PDF");
  }
}
