# Pipeline Material Inspector

Third-party materials inspection / documentation website for pipeline construction field work. It is a browser app and an installable PWA. GitHub Pages hosts the static Vite build. There is no App Store listing.

Open it in mobile Safari at `https://1319dev.github.io/TJMaterials/`. To keep an icon on the phone, tap Share, then Add to Home Screen. That icon opens this same site.

Not an official Atmos Energy or TJ Inspection application. The app records what an inspector enters. It does not decide that material is acceptable.

## Sign-in and sync

The home screen is an inspector’s project, not a guest demo. A new project starts empty. Material is added only when someone receives it.

IndexedDB is the offline cache. When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set at build time, the app signs in with email and password or an email sign-in link, then uploads the queue and pulls that inspector’s project memberships. Row level security is in the SQL migrations: an inspector only reads projects they belong to.

Status labels:

- **OFFLINE — SAVED LOCALLY** — no connection, or this build has no database settings
- **SAVED** — the change is on this device and waiting to sync
- **SYNCING** — the queue is being sent
- **SYNC COMPLETE** — the database acknowledged the queue

Auth Site URL: `https://1319dev.github.io/TJMaterials/`

Redirect allow list:

- `https://1319dev.github.io/TJMaterials/`
- `https://1319dev.github.io/TJMaterials/auth/callback`
- `http://localhost:5173/TJMaterials/auth/callback`

GitHub Actions secrets for the Pages build use the same names: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use the anon (publishable) key. Do not put the service role key in the site.

More → **Load sample project** opens the optional sample spread on this device. It is labeled SAMPLE and is not uploaded. **Back to my project** returns to the empty or synced project.

## Phase 1

Records stay available on the device when the network drops. The earlier guest-only build is replaced by the sign-in path above.

- Mobile shell with Home, Receive, Inventory, Search, and More
- Project setup and local document metadata
- Material receiving (delivery header, packing slip / BOL, photo and GPS stubs, line items)
- Search by heat, joint, serial, PO, BOL, manufacturer, or Material ID
- Light, dark, and high-contrast outdoor themes
- Supabase schema in `supabase/migrations` (not applied from the static site)

Material IDs look like `PMI-PIPE-000001`.

## Phase 2

Pipe tally and dedicated receiving forms. Still no OCR, and still no automatic acceptance.

- Pipe tally: joint number, heat, and length, with joint count, total footage, average length, and footage by heat, grade, and wall. Expected footage is compared with received footage. Export CSV or Excel.
- Fittings (elbow, tee, reducer, cap, other), flanges (classes 150–1500), and valves with an actuator link.
- ASTM A860 WPHY grades. `WPHY 52` and `WPHY52` are the same grade. Expected WPHY 52 against received WPHY 70 shows **GRADE DOES NOT MATCH EXPECTED MATERIAL — ENGINEERING/OPERATOR REVIEW REQUIRED**.
- The sample project, loaded from More, includes pipe joints, fittings, flanges, and valves. It is not the default project.

New receipts stay **REVIEW REQUIRED**. MATCH is not written by these forms.

## Scripts

```bash
npm install
npm test
npm run dev
npm run build
```

The dev and production apps use the `/TJMaterials/` base path. GitHub Pages publishes `dist` to the `gh-pages` branch from `.github/workflows/pages.yml`. In the repository settings, set Pages to deploy from that branch.

`Atmos Project #` and `Shipment # (MRC)` are labels copied from the inspector’s MTR request form. They are customer reference fields.
