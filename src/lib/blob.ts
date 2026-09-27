export function readBlob(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error('The file could not be read on this device.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read on this device.'));
    reader.readAsArrayBuffer(file);
  });
}
