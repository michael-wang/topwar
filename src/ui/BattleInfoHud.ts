import type { ProgressionBalance, ProgressionState } from '../simulation/progression';
import { gameIcon, iconMarkup } from './GameIcons';
import { loadoutPresentation } from './loadoutPresentation';

const UPGRADE_PULSE_MS = 480;
type Loadout = ReturnType<typeof loadoutPresentation>;

// Permanent unlock telemetry only. No living count, damage/status or firing-rate metrics.
export class BattleInfoHud {
  readonly element = document.createElement('div');
  private readonly weaponIcon = gameIcon('rifle');
  private readonly weaponPips = Array.from({ length: 3 }, () => document.createElement('span'));
  private readonly squadPips = Array.from({ length: 3 }, () => document.createElement('span'));
  private readonly weaponRow = document.createElement('div');
  private readonly squadRow = document.createElement('div');
  private previous: Loadout | null = null;
  private readonly weaponPulseUntil = [-Infinity, -Infinity, -Infinity];
  private readonly squadPulseUntil = [-Infinity, -Infinity, -Infinity];
  private familyPulseUntil = -Infinity;

  constructor(viewport: HTMLElement) {
    this.element.className = 'battle-info xp-loadout'; this.element.style.pointerEvents = 'none';
    this.element.setAttribute('role', 'group');
    const main = document.createElement('div'); main.className = 'battle-weapon-row';
    this.weaponIcon.className += ' battle-weapon-icon';
    this.weaponRow.className = 'battle-weapon-pips'; this.weaponRow.append(...this.weaponPips);
    this.squadRow.className = 'battle-squad-pips'; this.squadRow.append(...this.squadPips);
    main.append(this.weaponIcon, this.weaponRow); this.element.append(main, this.squadRow);
    this.reset(); viewport.append(this.element);
  }

  update(state: Readonly<ProgressionState>, balance: ProgressionBalance, nowMs: number): void {
    const model = loadoutPresentation(state, balance), previous = this.previous;
    const familyChanged = previous !== null && model.weapon !== previous.weapon;
    if (!previous || familyChanged || model.weaponStage !== previous.weaponStage || model.squadStage !== previous.squadStage) {
      if (!previous || familyChanged) {
        this.weaponIcon.innerHTML = iconMarkup(model.weapon);
        this.element.dataset.weaponFamily = model.weapon;
      }
      this.familyPulseUntil = familyChanged ? nowMs + UPGRADE_PULSE_MS : -Infinity;
      this.weaponRow.ariaLabel = `Weapon stage ${model.weaponStage} of 3`;
      this.squadRow.ariaLabel = `Unlocked squad stage ${model.squadStage ?? 1} of 3`;
      this.element.setAttribute('aria-label', `${model.weapon === 'rifle' ? 'Rifle' : 'Machine Gun'}, weapon stage ${model.weaponStage} of 3${model.squadStage ? `, unlocked squad stage ${model.squadStage} of 3` : ''}`);
      this.weaponPips.forEach((pip, index) => {
        const filled = index < model.weaponStage;
        pip.innerHTML = iconMarkup('cartridge', filled); pip.ariaHidden = 'true';
        this.weaponPulseUntil[index] = previous && !familyChanged && filled && index >= previous.weaponStage ? nowMs + UPGRADE_PULSE_MS : -Infinity;
      });
      this.squadPips.forEach((pip, index) => {
        const filled = index < (model.squadStage ?? 1);
        pip.innerHTML = iconMarkup('soldier', filled); pip.ariaHidden = 'true';
        this.squadPulseUntil[index] = previous && !familyChanged && model.squadStage && filled && index >= (previous.squadStage ?? 1) ? nowMs + UPGRADE_PULSE_MS : -Infinity;
      });
      this.previous = model;
    }
    // Presentation clock freezes on Pause; no timers or simulation state are added.
    this.weaponIcon.classList.toggle('weapon-evolution', nowMs < this.familyPulseUntil);
    this.weaponPips.forEach((pip, index) => {
      const className = `xp-pip xp-pip-cartridge ${index < model.weaponStage ? 'is-filled' : 'is-empty'}${nowMs < this.weaponPulseUntil[index] ? ' is-upgraded' : ''}`;
      if (pip.className !== className) pip.className = className;
    });
    this.squadPips.forEach((pip, index) => {
      const className = `xp-pip xp-pip-soldier ${index < (model.squadStage ?? 1) ? 'is-filled' : 'is-empty'}${nowMs < this.squadPulseUntil[index] ? ' is-upgraded' : ''}`;
      if (pip.className !== className) pip.className = className;
    });
    this.squadRow.hidden = model.squadStage === null;
    this.element.hidden = false;
  }

  reset(): void {
    this.element.hidden = true; this.previous = null; this.familyPulseUntil = -Infinity;
    this.weaponPulseUntil.fill(-Infinity); this.squadPulseUntil.fill(-Infinity);
    this.weaponIcon.classList.remove('weapon-evolution');
  }
  dispose(): void { this.element.remove(); }
}
