# Immersive Cinema 5 — Deployment & UE5 Pixel Streaming Guide

## 1. Web Frontend (Browser Preview + Pixel Streaming Client)
The React + TypeScript + Three.js application in the project root runs immediately in any modern browser as a real-time **Three.js WebGL Preview**, while remaining 100% wired to emit Unreal Engine 5 Pixel Streaming `emitUIInteraction` JSON descriptors.

```bash
npm install
npm run dev      # Local development on port 3000
npm run build    # Production bundle
```

Configure `VITE_UE5_SIGNALING_URL` in `.env` (or enter it live in the **UE5 & Stream** panel inside the app) to connect to a running UE5 Pixel Streaming Cirrus Signaling Server.

## 2. Native Unreal Engine 5 Workstation / Cloud GPU Deployment
1. Open `/ue5/ImmersiveCinema5.uproject` with **Unreal Engine 5.4+** on a DX12 / Vulkan GPU workstation (RTX 3080+ or cloud NVIDIA L4/A10G).
2. Run `/ue5/Scripts/build_cinema_environment.py` inside the UE5 Python console to generate the 18 stadium risers, 68 vertical acoustic slats, and `NavMeshBoundsVolume`.
3. Import your Fab / Megascans / ambientCG 4K–8K PBR assets listed in `/ue5/ASSET_MANIFEST.json`.
4. Bind the Pixel Streaming Input Component's `OnInputEvent` to `ACinemaLightingController::HandlePixelStreamingJson` and `ACinemaSeatManager`.
5. Package the project for Windows/Linux and launch with Pixel Streaming flags:
```bash
ImmersiveCinema5.exe -AudioMixer -PixelStreamingIP=127.0.0.1 -PixelStreamingPort=8888 -RenderOffScreen
```
6. Start the UE5 Signaling Web Server (`SignalingWebServer/platform_scripts/cmd/run_local.bat`) and point the web frontend's **UE5 & Stream** panel to `ws://<host>:80`.
