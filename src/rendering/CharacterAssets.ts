import type { CharacterVisualFamilies } from './CharacterVisualFamilies';
import { createChibiPlayerFamily } from './squad/ChibiPlayerFamily';
import { createChibiGruntFamily } from './enemies/ChibiGruntFamily';
import { createChibiHeavyFamily, createChibiGiantFamily } from './enemies/ChibiThreatFamilies';
export interface CharacterAssets {
  readonly families: Omit<CharacterVisualFamilies, 'boss'>;
  dispose(): void;
}
// Characters and the accepted Ink Spear are authored in code. No GLB parser or
// download is needed. Keep the asynchronous startup ownership contract.
export async function loadCharacterAssets(): Promise<CharacterAssets> {
  const player = createChibiPlayerFamily(), grunt = createChibiGruntFamily();
  const heavy = createChibiHeavyFamily(), giant = createChibiGiantFamily();
  let disposed = false;
  return { families: { player, grunt, heavy, giant }, dispose() {
    if (disposed) return;
    disposed = true;
    player.dispose(); grunt.dispose(); heavy.dispose(); giant.dispose();
  } };
}
