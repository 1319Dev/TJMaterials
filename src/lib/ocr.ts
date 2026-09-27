export interface RecognizedLine {
  text: string;
  confidence: number;
}

export interface RecognizedSlip {
  text: string;
  confidence: number;
  lines: RecognizedLine[];
}

interface OcrLine {
  text?: string;
  confidence?: number;
}

interface OcrBlock {
  paragraphs?: Array<{ lines?: OcrLine[] }>;
}

interface OcrPage {
  text?: string;
  confidence?: number;
  blocks?: OcrBlock[] | null;
}

interface OcrWorker {
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (
    image: Blob,
    options?: object,
    output?: { text?: boolean; blocks?: boolean },
  ) => Promise<{ data: OcrPage }>;
  terminate: () => Promise<unknown>;
}

interface OcrEngine {
  createWorker: (
    langs: string,
    oem: number,
    options: Record<string, unknown>,
  ) => Promise<OcrWorker>;
  PSM: { SINGLE_BLOCK: string };
}

function asEngine(mod: unknown): OcrEngine {
  if (!mod || typeof mod !== 'object') {
    throw new Error('The on-device OCR engine did not load. Nothing was written.');
  }
  const record = mod as {
    createWorker?: unknown;
    PSM?: { SINGLE_BLOCK?: string };
    default?: { createWorker?: unknown; PSM?: { SINGLE_BLOCK?: string } };
  };
  const source = typeof record.createWorker === 'function' ? record : record.default;
  if (!source || typeof source.createWorker !== 'function' || !source.PSM?.SINGLE_BLOCK) {
    throw new Error('The on-device OCR engine did not load. Nothing was written.');
  }
  return source as OcrEngine;
}

function unitConfidence(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  const scaled = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, scaled));
}

function linesFrom(page: OcrPage): RecognizedLine[] {
  const lines: RecognizedLine[] = [];
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const text = line.text?.trim() ?? '';
        if (!text) continue;
        lines.push({ text, confidence: unitConfidence(line.confidence) });
      }
    }
  }
  if (lines.length === 0 && page.text?.trim()) {
    const pageConfidence = unitConfidence(page.confidence);
    for (const text of page.text.split('\n')) {
      const trimmed = text.trim();
      if (trimmed) lines.push({ text: trimmed, confidence: pageConfidence });
    }
  }
  return lines;
}

export async function recognizePackingSlip(
  image: Blob,
  onProgress?: (status: string, progress: number) => void,
): Promise<RecognizedSlip> {
  const tesseract = asEngine(await import('tesseract.js'));
  const base = import.meta.env.BASE_URL;
  const worker = await tesseract.createWorker('eng', 1, {
    workerPath: `${base}ocr/worker.min.js`,
    corePath: `${base}ocr/core`,
    langPath: `${base}ocr`,
    gzip: true,
    workerBlobURL: true,
    logger: (message: { status?: string; progress?: number }) => {
      onProgress?.(message.status ?? 'Reading on this device', message.progress ?? 0);
    },
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });
    const result = await worker.recognize(image, {}, { text: true, blocks: true });
    const text = result.data.text?.trim() ?? '';
    return {
      text,
      confidence: unitConfidence(result.data.confidence),
      lines: linesFrom(result.data),
    };
  } finally {
    await worker.terminate();
  }
}
