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
    const protectedNames = ['helmet', 'vest', 'rifle', 'bullet', 'boss-body', 'boss-vest',
      ...[0, 1, 2, 3].map(index => `boss-run-${index}`), ...[0, 1, 2, 3].map(index => `boss-slam-${index}`)];
    const hash = createHash('sha256');
    for (const name of protectedNames) hash.update(readFileSync(new URL(`../public/models/toy-soldier-${name}.glb`, import.meta.url)));
    expect(hash.digest('hex')).toBe('c35147b2ebb80e37271f50429bef97c9f52c08537247f94641dcd762f8875ed9');
  });
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
      'run-0', 'run-1', 'run-2', 'run-3',
      'boss-body', 'boss-run-0', 'boss-run-1', 'boss-run-2', 'boss-run-3',
      'boss-slam-0', 'boss-slam-1', 'boss-slam-2', 'boss-slam-3']) {
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
    const rifle = glb('rifle').document;
    expect(rifle.materials[0].pbrMetallicRoughness.baseColorFactor[0]).toBeLessThan(.3);
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
    expect(triangles('player-body') - triangles('boss-body')).toBe(4);
    const bossRunCounts = [471, 458, 458, 471];
    for (let index = 0; index < 4; index++) {
      expect(triangles(`boss-run-${index}`)).toBe(bossRunCounts[index]);
      expect(triangles(`boss-slam-${index}`)).toBe(triangles('player-body') - 14);
    }
    expect(image('boss-body')).toEqual(image('body'));
    const normal = positions('player-body');
    const boss = positions('boss-body');
    // The lower hair, facial details and neck remain present in the Boss mesh.
    expect(boss.filter(([x, y, z]) => Math.abs(x) > .18 && y < .7 && z > -.15).length)
      .toBeGreaterThan(0);
    expect(uvs('boss-body').some(([u], index) => Math.abs(u - .09375) < 1e-5
      && boss[index][1] > .726)).toBe(false);
    expect(boss.length).toBeLessThan(normal.length);
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
    // Rim clipping generates pose-specific intersection vertices, not a shared rig.
    expect([0, 1, 2, 3].map(index => triangles(`run-${index}`))).toEqual([471, 458, 458, 471]);
    const gray = rgba(image('gray-body'));
    expect(gray.at(112, 268)[0]).toBe(gray.at(112, 268)[1]);
    expect(gray.at(112, 268)[1]).toBe(gray.at(112, 268)[2]);
  });

  it('clips hidden upper hair consistently in normal idle, gray contact/death and every run frame', () => {
    for (const name of ['body', 'gray-body', 'run-0', 'run-1', 'run-2', 'run-3']) {
      const vertices = positions(name);
      const texcoords = uvs(name);
      const hair = vertices.filter((_, index) => Math.abs(texcoords[index][0] - .09375) < 1e-5);
      expect(hair.length).toBeGreaterThan(0);
      expect(hair.every(point => point[1] <= .72501)).toBe(true);
      expect(hair.some(point => point[1] > .65 && point[1] < .725)).toBe(true);
    }
    expect(positions('gray-body')).toEqual(positions('body'));
    expect(positions('body')).toEqual(positions('boss-body'));
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

 it('adds normalized limb metadata while preserving the player surface and texture exactly', () => {
   const { document, binary } = glb('player-body'), primitive = document.meshes[0].primitives[0];
   const hash = createHash('sha256');
   for (const accessorIndex of ['POSITION','NORMAL','TEXCOORD_0'].map(name => primitive.attributes[name]).concat(primitive.indices)) {
     const view = document.bufferViews[document.accessors[accessorIndex].bufferView];
     hash.update(binary.subarray(view.byteOffset,view.byteOffset+view.byteLength));
   }
   hash.update(image('player-body'));
   expect(hash.digest('hex')).toBe('7a5f141af33d2fcd7bba873b58894b38fe986fdd8f3db174bc837a5b46f49ed0');
   const a = document.accessors[primitive.attributes._MOTION], view = document.bufferViews[a.bufferView];
   expect(a.type).toBe('VEC4'); expect(a.count).toBe(positions('player-body').length);
   const bytes = new DataView(binary.buffer,binary.byteOffset+view.byteOffset,view.byteLength);
   const totals = [0,0,0,0];
   for(let i=0;i<a.count;i++) { let sum=0; for(let j=0;j<4;j++) {
     const value=bytes.getFloat32(i*16+j*4,true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
     totals[j]+=value;sum+=value;
   } expect(sum).toBeLessThanOrEqual(1.00001); }
   expect(totals.every(n => n>10)).toBe(true);
 });
