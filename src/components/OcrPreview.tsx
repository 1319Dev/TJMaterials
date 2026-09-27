import { useEffect, useState } from 'react';
import type { PackingSlipParse } from '../domain/packing-slip-ocr';
import type { OcrProposal } from '../domain/tracker';
import { controlClass, Field } from './ui';

export interface OcrDraft extends PackingSlipParse {
  documentId: string | null;
  deliveryId: string | null;
}

function percent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function OcrPreview({
  draft,
  onApply,
}: {
  draft: OcrDraft;
  onApply: (input: { proposals: OcrProposal[]; constructionOrderNo: string; projectNumber: string }) => void;
}) {
  const [rows, setRows] = useState(draft.proposals.map((proposal) => ({ ...proposal, include: true })));
  const [constructionOrderNo, setConstructionOrderNo] = useState(draft.constructionOrderNo);
  const [projectNumber, setProjectNumber] = useState(draft.projectNumber);

  useEffect(() => {
    setRows(draft.proposals.map((proposal) => ({ ...proposal, include: true })));
    setConstructionOrderNo(draft.constructionOrderNo);
    setProjectNumber(draft.projectNumber);
  }, [draft]);

  function updateRow(key: string, patch: Partial<OcrProposal>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const selected = rows.filter((row) => row.include);

  return (
    <section id="ocr-preview" className="space-y-3 border-2 border-pmi-hold bg-pmi-card p-3" aria-labelledby="ocr-preview-heading">
      <h2 id="ocr-preview-heading" className="text-xl font-black">
        OCR preview
      </h2>
      <p className="text-sm font-bold">
        Edit the rows, then apply them. Nothing is written until you confirm. Material is not accepted.
      </p>
      {draft.packingSlipNumber ? <p className="pmi-code font-bold">Packing slip {draft.packingSlipNumber}</p> : null}
      <Field label="Construction Order No">
        <input className={controlClass} value={constructionOrderNo} onChange={(event) => setConstructionOrderNo(event.target.value)} />
      </Field>
      <Field label="Project Number">
        <input className={controlClass} value={projectNumber} onChange={(event) => setProjectNumber(event.target.value)} />
      </Field>
      {rows.length === 0 ? (
        <p className="pmi-flag" role="status">
          No line items were read. Nothing was written to the tracker.
        </p>
      ) : (
        rows.map((row, index) => (
          <fieldset key={row.key} className={`space-y-3 border-2 p-3 ${row.uncertain ? 'border-pmi-hold' : 'border-pmi-border'}`}>
            <legend className="px-1 font-black">Line {index + 1}</legend>
            <label className="flex min-h-12 items-center gap-3 text-lg font-black">
              <input
                type="checkbox"
                className="h-6 w-6"
                checked={row.include}
                onChange={(event) =>
                  setRows((current) => current.map((item) => (item.key === row.key ? { ...item, include: event.target.checked } : item)))
                }
              />
              Include this row
            </label>
            <p className="text-sm font-bold">Confidence {percent(row.confidence)}</p>
            {row.uncertain ? <p className="pmi-flag">REVIEW REQUIRED — OCR uncertain</p> : <p className="pmi-chip pmi-chip-warn">REVIEW REQUIRED</p>}
            {(
              [
                ['Item', 'item'],
                ['QTY', 'qty'],
                ['Size (Inches)', 'sizeInches'],
                ['Description', 'description'],
                ['Wall/SDR', 'wallSdr'],
                ['Steel Grade', 'steelGrade'],
                ['Manufacturer', 'manufacturer'],
                ['Model Number', 'modelNumber'],
                ['Serial/Lot/Heat #', 'serialLotHeat'],
                ['ANSI/Pressure Rating', 'ansiPressureRating'],
              ] as const
            ).map(([label, field]) => (
              <Field key={field} label={`${label} line ${index + 1}`}>
                <input className={controlClass} value={row[field]} onChange={(event) => updateRow(row.key, { [field]: event.target.value })} />
              </Field>
            ))}
          </fieldset>
        ))
      )}
      <button
        type="button"
        className="min-h-14 w-full bg-pmi-accent text-lg font-black text-pmi-accent-text disabled:opacity-50"
        disabled={selected.length === 0}
        onClick={() =>
          onApply({
            constructionOrderNo,
            projectNumber,
            proposals: selected.map((row) => ({
              key: row.key,
              item: row.item,
              qty: row.qty,
              sizeInches: row.sizeInches,
              description: row.description,
              wallSdr: row.wallSdr,
              steelGrade: row.steelGrade,
              manufacturer: row.manufacturer,
              modelNumber: row.modelNumber,
              serialLotHeat: row.serialLotHeat,
              ansiPressureRating: row.ansiPressureRating,
              confidence: row.confidence,
              uncertain: false,
              rawText: row.rawText,
            })),
          })
        }
      >
        Apply selected rows to tracker
      </button>
    </section>
  );
}
