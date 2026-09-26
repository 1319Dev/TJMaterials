# Pipeline Material Inspector

Third-party materials inspection / documentation website for pipeline construction field work. It is a browser app and an installable PWA. GitHub Pages hosts the static Vite build. There is no App Store listing.

Open it in mobile Safari at `https://1319dev.github.io/TJMaterials/`. To keep an icon on the phone, tap Share, then Add to Home Screen. That icon opens this same site.

Not an official Atmos Energy or TJ Inspection application. The app records what an inspector enters. It does not decide that material is acceptable.

## Phase 1

Guest demo, no sign-in. Records stay in IndexedDB on the device. The sync queue shows **OFFLINE — SAVED LOCALLY**, **SYNCING**, or **SYNC COMPLETE**. Phase 1 does not upload to a database, so a guest session stays on the first status until a remote project is connected.

- Mobile shell with Home, Receive, Inventory, Search, and More
- Project setup and local document metadata
- Material receiving (delivery header, packing slip / BOL, photo and GPS stubs, line items)
- Search by heat, joint, serial, PO, BOL, manufacturer, or Material ID
- Light, dark, and high-contrast outdoor themes
- Supabase schema in `supabase/migrations` (not applied from the static site)

Material IDs look like `PMI-PIPE-000001`.

## Phase 2

Pipe tally and dedicated receiving forms. Still guest IndexedDB, still no OCR, and still no automatic acceptance.

- Pipe tally: joint number, heat, and length, with joint count, total footage, average length, and footage by heat, grade, and wall. Expected footage is compared with received footage. Export CSV or Excel.
- Fittings (elbow, tee, reducer, cap, other), flanges (classes 150–1500), and valves with an actuator link.
- ASTM A860 WPHY grades. `WPHY 52` and `WPHY52` are the same grade. Expected WPHY 52 against received WPHY 70 shows **GRADE DOES NOT MATCH EXPECTED MATERIAL — ENGINEERING/OPERATOR REVIEW REQUIRED**.
- Demo pipe joints, fittings, flanges, and valves are stored with the guest project. A phase 1 snapshot on this device is filled in the first time it opens.

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
