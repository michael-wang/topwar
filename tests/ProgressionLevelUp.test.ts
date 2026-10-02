import { expect, it } from 'vitest';
import { ProgressionLevelObserver } from '../src/presentation/ProgressionLevelUp';
it('observes each gained level once and batches multiple-level overflow coherently', () => {
  const observer = new ProgressionLevelObserver();
  expect(observer.observe(1)).toBeNull();
  expect(observer.observe(2)).toEqual({ kind: 'progressionLevelUp', fromLevel: 1, toLevel: 2 });
  expect(observer.observe(2)).toBeNull();
  expect(observer.observe(5)).toEqual({ kind: 'progressionLevelUp', fromLevel: 2, toLevel: 5 });
  expect(observer.observe(5)).toBeNull();
  observer.reset(); expect(observer.observe(1)).toBeNull();
  expect(observer.observe(2)?.fromLevel).toBe(1);
});
