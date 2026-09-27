import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

function glb(name) {
  const data = readFileSync(new URL(`../public/models/toy-soldier-${name}.glb`, import.meta.url));
  expect(data.toString('utf8', 0, 4)).toBe('glTF');
  const jsonLength = data.readUInt32LE(12);
  const document = JSON.parse(data.toString('utf8', 20, 20 + jsonLength));
  const binary = data.subarray(20 + jsonLength + 8);
  return { document, binary };
}

function image(name) {
  const { document, binary } = glb(name);
  const view = document.bufferViews[document.images[0].bufferView];
  return binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
}

function positions(name) {
  const { document, binary } = glb(name);
  const entry = document.accessors[document.meshes[0].primitives[0].attributes.POSITION];
  const view = document.bufferViews[entry.bufferView];
  const bytes = new DataView(binary.buffer, binary.byteOffset + view.byteOffset + (entry.byteOffset ?? 0));
  return Array.from({ length: entry.count }, (_, vertex) =>
    [0, 1, 2].map((axis) => bytes.getFloat32(vertex * 12 + axis * 4, true)));
}

function uvs(name) {
  const { document, binary } = glb(name);
  const entry = document.accessors[document.meshes[0].primitives[0].attributes.TEXCOORD_0];
  const view = document.bufferViews[entry.bufferView];
  const bytes = new DataView(binary.buffer, binary.byteOffset + view.byteOffset + (entry.byteOffset ?? 0));
  return Array.from({ length: entry.count }, (_, vertex) =>
    [0, 1].map((axis) => bytes.getFloat32(vertex * 8 + axis * 4, true)));
}

function rgba(png) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect(png[24]).toBe(8);
  expect(png[25]).toBe(6);
  const chunks = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    if (type === 'IDAT') chunks.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  let source = 0;
  for (let row = 0; row < height; row++) {
    const filter = raw[source++];
    for (let col = 0; col < stride; col++) {
      const index = row * stride + col;
      const left = col >= 4 ? pixels[index - 4] : 0;
      const above = row ? pixels[index - stride] : 0;
      const upperLeft = row && col >= 4 ? pixels[index - stride - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = above;
      if (filter === 3) predictor = Math.floor((left + above) / 2);
      if (filter === 4) {
        const base = left + above - upperLeft;
        const distances = [Math.abs(base - left), Math.abs(base - above), Math.abs(base - upperLeft)];
        predictor = distances[0] <= distances[1] && distances[0] <= distances[2] ? left
          : distances[1] <= distances[2] ? above : upperLeft;
      }
      pixels[index] = (raw[source++] + predictor) & 255;
    }
  }
  return { width, height, pixels,
    at(x, y) { return [...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)]; } };
}

