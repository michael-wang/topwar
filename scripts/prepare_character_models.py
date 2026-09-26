"""Bake the selected Quaternius characters into small, rigid glTF binaries.

Usage: python scripts/prepare_character_models.py SOURCE_DIR public/models
SOURCE_DIR contains soldier.glb, zombie.glb, and giant.glb downloaded from the
Quaternius creator's individual CC0 model pages (see public/models/README.md).
"""

from __future__ import annotations

import json
import math
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


def prepare(source, destination, names, clip, at_seconds, facing_rotation):
    document, binary = read_glb(source)
    overrides = sample_animation(document, binary, clip, at_seconds)
    worlds = world_matrices(document, overrides)
    pieces = []
    for index, node in enumerate(document["nodes"]):
        if node.get("name") not in names or "mesh" not in node:
            continue
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            positions, normals, uv, indices = bake_primitive(document, binary, primitive, index, worlds)
            pieces.append((positions, normals, uv, indices, primitive["material"]))
    if not pieces:
        raise ValueError(f"No selected mesh in {source}")
    grouped = {}
    for positions, normals, uv, indices, material in pieces:
        grouped.setdefault(material, []).append((positions, normals, uv, indices))
    pieces = []
    for material, parts in grouped.items():
        offsets = np.cumsum([0] + [len(part[0]) for part in parts[:-1]])
        pieces.append((np.concatenate([part[0] for part in parts]),
                       np.concatenate([part[1] for part in parts]),
                       np.concatenate([part[2] for part in parts]) if parts[0][2] is not None else None,
                       np.concatenate([part[3] + offset for part, offset in zip(parts, offsets)]),
                       material))
    all_positions = np.concatenate([piece[0] for piece in pieces])
    height = float(all_positions[:, 1].max() - all_positions[:, 1].min())
    if not math.isfinite(height) or height <= 0:
        raise ValueError("Invalid model height")
    center = (all_positions[:, 0].min() + all_positions[:, 0].max()) / 2
    zcenter = (all_positions[:, 2].min() + all_positions[:, 2].max()) / 2
    minimum_y = all_positions[:, 1].min()
    rotation = np.array([[math.cos(facing_rotation), 0, math.sin(facing_rotation)],
                         [0, 1, 0], [-math.sin(facing_rotation), 0, math.cos(facing_rotation)]])
    writer = GlbWriter()
    output = []
    material_ids = {}
    materials = []
    for positions, normals, uv, indices, old_material in pieces:
        positions = ((positions - [center, minimum_y, zcenter]) @ rotation.T / height).astype("<f4")
        normals = (normals @ rotation.T).astype("<f4")
        attributes = {"POSITION": writer.add_array(positions, "VEC3", 5126, 34962),
                      "NORMAL": writer.add_array(normals, "VEC3", 5126, 34962)}
        if uv is not None:
            attributes["TEXCOORD_0"] = writer.add_array(uv.astype("<f4"), "VEC2", 5126, 34962)
        if old_material not in material_ids:
            original = document["materials"][old_material]
            material = {"name": original.get("name", "part"), "pbrMetallicRoughness": {
                "baseColorFactor": original.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1]),
                "metallicFactor": 0, "roughnessFactor": 1}}
            if "baseColorTexture" in original.get("pbrMetallicRoughness", {}):
                material["pbrMetallicRoughness"]["baseColorTexture"] = {"index": 0}
            material_ids[old_material] = len(materials)
            materials.append(material)
        output.append({"attributes": attributes,
                       "indices": writer.add_array(indices.astype("<u4"), "SCALAR", 5125, 34963),
                       "material": material_ids[old_material]})
    image = None
    if document.get("images"):
        view = document["bufferViews"][document["images"][0]["bufferView"]]
        start = view.get("byteOffset", 0)
        raw = binary[start:start + view["byteLength"]]
        # Neutral texture detail lets instanceColor represent every enemy tier.
        picture = Image.open(BytesIO(raw)).convert("RGBA")
        gray = Image.fromarray(np.asarray(picture.convert("L")))
        picture = Image.merge("RGBA", (gray, gray, gray, picture.getchannel("A")))
        stream = BytesIO()
        picture.save(stream, format="PNG", optimize=True)
        image = stream.getvalue()
    writer.save(destination, output, materials, image)
    print(f"{destination.name}: {destination.stat().st_size} bytes, {sum(len(p[0]) for p in pieces)} vertices, {len(output)} primitives")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: prepare_character_models.py SOURCE_DIR OUTPUT_DIR")
    inputs, outputs = Path(sys.argv[1]), Path(sys.argv[2])
    outputs.mkdir(parents=True, exist_ok=True)
    prepare(inputs / "soldier.glb", outputs / "soldier.glb",
            {"Body", "Head", "ShoulderPad.L", "ShoulderPad.R"}, "Idle_Shoot", 0.2, 0)
    prepare(inputs / "zombie.glb", outputs / "zombie-basic-static.glb",
            {"Zombie", "Eyelid"}, "CharacterArmature|Run_Attack", 0.22, math.pi)
    prepare(inputs / "giant.glb", outputs / "giant.glb", {"Giant"}, "Idle", 0.2, math.pi)
