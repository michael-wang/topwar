import { expect, it, vi } from 'vitest';
import { LaneStepInput } from '../src/input/LaneStepInput';

function fixture() {
  const keys = new EventTarget();
  const viewport = Object.assign(new EventTarget(), { setPointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 20, width: 400 }) });
  const step = vi.fn();
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

it('sends one lane step per physical key press and ignores held-key repeat', () => {
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
