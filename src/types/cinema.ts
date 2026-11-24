export type Language = 'en' | 'ar';
export type UiTheme = 'dark' | 'light';

export type SeatCategory = 'standard' | 'premium' | 'vip' | 'couple' | 'accessible';
export type SeatStatus = 'available' | 'reserved' | 'unavailable';

export interface SeatData {
  id: string;
  row: string;
  rowIndex: number;
  number: number;
  section: 'left' | 'center' | 'right';
  category: SeatCategory;
  price: number;
  status: SeatStatus;
  x: number;
  y: number;
  z: number;
  eyeY: number;
  distanceToScreen: number;
  horizontalAngleDeg: number;
  verticalAngleDeg: number;
  sightlineScore: number;
  nearestExitId: string;
  nearestExitDistance: number;
  isAccessible: boolean;
  isCompanion?: boolean;
}

export type CameraMode =
  | 'seat-map'
  | 'seat-preview'
  | 'compare-seats'
  | 'drone-tour'
  | 'free-walk'
  | 'panorama'
  | 'overview';

export type ActiveDrawer =
  | null
  | 'movies'
  | 'media'
  | 'lighting'
  | 'audience'
  | 'panorama'
  | 'floorplan'
  | 'concessions'
  | 'booking'
  | 'graphics'
  | 'audio'
  | 'vr'
  | 'ue5';

export type LightingPresetId =
  | 'full'
  | 'preshow'
  | 'movie'
  | 'intermission'
  | 'cleaning'
  | 'emergency'
  | 'custom';

export interface LightingSettings {
  preset: LightingPresetId;
  ceilingLights: number;      // 0..1
  wallSlats: number;          // 0..1
  ledStrips: number;          // 0..1
  stairLights: number;        // 0..1
  aisleLights: number;        // 0..1
  seatLights: number;         // 0..1
  emergencyLights: number;    // 0..1
  exitSigns: number;          // 0..1
  screenBrightness: number;   // 0..1.5
  ambientLight: number;       // 0..1
  exposure: number;           // 0.6..1.6
  colorTemperature: number;   // 2400..6500 K
  accentColor: string;        // hex
  exteriorLights: number;     // 0..1
  lobbyLights: number;        // 0..1
  exteriorDaytime: boolean;
}

export type GraphicsPresetId = 'low' | 'medium' | 'high' | 'ultra' | 'cinematic';

export interface GraphicsSettings {
  preset: GraphicsPresetId;
  resolutionScale: number;    // 0.6..2.0
  shadows: boolean;
  dynamicScreenGlow: boolean;
  reflectionsIntensity: number; // 0.2..1.5
  antiAliasing: boolean;
  characterDetail: 'low' | 'medium' | 'high';
  maxFps: number;
  streamingBitrateMbps: number;
}

export interface AudioSettings {
  masterVolume: number;
  movieVolume: number;
  environmentVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export type AudienceDensity = 0 | 25 | 50 | 75 | 100;

export interface MovieItem {
  id: string;
  title: string;
  titleAr: string;
  tagline: string;
  taglineAr: string;
  description: string;
  descriptionAr: string;
  genre: string;
  genreAr: string;
  durationMin: number;
  ageRating: string;
  language: string;
  subtitles: string[];
  posterUrl: string;
  accentColor: string;
  demoVideoUrl?: string;
  showtimes: {
    id: string;
    date: string;
    time: string;
    hall: string;
    format: string;
  }[];
}

export interface ConcessionItem {
  id: string;
  name: string;
  nameAr: string;
  category: 'popcorn' | 'drinks' | 'snacks' | 'coffee' | 'combos';
  description: string;
  descriptionAr: string;
  basePrice: number;
  sizes: { label: string; labelAr: string; priceDelta: number }[];
  imageUrl?: string;
  accentTone: string;
}

export interface CartItem {
  itemId: string;
  sizeIndex: number;
  quantity: number;
}

export interface PanoramaPoint {
  id: string;
  name: string;
  nameAr: string;
  zone: 'exterior' | 'lobby' | 'auditorium';
  position: [number, number, number];
  lookAt: [number, number, number];
}

export interface ExitLocation {
  id: string;
  name: string;
  nameAr: string;
  position: [number, number, number];
  accessible: boolean;
  zone: 'auditorium' | 'lobby' | 'exterior';
}

export interface MediaPlaybackState {
  sourceType: 'demo-reel' | 'youtube' | 'direct-video';
  sourceUrl: string;
  youtubeId: string | null;
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  quality: string;
  fullscreenOverlay: boolean;
}

export interface WayfindingState {
  active: boolean;
  mode: 'exit' | 'seat';
  accessibleOnly: boolean;
  targetName: string;
  distanceMeters: number;
  estimatedSeconds: number;
  points: [number, number, number][];
}

export interface PixelStreamingConfig {
  signalingUrl: string;
  status: 'preview-webgl' | 'connecting' | 'connected' | 'error';
  lastMessage: string;
}

export interface BookingConfirmation {
  bookingCode: string;
  movieTitle: string;
  date: string;
  time: string;
  hall: string;
  seatIds: string[];
  concessionsCount: number;
  totalPrice: number;
  createdAt: string;
}
