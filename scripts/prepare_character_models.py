"""Bake Kenney Mini Forest archer, bow and arrow into static Toy Samurai assets.

Usage: python scripts/prepare_character_models.py SOURCE_DIR public/models
SOURCE_DIR contains character-archer.glb, weapon-bow.glb, weapon-arrow.glb,
and colormap.png from the official Kenney Mini Forest 1.0 archive.
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


def bar_between(a, b, width, depth):
    # A chunky four-sided crest bar, built by rotating a narrow box in the XY plane.
    a, b = np.asarray(a), np.asarray(b)
    delta = b - a
    length = np.linalg.norm(delta[:2])
    vertices, normals, indices = box((0, 0, 0), (width, length, depth))
    direction = delta[:2] / length
    rotation = np.array([[direction[1], direction[0], 0],
                         [-direction[0], direction[1], 0], [0, 0, 1]])
    return vertices @ rotation.T + (a+b)/2, normals @ rotation.T, indices


def helmet_parts(boss=False):
    # Open-faced, shallow kabuto: the Kenney face, clothing, arms and shoes stay visible.
    radius = .38 if boss else .25
    bottom = .85
    top = 1.09 if boss else 1.05
    sides = 8
    crown_vertices = []
    for y, r in ((bottom, radius), (top, radius * .72)):
        for index in range(sides):
            angle = index * 2 * np.pi / sides
            crown_vertices.append([np.sin(angle) * r, y, np.cos(angle) * r])
    crown_vertices = np.asarray(crown_vertices)
    crown_indices = []
    for index in range(sides):
        next_index = (index + 1) % sides
        crown_indices.extend([index, next_index, sides + next_index,
                              index, sides + next_index, sides + index])
        crown_indices.extend([sides + index, sides + next_index, sides * 2])
    crown_vertices = np.vstack((crown_vertices, [0, top + .025, 0]))
    crown_normals = crown_vertices.copy()
    crown_normals[:, 1] = .25
    crown_normals /= np.linalg.norm(crown_normals, axis=1, keepdims=True)
    pieces = [(crown_vertices, crown_normals, np.asarray(crown_indices))]
    # A small rear/side brim suggests shikoro without obscuring the face.
    pieces += [box((0, .82, -.24), (radius * 1.65, .075, .13)),
               box((-radius, .82, -.10), (.08, .075, .24)),
               box((radius, .82, -.10), (.08, .075, .24))]
    crest = .45 if boss else .25
    crest_top = 1.35 if boss else 1.18
    front = radius + .025
    pieces += [bar_between((0, 1.00, front), (-crest, crest_top, front), .075, .075),
               bar_between((0, 1.00, front), (crest, crest_top, front), .075, .075)]
    offsets = np.cumsum([0] + [len(part[0]) for part in pieces[:-1]])
    return (np.concatenate([part[0] for part in pieces]),
            np.concatenate([part[1] for part in pieces]), None,
            np.concatenate([part[2] + offset for part, offset in zip(pieces, offsets)]))


def prepare_toy_samurai(inputs, outputs):
    neutral = {"name": "kabuto", "pbrMetallicRoughness": {
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
    write_mesh(outputs / "toy-samurai-body.glb", [body], textured, original)
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
    write_mesh(outputs / "toy-samurai-player-body.glb", [body], textured, stream.getvalue())
    write_mesh(outputs / "toy-samurai-helmet.glb", [helmet_parts()], neutral)
    write_mesh(outputs / "toy-samurai-boss-helmet.glb", [helmet_parts(True)], neutral)
    for name, scale in (("weapon-bow", 1.2), ("weapon-arrow", 1.0)):
        part = rigid_piece(inputs / f"{name}.glb")
        p, n, uv, idx = part
        p = p * scale
        if name == "weapon-bow":
            # Kenney's bow lies in YZ; turn its curve toward the portrait camera.
            p = np.column_stack((p[:, 2] - .15, p[:, 1], -p[:, 0])) + [.43, .35, -.28]
            n = np.column_stack((n[:, 2], n[:, 1], -n[:, 0]))
        write_mesh(outputs / f"toy-samurai-{name[7:]}.glb", [(p, n, None, idx)],
                   {"name": "wood" if name == "weapon-bow" else "arrow", "pbrMetallicRoughness": {
                       "baseColorFactor": [.30, .17, .08, 1] if name == "weapon-bow" else [.67, .43, .20, 1],
                       "metallicFactor": 0, "roughnessFactor": 1}})


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: prepare_character_models.py SOURCE_DIR OUTPUT_DIR")
    inputs, outputs = Path(sys.argv[1]), Path(sys.argv[2])
    outputs.mkdir(parents=True, exist_ok=True)
    prepare_toy_samurai(inputs, outputs)
