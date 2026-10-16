import * as THREE from 'three';
import { applyCoastalCamera } from '../rendering/CoastalCamera';
import { BridgeEnvironment } from '../rendering/environment/BridgeEnvironment';
import { COMPARISON_LOOKS, ExplosionComparison, type ComparisonGroup, type ExplosionLook } from './ExplosionComparison';

export function mountExplosionLab(host: HTMLElement): void {
  host.classList.add('beachhead-defense');
  const root = document.createElement('section'); root.className = 'explosion-lab';
  root.style.cssText = 'position:absolute;inset:0;z-index:20;background:#abc4ce';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  root.append(renderer.domElement); host.append(root);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(48, 350 / 844, .1, 180);
  const beach = new BridgeEnvironment(scene);
  const sunlight = new THREE.DirectionalLight('#fff0d4', 1.55); sunlight.position.set(-12, 24, -8);
  scene.add(new THREE.HemisphereLight('#c8e0e9', '#bda57e', 1.9), sunlight);
  const panel = document.createElement('div');
  panel.style.cssText = 'position:absolute;left:8px;right:8px;top:max(8px,env(safe-area-inset-top));padding:10px;background:#111d29ed;color:#fff;font:13px/1.4 sans-serif;border-radius:8px';
  panel.innerHTML = `<strong>DEV 爆炸比較 / Explosion Lab</strong><div>僅視覺實驗 · 不讀寫存檔 · 不代表正式定稿</div>
    <label>場景 <select aria-label="Comparison group"><option value="impact">Tank / Destroyer impact</option><option value="airstrike">Airstrike · nine impacts</option></select></label>
    <div data-looks style="display:flex;gap:6px;margin:6px 0"></div>
    <div data-description></div><div style="display:flex;gap:6px;margin:6px 0"><button data-play>暫停</button><button data-replay>重播</button><a href="./" style="color:#ffe0a0;align-self:center">返回遊戲</a></div>
    <label>時間 <output></output><input aria-label="Explosion time" type="range" min="0" max="2200" step="10" value="0" style="width:100%"></label>
    <div data-phases style="display:flex;gap:5px;flex-wrap:wrap"></div>`;
  root.append(panel);
  const reveal = document.createElement('button'); reveal.textContent = '顯示比較面板'; reveal.hidden = true;
  reveal.style.cssText = 'position:absolute;top:8px;left:8px;min-height:36px;background:#172837dd;color:white;border:1px solid #789';
  const hide = document.createElement('button'); hide.textContent = '隱藏面板 / View FX'; hide.dataset.hidePanel = '';
  hide.onclick = () => { panel.hidden = true; reveal.hidden = false; };
  reveal.onclick = () => { panel.hidden = false; reveal.hidden = true; };
  panel.append(hide); root.append(reveal);
  panel.querySelectorAll<HTMLElement>('button,select').forEach(element => {
    element.style.cssText = 'min-height:36px;padding:6px;color:#fff;background:#30475a;border:1px solid #6d8495;border-radius:4px;font:inherit;touch-action:manipulation';
  });
  const groupInput = panel.querySelector('select')!, slider = panel.querySelector('input')!, output = panel.querySelector('output')!;
  const play = panel.querySelector<HTMLButtonElement>('[data-play]')!;
  let group: ComparisonGroup = 'impact', look: ExplosionLook = 'control';
  let fx = new ExplosionComparison(scene, group, look), ms = 0, playing = true, previous: number | null = null, frame = 0;
  const describe = { control: 'Control · 原始效果（保留比較）', A: 'A · Flash inside black core', B: 'B · Billowing layered cloud', C: 'C · Dirty bombardment bank',
    'B-fast': 'B-fast · Rapid expansion / early dispersal / 1.5s fade', D: 'Hybrid D · White flash + ground ring / B smoke / 2s per impact' };
  const draw = (): void => {
    fx.seek(ms); beach.update(0, 3.2, 0); renderer.render(scene, camera);
    slider.value = String(Math.round(ms)); output.value = `${(ms / 1000).toFixed(2)}s`;
  };
  const setPlaying = (value: boolean): void => { playing = value; previous = null; play.textContent = playing ? '暫停' : '播放'; };
  const select = (value: ExplosionLook): void => {
    fx.dispose(); look = value; fx = new ExplosionComparison(scene, group, look);
    slider.max = String(fx.durationMs);
    // Switching look keeps the exact selected age and playback state for matched comparison.
    ms = Math.min(ms, fx.durationMs); previous = null;
    panel.querySelectorAll<HTMLButtonElement>('[data-look]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.look === look));
      button.style.background = button.dataset.look === look ? '#875e26' : '#30475a';
    });
    panel.querySelector('[data-description]')!.textContent = describe[look]; draw();
  };
  const controls = (): void => {
    const choices = panel.querySelector('[data-looks]')!; choices.replaceChildren();
    for (const value of COMPARISON_LOOKS[group]) {
      const button = document.createElement('button');
      button.textContent = value === 'control' ? 'Control' : value === 'D' ? 'Hybrid D' : value === 'B-fast' ? 'B-fast' : `Exp ${value}`;
      button.dataset.look = value; button.style.cssText = 'min-height:40px;flex:1;color:white;border:1px solid #789';
      button.onclick = () => select(value); choices.append(button);
    }
    const phases = panel.querySelector('[data-phases]')!; phases.replaceChildren();
    const times = group === 'impact' ? [30, 180, 350, 450, 650, 900, 1200, 1500, 2100]
      : [30, 180, 450, 900, 1000, 1500, 1800, 2000, 2500, 4000, 6500, 8900];
    for (const time of times) {
      const button = document.createElement('button'); button.textContent = `${time / 1000}s`;
      button.style.cssText = 'min-height:32px;background:#30475a;color:white;border:1px solid #789';
      button.onclick = () => { ms = time; setPlaying(false); draw(); }; phases.append(button);
    }
    select('control');
  };
  groupInput.onchange = () => { group = groupInput.value as ComparisonGroup; ms = 0; controls(); };
  slider.oninput = () => { ms = Number(slider.value); setPlaying(false); draw(); };
  play.onclick = () => setPlaying(!playing);
  panel.querySelector<HTMLButtonElement>('[data-replay]')!.onclick = () => { ms = 0; setPlaying(true); draw(); };
  const resize = (): void => {
    renderer.setSize(host.clientWidth, host.clientHeight, false); camera.aspect = host.clientWidth / host.clientHeight;
    applyCoastalCamera(camera); draw();
  };
  const observer = new ResizeObserver(resize); observer.observe(host);
  const visibility = (): void => { if (document.hidden) setPlaying(false); };
  document.addEventListener('visibilitychange', visibility);
  const tick = (now: number): void => {
    if (playing) {
      if (previous !== null) ms = Math.min(fx.durationMs, ms + Math.min(100, now - previous));
      previous = now; if (ms === fx.durationMs) setPlaying(false);
      draw();
    }
    frame = requestAnimationFrame(tick);
  };
  controls(); resize(); frame = requestAnimationFrame(tick);
  window.addEventListener('pagehide', event => {
    // A cached document resumes with its existing canvas, paused at the selected age.
    if (event.persisted) { setPlaying(false); return; }
    cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
    fx.dispose(); beach.dispose(); renderer.dispose(); root.remove();
  });
}
