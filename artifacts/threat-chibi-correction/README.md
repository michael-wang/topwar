# Phase 4C review evidence

Baseline: 9e67006422dbf13460f108f19c9f63419087f9a0 (Phase 4B).
390×844 portrait, DPR 2, actual camera/lighting. `baseline-*` is captured using the read-only Git-source Vite adapter; `palette-*` captures the first independently revertable palette pass. Capture script records errors, resource downloads, occupancy and performance in JSON.

Palette pass: 566 tests / 78 files, typecheck and build pass. Existing Zod annotation and bundle-size warnings remain. No GLBs or textures added. Boss shoes use the existing atlas's lower footwear region through a narrow shader adapter; silhouette and asset bytes are unchanged.

Run capture.mjs with baseline or palette. Node, Playwright and Chrome paths are configured for this development machine. Baseline adapter never resets the checkout. Live/production sanity and final comparison sheets are added with the form correction.
