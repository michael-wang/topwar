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


def rigid_piece(source, clip=None, seconds=0, two_handed=False):
    document, binary = read_glb(source)
    overrides = sample_animation(document, binary, clip, seconds) if clip else {}
    if two_handed:
        if clip != "attack-melee-right":
            raise ValueError("Two-handed Boss pose requires the right melee clip")
        left = sample_animation(document, binary, "attack-melee-left", seconds)
        arms = {node["name"]: index for index, node in enumerate(document["nodes"])
                if node.get("name") in ("arm-left", "arm-right")}
        if set(arms) != {"arm-left", "arm-right"} or "rotation" not in left.get(arms["arm-left"], {}):
            raise ValueError("Kenney Archer arm rig changed")
        overrides[arms["arm-left"]]["rotation"] = left[arms["arm-left"]]["rotation"]
        # Pull the overhead fists just ahead of the face so the wind-up is
        # legible from the game's low portrait camera, not hidden by the head.
        if seconds < .25:
            for index in arms.values():
                position = np.asarray(document["nodes"][index]["translation"], dtype=np.float64).copy()
                position += [0, .025, .07]
                overrides[index]["translation"] = position
    worlds = world_matrices(document, overrides)
    pieces = []
    expected_meshes = {"body-mesh", "head-mesh"}
    found_meshes = set()
    for index, node in enumerate(document["nodes"]):
        if "mesh" not in node:
            continue
        name = node.get("name")
        if name not in expected_meshes:
            raise ValueError(f"Unexpected Kenney character mesh node: {name}")
        found_meshes.add(name)
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            piece = bake_primitive(document, binary, primitive, index, worlds)
            pieces.append(without_green_headgear(piece) if name == "head-mesh" else piece)
    if found_meshes != expected_meshes:
        raise ValueError(f"Expected Kenney mesh nodes {expected_meshes}, found {found_meshes}")
    positions = np.concatenate([piece[0] for piece in pieces])
    normals = np.concatenate([piece[1] for piece in pieces])
    uv = np.concatenate([piece[2] for piece in pieces])
    offsets = np.cumsum([0] + [len(piece[0]) for piece in pieces[:-1]])
    indices = np.concatenate([piece[3] + offset for piece, offset in zip(pieces, offsets)])
    return positions, normals, uv, indices


def without_green_headgear(piece):
    """Exclude head-mesh triangles assigned to the archer's green cap UV swatch."""
    positions, normals, uv, indices = piece
    triangles = indices.reshape(-1, 3)
    triangle_uv = uv[triangles]
    green_cap = np.all(np.isclose(triangle_uv[:, :, 0], .21875)
                       & (triangle_uv[:, :, 1] >= .824), axis=1)
    if np.count_nonzero(green_cap) != 74:
        raise ValueError("Kenney green headgear UV island changed; inspect before baking")
    kept = triangles[~green_cap].ravel()
    used = np.unique(kept)
    remap = np.full(len(positions), -1, dtype=np.int32)
    remap[used] = np.arange(len(used))
    return positions[used], normals[used], uv[used], remap[kept]


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


def rear_archer_accessory_mask(piece):
    """Identify the isolated shaft islands in the normalized idle mesh."""
    positions, normals, uv, indices = piece
    parents = np.arange(len(positions))

    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for a, b, c in indices.reshape(-1, 3):
        parents[root(a)] = root(b)
        parents[root(b)] = root(c)
    islands = {}
    for index in range(len(positions)):
        islands.setdefault(root(index), []).append(index)
    unwanted = np.zeros(len(positions), dtype=bool)
    for vertices in islands.values():
        bounds = positions[vertices]
        if (bounds[:, 0].min() > .095 and bounds[:, 1].min() > .69
                and bounds[:, 1].max() > .90 and bounds[:, 2].max() < -.04):
            unwanted[vertices] = True
    if np.count_nonzero(unwanted) != 32:
        raise ValueError(f"Kenney rear accessory islands changed: {np.count_nonzero(unwanted)} vertices")
    return unwanted


def without_rear_archer_accessory(piece, unwanted):
    positions, normals, uv, indices = piece
    if len(unwanted) != len(positions):
        raise ValueError("Kenney pose topology changed between idle and sprint")
    triangles = indices.reshape(-1, 3)
    kept = triangles[~unwanted[triangles].any(axis=1)].ravel()
    used = np.unique(kept)
    remap = np.full(len(positions), -1, dtype=np.int32)
    remap[used] = np.arange(len(used))
    return positions[used], normals[used], uv[used], remap[kept]


