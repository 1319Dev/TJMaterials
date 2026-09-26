import { installGuidance, currentInstallMode } from '../domain/install';

export function InstallGuide() {
  const copy = installGuidance(currentInstallMode());
  return (
    <section id="install" className="space-y-2 rounded-2xl border-2 border-pmi-border bg-pmi-card p-4" aria-labelledby="install-heading">
      <h2 id="install-heading" className="text-sm font-bold uppercase tracking-wide">
        Use it in the browser
      </h2>
      <p className="text-lg font-black">{copy.heading}</p>
      <p>{copy.body}</p>
      <p className="text-sm text-pmi-muted">
        GitHub Pages hosts this website. Adding it to the Home Screen does not download a separate app.
      </p>
    </section>
  );
}
