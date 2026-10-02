import { expect, it } from 'vitest';
import { OffshoreTransports } from '../src/rendering/environment/OffshoreTransports';
it('keeps three asymmetric background carriers and a shoreward visual craft outside gameplay', () => {
  const transports = new OffshoreTransports();
  const ships = transports.group.children.filter(child => child.name.startsWith('troop-carrier'));
  expect(ships).toHaveLength(3);
  expect(new Set(ships.map(ship => ship.position.z)).size).toBe(3);
  expect(new Set(ships.map(ship => ship.scale.x)).size).toBe(3);
  expect(ships.every(ship => ship.position.z > 53 && ship.children.length === 4)).toBe(true);
  transports.update(100, 1000, true, -4);
  expect(transports.group.position.z).toBe(100);
  const craft = transports.group.children.at(-1)!; expect(craft.position.z).toBe(61);
  transports.update(100, 2000, true, 4); expect(craft.position.z).toBe(53);
  transports.update(100, 2000, false); expect(transports.group.visible).toBe(false);
  transports.dispose();
});
