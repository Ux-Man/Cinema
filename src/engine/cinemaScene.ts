import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AUDITORIUM_SEATS,
  EXIT_LOCATIONS,
  GRAPHICS_PRESETS,
  LIGHTING_PRESETS,
  PANORAMA_POINTS,
  POSTER_CHRONOS,
  POSTER_MIRAGE,
  POSTER_SOLARIS,
  SCREEN_CENTER,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '../data/cinemaData';
import {
  AudienceDensity,
  CameraMode,
  GraphicsSettings,
  LightingSettings,
  SeatData,
  WayfindingState,
} from '../types/cinema';
import {
  CinemaScreenReel,
  createAcousticPanelTexture,
  createCarpetTexture,
  createExitSignTexture,
  createLeatherBumpTexture,
  createMarbleTexture,
  createMarqueeSignTexture,
} from './proceduralTextures';
import { CinemaSpatialAudio } from './spatialAudio';

export interface CinemaSceneCallbacks {
  onSeatClick: (seatId: string) => void;
  onSeatHover: (seatId: string | null) => void;
  onTourProgress: (chapterIndex: number, chapterLabel: string, progress: number) => void;
  onTourComplete: () => void;
  onUserPoseChange: (x: number, y: number, z: number, yaw: number, zone: 'exterior' | 'lobby' | 'auditorium') => void;
}

interface TourWaypoint {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  label: string;
}

const TOUR_WAYPOINTS: TourWaypoint[] = [
  { pos: new THREE.Vector3(24, 22, 64), look: new THREE.Vector3(0, 5, 32), label: '01 · Aerial Architectural Exterior' },
  { pos: new THREE.Vector3(-18, 12, 54), look: new THREE.Vector3(0, 6, 36), label: '02 · Contemporary Illuminated Facade' },
  { pos: new THREE.Vector3(0, 3.2, 43), look: new THREE.Vector3(0, 3.2, 32), label: '03 · Main Glass Entrance & Drop-Off' },
  { pos: new THREE.Vector3(0, 3.4, 32), look: new THREE.Vector3(0, 2.5, 21), label: '04 · Double-Height Grand Lobby' },
  { pos: new THREE.Vector3(-5.5, 2.5, 29), look: new THREE.Vector3(-12.5, 2.1, 26), label: '05 · Ticket Reception & Self-Service Kiosks' },
  { pos: new THREE.Vector3(5.5, 2.5, 28), look: new THREE.Vector3(12.5, 2.3, 24), label: '06 · Popcorn & Artisanal Concession Bar' },
  { pos: new THREE.Vector3(0, 2.6, 22), look: new THREE.Vector3(11, 2.2, 19), label: '07 · Waiting Lounge & VIP Reception' },
  { pos: new THREE.Vector3(11.5, 2.2, 18.8), look: new THREE.Vector3(14.5, 1.8, 17.5), label: '08 · Private VIP Lounge' },
  { pos: new THREE.Vector3(-14.0, 2.1, 10), look: new THREE.Vector3(-14.0, 1.9, -12), label: '09 · Acoustic Transition Corridor' },
  { pos: new THREE.Vector3(-10.8, 2.0, -15.2), look: new THREE.Vector3(2, 4.5, -14), label: '10 · Entering the Grand Auditorium' },
  { pos: new THREE.Vector3(0, 9.6, 12.6), look: new THREE.Vector3(0, 3.6, -15), label: '11 · Full 352-Seat Stadium Reveal' },
  { pos: new THREE.Vector3(-6.2, 5.2, 4.5), look: new THREE.Vector3(4, 4.8, -19), label: '12 · Sweeping Across Premium Rows' },
  { pos: new THREE.Vector3(6.8, 7.2, 9.2), look: new THREE.Vector3(-2, 5.6, -12), label: '13 · Luxury VIP Recliner Deck' },
  { pos: new THREE.Vector3(0, 4.6, -8.5), look: new THREE.Vector3(0, 5.4, -19.2), label: '14 · Giant Curved IMAX Laser Screen' },
  { pos: new THREE.Vector3(9.8, 2.8, -14.5), look: new THREE.Vector3(12.2, 2.2, -15.6), label: '15 · Illuminated Aisles & Emergency Exits' },
];