def helmet_parts():
    # Hard rounded shell with a continuous flared steel rim above the face.
    radius = .29
    levels = ((.75, radius), (.85, radius), (.96, radius * .78),
              (1.005, radius * .38))
    sides = 12
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
    normals[:, 1] -= .79
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    rim_outer = radius * 1.18
    rim_inner = radius * .84
    rim_vertices = []
    for y, r in ((.74, rim_outer), (.79, rim_outer),
                 (.79, rim_inner), (.74, rim_inner)):
        for i in range(sides):
            angle = i * 2*np.pi/sides
            rim_vertices.append([np.sin(angle)*r, y, np.cos(angle)*r])
    rim_vertices = np.asarray(rim_vertices)
    rim_indices = []
    for ring in range(4):
        following = (ring + 1) % 4
        for i in range(sides):
            a, b = ring*sides+i, ring*sides+(i+1)%sides
            c, d = following*sides+i, following*sides+(i+1)%sides
            rim_indices.extend((a, b, d, a, d, c))
    rim_normals = rim_vertices.copy()
    rim_normals[:, 1] = 0
    rim_normals /= np.maximum(np.linalg.norm(rim_normals, axis=1, keepdims=True), 1e-12)
    return join_parts([(vertices, normals, np.asarray(indices)),
                       (rim_vertices, rim_normals, np.asarray(rim_indices))])


def vest_parts(boss=False):
    # A compact chest plate leaves the arms, lower tunic and boots exposed.
    if boss:
        # One low, shallow commander chest band replaces the two hanging front tabs.
        return join_parts([box((0, .35, .29), (.44, .07, .035)),
                           box((0, .35, -.29), (.44, .07, .035))])
    width = .44 if boss else .36
    y = .47
    height = .16
    depth = .29
    return join_parts([box((-width*.27, y, depth), (width*.42, height, .075)),
                       box((width*.27, y, depth), (width*.42, height, .075)),
                       box((0, y, -depth), (width, height, .055))])


def rifle_parts():
    # The barrel runs exactly along +Z, the simulation projectile direction.
    return join_parts([
        box((.25, .46, .32), (.13, .13, .67)),
        box((.25, .46, .74), (.08, .08, .29)),
        box((.25, .55, .18), (.18, .055, .16)),
        box((.25, .32, .25), (.08, .19, .11)),
        box((.25, .43, -.10), (.18, .13, .21))])


def bullet_parts():
    # One narrow, short tracer aligned with +Z. Runtime uses unlit pale gold.
    return join_parts([box((0, 0, 0), (.052, .052, .52))])


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
    rear_accessory = rear_archer_accessory_mask(body)
    body = without_rear_archer_accessory(body, rear_accessory)
    original = (inputs / "colormap.png").read_bytes()
    textured = {"name": "fixed-body", "pbrMetallicRoughness": {
        "baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1}}
    write_mesh(outputs / "toy-soldier-body.glb", [body], textured, original)
    for frame in range(4):
        run = rigid_piece(inputs / "character-archer.glb", "sprint", (frame + .5) * .125)
        p, n, texcoords, idx = run
        run = without_rear_archer_accessory(((p-center)/height, n, texcoords, idx), rear_accessory)
        # Runtime reuses the original body's material and texture.
        write_mesh(outputs / f"toy-soldier-run-{frame}.glb", [run],
                   {"name": "shared-body-material", "pbrMetallicRoughness": {
                       "baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0,
                       "roughnessFactor": 1}})
    # The right and left melee clips supply matching overhead arm swings.
    # Bake their respective arm bones together, with the right clip's torso/legs.
    for frame, seconds in enumerate((.18, .29, .34, .40)):
        slam = rigid_piece(inputs / "character-archer.glb", "attack-melee-right", seconds,
                           two_handed=True)
        p, n, texcoords, idx = slam
        slam = without_rear_archer_accessory(((p-center)/height, n, texcoords, idx), rear_accessory)
        write_mesh(outputs / f"toy-soldier-boss-slam-{frame}.glb", [slam],
                   {"name": "shared-body-material", "pbrMetallicRoughness": {
                       "baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0,
                       "roughnessFactor": 1}})
    gray = np.asarray(Image.open(BytesIO(original)).convert("RGBA")).copy()
    luminance = np.dot(gray[:, :, :3], [.299, .587, .114]).astype(np.uint8)
    gray[:, :, :3] = luminance[:, :, None]
    gray_stream = BytesIO()
    Image.fromarray(gray).save(gray_stream, format="PNG", optimize=True)
    write_mesh(outputs / "toy-soldier-gray-body.glb", [body], textured,
               gray_stream.getvalue())
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
    for name, piece in (("helmet", helmet_parts()),
                        ("vest", vest_parts()), ("boss-vest", vest_parts(True))):
        write_mesh(outputs / f"toy-soldier-{name}.glb", [piece], neutral)
    for name, piece, color in (("rifle", rifle_parts(), [.17, .20, .22, 1]),
                               ("bullet", bullet_parts(), [1, .95, .70, 1])):
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
