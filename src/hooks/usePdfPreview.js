import { useEffect, useRef, useState } from "react";

export default function usePdfPreview(payload, previewFn, skip = false, delayMs = 400) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);
  const urlRef = useRef(null);
  const previewFnRef = useRef(previewFn);

  useEffect(() => {
    previewFnRef.current = previewFn;
  }, [previewFn]);

  useEffect(() => {
    if (skip) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setPdfUrl(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setError(null);
        const res = await previewFnRef.current(payload);
        // A slower, older request must never overwrite a newer preview.
        if (cancelled) return;
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPdfUrl(url);
      } catch {
        if (!cancelled) setError("Preview unavailable");
      }
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(payload), skip, delayMs]);

  // Release the last blob URL when the consumer unmounts.
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return { pdfUrl, error };
}
