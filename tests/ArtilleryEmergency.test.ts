import { afterEach, expect, it, vi } from 'vitest';
import { personalArtilleryThreat, emergencyPulse } from '../src/presentation/ArtilleryEmergency';
import { ArtilleryEmergencyHud } from '../src/ui/ArtilleryEmergencyHud';
import { makeArtilleryShell } from '../src/simulation/artillery';
import { artilleryDefaults } from '../src/config/artilleryConfig';
import { createDevReviewFixture } from '../src/app/DevReviewFixtures';
import { LevelDefinitionSchema } from '../src/level/LevelDefinition';
import level from '../public/game-data/levels/level-001.json';
import config from './helpers/ShippingConfig';

const shell = (id = 1, launch = 0) => makeArtilleryShell(id,
  { source: { id: 'tank', type: 'defenseTank', position: { x: 0, y: 2, z: 48 } } },
  2, [-2.8, -1.4, 0, 1.4, 2.8], 0, launch, artilleryDefaults, .588);
function state() {
  const s = createDevReviewFixture({ seed: 17, level: LevelDefinitionSchema.parse(level), startSquad: 1,
    startRocketCount: 0, tiers: config.tiers, catharsis: { balance: config.catharsis!, trackHalfWidth: config.track.halfWidth } },
  config.weapon.rifle.fireRate, 'boss-phase2').getState();
  s.artillery = { version: 1, nextId: 3, shells: [shell()] }; s.elapsedSeconds = 1.5;
  return s;
}
afterEach(() => vi.unstubAllGlobals());

it('uses inclusive final-half-second deadlines and exact physical X/Z radial risk, independently of selectedLane', () => {
  const s = state(), first = s.artillery!.shells[0];
  s.elapsedSeconds = 1.499; expect(personalArtilleryThreat(s)).toBeUndefined();
  s.elapsedSeconds = 1.5; s.player.selectedLane = 4; expect(personalArtilleryThreat(s)).toBe(first);
  s.player.x = .588; expect(personalArtilleryThreat(s)).toBe(first);
  s.player.z = .01; expect(personalArtilleryThreat(s)).toBeUndefined();
  s.player.x = .3; s.player.z = .3; expect(personalArtilleryThreat(s)).toBe(first);
  s.player.z = .59; expect(personalArtilleryThreat(s)).toBeUndefined();
  s.player.x = 0; s.player.z = 0; s.elapsedSeconds = 2; expect(personalArtilleryThreat(s)).toBe(first);
  s.elapsedSeconds = 2.001; expect(personalArtilleryThreat(s)).toBeUndefined();
});

it('chooses one earliest threat, reconstructs without mutation, clears on dodge/cancel/end, and preserves historical modes', () => {
  const s = state(), first = shell(), next = shell(2, .1);
  s.elapsedSeconds = 1.7; s.artillery!.shells = [next, first];
  const before = structuredClone(s); expect(personalArtilleryThreat(s)).toBe(first); expect(s).toEqual(before);
  const restored = structuredClone(s); expect(personalArtilleryThreat(restored)).toEqual(first);
  s.player.x = 1; expect(personalArtilleryThreat(s)).toBeUndefined();
  s.player.x = 0; expect(personalArtilleryThreat(s)).toBe(first);
  s.artillery!.shells = [next]; expect(personalArtilleryThreat(s)).toBe(next);
  s.artillery!.shells = []; expect(personalArtilleryThreat(s)).toBeUndefined();
  s.artillery!.shells = [first]; s.squad.count = 0; expect(personalArtilleryThreat(s)).toBeUndefined();
  s.squad.count = 1; s.defenseTank!.status = 'defeated'; expect(personalArtilleryThreat(s)).toBeUndefined();
  s.defenseTank!.status = 'active';
  for (const mode of [undefined, 'overheadLanes'] as const) {
    s.catharsis!.balance.artillery!.warningPresentation = mode; expect(personalArtilleryThreat(s)).toBeUndefined();
  }
});

it('fits the personal glyph on both outer lanes, freezes at a fixed simulation time and respects reduced motion', () => {
  const make = () => ({ hidden: false, className: '', textContent: '', clientWidth: 350, clientHeight: 844,
    style: { setProperty(k: string, v: string) { (this as any)[k] = v; } } as any,
    children: [] as any[], append(...c: any[]) { this.children.push(...c); }, setAttribute: vi.fn(), remove: vi.fn() });
  const media = { matches: false }; vi.stubGlobal('matchMedia', () => media); vi.stubGlobal('document', { createElement: make });
  const host = make(), point = { x: -10, y: 550 }, hud = new ArtilleryEmergencyHud(host as any, () => point);
  const glyph = (hud.element as any).children[0];
  hud.update(.2, 2.8); expect(glyph.style.left).toBe('38px'); expect(glyph.style.top).toBe('550px');
  const transform = glyph.style.transform, glow = (hud.element.style as any)['--emergency-glow'];
  for (let i = 0; i < 30; i++) hud.update(.2, 2.8);
  expect(glyph.style.transform).toBe(transform); expect((hud.element.style as any)['--emergency-glow']).toBe(glow);
  point.x = 370; hud.update(.1, -2.8); expect(glyph.style.left).toBe('312px');
  host.clientWidth = 390; hud.update(.1, -2.8); expect(glyph.style.left).toBe('352px');
  media.matches = true; hud.update(.1, 0); expect(glyph.style.transform).toContain('scale(1)');
  expect((hud.element.style as any)['--emergency-glow']).toBe('0.09');
  hud.update(null, 0); expect(hud.element.hidden).toBe(true);
  hud.update(.3, 0); expect(hud.element.hidden).toBe(false); hud.reset(); expect(hud.element.hidden).toBe(true);
  hud.dispose(); expect(hud.element.remove).toHaveBeenCalledOnce();
  expect(emergencyPulse(.1)).toBeGreaterThanOrEqual(0); expect(emergencyPulse(.1)).toBeLessThanOrEqual(1);
});
