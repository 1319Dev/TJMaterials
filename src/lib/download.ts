export function downloadBytes(filename: string, mime: string, bytes: Uint8Array): void {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  downloadBlob(filename, new Blob([copy], { type: mime }));
}

export function downloadTextFile(filename: string, mime: string, contents: string): void {
  downloadBlob(filename, new Blob([contents], { type: mime }));
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
