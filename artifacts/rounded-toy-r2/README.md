# Rounded Toy R2 review

R1 baseline: `a36b3c5e09559ba0ea0b364ec3347e4d85eda25c`. Captures use a 390×844 CSS portrait viewport, DPR 2, actual coastal lighting and gameplay projection except explicitly labeled close inspection views.

## Combat-identity checkpoint

Before the separate Giant surviving-hit commit, all four roles gained trousers/cuffs and their restrained gear budget. R1 shoes, base helmet/body proportions and gait clocks remain unchanged. All equipment is merged into the owning reference/run body: zero added character draw, uploaded geometry or texture.

Review [R1 → R2 beauty sheet](r1-to-r2-four-role-beauty-sheet.png), [R2 beauty](r2-four-role-beauty-sheet.png), [equal-height Grunt/Heavy](grunt-heavy-normalized-height.png), [equal-height black silhouettes](grunt-heavy-normalized-silhouettes.png), [actual-projection silhouettes](actual-projection-silhouette-sheet.png), and [trousers/footwear](trousers-footwear-relationship.png).

The normalized QA composites resize each rendered figure to exactly 320 pixels tall; this never changes runtime proportions. Heavy remains wider, with huge fists, recessed/deep helmet, diagonal harness and paired hip equipment at equal height. Separate front/rear gear close views and actual opening/crowd/gait captures are included. Player retains a belt and one utility pouch; Grunt has belt/canteen; Giant has waist sash and one satchel opposite the maul.

`performance.json` records all seven warmed fixtures. Crowd triangles increase 9.3–10.1%, below 15%; two Giants increase 4.4%. Draws, uploaded geometry counts and texture counts are unchanged. No density reduction or new textures/GLBs/packages.

World/Boss-death and R1 Giant HP bar crops remain pixel-identical. The frozen Boss capture has 464 pixels differing by at most one RGB quantization step in SwiftShader; original Boss asset/material protections remain unchanged. Equipment does not alter simulation/config/app boot or snapshots.

Final hit-style evidence, live sanity, bundle comparison and validation totals follow in the second commit. Boss migration remains deferred; no deployment.
