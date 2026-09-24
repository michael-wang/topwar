# TopWar — Small-Ticket Roadmap

The purpose of this roadmap is to keep Codex tasks narrow.

## 001 Bootstrap
Vite + TypeScript + Three.js + Vitest. Rendering smoke test only.

## 002 Fixed-step loop and seeded RNG
No gameplay. Pure core utilities with deterministic tests.

## 003 Runtime ConfigStore
Fetch base JSON, schema validation, runtime overrides, localStorage persistence. No Dev Panel UI yet.

## 004 Minimal Simulation
Serializable simulation shell: tick/time, level progress, player X/Z, seed/RNG state.

## 005 Squad formation + renderer
Simulation owns squad count; renderer shows simple blue units. No weapon.

## 006 Pointer input
Touch/mouse drag maps into simulation horizontal control.

## 007A Level pacing data
Runtime-authored level definition and encounter pacing. No enemies yet.

## 007B Enemy groups
Simulation and rendering consume level data to create visible enemies. No combat.

## 008A Player offense
Automatic rifle fire, projectiles, enemy HP/death.

## 008B.1 Contact casualties
Static enemy contact removes squad members.

## 008B.2A Defense-line breaches + Game Over/Retry
Surviving enemies left behind cost soldiers; zero squad ends the run and Retry starts a fresh run.

## 008B.2B Stationary grunt pressure
Basic grunts hold their authored positions; player advance, contact, and defense-line breaches create pressure.

## 009 Dev Panel v1
Pause/time scale plus live editing of a small approved set of config values.

## 010 Snapshots v1
Named local save/load slots, export/import JSON, deterministic restore tests.

## 011 Stress/performance pass
Measure hundreds of units, introduce instancing/pooling only where needed.

## Current pivot slice
1. Continuous irregular enemy stream — implemented.
2. Rocket specialist combat — implemented.
3. Stream reward targets replacing occasional enemy slots — implemented; generic side armories are inactive in Level 001.
4. Endless enemy stream — implemented.
5. Slow nonlinear deterministic Tier-2 enemy spread through row 960 — implemented.
6. Tier-1 to Tier-2 squad and firepower compression at 10:1 — implemented.
7. Tier exchange combat — implemented: Tier-2 shots pierce up to 10 Tier-1 enemies; Tier-2 soldiers have 10 Tier-1 defensive value and may demote into Tier-1 bodies.
8. Enemy Tier-3 progression — next.
9. Enemy Tier-4 progression — after Tier-3.

## 012 Recruitment gates — later milestone
Data-driven +N gates, squad growth feedback.

## 013 Expanded level content
Build ordered gates, sections, and progression on the level data from 007A.

## 014 Boss
Boss HP, movement/threat, win/lose, retry.

## 015 Feel pass
Feedback only after the loop is stable: muzzle flash, hit reaction, death motion, sound hooks, subtle screen feedback.

Rule: one ticket should not quietly absorb the next ticket.
