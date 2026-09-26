import { useState } from 'react';
import { searchRecords } from '../domain/search';
import { useApp } from '../state/AppState';
import { VerificationBadge, controlClass } from '../components/ui';

export function SearchPage() {
  const { snapshot } = useApp();
  const [query, setQuery] = useState('');
  if (!snapshot) return null;
  const hits = searchRecords(snapshot, query);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Search</h1>
      <label className="block">
        <span className="block text-sm font-bold uppercase tracking-wide text-pmi-muted">
          Heat, joint, serial, PO, BOL, manufacturer, or Material ID
        </span>
        <input
          className={controlClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          placeholder="H52-18440"
        />
      </label>
      {query.trim().length < 2 ? (
        <p className="text-sm text-pmi-muted">Enter at least 2 characters. Results come only from records on this device.</p>
      ) : hits.length === 0 ? (
        <p role="status">No records matched. Nothing was guessed.</p>
      ) : (
        <ul className="space-y-3" aria-label="Search results">
          {hits.map((hit) => (
            <li key={`${hit.kind}-${hit.id}`} className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
              <p className="text-xs font-bold uppercase text-pmi-muted">{hit.kind}</p>
              <p className="text-lg font-black">{hit.title}</p>
              <p>{hit.subtitle}</p>
              <p className="text-sm text-pmi-muted">Matched on {hit.matchedOn}</p>
              {hit.verificationStatus ? (
                <div className="mt-2">
                  <VerificationBadge status={hit.verificationStatus} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
