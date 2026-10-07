import type { CatharsisConfig } from '../config/catharsisConfig';
import { effectiveRifleFireRate, progressionStage, type ProgressionBalance, type ProgressionState } from '../simulation/progression';
import { gameIcon, iconMarkup } from './GameIcons';
import { loadoutPresentation } from './loadoutPresentation';

// Read-only combat information. Unlock pips are permanent stage; squad value is living members.
export class BattleInfoHud {
  readonly element = document.createElement('div');
  private readonly weaponIcon = gameIcon('rifle');
  private readonly weaponName = document.createElement('strong');
  private readonly stage = document.createElement('span');
  private readonly enhancement = document.createElement('div');
  private readonly pips = Array.from({ length: 3 }, () => document.createElement('span'));
  private readonly rate = document.createElement('strong');
  private readonly squad = document.createElement('strong');
  private traitKey = '';
  constructor(viewport: HTMLElement) {
    this.element.className = 'battle-info xp-loadout'; this.element.style.pointerEvents = 'none';
    this.element.setAttribute('role', 'group'); this.element.setAttribute('aria-label', 'Battle information');
    const weapon = document.createElement('div'); weapon.className = 'xp-weapon-slot'; weapon.append(this.weaponIcon);
    const identity = document.createElement('div'); identity.className = 'battle-identity';
    identity.append(this.weaponName, this.stage);
    this.enhancement.className = 'xp-enhancement-slot'; this.enhancement.append(...this.pips);
    const metrics = document.createElement('div'); metrics.className = 'battle-metrics';
    for (const [icon, value, unit] of [['cartridge', this.rate, '/s'], ['soldier', this.squad, 'LIVE']] as const) {
      const row = document.createElement('div'), label = document.createElement('span');
      label.textContent = unit; row.append(gameIcon(icon), value, label); metrics.append(row);
    }
    this.element.append(weapon, identity, this.enhancement, metrics); this.reset(); viewport.append(this.element);
  }
  update(state: Readonly<ProgressionState>, balance: { readonly progression: ProgressionBalance; readonly machineGun: Readonly<CatharsisConfig['machineGun']> }, livingCount: number, baseFireRate: number): void {
    const loadout = loadoutPresentation(state, balance.progression), model = loadout.enhancement;
    const plan = progressionStage(state.level, balance.progression);
    const key = `${loadout.weapon}:${model.kind}:${model.stage}:${plan.fireRateStage}`;
    if (key !== this.traitKey) {
      this.weaponIcon.innerHTML = iconMarkup(loadout.weapon); this.element.dataset.weaponFamily = loadout.weapon;
      this.weaponName.textContent = loadout.weapon === 'machineGun' ? 'MG' : 'RIFLE';
      this.stage.textContent = `STAGE ${['I', 'II', 'III'][plan.fireRateStage - 1]}`;
      this.enhancement.ariaLabel = `${model.kind === 'soldier' ? 'Unlocked squad' : 'Fire-rate'} stage ${model.stage} of 3`;
      this.pips.forEach((pip, index) => {
        const filled = index < model.stage;
        pip.className = `xp-pip xp-pip-${model.kind} ${filled ? 'is-filled' : 'is-empty'}`;
        pip.innerHTML = iconMarkup(model.kind, filled); pip.ariaHidden = 'true';
      });
      this.traitKey = key;
    }
    const memberRate = loadout.weapon === 'machineGun' ? balance.machineGun.fireRate
      : effectiveRifleFireRate(baseFireRate, state.level, balance.progression);
    const rate = memberRate * livingCount;
    const displayedRate = Number(rate.toFixed(2)).toString();
    if (this.rate.textContent !== displayedRate) {
      this.rate.textContent = displayedRate; this.rate.ariaLabel = `${rate} total shots per second`;
    }
    if (this.squad.textContent !== String(livingCount)) {
      this.squad.textContent = String(livingCount); this.squad.ariaLabel = `${livingCount} living soldiers`;
    }
    this.element.hidden = false;
  }
  reset(): void { this.element.hidden = true; this.traitKey = ''; }
  dispose(): void { this.element.remove(); }
}
