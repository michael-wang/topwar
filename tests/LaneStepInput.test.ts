import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LaneStepInput } from '../src/input/LaneStepInput';

function fixture() {
  const keys = new EventTarget();
  const viewport = Object.assign(new EventTarget(), { setPointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 20, width: 400 }) });
  const step = vi.fn(() => true);
  const input = new LaneStepInput(viewport as unknown as HTMLElement, keys as unknown as Window, step);
  input.start();
  const dispatch = (target: EventTarget, type: string, fields: object) => {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
    return event;
  };
  const key = (type: string, key: string, repeat = false, target?: object) => dispatch(keys, type, { key, repeat, ...(target ? { target } : {}) });
  const pointer = (type: string, x: number, fields = {}) => dispatch(viewport, type,
    { pointerId: 1, pointerType: 'touch', clientX: x, clientY: 400, ...fields });
  return { input, step, key, pointer, keys };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('sends an immediate lane step per physical key press and ignores OS repeat events', () => {
  const f = fixture();
  f.key('keydown', 'a');
  f.key('keydown', 'a', true);
  f.key('keydown', 'a');
  expect(f.step.mock.calls).toEqual([[-1]]);
  f.key('keyup', 'a');
  f.key('keydown', 'ArrowLeft');
  f.key('keyup', 'ArrowLeft');
  f.key('keydown', 'd');
  f.key('keyup', 'd');
  f.key('keydown', 'ArrowRight');
  expect(f.step.mock.calls).toEqual([[-1], [-1], [1], [1]]);
  f.input.dispose();
});

it('waits 180 ms then steps at 120 ms cadence regardless of OS repeat rate', () => {
  const f = fixture();
  f.key('keydown', 'ArrowRight');
  vi.advanceTimersByTime(179);
  for (let index = 0; index < 30; index++) f.key('keydown', 'ArrowRight', true);
  expect(f.step).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect(f.step).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(119);
  expect(f.step).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(1);
  expect(f.step).toHaveBeenCalledTimes(3);
  vi.advanceTimersByTime(240);
  expect(f.step).toHaveBeenCalledTimes(5);
  f.key('keyup', 'ArrowRight');
  vi.advanceTimersByTime(1000);
  expect(f.step).toHaveBeenCalledTimes(5);
  expect(vi.getTimerCount()).toBe(0);
  f.input.dispose();
});

it.each(['blur', 'stop', 'dispose'])('%s clears hold timers and restart cannot revive a hold', (cleanup) => {
  const f = fixture();
  f.key('keydown', 'a');
  vi.advanceTimersByTime(100);
  if (cleanup === 'blur') f.keys.dispatchEvent(new Event('blur'));
  else f.input[cleanup as 'stop' | 'dispose']();
  expect(vi.getTimerCount()).toBe(0);
  f.input.start(); // Same stop/start lifecycle used by Pause and Retry.
  vi.advanceTimersByTime(1000);
  expect(f.step).toHaveBeenCalledTimes(1);
  f.key('keydown', 'a');
  expect(f.step).toHaveBeenCalledTimes(2);
  f.input.dispose();
});

it('opposite press immediately takes over with a fresh delay and no stale timers', () => {
  const f = fixture();
  f.key('keydown', 'a');
  vi.advanceTimersByTime(100);
  f.key('keydown', 'd');
  f.key('keyup', 'a');
  vi.advanceTimersByTime(179);
  expect(f.step.mock.calls).toEqual([[-1], [1]]);
  vi.advanceTimersByTime(1);
  expect(f.step.mock.calls).toEqual([[-1], [1], [1]]);
  f.key('keyup', 'd');
  vi.advanceTimersByTime(1000);
  expect(f.step).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
  f.input.dispose();
});

it('stops scheduling at an outer lane and can immediately step away from it', () => {
  const f = fixture();
  let lane = 2;
  f.step.mockImplementation((direction?: -1 | 1) => {
    lane = Math.max(0, Math.min(4, lane + direction!));
    return lane + direction! >= 0 && lane + direction! < 5;
  });
  f.key('keydown', 'd');
  vi.advanceTimersByTime(180);
  expect(lane).toBe(4);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(5000);
  expect(f.step).toHaveBeenCalledTimes(2);
  f.key('keydown', 'a');
  expect(lane).toBe(3);
  f.input.dispose();
});

it('entering an editable control cancels a hold and preserves native key editing', () => {
  const f = fixture();
  f.key('keydown', 'd');
  const event = new Event('focusin');
  const control = { closest: () => ({}) };
  Object.defineProperty(event, 'target', { value: control });
  f.keys.dispatchEvent(event);
  expect(f.key('keydown', 'ArrowRight', false, control).defaultPrevented).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(f.step).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  f.input.dispose();
});

it('steps once on left/right tap release, with no hold or drag steering', () => {
  const f = fixture();
  f.pointer('pointerdown', 100);
  expect(f.step).not.toHaveBeenCalled();
  f.pointer('pointerup', 105);
  f.pointer('pointerdown', 320);
  f.pointer('pointerup', 320);
  expect(f.step.mock.calls).toEqual([[-1], [1]]);
  f.pointer('pointerdown', 100);
  f.pointer('pointermove', 310);
  f.pointer('pointerup', 310);
  expect(f.step).toHaveBeenCalledTimes(2);
  f.input.dispose();
});

it('leaves HUD/editable targets alone and clears canceled, paused and blurred input', () => {
  const f = fixture();
  const hud = { closest: () => ({}) };
  f.key('keydown', 'ArrowRight', false, hud);
  f.pointer('pointerdown', 350, { target: hud });
  f.pointer('pointerup', 350, { target: hud });
  expect(f.step).not.toHaveBeenCalled();
  f.pointer('pointerdown', 100);
  f.pointer('pointercancel', 100);
  f.pointer('pointerup', 100);
  f.pointer('pointerdown', 100);
  f.input.stop();
  f.pointer('pointerup', 100);
  f.key('keydown', 'a');
  expect(f.step).not.toHaveBeenCalled();
  f.input.start();
  f.key('keydown', 'a');
  f.keys.dispatchEvent(new Event('blur'));
  f.key('keydown', 'a');
  expect(f.step.mock.calls).toEqual([[-1], [-1]]);
  f.input.dispose();
});
