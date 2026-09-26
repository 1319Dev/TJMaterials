import { useState } from 'react';
import type { ProjectRecord } from '../domain/types';
import { useApp } from '../state/AppState';
import { controlClass, Field } from '../components/ui';

export function ProjectPage() {
  const { snapshot, saveProject, attachDocument, deleteDocument, openDocument } = useApp();
  const [draft, setDraft] = useState<ProjectRecord | null>(snapshot?.project ?? null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  if (!snapshot || !draft) return null;
  const loaded = snapshot;
  const projectDraft = draft;

  const documents = loaded.documents.filter((document) => document.subjectType === 'project');

  function set<K extends keyof ProjectRecord>(key: K, value: ProjectRecord[K]) {
    setDraft({ ...draft!, [key]: value });
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = saveProject(projectDraft);
    setErrors(nextErrors);
    setSaved(nextErrors.length === 0);
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await attachDocument(file, 'project', loaded.project.id);
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <h1 className="text-2xl font-black">Project setup</h1>
      <p className="text-sm text-pmi-muted">
        Atmos Project # is the customer reference from the MTR request form. This app is not an Atmos Energy product.
      </p>
      {errors.length > 0 ? (
        <ul role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {saved ? <p role="status">Project saved on this device.</p> : null}

      <Field label="Project name">
        <input className={controlClass} value={draft.name} onChange={(event) => set('name', event.target.value)} />
      </Field>
      <Field label="Project Number" hint="Bill of materials header">
        <input className={controlClass} value={draft.projectNumber} onChange={(event) => set('projectNumber', event.target.value)} />
      </Field>
      <Field label="Construction Order No.">
        <input className={controlClass} value={draft.constructionOrderNo} onChange={(event) => set('constructionOrderNo', event.target.value)} />
      </Field>
      <Field label="Atmos Project #">
        <input className={controlClass} value={draft.atmosProjectNumber} onChange={(event) => set('atmosProjectNumber', event.target.value)} />
      </Field>
      <Field label="Inspector Name">
        <input className={controlClass} value={draft.inspectorName} onChange={(event) => set('inspectorName', event.target.value)} />
      </Field>
      <Field label="Vendor">
        <input className={controlClass} value={draft.vendor} onChange={(event) => set('vendor', event.target.value)} />
      </Field>
      <Field label="Sales Order# / Customer PO #">
        <input
          className={controlClass}
          value={draft.salesOrderOrCustomerPo}
          onChange={(event) => set('salesOrderOrCustomerPo', event.target.value)}
        />
      </Field>
      <Field label="Client / owner">
        <input className={controlClass} value={draft.clientName} onChange={(event) => set('clientName', event.target.value)} />
      </Field>
      <Field label="Spread / segment">
        <input className={controlClass} value={draft.spread} onChange={(event) => set('spread', event.target.value)} />
      </Field>
      <Field label="Location">
        <input className={controlClass} value={draft.locationName} onChange={(event) => set('locationName', event.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea className={controlClass} rows={3} value={draft.notes} onChange={(event) => set('notes', event.target.value)} />
      </Field>

      <button type="submit" className="min-h-14 w-full rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text">
        Save project
      </button>

      <section className="space-y-3" aria-labelledby="docs-heading">
        <h2 id="docs-heading" className="text-sm font-bold uppercase tracking-wide">
          Document attachments
        </h2>
        <Field label="Attach document" hint="Name, type, and size are saved on this device.">
          <input className={controlClass} type="file" onChange={onFile} />
        </Field>
        <ul className="space-y-2">
          {documents.map((document) => (
            <li key={document.id} className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
              <p className="font-bold">{document.fileName}</p>
              <p className="text-sm">
                {document.mimeType || 'unknown type'} · {document.byteSize} bytes
              </p>
              <p className="text-sm text-pmi-muted">{document.notes}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="min-h-12 rounded-xl border-2 border-pmi-border px-3 font-bold"
                  onClick={async () => {
                    const url = await openDocument(document.id);
                    if (!url) return;
                    window.open(url, '_blank', 'noopener');
                  }}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="min-h-12 rounded-xl border-2 border-pmi-border px-3 font-bold"
                  onClick={() => deleteDocument(document.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </form>
  );
}
