"""Bake the Kenney Mini Forest archer into static Modern Toy Soldier assets.

Usage: python scripts/prepare_character_models.py SOURCE_DIR public/models
SOURCE_DIR contains character-archer.glb and colormap.png from the official
Kenney Mini Forest 1.0 archive. Gear is generated from simple rigid geometry.
"""

from __future__ import annotations

import json
import struct
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

COMPONENTS = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path: Path):
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"Not a GLB: {path}")
    json_length, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("Missing glTF JSON chunk")
    document = json.loads(data[20:20 + json_length])
    binary_start = 20 + json_length + 8
    return document, data[binary_start:]


def accessor(document, binary, index):
    entry = document["accessors"][index]
    view = document["bufferViews"][entry["bufferView"]]
    dtype = np.dtype(COMPONENTS[entry["componentType"]]).newbyteorder("<")
    width = COUNTS[entry["type"]]
    offset = view.get("byteOffset", 0) + entry.get("byteOffset", 0)
    stride = view.get("byteStride", dtype.itemsize * width)
    values = np.ndarray((entry["count"], width), dtype=dtype, buffer=binary,
                        offset=offset, strides=(stride, dtype.itemsize)).copy()
    return values[:, 0] if width == 1 else values


def quaternion_matrix(value):
    x, y, z, w = value
    return np.array([
        [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w), 0],
        [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w), 0],
        [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y), 0],
        [0, 0, 0, 1],
    ], dtype=np.float64)


def node_matrix(node, overrides):
    if "matrix" in node and not overrides:
        return np.asarray(node["matrix"], dtype=np.float64).reshape(4, 4).T
    position = np.asarray(overrides.get("translation", node.get("translation", [0, 0, 0])), dtype=np.float64)
    rotation = np.asarray(overrides.get("rotation", node.get("rotation", [0, 0, 0, 1])), dtype=np.float64)
    scale = np.asarray(overrides.get("scale", node.get("scale", [1, 1, 1])), dtype=np.float64)
    matrix = quaternion_matrix(rotation)
    matrix[:3, :3] *= scale
    matrix[:3, 3] = position
    return matrix


def sample_animation(document, binary, name, seconds):
    clips = [clip for clip in document.get("animations", []) if clip.get("name", "").endswith(name)]
    if len(clips) != 1:
        raise ValueError(f"Expected one animation ending in {name}, found {len(clips)}")
    clip = clips[0]
    overrides = {}
    for channel in clip["channels"]:
        sampler = clip["samplers"][channel["sampler"]]
        if sampler.get("interpolation", "LINEAR") != "LINEAR":
            raise ValueError("Only LINEAR animation sampling is supported")
        times = accessor(document, binary, sampler["input"])
        values = accessor(document, binary, sampler["output"]).astype(np.float64)
        at = min(max(seconds, float(times[0])), float(times[-1]))
        upper = min(int(np.searchsorted(times, at, side="right")), len(times) - 1)
        lower = max(0, upper - 1)
        blend = 0.0 if times[upper] == times[lower] else (at - times[lower]) / (times[upper] - times[lower])
        value = values[lower] * (1 - blend) + values[upper] * blend
        if channel["target"]["path"] == "rotation":
            value /= np.linalg.norm(value)
        overrides.setdefault(channel["target"]["node"], {})[channel["target"]["path"]] = value
    return overrides


def world_matrices(document, overrides):
    nodes = document["nodes"]
    parents = {}
    for parent, node in enumerate(nodes):
        for child in node.get("children", []):
            parents[child] = parent
    result = {}

    def world(index):
        if index not in result:
            local = node_matrix(nodes[index], overrides.get(index, {}))
            result[index] = world(parents[index]) @ local if index in parents else local
        return result[index]

    for index in range(len(nodes)):
        world(index)
    return result


