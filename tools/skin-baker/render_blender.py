#!/usr/bin/env python3
"""
Headless Blender 2:1 Isometric Character Skin Renderer (`tools/skin-baker/render_blender.py`).

Renders a rigged 3D character (`.glb` / `.fbx` / `.blend`) across 8 or 16 Diablo II
isometric directions (`0 = South` turning clockwise: `S, SW, W, NW, N, NE, E, SE`)
into transparent 32-bit RGBA PNG frame sequences + optional emissive `glow` frames
+ `raw-manifest.json` ready for `npx tsx tools/skin-baker/pack-skin.ts`.

Usage:
  blender --background --python tools/skin-baker/render_blender.py -- \\
    --model ./kratos_or_lich.glb \\
    --id ne-kelthuzad \\
    --class ne \\
    --dirs 8 \\
    --size 192 \\
    --ortho-scale 2.6 \\
    --out ./scratch/raw-skin-frames
"""

import argparse
import json
import math
import os
import sys

import bpy  # type: ignore
from mathutils import Euler, Vector  # type: ignore


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    parser = argparse.ArgumentParser(description="Render 3D model to D2 isometric RGBA frames")
    parser.add_argument("--model", required=True, help="Input .glb / .fbx / .blend path")
    parser.add_argument("--id", required=True, help="Skin id (kebab-case, e.g. ne-kelthuzad)")
    parser.add_argument("--class", dest="target_class", default="ne", help="2-letter D2 class token")
    parser.add_argument("--name-zh", default="自定义皮肤", help="Chinese display name")
    parser.add_argument("--name-en", default="Custom Skin", help="English display name")
    parser.add_argument("--dirs", type=int, default=8, choices=[4, 8, 16], help="Direction count")
    parser.add_argument("--size", type=int, default=192, help="Square frame render resolution (px)")
    parser.add_argument("--render-scale", type=float, default=0.5, help="In-game logical draw scale")
    parser.add_argument("--ortho-scale", type=float, default=2.6, help="Orthographic camera height in meters")
    parser.add_argument("--floating", action="store_true", help="Mark skin as hovering/floating")
    parser.add_argument("--shadow-offset-y", type=float, default=0.0, help="Ground shadow Y offset")
    parser.add_argument("--clips-json", default="", help="Optional JSON mapping D2 clip keys to Blender action names")
    parser.add_argument("--out", required=True, help="Output directory for raw PNG frames and raw-manifest.json")
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(path: str):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=path)
    else:
        raise ValueError(f"Unsupported model extension: {ext}")


