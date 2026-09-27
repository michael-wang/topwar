# TopWar art approval showcase

Run the Vite development server and open `/art-showcase/`. This is a separate HTML entry and is not part of the production build. It does not import the gameplay app, simulation, or gameplay renderers.

The eight controls show the player front 3/4, player firing from the side, idle enemy, running enemy, Boss, projectile, enemy death, and combined scale comparison. `?scene=running&still=1&t=0.13` selects a repeatable animation frame. Add `capture=1` to show only the 720 × 1280 canvas. The page also has a Save PNG button.

The study uses procedural Three.js geometry and materials. No new external asset or license is needed. It is a visual proposal only. The gameplay Kenney GLBs and renderers have not been changed.

`review/` preserves the first 720 × 1280 review set. `review-v2/` contains the polish pass set: longer warm tracer and muzzle flash, a smaller Boss helmet, clean unaccessorized enemy eyes and mouth, and stronger running arm swing. Compare both sets with Michael's Visual Bible v1 and Gameplay Target before approving any gameplay integration.

`review-v3/` is the current approval set. It uses a gray runway and brighter tracer glow, lowers all helmets onto the heads, and removes the player-only rear block that was protruding behind the silhouette. These changes remain isolated to the showcase.