def bake_primitive(document, binary, primitive, node, worlds):
    attributes = primitive["attributes"]
    positions = accessor(document, binary, attributes["POSITION"]).astype(np.float64)
    normals = accessor(document, binary, attributes["NORMAL"]).astype(np.float64)
    coordinates = accessor(document, binary, attributes["TEXCOORD_0"]).astype(np.float32) if "TEXCOORD_0" in attributes else None
    indices = accessor(document, binary, primitive["indices"]).astype(np.uint32)
    mesh_world = worlds[node]
    skin_id = document["nodes"][node].get("skin")
    if skin_id is not None:
        skin = document["skins"][skin_id]
        binds = accessor(document, binary, skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        joint_matrices = np.asarray([worlds[joint] @ bind for joint, bind in zip(skin["joints"], binds)])
        joints = accessor(document, binary, attributes["JOINTS_0"]).astype(np.int32)
        weights = accessor(document, binary, attributes["WEIGHTS_0"]).astype(np.float64)
        if np.issubdtype(COMPONENTS[document["accessors"][attributes["WEIGHTS_0"]]["componentType"]], np.integer):
            weights /= np.iinfo(COMPONENTS[document["accessors"][attributes["WEIGHTS_0"]]["componentType"]]).max
        weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-12)
        matrices = (joint_matrices[joints] * weights[:, :, None, None]).sum(axis=1)
        positions = np.einsum("nij,nj->ni", matrices, np.column_stack((positions, np.ones(len(positions)))))[:, :3]
        normals = np.einsum("nij,nj->ni", matrices[:, :3, :3], normals)
    else:
        positions = np.einsum("ij,nj->ni", mesh_world, np.column_stack((positions, np.ones(len(positions)))))[:, :3]
        normals = np.einsum("ij,nj->ni", mesh_world[:3, :3], normals)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    return positions, normals, coordinates, indices