// Reusable math vectors outside tick loop (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _color = new THREE.Color();
const _targetColor = new THREE.Color();
const _scale = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function kelvinToColor(kelvin: number, out: THREE.Color): THREE.Color {
  const t = THREE.MathUtils.clamp((kelvin - 2400) / (6500 - 2400), 0, 1);
  // 2400K warm amber -> 4000K neutral warm white -> 6500K crisp daylight
  const r = THREE.MathUtils.lerp(1.0, 0.88, t);
  const g = THREE.MathUtils.lerp(0.72, 0.94, t);
  const b = THREE.MathUtils.lerp(0.45, 1.0, t);
  return out.setRGB(r, g, b);
}

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class CinemaEngine {
  private container: HTMLElement;
  private callbacks: CinemaSceneCallbacks;
  private audio: CinemaSpatialAudio;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private compareCamera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private frameId = 0;
  private disposed = false;

  // Screen & Video
  private screenReel: CinemaScreenReel;
  private screenMat!: THREE.MeshStandardMaterial;
  private screenVideoEl: HTMLVideoElement | null = null;
  private screenVideoTex: THREE.VideoTexture | null = null;
  private screenLight!: THREE.PointLight;
  private screenSpot!: THREE.SpotLight;
  private isMediaPlaying = true;
  private reelTime = 0;

  // Instanced Seat Meshes (6 high-detail layers + invisible raycast layer)
  private seatBackMesh!: THREE.InstancedMesh;
  private seatHeadMesh!: THREE.InstancedMesh;
  private seatPanMesh!: THREE.InstancedMesh;
  private seatArmMesh!: THREE.InstancedMesh;
  private seatBaseMesh!: THREE.InstancedMesh;
  private seatLedMesh!: THREE.InstancedMesh;
  private seatHitMesh!: THREE.InstancedMesh;
  private seatLedMat!: THREE.MeshStandardMaterial;

  // Audience Instanced Meshes
  private audienceHeadMesh!: THREE.InstancedMesh;
  private audienceBodyMesh!: THREE.InstancedMesh;
  private audienceDensity: AudienceDensity = 0;

  // Lighting handles for smooth animated transitions
  private hemiLight!: THREE.HemisphereLight;
  private keyDirLight!: THREE.DirectionalLight;
  private audCeilingLights: THREE.PointLight[] = [];
  private lobbyLights: THREE.PointLight[] = [];
  private emergencyLights: THREE.PointLight[] = [];
  private wallSlatGlowMat!: THREE.MeshStandardMaterial;
  private ledStripMat!: THREE.MeshStandardMaterial;
  private stairLightMat!: THREE.MeshStandardMaterial;
  private aisleLightMat!: THREE.MeshStandardMaterial;
  private exitSignMat!: THREE.MeshStandardMaterial;
  private exteriorGlowMat!: THREE.MeshStandardMaterial;
  private projectorBeamMat!: THREE.MeshBasicMaterial;

  private targetLighting: LightingSettings = { ...LIGHTING_PRESETS.preshow };
  private currentLighting: LightingSettings = { ...LIGHTING_PRESETS.preshow };
  private graphicsSettings: GraphicsSettings = { ...GRAPHICS_PRESETS.high };

  // Wayfinding 3D mesh group
  private wayfindingGroup = new THREE.Group();
  private wayfindingChevrons: THREE.Mesh[] = [];
  private wayfindingMat!: THREE.MeshStandardMaterial;

  // Camera & Interaction state
  private cameraMode: CameraMode = 'seat-map';
  private selectedSeatIds = new Set<string>(['J10', 'J11']);
  private primarySeatId = 'J10';
  private compareSeatIds: [string, string] = ['J10', 'P6'];
  private hoveredSeatId: string | null = null;

  // Smooth camera transition targets
  private camPosTarget = new THREE.Vector3(0, 26.5, 2.2);
  private camLookCurrent = new THREE.Vector3(0, 1.5, -2.5);
  private camLookTarget = new THREE.Vector3(0, 1.5, -2.5);
  private camYaw = 0;
  private camPitch = 0;
  private camYawTarget = 0;
  private camPitchTarget = 0;
  private lookOverrideActive = false;

  // Free Walk & Input state
  private keysPressed = new Set<string>();
  private joystickVec = { x: 0, y: 0 };
  private walkSeatedHeight = false;
  private walkStepDist = 0;
  private isDragging = false;
  private pointerDownPos = { x: 0, y: 0 };
  private lastPointerPos = { x: 0, y: 0 };
  private raycaster = new THREE.Raycaster();
  private mouseNdc = new THREE.Vector2();
  private lastHoverRaycast = 0;

  // Tour state
  private tourCurvePos!: THREE.CatmullRomCurve3;
  private tourCurveLook!: THREE.CatmullRomCurve3;
  private tourProgress = 0;
  private tourPaused = false;
  private lastTourChapter = -1;
  private lastPoseEmit = 0;

  // Cleanup registry
  private disposables: { dispose: () => void }[] = [];

  constructor(container: HTMLElement, audio: CinemaSpatialAudio, callbacks: CinemaSceneCallbacks) {
    this.container = container;
    this.audio = audio;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#06070a');
    this.scene.fog = new THREE.FogExp2('#07080c', 0.0082);

    // Mandatory studio environment reflection map for rich leather, brass & marble highlights
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.65;
    pmrem.dispose();
    this.disposables.push(envTex);

    this.camera = new THREE.PerspectiveCamera(54, width / height, 0.12, 220);
    this.compareCamera = new THREE.PerspectiveCamera(56, (width * 0.5) / height, 0.12, 220);

    // Start in elevated architectural overview matching the reference video reveal
    this.camera.position.set(0, 26.5, 2.2);
    this.camera.lookAt(0, 1.5, -2.5);

    this.screenReel = new CinemaScreenReel(this.renderer.capabilities.getMaxAnisotropy());
    this.disposables.push(this.screenReel);

    this.buildLightingRig();
    this.buildAuditoriumArchitecture();
    this.buildInstancedSeats();
    this.buildAudienceSystem();
    this.buildLobbyAndCorridors();
    this.buildExteriorArchitecture();
    this.buildWayfindingSystem();
    this.buildTourCurves();

    this.updateSeatVisualStates();
    this.applyLightingImmediate();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.startLoop();
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildLightingRig() {
    this.hemiLight = new THREE.HemisphereLight('#c9d8f0', '#231c15', 0.48);
    this.scene.add(this.hemiLight);

    // Primary architectural key light (single directional shadow caster)
    this.keyDirLight = new THREE.DirectionalLight('#ffe4c4', 0.85);
    this.keyDirLight.position.set(16, 28, 22);
    if (!this.isSoftwareGl) {
      this.keyDirLight.castShadow = true;
      this.keyDirLight.shadow.mapSize.set(1024, 1024);
      this.keyDirLight.shadow.camera.near = 2;
      this.keyDirLight.shadow.camera.far = 90;
      const d = 32;
      this.keyDirLight.shadow.camera.left = -d;
      this.keyDirLight.shadow.camera.right = d;
      this.keyDirLight.shadow.camera.top = d;
      this.keyDirLight.shadow.camera.bottom = -d;
      this.keyDirLight.shadow.bias = -0.0005;
      this.keyDirLight.shadow.normalBias = 0.025;
    }
    this.scene.add(this.keyDirLight);

    // Auditorium overhead architectural ceiling wash lights
    const ceilingPositions: [number, number, number][] = [
      [-6, 11.4, -8],
      [6, 11.4, -8],
      [-6, 11.4, 4],
      [6, 11.4, 4],
    ];
    for (const [x, y, z] of ceilingPositions) {
      const pl = new THREE.PointLight('#ffdfb0', 22, 28, 1.5);
      pl.position.set(x, y, z);
      this.scene.add(pl);
      this.audCeilingLights.push(pl);
    }

    // Dynamic Cinema Screen Bounce Illumination (illuminates front rows, walls, ceiling!)
    this.screenLight = new THREE.PointLight('#78a6e8', 36, 34, 1.35);
    this.screenLight.position.set(0, 5.5, -16.8);
    this.scene.add(this.screenLight);

    this.screenSpot = new THREE.SpotLight('#8cb8f5', 42, 42, Math.PI * 0.44, 0.75, 1.3);
    this.screenSpot.position.set(0, 6.2, -18.2);
    this.screenSpot.target.position.set(0, 2.2, 2);
    this.scene.add(this.screenSpot);
    this.scene.add(this.screenSpot.target);

    // Emergency accent lights near exit doors
    const emPositions: [number, number, number][] = [
      [-11.8, 3.2, -15.5],
      [11.8, 3.2, -15.5],
      [-9.2, 7.6, 12.8],
      [9.2, 7.6, 12.8],
    ];
    for (const [x, y, z] of emPositions) {
      const el = new THREE.PointLight('#ef4444', 0, 14, 1.6);
      el.position.set(x, y, z);
      this.scene.add(el);
      this.emergencyLights.push(el);
    }

    // Lobby architectural chandelier & counter lights
    const lobbyPositions: [number, number, number][] = [
      [0, 8.8, 26],
      [-10, 6.5, 27],
      [10, 6.5, 25],
      [13.5, 4.8, 19],
    ];
    for (const [x, y, z] of lobbyPositions) {
      const ll = new THREE.PointLight('#ffdfba', 28, 26, 1.45);
      ll.position.set(x, y, z);
      this.scene.add(ll);
      this.lobbyLights.push(ll);
    }
  }

  private buildAuditoriumArchitecture() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const { map: carpetMap, bumpMap: carpetBump } = createCarpetTexture(maxAniso);
    const acousticTex = createAcousticPanelTexture(maxAniso);
    const exitTex = createExitSignTexture('EXIT');
    this.track(carpetMap);
    this.track(carpetBump);
    this.track(acousticTex);
    this.track(exitTex);

    const carpetMat = this.track(
      new THREE.MeshStandardMaterial({
        map: carpetMap,
        bumpMap: carpetBump,
        bumpScale: 0.025,
        roughness: 0.92,
        metalness: 0.04,
      }),
    );

    const darkWallMat = this.track(
      new THREE.MeshStandardMaterial({
        map: acousticTex,
        color: '#201e23',
        roughness: 0.82,
        metalness: 0.08,
      }),
    );

    const walnutRibMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#2c221a',
        roughness: 0.56,
        metalness: 0.14,
      }),
    );

    const brushedDarkMetalMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#1b1d22',
        roughness: 0.34,
        metalness: 0.78,
      }),
    );

    // Controlled emissive architectural lighting materials
    this.wallSlatGlowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#fff2dc',
        emissive: '#f5c782',
        emissiveIntensity: 2.2,
        roughness: 0.25,
      }),
    );

    this.ledStripMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#ffeed2',
        emissive: '#f2be72',
        emissiveIntensity: 1.8,
        roughness: 0.2,
      }),
    );

    this.stairLightMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#ffe8bf',
        emissive: '#f5b855',
        emissiveIntensity: 1.9,
        roughness: 0.2,
      }),
    );

    this.aisleLightMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#fff0d4',
        emissive: '#eab366',
        emissiveIntensity: 1.5,
        roughness: 0.25,
      }),
    );

    this.exitSignMat = this.track(
      new THREE.MeshStandardMaterial({
        map: exitTex,
        emissiveMap: exitTex,
        emissive: '#4ade80',
        emissiveIntensity: 1.6,
        roughness: 0.3,
      }),
    );

    const audGroup = new THREE.Group();
    this.scene.add(audGroup);

    // Front flat auditorium floor (screen apron to Row A)
    const frontFloorGeo = this.track(new THREE.BoxGeometry(26.4, 0.3, 8.0));
    const frontFloor = new THREE.Mesh(frontFloorGeo, carpetMat);
    frontFloor.position.set(0, -0.15, -16.4);
    frontFloor.receiveShadow = true;
    audGroup.add(frontFloor);

    // 18 Stadium-tiered floor risers (Rows A-R) + illuminated stair nosing edges
    const riserGeo = this.track(new THREE.BoxGeometry(26.2, 0.42, 1.58));
    const stairEdgeGeo = this.track(new THREE.BoxGeometry(1.42, 0.035, 0.055));
    const riserAccentGeo = this.track(new THREE.BoxGeometry(25.2, 0.024, 0.03));

    for (let r = 0; r < 18; r++) {
      const z = r <= 13 ? -13.6 + r * 1.32 : 4.88 + (r - 13) * 1.56;
      const y = r === 0 ? 0.0 : r * 0.34;
      const depth = r >= 14 ? 1.62 : 1.36;

      const step = new THREE.Mesh(riserGeo, carpetMat);
      step.scale.set(1, 1 + y / 0.42, depth / 1.58);
      step.position.set(0, y - (y + 0.42) * 0.5, z);
      step.receiveShadow = true;
      audGroup.add(step);

      // Illuminated golden stair nosing along Left & Right main aisles (X = ±5.35)
      for (const aisleX of [-5.35, 5.35]) {
        const edge = new THREE.Mesh(stairEdgeGeo, this.stairLightMat);
        edge.position.set(aisleX, y + 0.018, z - depth * 0.48);
        audGroup.add(edge);
      }

      // Subtle continuous horizontal LED trim under every 2nd tier
      if (r % 2 === 1) {
        const strip = new THREE.Mesh(riserAccentGeo, this.aisleLightMat);
        strip.position.set(0, y + 0.012, z - depth * 0.49);
        audGroup.add(strip);
      }
    }

    // Rear upper walkway behind Row R
    const rearDeck = new THREE.Mesh(this.track(new THREE.BoxGeometry(26.2, 6.2, 3.0)), carpetMat);
    rearDeck.position.set(0, 2.68, 12.8);
    rearDeck.receiveShadow = true;
    audGroup.add(rearDeck);

    // Auditorium Side Walls, Front Wall, Rear Wall, and Coffered Ceiling
    const sideWallGeo = this.track(new THREE.BoxGeometry(0.5, 13.0, 35.0));
    const leftWall = new THREE.Mesh(sideWallGeo, darkWallMat);
    leftWall.position.set(-13.2, 6.3, -3.0);
    audGroup.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, darkWallMat);
    rightWall.position.set(13.2, 6.3, -3.0);
    audGroup.add(rightWall);

    const frontWall = new THREE.Mesh(this.track(new THREE.BoxGeometry(26.8, 13.0, 0.6)), darkWallMat);
    frontWall.position.set(0, 6.3, -20.3);
    audGroup.add(frontWall);

    const rearWall = new THREE.Mesh(this.track(new THREE.BoxGeometry(26.8, 13.0, 0.6)), darkWallMat);
    rearWall.position.set(0, 6.3, 14.3);
    audGroup.add(rearWall);

    // Coffered acoustic ceiling + architectural LED cove strips
    const ceiling = new THREE.Mesh(this.track(new THREE.BoxGeometry(26.8, 0.5, 35.2)), darkWallMat);
    ceiling.position.set(0, 12.75, -3.0);
    audGroup.add(ceiling);

    const baffleGeo = this.track(new THREE.BoxGeometry(24.6, 0.36, 0.72));
    for (let z = -17.5; z <= 12; z += 3.2) {
      const baffle = new THREE.Mesh(baffleGeo, walnutRibMat);
      baffle.position.set(0, 12.35, z);
      audGroup.add(baffle);
    }

    // Ceiling longitudinal cove LED light strips
    const coveGeo = this.track(new THREE.BoxGeometry(0.14, 0.08, 32.0));
    for (const cx of [-12.2, 12.2]) {
      const cove = new THREE.Mesh(coveGeo, this.ledStripMat);
      cove.position.set(cx, 12.38, -3.0);
      audGroup.add(cove);
    }

    // SIGNATURE VERTICAL ARCHITECTURAL LIGHT SLATS ON BOTH SIDE WALLS (homage to reference video!)
    const slatCount = 34;
    const ribGeo = this.track(new THREE.BoxGeometry(0.24, 11.8, 0.16));
    const glowBarGeo = this.track(new THREE.BoxGeometry(0.06, 11.4, 0.06));
    const ribInst = new THREE.InstancedMesh(ribGeo, walnutRibMat, slatCount * 2);
    const glowInst = new THREE.InstancedMesh(glowBarGeo, this.wallSlatGlowMat, slatCount * 2);

    let idx = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < slatCount; i++) {
        const z = -18.4 + i * 0.96;
        // Skip small door openings at front exits
        const yBottom = z < -14.2 ? 3.2 : 0.4;
        const hScale = (12.2 - yBottom) / 11.8;
        const yCenter = yBottom + (12.2 - yBottom) * 0.5;

        _pos.set(side * 12.82, yCenter, z);
        _scale.set(1, hScale, 1);
        _quat.identity();
        _mat4.compose(_pos, _quat, _scale);
        ribInst.setMatrixAt(idx, _mat4);

        _pos.set(side * 12.74, yCenter, z + 0.14);
        _mat4.compose(_pos, _quat, _scale);
        glowInst.setMatrixAt(idx, _mat4);
        idx++;
      }
    }
    ribInst.instanceMatrix.needsUpdate = true;
    glowInst.instanceMatrix.needsUpdate = true;
    ribInst.computeBoundingSphere();
    glowInst.computeBoundingSphere();
    audGroup.add(ribInst);
    audGroup.add(glowInst);

    // Surround sound wall speaker arrays (Dolby Atmos side surrounds)
    const speakerGeo = this.track(new THREE.BoxGeometry(0.32, 0.78, 0.48));
    for (const side of [-1, 1]) {
      for (let z = -12; z <= 10; z += 5.5) {
        const spk = new THREE.Mesh(speakerGeo, brushedDarkMetalMat);
        spk.position.set(side * 12.6, 5.2 + (z + 12) * 0.11, z);
        spk.rotation.z = side * 0.16;
        audGroup.add(spk);
      }
    }

    // CURVED GIANT CINEMA SCREEN + VELVET MASKING FRAME + FRONT STAGE APRON
    const screenSegs = 40;
    const screenGeo = this.track(new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT, screenSegs, 1));
    const posAttr = screenGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      // Subtle concave IMAX curvature wrapping gently toward audience
      const zCurve = (x * x) * 0.009;
      posAttr.setZ(i, zCurve);
    }
    screenGeo.computeVertexNormals();

    this.screenMat = this.track(
      new THREE.MeshStandardMaterial({
        map: this.screenReel.texture,
        emissiveMap: this.screenReel.texture,
        emissive: '#ffffff',
        emissiveIntensity: 1.15,
        roughness: 0.42,
        metalness: 0.02,
      }),
    );

    const screenMesh = new THREE.Mesh(screenGeo, this.screenMat);
    screenMesh.position.set(SCREEN_CENTER.x, SCREEN_CENTER.y, SCREEN_CENTER.z);
    audGroup.add(screenMesh);

    // Matte acoustic velvet masking frame around screen
    const frameMat = this.track(new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.95, metalness: 0.02 }));
    const topMask = new THREE.Mesh(this.track(new THREE.BoxGeometry(SCREEN_WIDTH + 1.8, 0.85, 0.35)), frameMat);
    topMask.position.set(0, SCREEN_CENTER.y + SCREEN_HEIGHT * 0.5 + 0.42, SCREEN_CENTER.z + 0.3);
    audGroup.add(topMask);

    const botMask = new THREE.Mesh(this.track(new THREE.BoxGeometry(SCREEN_WIDTH + 1.8, 0.65, 0.35)), frameMat);
    botMask.position.set(0, SCREEN_CENTER.y - SCREEN_HEIGHT * 0.5 - 0.32, SCREEN_CENTER.z + 0.3);
    audGroup.add(botMask);

    // Sculpted front stage apron with recessed warm under-glow
    const stageApron = new THREE.Mesh(this.track(new THREE.BoxGeometry(22.6, 0.52, 2.6)), walnutRibMat);
    stageApron.position.set(0, 0.26, -18.5);
    stageApron.receiveShadow = true;
    audGroup.add(stageApron);

    const stageTrim = new THREE.Mesh(this.track(new THREE.BoxGeometry(22.4, 0.04, 0.06)), this.ledStripMat);
    stageTrim.position.set(0, 0.53, -17.2);
    audGroup.add(stageTrim);

    // Rear Projection Booth Window + Subtle Volumetric Projector Light Cone
    const boothGlass = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(3.6, 1.1, 0.12)),
      this.track(
        new THREE.MeshPhysicalMaterial({
          color: '#1b2638',
          roughness: 0.08,
          metalness: 0.2,
          clearcoat: 1,
        }),
      ),
    );
    boothGlass.position.set(0, 9.8, 13.92);
    audGroup.add(boothGlass);

    this.projectorBeamMat = this.track(
      new THREE.MeshBasicMaterial({
        color: '#a8c7ff',
        transparent: true,
        opacity: 0.032,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    const beamCone = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.18, 6.4, 32.5, 24, 1, true)),
      this.projectorBeamMat,
    );
    beamCone.position.set(0, 7.6, -2.5);
    beamCone.rotation.x = Math.PI * 0.5 - 0.13;
    audGroup.add(beamCone);

    // Emergency Exit Doors & Glowing Green EXIT Signs
    const doorGeo = this.track(new THREE.BoxGeometry(0.18, 2.5, 1.8));
    const exitSignGeo = this.track(new THREE.BoxGeometry(0.14, 0.34, 0.85));
    const exitDoorMat = this.track(new THREE.MeshStandardMaterial({ color: '#1a1d22', roughness: 0.45, metalness: 0.55 }));

    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(doorGeo, exitDoorMat);
      door.position.set(side * 12.88, 1.25, -15.6);
      audGroup.add(door);

      const sign = new THREE.Mesh(exitSignGeo, this.exitSignMat);
      sign.position.set(side * 12.74, 2.82, -15.6);
      audGroup.add(sign);

      // Rear portals & signs
      const rearSign = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.85, 0.34, 0.14)),
        this.exitSignMat,
      );
      rearSign.position.set(side * 9.2, 8.65, 13.85);
      audGroup.add(rearSign);
    }
  }

  private buildInstancedSeats() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const leatherBump = this.track(createLeatherBumpTexture(maxAniso));
    const count = AUDITORIUM_SEATS.length;

    // 1. Sculpted ergonomic backrest (extruded curved profile with bevels — NOT a box!)
    const backShape = new THREE.Shape();
    backShape.moveTo(-0.27, 0.28);
    backShape.quadraticCurveTo(-0.31, 0.65, -0.25, 0.96);
    backShape.quadraticCurveTo(0, 1.04, 0.25, 0.96);
    backShape.quadraticCurveTo(0.31, 0.65, 0.27, 0.28);
    backShape.closePath();

    const backGeo = this.track(
      new THREE.ExtrudeGeometry(backShape, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.045,
        bevelSize: 0.035,
        bevelSegments: 3,
      }),
    );
    backGeo.translate(0, 0, 0.16);
    backGeo.rotateX(0.14); // Ergonomic cinema recline angle

    // 2. Plush curved headrest pillow bolster
    const headGeo = this.track(new THREE.CapsuleGeometry(0.115, 0.26, 6, 12));
    headGeo.rotateZ(Math.PI / 2);
    headGeo.translate(0, 1.02, 0.31);

    // 3. Sculpted cushioned seat pan
    const panShape = new THREE.Shape();
    panShape.moveTo(-0.28, -0.24);
    panShape.lineTo(0.28, -0.24);
    panShape.quadraticCurveTo(0.31, 0.0, 0.27, 0.22);
    panShape.lineTo(-0.27, 0.22);
    panShape.quadraticCurveTo(-0.31, 0.0, -0.28, -0.24);

    const panGeo = this.track(
      new THREE.ExtrudeGeometry(panShape, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.03,
        bevelSegments: 2,
      }),
    );
    panGeo.rotateX(Math.PI / 2);
    panGeo.translate(0, 0.43, 0.02);

    // 4. Sculpted dual armrests + cupholder silhouette
    const armGeo = this.track(new THREE.BoxGeometry(0.1, 0.24, 0.56));
    armGeo.translate(0, 0.54, 0.03);

    // 5. Cast-aluminum structural pedestal base (anchored flush to floor y=0)
    const baseGeo = this.track(new THREE.CylinderGeometry(0.14, 0.21, 0.32, 10));
    baseGeo.translate(0, 0.16, 0.04);

    // 6. Subtle under-seat illuminated accent bar
    const ledGeo = this.track(new THREE.BoxGeometry(0.42, 0.028, 0.03));
    ledGeo.translate(0, 0.05, -0.26);

    // Raycast proxy box (layer 1 only)
    const hitGeo = this.track(new THREE.BoxGeometry(0.74, 1.12, 0.72));
    hitGeo.translate(0, 0.56, 0.06);

    const upholsteryMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        bumpMap: leatherBump,
        bumpScale: 0.015,
        roughness: 0.48,
        metalness: 0.06,
        clearcoat: 0.24,
        clearcoatRoughness: 0.48,
      }),
    );

    const cushionMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        bumpMap: leatherBump,
        bumpScale: 0.012,
        roughness: 0.52,
        metalness: 0.05,
        clearcoat: 0.18,
        clearcoatRoughness: 0.55,
      }),
    );

    const armMetalMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#202126',
        roughness: 0.36,
        metalness: 0.55,
      }),
    );

    const baseMetalMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#17181c',
        roughness: 0.32,
        metalness: 0.82,
      }),
    );

    this.seatLedMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#f5d298',
        emissive: '#e5b869',
        emissiveIntensity: 0.9,
        roughness: 0.25,
      }),
    );

    const hitMat = this.track(
      new THREE.MeshBasicMaterial({
        visible: false,
      }),
    );

    this.seatBackMesh = new THREE.InstancedMesh(backGeo, upholsteryMat, count);
    this.seatHeadMesh = new THREE.InstancedMesh(headGeo, upholsteryMat, count);
    this.seatPanMesh = new THREE.InstancedMesh(panGeo, cushionMat, count);
    this.seatArmMesh = new THREE.InstancedMesh(armGeo, armMetalMat, count * 2);
    this.seatBaseMesh = new THREE.InstancedMesh(baseGeo, baseMetalMat, count);
    this.seatLedMesh = new THREE.InstancedMesh(ledGeo, this.seatLedMat, count);
    this.seatHitMesh = new THREE.InstancedMesh(hitGeo, hitMat, count);

    if (!this.isSoftwareGl) {
      this.seatBackMesh.castShadow = true;
      this.seatBackMesh.receiveShadow = true;
      this.seatPanMesh.receiveShadow = true;
    }

    // VIP walnut/brass side tables (for VIP rows O-R)
    const vipSeats = AUDITORIUM_SEATS.filter((s) => s.category === 'vip');
    const vipTableGeo = this.track(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 16));
    const vipTableMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#5a422b',
        roughness: 0.32,
        metalness: 0.42,
      }),
    );
    const vipTableInst = new THREE.InstancedMesh(vipTableGeo, vipTableMat, vipSeats.length);
    let vipIdx = 0;

    AUDITORIUM_SEATS.forEach((seat, i) => {
      // Orient every seat subtly inward toward the center of the curved screen
      const yawToScreen = Math.atan2(SCREEN_CENTER.x - seat.x, SCREEN_CENTER.z - seat.z) + Math.PI;
      _euler.set(0, yawToScreen, 0);
      _quat.setFromEuler(_euler);

      const widthScale = seat.category === 'vip' ? 1.28 : seat.category === 'couple' ? 1.15 : seat.isAccessible ? 0.01 : 1.0;
      const heightScale = seat.category === 'vip' ? 1.08 : seat.isAccessible ? 0.01 : 1.0;

      _pos.set(seat.x, seat.y, seat.z);
      _scale.set(widthScale, heightScale, seat.category === 'vip' ? 1.16 : 1.0);
      _mat4.compose(_pos, _quat, _scale);

      this.seatBackMesh.setMatrixAt(i, _mat4);
      this.seatHeadMesh.setMatrixAt(i, _mat4);
      this.seatPanMesh.setMatrixAt(i, _mat4);
      this.seatBaseMesh.setMatrixAt(i, _mat4);
      this.seatLedMesh.setMatrixAt(i, _mat4);

      // Hit proxy stays full size even for wheelchair spaces so users can click them
      _scale.set(seat.category === 'vip' ? 1.3 : 1.0, 1.0, 1.0);
      _mat4.compose(_pos, _quat, _scale);
      this.seatHitMesh.setMatrixAt(i, _mat4);

      // Left & Right Armrests
      const armOffset = seat.category === 'vip' ? 0.42 : 0.33;
      for (let side = 0; side < 2; side++) {
        const dir = side === 0 ? -1 : 1;
        _v1.set(dir * armOffset, 0, 0).applyQuaternion(_quat).add(_pos);
        _scale.set(seat.isAccessible ? 0.01 : 1.0, seat.isAccessible ? 0.01 : 1.0, 1.0);
        _mat4.compose(_v1, _quat, _scale);
        this.seatArmMesh.setMatrixAt(i * 2 + side, _mat4);
      }

      if (seat.category === 'vip') {
        _v1.set(0.45, 0.68, -0.14).applyQuaternion(_quat).add(_pos);
        _scale.set(1, 1, 1);
        _mat4.compose(_v1, _quat, _scale);
        vipTableInst.setMatrixAt(vipIdx++, _mat4);
      }
    });

    [
      this.seatBackMesh,
      this.seatHeadMesh,
      this.seatPanMesh,
      this.seatArmMesh,
      this.seatBaseMesh,
      this.seatLedMesh,
      this.seatHitMesh,
      vipTableInst,
    ].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      this.scene.add(m);
    });

    // Put hit proxy on layer 1 for fast isolated raycasting
    this.seatHitMesh.layers.set(1);
    this.raycaster.layers.set(1);

    // Wheelchair accessible floor bay markers on Row A
    const accMarkerMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 0.45,
        roughness: 0.4,
      }),
    );
    const accGeo = this.track(new THREE.PlaneGeometry(0.82, 0.95));
    accGeo.rotateX(-Math.PI / 2);
    for (const s of AUDITORIUM_SEATS) {
      if (s.isAccessible) {
        const marker = new THREE.Mesh(accGeo, accMarkerMat);
        marker.position.set(s.x, s.y + 0.02, s.z);
        this.scene.add(marker);
      }
    }
  }

  private buildAudienceSystem() {
    const count = AUDITORIUM_SEATS.length;
    const headGeo = this.track(new THREE.SphereGeometry(0.115, 12, 10));
    const bodyGeo = this.track(new THREE.CapsuleGeometry(0.18, 0.34, 6, 10));

    const headMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#c9a68a',
        roughness: 0.68,
        metalness: 0.02,
      }),
    );
    const bodyMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#2b303a',
        roughness: 0.85,
        metalness: 0.04,
      }),
    );

    this.audienceHeadMesh = new THREE.InstancedMesh(headGeo, headMat, count);
    this.audienceBodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    this.audienceHeadMesh.frustumCulled = false;
    this.audienceBodyMesh.frustumCulled = false;
    this.scene.add(this.audienceHeadMesh);
    this.scene.add(this.audienceBodyMesh);

    this.updateAudienceVisuals();
  }

  private buildLobbyAndCorridors() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const { map: marbleMap, roughnessMap: marbleRough } = createMarbleTexture(maxAniso);
    const acousticTex = createAcousticPanelTexture(maxAniso);
    this.track(marbleMap);
    this.track(marbleRough);
    this.track(acousticTex);

    const marbleMat = this.track(
      new THREE.MeshStandardMaterial({
        map: marbleMap,
        roughnessMap: marbleRough,
        roughness: 0.24,
        metalness: 0.16,
      }),
    );

    const wallMat = this.track(
      new THREE.MeshStandardMaterial({
        map: acousticTex,
        color: '#1f1d21',
        roughness: 0.7,
        metalness: 0.1,
      }),
    );

    const brassMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#d4a65a',
        roughness: 0.24,
        metalness: 0.88,
      }),
    );

    const velvetSofaMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#34262c',
        roughness: 0.82,
        metalness: 0.04,
      }),
    );

    const glassMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#b8d4e8',
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.28,
      }),
    );

    const lobbyGroup = new THREE.Group();
    this.scene.add(lobbyGroup);

    // Grand Lobby Floor (Z = 16 to 36, X = -18 to 18)
    const lobbyFloor = new THREE.Mesh(this.track(new THREE.BoxGeometry(36.4, 0.3, 21.0)), marbleMat);
    lobbyFloor.position.set(0, -0.15, 26.0);
    lobbyFloor.receiveShadow = true;
    lobbyGroup.add(lobbyFloor);

    // Grand Lobby Double-Height Ceiling (Y = 10.5)
    const lobbyCeiling = new THREE.Mesh(this.track(new THREE.BoxGeometry(36.4, 0.5, 21.0)), wallMat);
    lobbyCeiling.position.set(0, 10.75, 26.0);
    lobbyGroup.add(lobbyCeiling);

    // Lobby Side Walls
    const lSideGeo = this.track(new THREE.BoxGeometry(0.5, 11.0, 21.0));
    const lLeft = new THREE.Mesh(lSideGeo, wallMat);
    lLeft.position.set(-18.2, 5.3, 26.0);
    lobbyGroup.add(lLeft);
    const lRight = new THREE.Mesh(lSideGeo, wallMat);
    lRight.position.set(18.2, 5.3, 26.0);
    lobbyGroup.add(lRight);

    // Double-height fluted architectural columns with brass collars
    const colGeo = this.track(new THREE.CylinderGeometry(0.45, 0.48, 10.5, 18));
    const collarGeo = this.track(new THREE.CylinderGeometry(0.53, 0.53, 0.18, 18));
    const colCoords: [number, number][] = [
      [-11, 32],
      [11, 32],
      [-11, 22],
      [11, 22],
    ];
    for (const [cx, cz] of colCoords) {
      const col = new THREE.Mesh(colGeo, wallMat);
      col.position.set(cx, 5.25, cz);
      lobbyGroup.add(col);
      const collar = new THREE.Mesh(collarGeo, brassMat);
      collar.position.set(cx, 0.4, cz);
      lobbyGroup.add(collar);
    }

    // Sculptural Golden Ceiling Chandelier Ring
    const ring = new THREE.Mesh(this.track(new THREE.TorusGeometry(4.2, 0.08, 12, 48)), this.ledStripMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 8.9, 26.5);
    lobbyGroup.add(ring);

    // TICKET RECEPTION COUNTER (Left Wing X = -12.5, Z = 27)
    const ticketDesk = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.6, 1.15, 7.5)), marbleMat);
    ticketDesk.position.set(-13.2, 0.575, 27.0);
    lobbyGroup.add(ticketDesk);
    const deskTop = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.8, 0.08, 7.7)), brassMat);
    deskTop.position.set(-13.2, 1.18, 27.0);
    lobbyGroup.add(deskTop);

    // 4 Self-Service Booking Kiosks
    const kioskMat = this.track(new THREE.MeshStandardMaterial({ color: '#14171f', roughness: 0.3, metalness: 0.7 }));
    const kioskScreenMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1e3a5f', emissive: '#38bdf8', emissiveIntensity: 0.75 }),
    );
    for (let k = 0; k < 4; k++) {
      const kz = 29.8 - k * 1.65;
      const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.45, 1.65, 0.65)), kioskMat);
      body.position.set(-9.6, 0.825, kz);
      lobbyGroup.add(body);
      const scr = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.52, 0.72)), kioskScreenMat);
      scr.rotation.y = Math.PI / 2;
      scr.position.set(-9.36, 1.18, kz);
      lobbyGroup.add(scr);
    }

    // POPCORN & BEVERAGE CONCESSION BAR (Right Wing X = +13.2, Z = 25.5)
    const concDesk = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.8, 1.15, 8.4)), marbleMat);
    concDesk.position.set(13.2, 0.575, 25.5);
    lobbyGroup.add(concDesk);
    const concTop = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.0, 0.08, 8.6)), brassMat);
    concTop.position.set(13.2, 1.18, 25.5);
    lobbyGroup.add(concTop);

    // Glowing Popcorn Warmer Display Cases + Backlit Menu Boards
    const popcornGlowMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#f59e0b', emissiveIntensity: 0.85 }),
    );
    for (let p = 0; p < 3; p++) {
      const box = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.7, 0.75, 1.1)), glassMat);
      box.position.set(13.0, 1.56, 23.0 + p * 2.4);
      lobbyGroup.add(box);
      const inner = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.52, 0.35, 0.88)), popcornGlowMat);
      inner.position.set(13.0, 1.38, 23.0 + p * 2.4);
      lobbyGroup.add(inner);
    }

    // Central Waiting Lounge Designer Sofas & Travertine Coffee Table
    const sofaGeo = this.track(new THREE.BoxGeometry(3.6, 0.58, 1.25));
    const sofa1 = new THREE.Mesh(sofaGeo, velvetSofaMat);
    sofa1.position.set(0, 0.29, 25.0);
    lobbyGroup.add(sofa1);
    const sofa2 = new THREE.Mesh(sofaGeo, velvetSofaMat);
    sofa2.position.set(0, 0.29, 28.4);
    lobbyGroup.add(sofa2);
    const table = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.4, 0.38, 1.0)), brassMat);
    table.position.set(0, 0.19, 26.7);
    lobbyGroup.add(table);

    // VIP LOUNGE GLASS PAVILION (Rear-Right Lobby X = 13, Z = 18.5)
    const vipGlassWall = new THREE.Mesh(this.track(new THREE.BoxGeometry(7.2, 4.4, 0.14)), glassMat);
    vipGlassWall.position.set(13.5, 2.2, 20.6);
    lobbyGroup.add(vipGlassWall);
    const vipArmchairGeo = this.track(new THREE.BoxGeometry(1.15, 0.75, 1.1));
    for (let v = 0; v < 3; v++) {
      const chair = new THREE.Mesh(vipArmchairGeo, velvetSofaMat);
      chair.position.set(11.4 + v * 2.1, 0.38, 18.2);
      lobbyGroup.add(chair);
    }

    // Illuminated Digital Movie Poster Lightboxes (using our generated theatrical posters!)
    const texLoader = new THREE.TextureLoader();
    const posterUrls = [POSTER_CHRONOS, POSTER_MIRAGE, POSTER_SOLARIS];
    posterUrls.forEach((url, idx) => {
      const posterTex = texLoader.load(url);
      posterTex.colorSpace = THREE.SRGBColorSpace;
      this.track(posterTex);
      const pMat = this.track(
        new THREE.MeshStandardMaterial({
          map: posterTex,
          emissiveMap: posterTex,
          emissive: '#ffffff',
          emissiveIntensity: 0.45,
          roughness: 0.25,
        }),
      );
      // Lobby feature wall posters
      const frame = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.3, 3.1, 0.15)), brassMat);
      frame.position.set(-4.5 + idx * 4.5, 3.2, 16.3);
      lobbyGroup.add(frame);

      const art = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2.1, 2.85)), pMat);
      art.position.set(-4.5 + idx * 4.5, 3.2, 16.39);
      lobbyGroup.add(art);
    });

    // TWIN ACOUSTIC CORRIDORS connecting Lobby (Z=16) seamlessly to Auditorium Front Entrances (Z=-15.6)
    const corrFloorGeo = this.track(new THREE.BoxGeometry(3.2, 0.3, 33.0));
    const corrWallGeo = this.track(new THREE.BoxGeometry(0.4, 4.8, 33.0));
    const corrCeilGeo = this.track(new THREE.BoxGeometry(3.4, 0.35, 33.0));
    const corrStripGeo = this.track(new THREE.BoxGeometry(0.08, 0.04, 31.0));

    for (const side of [-1, 1]) {
      const cx = side * 14.6;
      const cf = new THREE.Mesh(corrFloorGeo, marbleMat);
      cf.position.set(cx, -0.15, 0.0);
      lobbyGroup.add(cf);

      const outerW = new THREE.Mesh(corrWallGeo, wallMat);
      outerW.position.set(side * 16.2, 2.3, 0.0);
      lobbyGroup.add(outerW);

      const cc = new THREE.Mesh(corrCeilGeo, wallMat);
      cc.position.set(cx, 4.7, 0.0);
      lobbyGroup.add(cc);

      const strip = new THREE.Mesh(corrStripGeo, this.ledStripMat);
      strip.position.set(cx, 4.48, 0.0);
      lobbyGroup.add(strip);
    }
  }

  private buildExteriorArchitecture() {
    const extGroup = new THREE.Group();
    this.scene.add(extGroup);

    const stoneMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#25262b',
        roughness: 0.72,
        metalness: 0.12,
      }),
    );
    const asphaltMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#17191e',
        roughness: 0.88,
        metalness: 0.06,
      }),
    );
    const facadeGlassMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: '#88b4d8',
        roughness: 0.1,
        metalness: 0.15,
        transparent: true,
        opacity: 0.34,
      }),
    );
    const foliageMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#243c2c',
        roughness: 0.85,
      }),
    );
    const trunkMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#3b2c22',
        roughness: 0.9,
      }),
    );

    this.exteriorGlowMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#fff4de',
        emissive: '#f5c273',
        emissiveIntensity: 1.9,
        roughness: 0.2,
      }),
    );

    // Exterior Plaza & Extended Surrounding Ground Plane (avoids floating-void edges!)
    const plaza = new THREE.Mesh(this.track(new THREE.BoxGeometry(64, 0.3, 32)), stoneMat);
    plaza.position.set(0, -0.16, 51.0);
    plaza.receiveShadow = true;
    extGroup.add(plaza);

    const outerGround = new THREE.Mesh(this.track(new THREE.PlaneGeometry(240, 240)), asphaltMat);
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.set(0, -0.32, 24);
    extGroup.add(outerGround);

    // Contemporary Architectural Cinema Facade & Cantilevered Canopy (Z = 36.2)
    const facadeHeader = new THREE.Mesh(this.track(new THREE.BoxGeometry(38.0, 4.4, 1.4)), stoneMat);
    facadeHeader.position.set(0, 9.6, 36.4);
    extGroup.add(facadeHeader);

    const canopy = new THREE.Mesh(this.track(new THREE.BoxGeometry(24.0, 0.55, 5.2)), stoneMat);
    canopy.position.set(0, 5.2, 38.6);
    extGroup.add(canopy);

    const canopyLed = new THREE.Mesh(this.track(new THREE.BoxGeometry(23.6, 0.08, 0.12)), this.exteriorGlowMat);
    canopyLed.position.set(0, 4.92, 41.15);
    extGroup.add(canopyLed);

    // Glass Curtain Wall & Sliding Entrance Doors
    const curtainL = new THREE.Mesh(this.track(new THREE.BoxGeometry(13.0, 7.6, 0.18)), facadeGlassMat);
    curtainL.position.set(-11.0, 3.8, 36.2);
    extGroup.add(curtainL);

    const curtainR = new THREE.Mesh(this.track(new THREE.BoxGeometry(13.0, 7.6, 0.18)), facadeGlassMat);
    curtainR.position.set(11.0, 3.8, 36.2);
    extGroup.add(curtainR);

    // Illuminated Cinema Marquee Sign ("IMMERSIVE CINEMA 5")
    const marqueeTex = this.track(createMarqueeSignTexture('IMMERSIVE CINEMA 5', 'IMAX LASER · DOLBY ATMOS · VIP LOUNGE'));
    const marqueeMat = this.track(
      new THREE.MeshStandardMaterial({
        map: marqueeTex,
        emissiveMap: marqueeTex,
        emissive: '#ffffff',
        emissiveIntensity: 1.0,
        roughness: 0.25,
      }),
    );
    const marquee = new THREE.Mesh(this.track(new THREE.BoxGeometry(15.2, 3.2, 0.35)), marqueeMat);
    marquee.position.set(0, 9.6, 37.2);
    extGroup.add(marquee);

    // Landscaped Planters + Multi-part Ornamental Trees + Walkway Light Bollards
    const planterGeo = this.track(new THREE.BoxGeometry(3.4, 0.72, 2.2));
    const bollardGeo = this.track(new THREE.CylinderGeometry(0.08, 0.09, 0.92, 10));
    const bollardTopGeo = this.track(new THREE.CylinderGeometry(0.085, 0.085, 0.14, 10));

    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const pz = 42.5 + i * 5.2;
        const planter = new THREE.Mesh(planterGeo, stoneMat);
        planter.position.set(side * 12.5, 0.36, pz);
        extGroup.add(planter);

        // Multi-part tree (trunk + 3 clustered foliage canopies)
        const trunk = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.11, 0.16, 1.9, 8)), trunkMat);
        trunk.position.set(side * 12.5, 1.65, pz);
        extGroup.add(trunk);

        const c1 = new THREE.Mesh(this.track(new THREE.DodecahedronGeometry(1.05, 1)), foliageMat);
        c1.position.set(side * 12.5, 2.95, pz);
        extGroup.add(c1);
        const c2 = new THREE.Mesh(this.track(new THREE.DodecahedronGeometry(0.78, 1)), foliageMat);
        c2.position.set(side * 12.5 + 0.45, 2.6, pz + 0.35);
        extGroup.add(c2);

        // Illuminated Walkway Bollards lining pedestrian approach
        const bol = new THREE.Mesh(bollardGeo, stoneMat);
        bol.position.set(side * 5.6, 0.46, pz);
        extGroup.add(bol);
        const bolGlow = new THREE.Mesh(bollardTopGeo, this.exteriorGlowMat);
        bolGlow.position.set(side * 5.6, 0.84, pz);
        extGroup.add(bolGlow);
      }
    }

    // Parking Bay Lines & Accessible Parking Spaces (Z = 56..63)
    const lineMat = this.track(new THREE.MeshBasicMaterial({ color: '#475569' }));
    const accLineMat = this.track(new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
    const lineGeo = this.track(new THREE.PlaneGeometry(0.14, 4.8));
    lineGeo.rotateX(-Math.PI / 2);

    for (let x = -21; x <= 21; x += 3.5) {
      const isAcc = Math.abs(x) <= 7;
      const stripe = new THREE.Mesh(lineGeo, isAcc ? accLineMat : lineMat);
      stripe.position.set(x, 0.015, 58.5);
      extGroup.add(stripe);
    }
  }

  private buildWayfindingSystem() {
    this.wayfindingMat = this.track(
      new THREE.MeshStandardMaterial({
        color: '#34d399',
        emissive: '#10b981',
        emissiveIntensity: 2.0,
        roughness: 0.2,
      }),
    );
    this.wayfindingGroup.visible = false;
    this.scene.add(this.wayfindingGroup);
  }

  private buildTourCurves() {
    this.tourCurvePos = new THREE.CatmullRomCurve3(TOUR_WAYPOINTS.map((w) => w.pos));
    this.tourCurveLook = new THREE.CatmullRomCurve3(TOUR_WAYPOINTS.map((w) => w.look));
  }

  public updateSeatVisualStates() {
    for (let i = 0; i < AUDITORIUM_SEATS.length; i++) {
      const s = AUDITORIUM_SEATS[i];
      const isSelected = this.selectedSeatIds.has(s.id);
      const isHovered = this.hoveredSeatId === s.id;

      if (isSelected) {
        // Signature electric cinema blue from reference video!
        _color.set('#2563eb');
      } else if (isHovered && s.status === 'available') {
        _color.set('#d4a65a');
      } else if (s.status === 'reserved') {
        _color.set('#141519');
      } else if (s.status === 'unavailable') {
        _color.set('#26181a');
      } else if (s.category === 'vip') {
        _color.set('#4c3324'); // Rich cognac-espresso leather
      } else if (s.category === 'couple') {
        _color.set('#442634'); // Deep burgundy-velvet
      } else if (s.category === 'premium') {
        _color.set('#262b38'); // Architectural midnight slate
      } else {
        _color.set('#232226'); // Classic charcoal upholstery
      }

      this.seatBackMesh.setColorAt(i, _color);
      this.seatHeadMesh.setColorAt(i, _color);
      this.seatPanMesh.setColorAt(i, _color.clone().multiplyScalar(0.92));
    }

    if (this.seatBackMesh.instanceColor) this.seatBackMesh.instanceColor.needsUpdate = true;
    if (this.seatHeadMesh.instanceColor) this.seatHeadMesh.instanceColor.needsUpdate = true;
    if (this.seatPanMesh.instanceColor) this.seatPanMesh.instanceColor.needsUpdate = true;
  }

  private updateAudienceVisuals() {
    const ratio = this.audienceDensity / 100;
    for (let i = 0; i < AUDITORIUM_SEATS.length; i++) {
      const s = AUDITORIUM_SEATS[i];
      const hash = ((i * 2654435761) % 100) / 100;
      const shouldShow =
        ratio > 0 &&
        !this.selectedSeatIds.has(s.id) &&
        !s.isAccessible &&
        (s.status === 'reserved' ? hash < Math.min(1, ratio * 1.4) : hash < ratio * 0.85);

      if (shouldShow) {
        const yaw = Math.atan2(SCREEN_CENTER.x - s.x, SCREEN_CENTER.z - s.z) + Math.PI;
        _euler.set(0, yaw, 0);
        _quat.setFromEuler(_euler);

        // Varied subtle human heights (±7cm) for realistic audience silhouette
        const hOff = ((i % 7) - 3) * 0.022;
        _pos.set(s.x, s.y + 0.72 + hOff * 0.5, s.z + 0.04);
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        this.audienceBodyMesh.setMatrixAt(i, _mat4);

        _pos.set(s.x, s.y + 1.14 + hOff, s.z + 0.05);
        _mat4.compose(_pos, _quat, _scale);
        this.audienceHeadMesh.setMatrixAt(i, _mat4);
      } else {
        _pos.set(0, -100, 0);
        _scale.set(0.001, 0.001, 0.001);
        _quat.identity();
        _mat4.compose(_pos, _quat, _scale);
        this.audienceBodyMesh.setMatrixAt(i, _mat4);
        this.audienceHeadMesh.setMatrixAt(i, _mat4);
      }
    }
    this.audienceHeadMesh.instanceMatrix.needsUpdate = true;
    this.audienceBodyMesh.instanceMatrix.needsUpdate = true;
  }

  // --- PUBLIC API FOR REACT FRONTEND ---

  public setSelectedSeats(ids: string[], primaryId?: string) {
    this.selectedSeatIds = new Set(ids);
    if (primaryId) {
      this.primarySeatId = primaryId;
    } else if (ids.length > 0 && !this.selectedSeatIds.has(this.primarySeatId)) {
      this.primarySeatId = ids[0];
    }
    this.updateSeatVisualStates();
    this.updateAudienceVisuals();

    if (this.cameraMode === 'seat-preview') {
      this.focusSeatPov(this.primarySeatId, false);
    }
  }

  public setCompareSeats(seatA: string, seatB: string) {
    this.compareSeatIds = [seatA, seatB];
    if (this.cameraMode === 'compare-seats') {
      this.camYawTarget = 0;
      this.camPitchTarget = 0;
    }
  }

  public setCameraMode(mode: CameraMode, seatId?: string) {
    this.cameraMode = mode;
    this.lookOverrideActive = false;

    if (mode === 'seat-map') {
      // High bird's-eye architectural overview matching the reference video transition
      this.camPosTarget.set(0, 26.5, 2.2);
      this.camLookTarget.set(0, 1.5, -2.5);
    } else if (mode === 'seat-preview') {
      const targetId = seatId || this.primarySeatId || 'J10';
      this.primarySeatId = targetId;
      this.focusSeatPov(targetId, true);
    } else if (mode === 'compare-seats') {
      this.camYaw = 0;
      this.camPitch = 0;
      this.camYawTarget = 0;
      this.camPitchTarget = 0;
    } else if (mode === 'drone-tour') {
      this.tourProgress = 0;
      this.tourPaused = false;
      this.lastTourChapter = -1;
    } else if (mode === 'free-walk') {
      // Drop user at a natural standing vantage if coming from overhead
      if (this.camera.position.y > 10) {
        this.camera.position.set(0, 1.68, 29.0);
        this.camPosTarget.set(0, 1.68, 29.0);
        this.camYaw = 0;
        this.camYawTarget = 0;
        this.camPitch = 0;
        this.camPitchTarget = 0;
      } else {
        const yFloor = this.getWalkableFloorHeight(this.camera.position.x, this.camera.position.z);
        this.camPosTarget.set(this.camera.position.x, yFloor + (this.walkSeatedHeight ? 1.12 : 1.68), this.camera.position.z);
      }
      this.lookOverrideActive = true;
    } else if (mode === 'overview') {
      this.camPosTarget.set(18, 16, 56);
      this.camLookTarget.set(0, 4, 24);
    }
  }

  public focusSeatPov(seatId: string, resetLook = true) {
    const seat = AUDITORIUM_SEATS.find((s) => s.id === seatId);
    if (!seat) return;
    this.primarySeatId = seat.id;
    this.camPosTarget.set(seat.x, seat.eyeY, seat.z - 0.04);
    this.camLookTarget.set(SCREEN_CENTER.x, SCREEN_CENTER.y, SCREEN_CENTER.z);

    if (resetLook) {
      const dx = SCREEN_CENTER.x - seat.x;
      const dy = SCREEN_CENTER.y - seat.eyeY;
      const dz = SCREEN_CENTER.z - seat.z;
      this.camYawTarget = Math.atan2(-dx, -dz);
      this.camPitchTarget = Math.atan2(dy, Math.hypot(dx, dz));
      this.lookOverrideActive = false;
    }
  }

  public goToPanorama(pointId: string) {
    const pt = PANORAMA_POINTS.find((p) => p.id === pointId);
    if (!pt) return;
    this.cameraMode = 'panorama';
    this.camPosTarget.set(pt.position[0], pt.position[1], pt.position[2]);
    this.camLookTarget.set(pt.lookAt[0], pt.lookAt[1], pt.lookAt[2]);
    const dx = pt.lookAt[0] - pt.position[0];
    const dy = pt.lookAt[1] - pt.position[1];
    const dz = pt.lookAt[2] - pt.position[2];
    this.camYawTarget = Math.atan2(-dx, -dz);
    this.camPitchTarget = Math.atan2(dy, Math.hypot(dx, dz));
    this.lookOverrideActive = false;
  }

  public teleportToFloorPoint(x: number, z: number) {
    const clamped = this.clampWalkPosition(x, z);
    const y = this.getWalkableFloorHeight(clamped.x, clamped.z);
    this.cameraMode = 'free-walk';
    this.camPosTarget.set(clamped.x, y + (this.walkSeatedHeight ? 1.12 : 1.68), clamped.z);
    // Face screen if inside auditorium, else face north toward lobby/auditorium
    const lookZ = clamped.z < 14 ? SCREEN_CENTER.z : clamped.z - 10;
    const dx = 0 - clamped.x;
    const dz = lookZ - clamped.z;
    this.camYawTarget = Math.atan2(-dx, -dz);
    this.camPitchTarget = 0;
    this.lookOverrideActive = true;
  }

  public setWalkSeated(seated: boolean) {
    this.walkSeatedHeight = seated;
  }

  public setJoystick(x: number, y: number) {
    this.joystickVec.x = x;
    this.joystickVec.y = y;
  }

  public setTourPaused(paused: boolean) {
    this.tourPaused = paused;
  }

  public skipTourChapter() {
    const step = 1 / TOUR_WAYPOINTS.length;
    this.tourProgress = Math.min(0.99, this.tourProgress + step);
  }

  public setLighting(next: LightingSettings) {
    this.targetLighting = { ...next };
  }

  public setAudienceDensity(density: AudienceDensity) {
    this.audienceDensity = density;
    this.updateAudienceVisuals();
  }

  public setMovieReelInfo(title: string, tagline: string, accentColor: string) {
    this.screenReel.setMovieInfo(title, tagline, accentColor);
  }

  public setDirectVideoSource(url: string | null) {
    if (this.screenVideoEl) {
      this.screenVideoEl.pause();
      this.screenVideoEl.src = '';
      this.screenVideoEl = null;
    }
    if (this.screenVideoTex) {
      this.screenVideoTex.dispose();
      this.screenVideoTex = null;
    }

    if (!url) {
      this.screenMat.map = this.screenReel.texture;
      this.screenMat.emissiveMap = this.screenReel.texture;
      this.screenMat.needsUpdate = true;
      return;
    }

    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.loop = true;
    vid.playsInline = true;
    vid.muted = false;
    vid.src = url;
    vid.play().catch(() => {
      vid.muted = true;
      vid.play().catch(() => {});
    });

    const vTex = new THREE.VideoTexture(vid);
    vTex.colorSpace = THREE.SRGBColorSpace;
    this.screenVideoEl = vid;
    this.screenVideoTex = vTex;
    this.screenMat.map = vTex;
    this.screenMat.emissiveMap = vTex;
    this.screenMat.needsUpdate = true;
  }

  public controlMedia(action: 'play' | 'pause' | 'restart' | 'seek', value?: number) {
    if (action === 'play') {
      this.isMediaPlaying = true;
      this.screenVideoEl?.play().catch(() => {});
    } else if (action === 'pause') {
      this.isMediaPlaying = false;
      this.screenVideoEl?.pause();
    } else if (action === 'restart') {
      this.reelTime = 0;
      if (this.screenVideoEl) {
        this.screenVideoEl.currentTime = 0;
        this.screenVideoEl.play().catch(() => {});
      }
      this.isMediaPlaying = true;
    } else if (action === 'seek' && typeof value === 'number') {
      if (this.screenVideoEl && Number.isFinite(this.screenVideoEl.duration)) {
        this.screenVideoEl.currentTime = THREE.MathUtils.clamp(
          this.screenVideoEl.currentTime + value,
          0,
          this.screenVideoEl.duration,
        );
      } else {
        this.reelTime = Math.max(0, this.reelTime + value);
      }
    }
  }

  public setMediaVolume(vol: number, muted: boolean) {
    if (this.screenVideoEl) {
      this.screenVideoEl.volume = THREE.MathUtils.clamp(vol, 0, 1);
      this.screenVideoEl.muted = muted;
    }
  }

  public setGraphics(next: GraphicsSettings) {
    this.graphicsSettings = { ...next };
    const maxRatio = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio * next.resolutionScale, 2);
    this.renderer.setPixelRatio(Math.max(0.6, maxRatio));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && next.shadows;
    this.scene.environmentIntensity = 0.45 * next.reflectionsIntensity;
  }

  // Compute & render glowing 3D wayfinding ribbon (Nearest Exit OR Entrance -> Booked Seat)
  public computeWayfinding(
    mode: 'exit' | 'seat',
    accessibleOnly: boolean,
    seatId?: string,
  ): WayfindingState {
    // Clear previous ribbon meshes
    while (this.wayfindingGroup.children.length > 0) {
      const child = this.wayfindingGroup.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      this.wayfindingGroup.remove(child);
    }
    this.wayfindingChevrons = [];

    const pts: [number, number, number][] = [];
    let targetName = '';

    if (mode === 'exit') {
      const origin =
        this.cameraMode === 'seat-preview' || this.cameraMode === 'seat-map'
          ? (() => {
              const s = AUDITORIUM_SEATS.find((seat) => seat.id === (seatId || this.primarySeatId));
              return s ? new THREE.Vector3(s.x, s.y, s.z) : this.camera.position.clone();
            })()
          : this.camera.position.clone();

      const candidates = EXIT_LOCATIONS.filter((e) => (!accessibleOnly || e.accessible));
      let best = candidates[0];
      let bestDist = Infinity;
      for (const ex of candidates) {
        const d = Math.hypot(origin.x - ex.position[0], origin.z - ex.position[2]);
        if (d < bestDist) {
          bestDist = d;
          best = ex;
        }
      }
      targetName = best.name;

      // Build realistic navigable aisle-following waypoints
      const startY = this.getWalkableFloorHeight(origin.x, origin.z);
      pts.push([origin.x, startY + 0.14, origin.z]);

      if (origin.z < 14.5) {
        // Inside auditorium: move laterally along row to nearest aisle (X = ±5.35)
        const aisleX = origin.x < 0 ? -5.35 : 5.35;
        pts.push([aisleX, startY + 0.14, origin.z]);
        if (best.position[2] < 0) {
          // Walk down aisle to front cross-aisle (Z = -15.5)
          pts.push([aisleX, 0.14, -15.5]);
        } else {
          // Walk up aisle to rear deck
          pts.push([aisleX, 5.92, 12.6]);
        }
      }
      pts.push([best.position[0], best.position[1] + 0.14, best.position[2]]);
    } else {
      // Main Glass Entrance -> Grand Lobby -> Left Acoustic Corridor -> Auditorium Aisle -> Booked Seat
      const seat = AUDITORIUM_SEATS.find((s) => s.id === (seatId || this.primarySeatId)) || AUDITORIUM_SEATS[160];
      targetName = `Row ${seat.row} · Seat ${seat.number}`;
      const aisleX = seat.x < 0 ? -5.35 : 5.35;
      const corrX = seat.x < 0 ? -14.6 : 14.6;
      pts.push([0, 0.14, 35.5]);
      pts.push([0, 0.14, 21.5]);
      pts.push([corrX, 0.14, 17.5]);
      pts.push([corrX, 0.14, -15.5]);
      pts.push([aisleX, 0.14, -15.5]);
      pts.push([aisleX, seat.y + 0.14, seat.z]);
      pts.push([seat.x, seat.y + 0.14, seat.z]);
    }

    // Build smooth elevated tube & directional chevrons
    const vectors = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.15);
    const totalLength = curve.getLength();

    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(24, Math.floor(totalLength * 3)), 0.08, 8, false);
    const tube = new THREE.Mesh(tubeGeo, this.wayfindingMat);
    this.wayfindingGroup.add(tube);

    const chevronCount = Math.max(4, Math.floor(totalLength / 2.2));
    const chevGeo = new THREE.ConeGeometry(0.22, 0.48, 4);
    chevGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < chevronCount; i++) {
      const t = (i + 0.5) / chevronCount;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const mesh = new THREE.Mesh(chevGeo, this.wayfindingMat);
      mesh.position.copy(p).add(new THREE.Vector3(0, 0.28, 0));
      mesh.lookAt(p.clone().add(tan));
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.phase = i * 0.55;
      this.wayfindingGroup.add(mesh);
      this.wayfindingChevrons.push(mesh);
    }

    this.wayfindingGroup.visible = true;
    this.wayfindingMat.color.set(mode === 'exit' ? '#34d399' : '#60a5fa');
    this.wayfindingMat.emissive.set(mode === 'exit' ? '#10b981' : '#3b82f6');

    return {
      active: true,
      mode,
      accessibleOnly,
      targetName,
      distanceMeters: Number(totalLength.toFixed(1)),
      estimatedSeconds: Math.max(4, Math.round(totalLength / 1.25)),
      points: pts,
    };
  }

  public clearWayfinding() {
    this.wayfindingGroup.visible = false;
  }

  public resetCamera() {
    if (this.cameraMode === 'seat-preview') {
      this.focusSeatPov(this.primarySeatId, true);
    } else if (this.cameraMode === 'compare-seats') {
      this.camYawTarget = 0;
      this.camPitchTarget = 0;
    } else {
      this.setCameraMode('seat-map');
    }
  }

  public getUserZone(z: number): 'exterior' | 'lobby' | 'auditorium' {
    if (z > 36) return 'exterior';
    if (z > 14.8) return 'lobby';
    return 'auditorium';
  }

  // Floor height helper for continuous stair & corridor walking
  private getWalkableFloorHeight(x: number, z: number): number {
    if (z > 14.5) return 0.0; // Lobby & Exterior
    if (Math.abs(x) > 13.0) return 0.0; // Twin ground-level side corridors
    if (z < -14.0) return 0.0; // Front auditorium accessible floor
    if (z > 11.4) return 5.78; // Rear upper deck
    // Stadium riser slope matching Rows A-R
    const t = THREE.MathUtils.clamp((z - -13.6) / (11.1 - -13.6), 0, 1);
    return t * 5.78;
  }

  // Architectural collision bounds preventing walking through walls/screen
  private clampWalkPosition(x: number, z: number): { x: number; z: number } {
    let cx = THREE.MathUtils.clamp(x, -24, 24);
    let cz = THREE.MathUtils.clamp(z, -16.8, 60.0);

    if (cz < 14.2) {
      // Inside auditorium or side corridors
      if (Math.abs(cx) > 12.4 && Math.abs(cx) < 13.5) {
        // Auditorium side walls (allow passage at front doors Z = -16..-14.6)
        if (cz > -14.4) {
          cx = cx < 0 ? -12.2 : 12.2;
        }
      }
      if (Math.abs(cx) > 15.8) {
        cx = Math.sign(cx) * 15.8;
      }
    } else if (cz <= 36.2) {
      // Grand Lobby bounds
      cx = THREE.MathUtils.clamp(cx, -17.2, 17.2);
    }
    return { x: cx, z: cz };
  }

  // --- SMOOTH LIGHTING TRANSITION ENGINE ---

  private applyLightingImmediate() {
    this.currentLighting = { ...this.targetLighting };
    this.syncLightingToScene(this.currentLighting, 0);
  }

  private updateLighting(dt: number, elapsed: number) {
    const lambda = 4.2;
    const c = this.currentLighting;
    const t = this.targetLighting;

    c.ceilingLights = THREE.MathUtils.damp(c.ceilingLights, t.ceilingLights, lambda, dt);
    c.wallSlats = THREE.MathUtils.damp(c.wallSlats, t.wallSlats, lambda, dt);
    c.ledStrips = THREE.MathUtils.damp(c.ledStrips, t.ledStrips, lambda, dt);
    c.stairLights = THREE.MathUtils.damp(c.stairLights, t.stairLights, lambda, dt);
    c.aisleLights = THREE.MathUtils.damp(c.aisleLights, t.aisleLights, lambda, dt);
    c.seatLights = THREE.MathUtils.damp(c.seatLights, t.seatLights, lambda, dt);
    c.emergencyLights = THREE.MathUtils.damp(c.emergencyLights, t.emergencyLights, lambda, dt);
    c.exitSigns = THREE.MathUtils.damp(c.exitSigns, t.exitSigns, lambda, dt);
    c.screenBrightness = THREE.MathUtils.damp(c.screenBrightness, t.screenBrightness, lambda, dt);
    c.ambientLight = THREE.MathUtils.damp(c.ambientLight, t.ambientLight, lambda, dt);
    c.exposure = THREE.MathUtils.damp(c.exposure, t.exposure, lambda, dt);
    c.colorTemperature = THREE.MathUtils.damp(c.colorTemperature, t.colorTemperature, lambda, dt);
    c.exteriorLights = THREE.MathUtils.damp(c.exteriorLights, t.exteriorLights, lambda, dt);
    c.lobbyLights = THREE.MathUtils.damp(c.lobbyLights, t.lobbyLights, lambda, dt);
    c.accentColor = t.accentColor;
    c.exteriorDaytime = t.exteriorDaytime;

    this.syncLightingToScene(c, elapsed);
  }

  private syncLightingToScene(l: LightingSettings, elapsed: number) {
    const tempCol = kelvinToColor(l.colorTemperature, _color);
    _targetColor.set(l.accentColor);

    this.renderer.toneMappingExposure = l.exposure;
    this.hemiLight.intensity = 0.16 + l.ambientLight * 0.9;
    this.keyDirLight.intensity = l.exteriorDaytime ? 1.45 : 0.45 + l.exteriorLights * 0.5;

    // Sky / night exterior atmosphere transition (zero GC)
    _targetColor.set(l.exteriorDaytime ? '#7a9cc6' : '#06070a');
    (this.scene.background as THREE.Color).lerp(_targetColor, 0.08);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.scene.background as THREE.Color);
    }
    _targetColor.set(l.accentColor);

    for (const pl of this.audCeilingLights) {
      pl.intensity = l.ceilingLights * 36;
      pl.color.copy(tempCol);
    }

    for (const ll of this.lobbyLights) {
      ll.intensity = l.lobbyLights * 34;
      ll.color.copy(tempCol);
    }

    // Wall slats & architectural LEDs
    this.wallSlatGlowMat.emissive.copy(_targetColor).lerp(tempCol, 0.35);
    this.wallSlatGlowMat.emissiveIntensity = l.wallSlats * 2.6;
    this.ledStripMat.emissive.copy(_targetColor);
    this.ledStripMat.emissiveIntensity = l.ledStrips * 2.2;
    this.stairLightMat.emissiveIntensity = l.stairLights * 2.4;
    this.aisleLightMat.emissiveIntensity = l.aisleLights * 1.9;
    this.seatLedMat.emissiveIntensity = l.seatLights * 1.5;
    this.exitSignMat.emissiveIntensity = 0.5 + l.exitSigns * 1.8;
    this.exteriorGlowMat.emissiveIntensity = l.exteriorLights * 2.2;

    // Emergency gentle pulse only in emergency mode
    const emPulse = l.emergencyLights > 0.4 ? 0.65 + 0.35 * Math.sin(elapsed * 4.5) : 1;
    for (const el of this.emergencyLights) {
      el.intensity = l.emergencyLights * 24 * emPulse;
    }

    // Dynamic Cinema Screen Brightness & Room Illumination Bounce!
    this.screenMat.emissiveIntensity = l.screenBrightness * 1.25;
    const bounceMult = this.graphicsSettings.dynamicScreenGlow ? 1 : 0.25;
    this.screenLight.intensity = l.screenBrightness * 44 * bounceMult;
    this.screenLight.color.copy(this.screenReel.dominantColor);
    this.screenSpot.intensity = l.screenBrightness * 54 * bounceMult;
    this.screenSpot.color.copy(this.screenReel.dominantColor);
    this.projectorBeamMat.opacity = l.screenBrightness * (0.042 - l.ceilingLights * 0.024);
  }

  // --- EVENTS & INTERACTION ---

  private bindEvents() {
    const dom = this.renderer.domElement;
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    dom.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.compareCamera.aspect = (w * 0.5) / h;
    this.compareCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    this.keysPressed.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    this.audio.initIfNeeded();
    this.isDragging = true;
    this.pointerDownPos.x = e.clientX;
    this.pointerDownPos.y = e.clientY;
    this.lastPointerPos.x = e.clientX;
    this.lastPointerPos.y = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    const dx = e.clientX - this.lastPointerPos.x;
    const dy = e.clientY - this.lastPointerPos.y;
    this.lastPointerPos.x = e.clientX;
    this.lastPointerPos.y = e.clientY;

    if (this.isDragging) {
      if (
        this.cameraMode === 'seat-preview' ||
        this.cameraMode === 'compare-seats' ||
        this.cameraMode === 'free-walk' ||
        this.cameraMode === 'panorama'
      ) {
        this.lookOverrideActive = true;
        this.camYawTarget -= dx * 0.0046;
        this.camPitchTarget -= dy * 0.0042;
        if (this.cameraMode === 'seat-preview' || this.cameraMode === 'compare-seats') {
          // Comfortable seated neck turn limits
          this.camPitchTarget = THREE.MathUtils.clamp(this.camPitchTarget, -0.68, 0.85);
        } else {
          this.camPitchTarget = THREE.MathUtils.clamp(this.camPitchTarget, -1.25, 1.25);
        }
      } else if (this.cameraMode === 'overview') {
        // Gentle orbital drag around cinema exterior/complex
        const angle = -dx * 0.004;
        const offsetX = this.camPosTarget.x;
        const offsetZ = this.camPosTarget.z - 24;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        this.camPosTarget.x = offsetX * cos - offsetZ * sin;
        this.camPosTarget.z = offsetX * sin + offsetZ * cos + 24;
        this.camPosTarget.y = THREE.MathUtils.clamp(this.camPosTarget.y + dy * 0.08, 6, 42);
      }
      return;
    }

    // Throttled 3D seat hover raycasting
    const now = performance.now();
    if (now - this.lastHoverRaycast < 45) return;
    this.lastHoverRaycast = now;

    if (this.cameraMode === 'seat-preview' || this.cameraMode === 'free-walk' || this.cameraMode === 'panorama') {
      const hitId = this.pickSeatAt(e.clientX, e.clientY);
      if (hitId !== this.hoveredSeatId) {
        this.hoveredSeatId = hitId;
        this.updateSeatVisualStates();
        this.callbacks.onSeatHover(hitId);
        this.renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.isDragging = false;

    // Detect clean click (not a drag) for direct 3D seat selection!
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist < 6 && this.cameraMode !== 'compare-seats' && this.cameraMode !== 'drone-tour') {
      const hitId = this.pickSeatAt(e.clientX, e.clientY);
      if (hitId) {
        this.audio.playSeatClick();
        this.callbacks.onSeatClick(hitId);
      }
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.cameraMode === 'seat-preview' || this.cameraMode === 'panorama') {
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + e.deltaY * 0.025, 34, 76);
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'overview') {
      const zoomDir = e.deltaY > 0 ? 1.07 : 0.93;
      this.camPosTarget.multiplyScalar(zoomDir);
      this.camPosTarget.y = THREE.MathUtils.clamp(this.camPosTarget.y, 6, 48);
    }
  };

  private pickSeatAt(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hits = this.raycaster.intersectObject(this.seatHitMesh, false);
    if (hits.length > 0 && typeof hits[0].instanceId === 'number') {
      const seat = AUDITORIUM_SEATS[hits[0].instanceId];
      return seat ? seat.id : null;
    }
    return null;
  }

  // --- MAIN ANIMATION & RENDER LOOP ---

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 6);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 75);
      }
    };
    this.frameId = window.setTimeout(poll, 6);
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();

      this.updateFrame(dt, elapsed);
      this.renderFrame();

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private updateFrame(dt: number, elapsed: number) {
    // 1. Update procedural cinema preview reel on the 3D giant screen
    if (this.isMediaPlaying && !this.screenVideoEl) {
      this.reelTime += dt;
      this.screenReel.renderFrame(this.reelTime);
    }

    // 2. Smoothly interpolate architectural lighting & dynamic screen glow
    this.updateLighting(dt, elapsed);

    // 3. Animate wayfinding directional chevrons
    if (this.wayfindingGroup.visible) {
      for (const chev of this.wayfindingChevrons) {
        const base = (chev.userData.baseY as number) || 0.4;
        const phase = (chev.userData.phase as number) || 0;
        chev.position.y = base + Math.sin(elapsed * 4.2 - phase) * 0.07;
      }
    }

    // 4. Camera kinematics per active mode
    const dampSpeed = this.cameraMode === 'seat-preview' ? 4.4 : 5.2;

    if (this.cameraMode === 'drone-tour') {
      if (!this.tourPaused) {
        this.tourProgress += dt * 0.032; // ~31 seconds for full grand tour
        if (this.tourProgress >= 1) {
          this.tourProgress = 1;
          this.callbacks.onTourComplete();
          this.setCameraMode('seat-preview', this.primarySeatId);
          return;
        }
      }
      this.tourCurvePos.getPointAt(this.tourProgress, _v1);
      this.tourCurveLook.getPointAt(this.tourProgress, _v2);
      this.camera.position.lerp(_v1, 1 - Math.exp(-6 * dt));
      this.camLookCurrent.lerp(_v2, 1 - Math.exp(-6 * dt));
      this.camera.lookAt(this.camLookCurrent);

      const chapterIdx = Math.min(
        TOUR_WAYPOINTS.length - 1,
        Math.floor(this.tourProgress * TOUR_WAYPOINTS.length),
      );
      if (chapterIdx !== this.lastTourChapter) {
        this.lastTourChapter = chapterIdx;
        this.callbacks.onTourProgress(chapterIdx, TOUR_WAYPOINTS[chapterIdx].label, this.tourProgress);
      }
    } else if (this.cameraMode === 'free-walk') {
      this.camYaw = THREE.MathUtils.damp(this.camYaw, this.camYawTarget, 10, dt);
      this.camPitch = THREE.MathUtils.damp(this.camPitch, this.camPitchTarget, 10, dt);

      const forward =
        (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp') ? 1 : 0) -
        (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown') ? 1 : 0) +
        this.joystickVec.y;
      const strafe =
        (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight') ? 1 : 0) -
        (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft') ? 1 : 0) +
        this.joystickVec.x;

      if (Math.abs(forward) > 0.01 || Math.abs(strafe) > 0.01) {
        const sprint = this.keysPressed.has('ShiftLeft') || this.keysPressed.has('ShiftRight') ? 1.85 : 1.0;
        const speed = 4.2 * sprint * dt;
        const sinY = Math.sin(this.camYaw);
        const cosY = Math.cos(this.camYaw);
        const moveX = (-sinY * forward + cosY * strafe) * speed;
        const moveZ = (-cosY * forward - sinY * strafe) * speed;

        const next = this.clampWalkPosition(this.camPosTarget.x + moveX, this.camPosTarget.z + moveZ);
        this.camPosTarget.x = next.x;
        this.camPosTarget.z = next.z;

        this.walkStepDist += Math.hypot(moveX, moveZ);
        if (this.walkStepDist > 1.35) {
          this.walkStepDist = 0;
          this.audio.playFootstep(next.z > 14.5);
        }
      }

      const floorY = this.getWalkableFloorHeight(this.camPosTarget.x, this.camPosTarget.z);
      const eyeH = this.walkSeatedHeight ? 1.12 : 1.68;
      this.camPosTarget.y = floorY + eyeH;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.camPosTarget.x, 8, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.camPosTarget.y, 8, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.camPosTarget.z, 8, dt);

      _euler.set(this.camPitch, this.camYaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);
    } else if (this.cameraMode === 'seat-preview' || this.cameraMode === 'panorama') {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.camPosTarget.x, dampSpeed, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.camPosTarget.y, dampSpeed, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.camPosTarget.z, dampSpeed, dt);

      if (this.lookOverrideActive) {
        this.camYaw = THREE.MathUtils.damp(this.camYaw, this.camYawTarget, 9, dt);
        this.camPitch = THREE.MathUtils.damp(this.camPitch, this.camPitchTarget, 9, dt);
        _euler.set(this.camPitch, this.camYaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(_euler);
      } else {
        this.camLookCurrent.x = THREE.MathUtils.damp(this.camLookCurrent.x, this.camLookTarget.x, dampSpeed, dt);
        this.camLookCurrent.y = THREE.MathUtils.damp(this.camLookCurrent.y, this.camLookTarget.y, dampSpeed, dt);
        this.camLookCurrent.z = THREE.MathUtils.damp(this.camLookCurrent.z, this.camLookTarget.z, dampSpeed, dt);
        this.camera.lookAt(this.camLookCurrent);

        // Keep yaw/pitch synced so first drag starts seamlessly without jump!
        _euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
        this.camYaw = _euler.y;
        this.camPitch = _euler.x;
        this.camYawTarget = _euler.y;
        this.camPitchTarget = _euler.x;
      }
    } else if (this.cameraMode === 'compare-seats') {
      this.camYaw = THREE.MathUtils.damp(this.camYaw, this.camYawTarget, 9, dt);
      this.camPitch = THREE.MathUtils.damp(this.camPitch, this.camPitchTarget, 9, dt);
    } else {
      // 'seat-map' or 'overview'
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.camPosTarget.x, 4.2, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.camPosTarget.y, 4.2, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.camPosTarget.z, 4.2, dt);
      this.camLookCurrent.x = THREE.MathUtils.damp(this.camLookCurrent.x, this.camLookTarget.x, 4.2, dt);
      this.camLookCurrent.y = THREE.MathUtils.damp(this.camLookCurrent.y, this.camLookTarget.y, 4.2, dt);
      this.camLookCurrent.z = THREE.MathUtils.damp(this.camLookCurrent.z, this.camLookTarget.z, 4.2, dt);
      this.camera.lookAt(this.camLookCurrent);
    }

    // 5. Emit spatial zone & pose periodically for synchronized Floor Plan & Spatial Audio
    if (elapsed - this.lastPoseEmit > 0.14) {
      this.lastPoseEmit = elapsed;
      const zone = this.getUserZone(this.camera.position.z);
      this.audio.setZone(zone);
      this.camera.getWorldDirection(_v3);
      const yaw = Math.atan2(_v3.x, _v3.z);
      this.callbacks.onUserPoseChange(
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
        yaw,
        zone,
      );
    }
  }

  private renderFrame() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    if (this.cameraMode === 'compare-seats') {
      const seatA = AUDITORIUM_SEATS.find((s) => s.id === this.compareSeatIds[0]) || AUDITORIUM_SEATS[160];
      const seatB = AUDITORIUM_SEATS.find((s) => s.id === this.compareSeatIds[1]) || AUDITORIUM_SEATS[310];
      const halfW = Math.floor(w / 2);

      this.renderer.setScissorTest(true);

      // Left Viewport: Seat A
      this.renderer.setViewport(0, 0, halfW, h);
      this.renderer.setScissor(0, 0, halfW, h);
      this.positionCompareCamera(this.compareCamera, seatA, halfW / h);
      this.renderer.render(this.scene, this.compareCamera);

      // Right Viewport: Seat B
      this.renderer.setViewport(halfW, 0, w - halfW, h);
      this.renderer.setScissor(halfW, 0, w - halfW, h);
      this.positionCompareCamera(this.compareCamera, seatB, (w - halfW) / h);
      this.renderer.render(this.scene, this.compareCamera);

      this.renderer.setScissorTest(false);
    } else {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, w, h);
      this.renderer.render(this.scene, this.camera);
    }
  }

  private positionCompareCamera(cam: THREE.PerspectiveCamera, seat: SeatData, aspect: number) {
    cam.aspect = aspect;
    cam.fov = 56;
    cam.updateProjectionMatrix();
    cam.position.set(seat.x, seat.eyeY, seat.z - 0.04);

    // Base look toward screen center + shared user drag yaw/pitch offset
    const dx = SCREEN_CENTER.x - seat.x;
    const dy = SCREEN_CENTER.y - seat.eyeY;
    const dz = SCREEN_CENTER.z - seat.z;
    const baseYaw = Math.atan2(-dx, -dz);
    const basePitch = Math.atan2(dy, Math.hypot(dx, dz));
    _euler.set(
      THREE.MathUtils.clamp(basePitch + this.camPitch, -0.65, 0.8),
      baseYaw + this.camYaw,
      0,
      'YXZ',
    );
    cam.quaternion.setFromEuler(_euler);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);

    if (this.screenVideoEl) {
      this.screenVideoEl.pause();
      this.screenVideoEl.src = '';
    }
    this.screenVideoTex?.dispose();

    for (const d of this.disposables) {
      d.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