describe('Kenney texture and toy soldier gear bake', () => {
  it('embeds the original Kenney colormap unchanged for enemy and Boss bodies', () => {
    expect(createHash('sha256').update(image('body')).digest('hex'))
      .toBe('319f1087d8ed50a8794f9a8179f64671d5595f2365fdf3e47ec2d4eb74dba20f');
  });

  it('makes only the identified cloth swatch blue and preserves sampled skin and leather', () => {
    const original = rgba(image('body'));
    const player = rgba(image('player-body'));
    expect([original.width, original.height]).toEqual([512, 512]);
    const cloth = player.at(495, 430);
    expect(cloth[2]).toBeGreaterThan(cloth[0] * 2);
    expect(cloth[2]).toBeGreaterThan(cloth[1] * 1.4);
    const skin = original.at(112, 268);
    expect(skin[0]).toBeGreaterThan(skin[1]);
    expect(skin[1]).toBeGreaterThan(skin[2]);
    expect(player.at(112, 268)).toEqual(skin);
    expect(player.at(48, 319)).toEqual(original.at(48, 319));
    let changed = 0;
    for (let pixel = 0; pixel < original.pixels.length; pixel += 4) {
      if (!original.pixels.subarray(pixel, pixel + 4).equals(player.pixels.subarray(pixel, pixel + 4))) changed++;
    }
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(1200); // under 0.5% of the original atlas
  });

  it('keeps a hard helmet rim above the face and strips runtime skeletons', () => {
    for (const name of ['body', 'player-body', 'helmet', 'vest',
      'boss-vest', 'rifle', 'bullet', 'gray-body',
      'run-0', 'run-1', 'run-2', 'run-3']) {
      const { document } = glb(name);
      expect(document.skins).toBeUndefined();
      expect(document.animations).toBeUndefined();
    }
    for (const name of ['helmet']) {
      const { document } = glb(name);
      const position = document.meshes[0].primitives[0].attributes.POSITION;
      expect(document.accessors[position].min[1]).toBeGreaterThan(.73);
      expect(document.accessors[position].min[1]).toBeLessThan(.76);
      expect(document.accessors[position].max[1]).toBeLessThan(1.08);
      expect(document.images).toBeUndefined();
    }
    const helmet = positions('helmet');
    expect(helmet.filter((point) => Math.abs(point[1] - .74) < .001).length).toBeGreaterThan(10);
    expect(Math.max(...helmet.map((point) => Math.abs(point[0])))).toBeGreaterThan(.32);
    expect(existsSync(new URL('../public/models/toy-soldier-boss-helmet.glb', import.meta.url))).toBe(false);
    for (const name of ['vest', 'boss-vest']) {
      const { document } = glb(name);
      const position = document.meshes[0].primitives[0].attributes.POSITION;
      expect(document.accessors[position].max[1]).toBeLessThan(.7);
    }
    const bossVest = positions('boss-vest');
    expect(Math.min(...bossVest.map((point) => point[1]))).toBeGreaterThan(.3);
    expect(Math.max(...bossVest.map((point) => point[1]))).toBeLessThan(.4);
    const rifle = glb('rifle').document;
    expect(rifle.materials[0].pbrMetallicRoughness.baseColorFactor[0]).toBeLessThan(.3);
    const bullet = glb('bullet').document;
    const bulletBounds = bullet.accessors[bullet.meshes[0].primitives[0].attributes.POSITION];
    expect(bulletBounds.max[0] - bulletBounds.min[0]).toBeLessThan(.06);
    expect(bulletBounds.max[2] - bulletBounds.min[2]).toBeGreaterThan(.5);
  });

  it('aims rifle along +Z and bakes four different sprint poses', () => {
    const rifle = positions('rifle');
    const player = positions('player-body');
    expect(player.some((point) => point[0] > .1 && point[1] > .98 && point[2] < -.05)).toBe(false);
    const rear = rifle.filter((point) => point[2] < 0);
    const muzzle = rifle.filter((point) => point[2] > .8);
    const averageX = (points) => points.reduce((sum, point) => sum + point[0], 0) / points.length;
    expect(Math.abs(averageX(muzzle) - averageX(rear))).toBeLessThan(.05);
    expect(Math.max(...muzzle.map((point) => point[2]))).toBeGreaterThan(.85);
    const frames = [0, 1, 2, 3].map((index) => positions(`run-${index}`));
    expect(new Set(frames.map((frame) => JSON.stringify(frame))).size).toBe(4);
    expect(frames.every((frame) => frame.length === frames[0].length)).toBe(true);
    const gray = rgba(image('gray-body'));
    expect(gray.at(112, 268)[0]).toBe(gray.at(112, 268)[1]);
    expect(gray.at(112, 268)[1]).toBe(gray.at(112, 268)[2]);
  });

  it('excludes the source head-mesh green cap swatch from every baked body pose', () => {
    for (const name of ['body', 'player-body', 'gray-body',
      'run-0', 'run-1', 'run-2', 'run-3']) {
      const vertices = positions(name);
      expect(uvs(name).some(([u, v], index) => vertices[index][1] > .6
        && Math.abs(u - .21875) < 1e-5 && v >= .824)).toBe(false);
      expect(vertices.some((point) => point[0] > .1 && point[1] > .98 && point[2] < -.05)).toBe(false);
    }
  });
});