class GlbWriter:
    def __init__(self):
        self.binary = bytearray()
        self.views = []
        self.accessors = []

    def add_bytes(self, data, target=None):
        while len(self.binary) % 4:
            self.binary.append(0)
        view = {"buffer": 0, "byteOffset": len(self.binary), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.views.append(view)
        self.binary.extend(data)
        return len(self.views) - 1

    def add_array(self, values, kind, component, target):
        values = np.ascontiguousarray(values)
        view = self.add_bytes(values.tobytes(), target)
        entry = {"bufferView": view, "componentType": component, "count": len(values), "type": kind}
        if kind == "VEC3":
            entry["min"] = values.min(axis=0).tolist()
            entry["max"] = values.max(axis=0).tolist()
        self.accessors.append(entry)
        return len(self.accessors) - 1

    def save(self, path, primitives, materials, image=None):
        document = {"asset": {"version": "2.0", "generator": "TopWar character pose bake"},
                    "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
                    "meshes": [{"primitives": primitives}], "materials": materials,
                    "bufferViews": self.views, "accessors": self.accessors, "buffers": [{"byteLength": 0}]}
        if image is not None:
            image_view = self.add_bytes(image)
            document["images"] = [{"bufferView": image_view, "mimeType": "image/png"}]
            document["textures"] = [{"source": 0}]
        while len(self.binary) % 4:
            self.binary.append(0)
        document["buffers"][0]["byteLength"] = len(self.binary)
        encoded = json.dumps(document, separators=(",", ":")).encode()
        encoded += b" " * ((-len(encoded)) % 4)
        size = 12 + 8 + len(encoded) + 8 + len(self.binary)
        path.write_bytes(struct.pack("<III", 0x46546C67, 2, size)
                         + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
                         + struct.pack("<II", len(self.binary), 0x004E4942) + self.binary)


def write_mesh(path, pieces, material, image=None):
    writer = GlbWriter()
    primitives = []
    for positions, normals, uv, indices in pieces:
        attrs = {"POSITION": writer.add_array(np.asarray(positions, dtype="<f4"), "VEC3", 5126, 34962),
                 "NORMAL": writer.add_array(np.asarray(normals, dtype="<f4"), "VEC3", 5126, 34962)}
        if uv is not None:
            attrs["TEXCOORD_0"] = writer.add_array(np.asarray(uv, dtype="<f4"), "VEC2", 5126, 34962)
        primitives.append({"attributes": attrs,
                           "indices": writer.add_array(np.asarray(indices, dtype="<u4"), "SCALAR", 5125, 34963),
                           "material": 0})
    writer.save(path, primitives, [material], image)
    print(f"{path.name}: {path.stat().st_size} bytes")


def rigid_piece(source, clip=None, seconds=0):
    document, binary = read_glb(source)
    overrides = sample_animation(document, binary, clip, seconds) if clip else {}
    worlds = world_matrices(document, overrides)
    pieces = []
    for index, node in enumerate(document["nodes"]):
        if "mesh" not in node:
            continue
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            pieces.append(bake_primitive(document, binary, primitive, index, worlds))
    positions = np.concatenate([piece[0] for piece in pieces])
    normals = np.concatenate([piece[1] for piece in pieces])
    uv = np.concatenate([piece[2] for piece in pieces])
    offsets = np.cumsum([0] + [len(piece[0]) for piece in pieces[:-1]])
    indices = np.concatenate([piece[3] + offset for piece, offset in zip(pieces, offsets)])
    return positions, normals, uv, indices


def box(center, size):
    cx, cy, cz = center
    sx, sy, sz = np.asarray(size) / 2
    corners = np.array([[cx-sx, cy-sy, cz-sz], [cx+sx, cy-sy, cz-sz],
                        [cx+sx, cy+sy, cz-sz], [cx-sx, cy+sy, cz-sz],
                        [cx-sx, cy-sy, cz+sz], [cx+sx, cy-sy, cz+sz],
                        [cx+sx, cy+sy, cz+sz], [cx-sx, cy+sy, cz+sz]])
    faces = [([0, 1, 2, 3], [0, 0, -1]), ([5, 4, 7, 6], [0, 0, 1]),
             ([4, 0, 3, 7], [-1, 0, 0]), ([1, 5, 6, 2], [1, 0, 0]),
             ([3, 2, 6, 7], [0, 1, 0]), ([4, 5, 1, 0], [0, -1, 0])]
    vertices, normals, indices = [], [], []
    for face, normal in faces:
        start = len(vertices)
        vertices.extend(corners[face])
        normals.extend([normal] * 4)
        indices.extend([start, start+1, start+2, start, start+2, start+3])
    return np.asarray(vertices), np.asarray(normals), np.asarray(indices)


def join_parts(parts):
    offsets = np.cumsum([0] + [len(part[0]) for part in parts[:-1]])
    return (np.concatenate([part[0] for part in parts]),
            np.concatenate([part[1] for part in parts]), None,
            np.concatenate([part[2] + offset for part, offset in zip(parts, offsets)]))


def helmet_parts(boss=False):
    # Low-poly rounded dome, small brim. Its open face retains Kenney expressions.
    radius = .34 if boss else .265
    levels = ((.835, radius), (.91, radius * 1.08), (1.005, radius * .88),
              (1.075 if boss else 1.055, radius * .42))
    sides = 10
    vertices = np.array([[np.sin(i * 2*np.pi/sides) * r, y,
                          np.cos(i * 2*np.pi/sides) * r]
                         for y, r in levels for i in range(sides)] +
                        [[0, levels[-1][0] + .02, 0]], dtype=float)
    indices = []
    for ring in range(len(levels)-1):
        for i in range(sides):
            a, b = ring*sides+i, ring*sides+(i+1)%sides
            indices.extend((a, b, b+sides, a, b+sides, a+sides))
    for i in range(sides):
        indices.extend(((len(levels)-1)*sides+i,
                        (len(levels)-1)*sides+(i+1)%sides, len(vertices)-1))
    normals = vertices.copy()
    normals[:, 1] -= .84
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    brim = box((0, .84, radius*.78), (radius*1.7, .045, radius*.65))
    return join_parts([(vertices, normals, np.asarray(indices)), brim])


def vest_parts(boss=False):
    # A compact chest plate leaves the arms, lower tunic and boots exposed.
    width = .44 if boss else .36
    y = .47
    height = .16
    depth = .29
    return join_parts([box((-width*.27, y, depth), (width*.42, height, .075)),
                       box((width*.27, y, depth), (width*.42, height, .075)),
                       box((0, y, -depth), (width, height, .055))])


def rifle_parts():
    # Exaggerated, forward-pointing toy rifle in the archer's weapon hand.
    positions, normals, uv, indices = join_parts([
        box((.35, .46, .32), (.12, .13, .67)),
        box((.35, .46, .74), (.085, .085, .29)),
        box((.35, .55, .18), (.18, .055, .16)),
        box((.35, .32, .25), (.08, .19, .11)),
        box((.35, .43, -.10), (.18, .13, .21))])
    # Angle the barrel sideways enough to retain its silhouette from behind.
    angle = .45
    rotation = np.array([[np.cos(angle), 0, np.sin(angle)], [0, 1, 0],
                         [-np.sin(angle), 0, np.cos(angle)]])
    pivot = np.array([.35, 0, .2])
    return (positions - pivot) @ rotation.T + pivot, normals @ rotation.T, uv, indices


def bullet_parts():
    # Broad enough to read head-on at the portrait camera, with finite tier scaling.
    return join_parts([box((0, 0, 0), (.14, .14, .42)),
                       box((0, 0, .24), (.18, .18, .09))])


def prepare_toy_soldier(inputs, outputs):
    neutral = {"name": "tier-equipment", "pbrMetallicRoughness": {
        "baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 1}}
    body = rigid_piece(inputs / "character-archer.glb", "idle", .2)
    positions, normals, uv, indices = body
    minimum = positions.min(axis=0)
    maximum = positions.max(axis=0)
    height = maximum[1] - minimum[1]
    center = (minimum + maximum) / 2
    center[1] = minimum[1]
    body = ((positions-center)/height, normals, uv, indices)
    original = (inputs / "colormap.png").read_bytes()
    textured = {"name": "fixed-body", "pbrMetallicRoughness": {
        "baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1}}
    write_mesh(outputs / "toy-soldier-body.glb", [body], textured, original)
    # The main tunic swatch is used by body-mesh vertices at U=0.96875,
    # V=0.775..0.975. Paint only texels touched by that UV line. The source
    # atlas remains byte-for-byte unchanged in the enemy/Boss body GLB.
    cloth_uv = uv[np.isclose(uv[:, 0], .96875)]
    if len(cloth_uv) < 150 or not (.77 < cloth_uv[:, 1].min() < .78):
        raise ValueError("Kenney archer cloth UV swatch changed")
    atlas = np.asarray(Image.open(BytesIO(original)).convert("RGBA")).copy()
    height_px, width_px = atlas.shape[:2]
    x = int(round(.96875 * (width_px - 1)))
    y0 = int(np.floor(cloth_uv[:, 1].min() * (height_px - 1)))
    y1 = int(np.ceil(cloth_uv[:, 1].max() * (height_px - 1)))
    # Four texels either side account for bilinear sampling/mip generation.
    for row in range(y0 - 4, y1 + 5):
        for col in range(x - 4, x + 5):
            if 0 <= row < height_px and 0 <= col < width_px:
                source = atlas[row, col, :3].astype(np.float64)
                lightness = np.clip(source.mean() / 150, .65, 1.3)
                atlas[row, col, :3] = np.clip(np.array([23, 105, 238]) * lightness, 0, 255)
    stream = BytesIO()
    Image.fromarray(atlas).save(stream, format="PNG", optimize=True)
    write_mesh(outputs / "toy-soldier-player-body.glb", [body], textured, stream.getvalue())
    for name, piece in (("helmet", helmet_parts()), ("boss-helmet", helmet_parts(True)),
                        ("vest", vest_parts()), ("boss-vest", vest_parts(True))):
        write_mesh(outputs / f"toy-soldier-{name}.glb", [piece], neutral)
    for name, piece, color in (("rifle", rifle_parts(), [.17, .20, .22, 1]),
                               ("bullet", bullet_parts(), [.95, .78, .31, 1])):
        write_mesh(outputs / f"toy-soldier-{name}.glb", [piece],
                   {"name": name, "pbrMetallicRoughness": {
                       "baseColorFactor": color, "metallicFactor": 0,
                       "roughnessFactor": .8}})


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: prepare_character_models.py SOURCE_DIR OUTPUT_DIR")
    inputs, outputs = Path(sys.argv[1]), Path(sys.argv[2])
    outputs.mkdir(parents=True, exist_ok=True)
    prepare_toy_soldier(inputs, outputs)
