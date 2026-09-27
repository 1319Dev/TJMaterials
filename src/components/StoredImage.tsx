import { useEffect, useState } from 'react';
import { useApp } from '../state/AppState';

export function StoredImage({ documentId, alt }: { documentId: string; alt: string }) {
  const { openDocument } = useApp();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let current: string | null = null;
    void openDocument(documentId).then((next) => {
      if (!active) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      current = next;
      setUrl(next);
    });
    return () => {
      active = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [documentId, openDocument]);

  if (!url) return <p className="text-sm font-bold">Photo stored on this device.</p>;
  return <img src={url} alt={alt} className="max-h-64 w-full border-2 border-pmi-border bg-pmi-card object-contain" />;
}
