export const LEVEL_UP_MS = 800;
export const LEVEL_BAR_FLASH_MS = 240;
export const WEAPON_AFTERGLOW_MS = 1400;

// A disposable presentation event, independent of rifle tiers and snapshot gameplay state.
export interface ProgressionLevelUpEvent { kind: 'progressionLevelUp'; fromLevel: number; toLevel: number }
export class ProgressionLevelObserver {
  private previousLevel = 1;
  observe(level: number): ProgressionLevelUpEvent | null {
    const previous = this.previousLevel;
    this.previousLevel = level;
    // A multi-level grant carries all gained levels in one coherent beat.
    return level > previous ? { kind: 'progressionLevelUp', fromLevel: previous, toLevel: level } : null;
  }
  reset(): void { this.previousLevel = 1; }
}
