import { useEffect, useRef, useState } from "react";

export default function usePdfPreview(payload, previewFn, skip = false) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);
  const urlRef = useRef(null);
  const previewFnRef = useRef(previewFn);
  previewFnRef.current = previewFn;

  useEffect(() => {
    if (skip) {
      setPdfUrl(null);
      setError(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setError(null);
        const res = await previewFnRef.current(payload);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPdfUrl(url);
      } catch {
        setError("Preview unavailable");
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(payload), skip]);

  return { pdfUrl, error };
}
