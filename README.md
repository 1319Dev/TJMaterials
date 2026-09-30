# Pipeline Material Inspector

Third-party materials inspection / documentation website for pipeline construction field work. It is a browser app and an installable PWA. GitHub Pages hosts the static Vite build. There is no App Store listing.

Open it in mobile Safari at `https://1319dev.github.io/TJMaterials/`. To keep an icon on the phone, tap Share, then Add to Home Screen. That icon opens this same site.

Not an official Atmos Energy or TJ Inspection application. The app records what an inspector enters. It does not decide that material is acceptable.

## On this device

The home screen is the inspector’s project. A new project starts empty. Material is added only when someone receives it. IndexedDB is the store. There is no account and no cloud sync.

The status line stays **OFFLINE — SAVED LOCALLY**. Records remain in this browser.

More → **Load sample project** opens optional practice records. **Back to my project** returns to the inspector’s project. The sample is not the default home screen. A practice project already stored on the phone is set aside on the next open, so the home stays empty until someone loads it again.

## Phase 1

Records stay available on the device when the network drops.

- Mobile shell with Home, Receive, Inventory, Search, and More
- Project setup and local document metadata
- Material receiving (delivery header, packing slip / BOL, photo and GPS capture, line items)
- Search by heat, joint, serial, PO, BOL, manufacturer, or Material ID
- Light, dark, and high-contrast outdoor themes
- SQL notes in `supabase/migrations` are unused by this site. The running app does not connect to a database.

Material IDs look like `PMI-PIPE-000001`.

## Phase 2

Pipe tally and dedicated receiving forms. Receipts stay in review. The app does not accept material.

- Pipe tally: joint number, heat, and length, with joint count, total footage, average length, and footage by heat, grade, and wall. Expected footage is compared with received footage. Export CSV or Excel.
- Fittings (elbow, tee, reducer, cap, other), flanges (classes 150–1500), and valves with an actuator link.
- ASTM A860 WPHY grades. `WPHY 52` and `WPHY52` are the same grade. Expected WPHY 52 against received WPHY 70 shows **GRADE DOES NOT MATCH EXPECTED MATERIAL — ENGINEERING/OPERATOR REVIEW REQUIRED**.
- The sample project, loaded from More, includes pipe joints, fittings, flanges, and valves. It is not the default project.

New receipts stay **REVIEW REQUIRED**. MATCH is not written by these forms.

## Coordinator

Daily receive, packing slips, MTRs, and the materials tracking sheet. Still local only. OCR runs in the browser with Tesseract.js. No cloud API key.

- **Material Handling Tracking** is the Master List on this device. Home opens on that list. Daily materials receive and Receive material each append the next Item row when a material and qty are saved. The row stays **REVIEW REQUIRED**. Export downloads an Excel workbook with Garrett’s Master List columns. Difference is `QTY-Received − QTY-Ordered` and Remaining Material is `QTY-Received − QTY-Used`.
- **Packing slips** store a photo and the slip number on the device, tied to a delivery when you pick one.
- **MTRs** list material with an image on file or **NOT PROVIDED**. The MTR request form is unchanged. Storing an image does not accept the material.
- **Master List** columns match the Material Handling Tracking sheet: Item, QTY-Ordered, Material Type, Size (Inches), Material Description, Wall / SDR, Grade, Manufacturer, Model Number, Serial / Lot / Heat #, ANSI / Pressure Rating, UOM (Each/Ft), QTY-Received, Difference, QTY-Used, Remaining Material, Location (A,B,C), MTR (Y/N), Matches IFC (Y/N), Damaged Materials, and Notes/Remarks. Header fields are Project Name, Project #, Date, and Inspector. An uploaded workbook uses the Master List sheet when that tab is present. Blank numbered template rows are not imported. Packing-slip OCR still adds rows to this same list and never writes MATCH.
- **Packing-slip OCR** reads a photo on the device, shows a preview with confidence, and writes tracker rows only after you apply them. Uncertain reads are **REVIEW REQUIRED**. OCR never writes MATCH.

## Stuck on an old screen

iOS can keep the previous service worker after the Home Screen icon is deleted. That worker answers every navigation, including `reset.html`, with the cached shell. After this site is published, open `https://1319dev.github.io/TJMaterials/reset.html` once. The page clears the worker, cached files, and the on-device project database, then opens the current app. The home screen shows `Build pmi-field-5`.

## Scripts

```bash
npm install
npm test
npm run dev
npm run build
```

The dev and production apps use the `/TJMaterials/` base path. GitHub Pages publishes `dist` to the `gh-pages` branch from `.github/workflows/pages.yml`. In the repository settings, set Pages to deploy from that branch.

`Atmos Project #` and `Shipment # (MRC)` are labels copied from the inspector’s MTR request form. They are customer reference fields.
