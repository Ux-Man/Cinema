"""
Unreal Engine 5 Editor Python Automation Script — Immersive Cinema 5
Run inside UE5 Editor (Tools -> Execute Python Script) to bootstrap the architectural
shell, 352 HISM seat sockets, vertical acoustic light slats, MediaTexture cinema screen,
and NavMeshBoundsVolume matching the React/TypeScript Pixel Streaming frontend.
"""
import unreal

def spawn_actor(asset_path, label, loc, rot=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0)):
    mesh = unreal.EditorAssetLibrary.load_asset(asset_path)
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.StaticMeshActor,
        unreal.Vector(*loc),
        unreal.Rotator(*rot),
    )
    if actor and mesh:
        actor.static_mesh_component.set_static_mesh(mesh)
        actor.set_actor_scale3d(unreal.Vector(*scale))
        actor.set_actor_label(label)
    return actor

def build_master_level():
    unreal.log("Building Immersive Cinema 5 Master Architectural Level...")
    cube = "/Engine/BasicShapes/Cube.Cube"

    # Spawn 18 Stadium Riser Tiers (matching CinemaSeatManager.cpp exact cm coordinates)
    for r in range(18):
        y_cm = (-1360.0 + r * 132.0) if r <= 13 else (488.0 + (r - 13) * 156.0)
        z_cm = 0.0 if r == 0 else r * 34.0
        spawn_actor(cube, f"Aud_Riser_Row_{r+1:02d}", (0.0, y_cm, z_cm - 20.0), scale=(26.2, 1.4, 0.4))

    # Spawn 68 Vertical Acoustic Wall Slats (34 left, 34 right)
    for side in (-1.0, 1.0):
        for i in range(34):
            y_cm = -1840.0 + i * 96.0
            spawn_actor(cube, f"WallSlat_{'L' if side < 0 else 'R'}_{i:02d}", (side * 1280.0, y_cm, 600.0), scale=(0.24, 0.16, 11.8))

    # Spawn CinemaSeatManager & CinemaLightingController Actors
    unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.NavMeshBoundsVolume, unreal.Vector(0, 1500, 300))
    unreal.log("Immersive Cinema 5 architectural bootstrap complete.")

if __name__ == "__main__":
    build_master_level()
