import type { DevReviewFixture } from '../app/DevReviewFixtures';
import { MG_TEST_PRESETS, type MachineGunReviewFixture } from '../app/DevMachineGunReview';
import type { SurvivalReviewFixture, SurvivalReviewLevel, SurvivalReviewMode } from '../app/DevSurvivalReview';

// Constructed only behind import.meta.env.DEV. Inline styling stays out of the
// shipping CSS, along with the controls and fixture factory in production JS.
export class DevReviewControls {
  readonly element = document.createElement('div');
  readonly mgTest = document.createElement('details');
  readonly survivalTest = document.createElement('details');
  private survivalMode: SurvivalReviewMode = 'experimental';
  private survivalLevel: SurvivalReviewLevel = 8;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly stopPointer = (event: Event) => event.stopPropagation();
  constructor(viewport: HTMLElement, select: (role: DevReviewFixture) => void) {
    this.element.className = 'dev-review-controls';
    this.element.setAttribute('aria-label', 'DEV Review');
    this.element.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 16px';
    for (const role of ['late', 'crate3', 'crate8', 'naval'] as const) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = role.toUpperCase();
      button.dataset.role = role; button.setAttribute('aria-pressed', 'false');
      if (role === 'late') button.title = 'Restart Lv10 with three Stage III Machine Guns and Survival pressure';
      if (role === 'crate3') button.title = 'Restart Lv3 Rifle teaching Supply destruction and three Grenade transfers';
      if (role === 'crate8') button.title = 'Restart Lv8 Stage III MG Supply destruction and one Grenade transfer';
      if (role === 'naval') button.title = 'Restart Lv10 Destroyer assault and Field Observer communication';
      button.style.cssText = 'min-height:44px;border:1px solid #566578;border-radius:6px;background:#263444;color:#f5f5f0;font:700 11px var(--font-utility, sans-serif);cursor:pointer;touch-action:manipulation';
      button.addEventListener('click', () => {
        select(role);
        // Return focus to the battlefield for Q and lane keys.
        button.blur();
      });
      this.buttons.push(button); this.element.append(button);
    }
    this.element.addEventListener('pointerdown', this.stopPointer);
    viewport.append(this.element);
    this.mgTest.className = 'dev-mg-test';
    this.mgTest.style.cssText = 'margin:0 0 16px';
    const summary = document.createElement('summary'); summary.textContent = 'MG TEST';
    summary.style.cssText = 'min-height:44px;width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #566578;border-radius:6px;background:#263444;color:#f5f5f0;font:700 12px var(--font-utility, sans-serif);cursor:pointer;touch-action:manipulation';
    this.mgTest.append(summary);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding-top:6px';
    for (const role of Object.keys(MG_TEST_PRESETS) as MachineGunReviewFixture[]) {
      const preset = MG_TEST_PRESETS[role], button = document.createElement('button');
      button.type = 'button'; button.textContent = role.toUpperCase(); button.dataset.role = role;
      button.title = `Restart Lv${preset.level} with ${preset.soldiers} Stage ${preset.weaponStage} MGs in the shared comparison crowd`;
      button.setAttribute('aria-pressed', 'false');
      button.style.cssText = 'min-height:48px;margin:0;border:1px solid #566578;border-radius:6px;background:#263444;color:#f5f5f0;font:700 12px var(--font-utility, sans-serif);cursor:pointer;touch-action:manipulation';
      button.addEventListener('click', () => { select(role); button.blur(); });
      this.buttons.push(button); grid.append(button);
    }
    this.mgTest.append(grid);
    this.mgTest.addEventListener('pointerdown', this.stopPointer);
    viewport.append(this.mgTest);
    this.survivalTest.className = 'dev-survival-test';
    this.survivalTest.style.cssText = this.mgTest.style.cssText;
    const survivalSummary = document.createElement('summary'); survivalSummary.textContent = 'SURVIVAL TEST';
    survivalSummary.style.cssText = summary.style.cssText;
    const survivalGrid = document.createElement('div');
    survivalGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding-top:6px';
    for (const key of ['baseline', 'experimental', '7', '8', '9', '10'] as const) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = key === 'baseline' || key === 'experimental' ? key.toUpperCase() : `LV${key}`;
      button.dataset.survival = key; button.setAttribute('aria-pressed', 'false');
      button.style.cssText = 'min-height:48px;margin:0;border:1px solid #566578;border-radius:6px;background:#263444;color:#f5f5f0;font:700 11px var(--font-utility, sans-serif);cursor:pointer;touch-action:manipulation';
      button.title = 'Restart deterministic Survival with normal authored weapons and XP progression';
      button.addEventListener('click', () => {
        if (key === 'baseline' || key === 'experimental') this.survivalMode = key;
        else this.survivalLevel = Number(key) as SurvivalReviewLevel;
        select(`survival${this.survivalLevel}-${this.survivalMode}` as SurvivalReviewFixture); button.blur();
      });
      this.buttons.push(button); survivalGrid.append(button);
    }
    this.survivalTest.append(survivalSummary); this.survivalTest.append(survivalGrid);
    this.survivalTest.addEventListener('pointerdown', this.stopPointer);
    viewport.append(this.survivalTest);
    this.setSelected();
  }
  setSelected(role?: DevReviewFixture): void {
    if (role?.startsWith('survival')) {
      const [level, mode] = role.split('-');
      this.survivalLevel = Number(level.slice(8)) as SurvivalReviewLevel; this.survivalMode = mode as SurvivalReviewMode;
    }
    for (const button of this.buttons) {
      const selected = button.dataset.survival !== undefined
        ? button.dataset.survival === this.survivalMode || button.dataset.survival === String(this.survivalLevel)
        : button.dataset.role === role;
      button.setAttribute('aria-pressed', String(selected));
      button.style.background = selected ? '#7a3b1d' : '#263444';
    }
  }
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.stopPointer);
    this.mgTest.removeEventListener('pointerdown', this.stopPointer);
    this.survivalTest.removeEventListener('pointerdown', this.stopPointer);
    this.element.remove();
    this.mgTest.remove();
    this.survivalTest.remove();
  }
}
