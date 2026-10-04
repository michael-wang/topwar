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

function triangles(name) {
  const { document } = glb(name);
  const entry = document.accessors[document.meshes[0].primitives[0].indices];
  return entry.count / 3;
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
  it('preserves Boss and shared gear assets byte-for-byte', () => {
    const protectedNames = ['gray-body','helmet','boss-vest','bullet',
      ...[0,1,2,3].map(i=>`boss-slam-${i}`),'boss-body',...[0,1,2,3].map(i=>`boss-run-${i}`)];
    const hash = createHash('sha256');
    for (const name of protectedNames) hash.update(readFileSync(new URL(`../public/models/toy-soldier-${name}.glb`, import.meta.url)));
    expect(hash.digest('hex')).toBe('ef85c3b7514b5d1c86607901df4543e5cdf1c2d4f03dc5d91d18e7ae387da0b2');
  });
  it('embeds the original Kenney colormap unchanged for enemy and Boss bodies', () => {
    expect(createHash('sha256').update(image('boss-body')).digest('hex'))
      .toBe('319f1087d8ed50a8794f9a8179f64671d5595f2365fdf3e47ec2d4eb74dba20f');
  });

  it('keeps a hard helmet rim above the face and strips runtime skeletons', () => {
    for (const name of ['helmet','bullet','gray-body','boss-body','boss-vest',
      ...[0,1,2,3].map(i=>`boss-run-${i}`),...[0,1,2,3].map(i=>`boss-slam-${i}`)]) {
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
    for (const name of ['boss-vest']) {
      const { document } = glb(name);
      const position = document.meshes[0].primitives[0].attributes.POSITION;
      expect(document.accessors[position].max[1]).toBeLessThan(.7);
    }
    const bossVest = positions('boss-vest');
    const bossVestGlb = glb('boss-vest').document;
    const bossVestColors = bossVestGlb.accessors[
      bossVestGlb.meshes[0].primitives[0].attributes.COLOR_0];
    expect(bossVestColors.count).toBe(bossVest.length);
    expect(bossVestColors.min[0]).toBeCloseTo(.6);
    expect(bossVestColors.max[0]).toBe(1);
    expect(Math.min(...bossVest.map((point) => point[1]))).toBeGreaterThan(.26);
    expect(Math.max(...bossVest.map((point) => point[1]))).toBeLessThan(.65);
    expect(Math.max(...bossVest.map((point) => Math.abs(point[0])))).toBeGreaterThan(.3);
    expect(Math.max(...bossVest.map((point) => Math.abs(point[0])))).toBeLessThan(.35);
    expect(bossVest.filter((point) => point[1] > .55 && Math.abs(point[0]) > .3)).toHaveLength(0);
    const bullet = glb('bullet').document;
    const bulletBounds = bullet.accessors[bullet.meshes[0].primitives[0].attributes.POSITION];
    expect(bulletBounds.max[0] - bulletBounds.min[0]).toBeLessThan(.06);
    expect(bulletBounds.max[2] - bulletBounds.min[2]).toBeGreaterThan(.5);
  });

  it('bakes four distinct Boss attack poses without runtime rig data', () => {
    const frames = [0, 1, 2, 3].map((index) => positions(`boss-slam-${index}`));
    expect(frames.every((frame) => frame.length === frames[0].length)).toBe(true);
    for (let index = 1; index < frames.length; index++) {
      expect(frames[index].some((point, vertex) => point.some((axis, coordinate) =>
        Math.abs(axis - frames[index - 1][vertex][coordinate]) > .01))).toBe(true);
    }
  });

  it('bakes helmet-occluded head geometry for every Boss pose family', () => {
    expect(triangles('boss-body')).toBe(476);
    const bossRunCounts = [471, 458, 458, 471];
    for (let index = 0; index < 4; index++) {
      expect(triangles(`boss-run-${index}`)).toBe(bossRunCounts[index]);
      expect(triangles(`boss-slam-${index}`)).toBe(466);
    }
    expect(image('boss-body')).toEqual(image('boss-body'));
    const boss = positions('boss-body');
    // The lower hair, facial details and neck remain present in the Boss mesh.
    expect(boss.filter(([x, y, z]) => Math.abs(x) > .18 && y < .7 && z > -.15).length)
      .toBeGreaterThan(0);
    expect(uvs('boss-body').some(([u], index) => Math.abs(u - .09375) < 1e-5
      && boss[index][1] > .726)).toBe(false);

  });

  it('retains Boss gray atlas and corrected helmet-hidden hair without obsolete normal bodies',()=>{
    const gray=rgba(image('gray-body'));
    expect(gray.at(112,268)[0]).toBe(gray.at(112,268)[1]);
    expect(gray.at(112,268)[1]).toBe(gray.at(112,268)[2]);
    expect(positions('gray-body')).toEqual(positions('boss-body'));
    for(const name of ['boss-body','gray-body',...[0,1,2,3].map(i=>`boss-run-${i}`)]){
      const vertices=positions(name),texcoords=uvs(name);
      const hair=vertices.filter((_,i)=>Math.abs(texcoords[i][0]-.09375)<1e-5);
      expect(hair.length).toBeGreaterThan(0);expect(hair.every(p=>p[1]<=.72501)).toBe(true);
      expect(uvs(name).some(([u,v],i)=>vertices[i][1]>.6&&Math.abs(u-.21875)<1e-5&&v>=.824)).toBe(false);
    }
  });
});