def setup_isometric_camera_and_lights(size: int, ortho_scale: float, foot_target_z: float = 0.9):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "SceneEEVEE") else "BLENDER_EEVEE"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    # D2 2:1 isometric projection corresponds to elevation angle arcsin(tan(30 deg)) / ~30 deg pitch
    pitch_from_vertical = math.radians(60.0)
    dist = 10.0

    cam_data = bpy.data.cameras.new("D2IsoCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_obj = bpy.data.objects.new("D2IsoCam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = Vector((0.0, -dist * math.sin(pitch_from_vertical), foot_target_z + dist * math.cos(pitch_from_vertical)))
    cam_obj.rotation_euler = Euler((pitch_from_vertical, 0.0, 0.0), "XYZ")
    scene.camera = cam_obj

    # Gothic neutral 3-point lighting (in-game LightGrid tints the final sprite per room)
    key_data = bpy.data.lights.new(name="KeyLight", type="SUN")
    key_data.energy = 2.6
    key_obj = bpy.data.objects.new(name="KeyLight", object_data=key_data)
    key_obj.rotation_euler = Euler((math.radians(45), math.radians(-25), math.radians(20)), "XYZ")
    scene.collection.objects.link(key_obj)

    rim_data = bpy.data.lights.new(name="RimLight", type="SUN")
    rim_data.energy = 1.1
    rim_obj = bpy.data.objects.new(name="RimLight", object_data=rim_data)
    rim_obj.rotation_euler = Euler((math.radians(125), math.radians(30), math.radians(160)), "XYZ")
    scene.collection.objects.link(rim_obj)

    return cam_obj


def project_world_origin_to_pixel(scene, cam_obj, size: int):
    from bpy_extras.object_utils import world_to_camera_view  # type: ignore

    ndc = world_to_camera_view(scene, cam_obj, Vector((0.0, 0.0, 0.0)))
    foot_x = round(ndc.x * size)
    foot_y = round((1.0 - ndc.y) * size)
    return foot_x, foot_y


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    clear_scene()
    import_model(os.path.abspath(args.model))

    # Create a root pivot at (0, 0, 0) to rotate top-level imported objects cleanly across directions
    pivot = bpy.data.objects.new("D2DirectionPivot", None)
    bpy.context.scene.collection.objects.link(pivot)
    for obj in list(bpy.context.scene.objects):
        if obj != pivot and obj.parent is None:
            obj.parent = pivot

    cam_obj = setup_isometric_camera_and_lights(args.size, args.ortho_scale)
    scene = bpy.context.scene
    foot_x, foot_y = project_world_origin_to_pixel(scene, cam_obj, args.size)

    actions = {a.name.lower(): a for a in bpy.data.actions}
    clip_map = json.loads(args.clips_json) if args.clips_json else {
        "nu": {"action": "idle", "frames": 8, "speed": 128, "loop": True},
        "wl": {"action": "walk", "frames": 8, "speed": 256, "loop": True},
        "rn": {"action": "run", "frames": 8, "speed": 256, "loop": True},
        "sc": {"action": "cast", "frames": 12, "speed": 256, "loop": False},
        "a1": {"action": "attack", "frames": 10, "speed": 256, "loop": False},
        "gh": {"action": "hit", "frames": 6, "speed": 256, "loop": False},
        "dt": {"action": "death", "frames": 14, "speed": 176, "loop": False},
    }

    armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    rendered_clips = {}

    for clip_key, spec in clip_map.items():
        act_name = spec["action"].lower()
        matched_action = actions.get(act_name)
        if matched_action is None and actions:
            for k, v in actions.items():
                if act_name in k:
                    matched_action = v
                    break
            if matched_action is None:
                matched_action = next(iter(actions.values()))

        for arm in armatures:
            if arm.animation_data is None:
                arm.animation_data_create()
            arm.animation_data.action = matched_action

        start_f, end_f = (matched_action.frame_range if matched_action else (1.0, float(spec["frames"])))
        frame_count = int(spec["frames"])
        dir_lists = []

        for d in range(args.dirs):
            # D2 direction 0 faces South (-Y camera); clockwise screen turn = -Z rotation in right-handed Z-up
            yaw = -d * (2.0 * math.pi / args.dirs)
            pivot.rotation_euler = Euler((0.0, 0.0, yaw), "XYZ")
            frame_files = []
            for f_idx in range(frame_count):
                t = f_idx / max(1, frame_count - (0 if spec.get("loop") else 1))
                blender_frame = int(round(start_f + t * max(0.0, end_f - start_f)))
                scene.frame_set(blender_frame)
                rel_png = f"{clip_key}_d{d:02d}_f{f_idx:02d}.png"
                scene.render.filepath = os.path.join(args.out, rel_png)
                bpy.ops.render.render(write_still=True)
                frame_files.append({"file": rel_png, "footX": foot_x, "footY": foot_y})
            dir_lists.append(frame_files)

        rendered_clips[clip_key] = {
            "speed": int(spec.get("speed", 256)),
            "loop": bool(spec.get("loop", False)),
            "directions": dir_lists,
        }

    raw_manifest = {
        "id": args.id,
        "name": {"zh": args.name_zh, "en": args.name_en},
        "targetClass": args.target_class,
        "directions": args.dirs,
        "renderScale": args.render_scale,
        "floating": args.floating,
        "shadowOffsetY": args.shadow_offset_y,
        "clips": rendered_clips,
    }
    with open(os.path.join(args.out, "raw-manifest.json"), "w", encoding="utf-8") as fp:
        json.dump(raw_manifest, fp, ensure_ascii=False, indent=2)
    print(f"Rendered {args.id} raw frames into {args.out}")


if __name__ == "__main__":
    main()
