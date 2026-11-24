import React, { useState } from 'react';
import {
  Compass,
  Cpu,
  Glasses,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sliders,
  Sun,
  Trash2,
  Upload,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Youtube,
  Maximize2,
} from 'lucide-react';
import {
  GRAPHICS_PRESETS,
  LIGHTING_PRESETS,
  PANORAMA_POINTS,
  TRANSLATIONS,
} from '../data/cinemaData';
import { pixelStreamingBridge } from '../engine/pixelStreamingBridge';
import {
  ActiveDrawer,
  AudienceDensity,
  AudioSettings,
  GraphicsPresetId,
  GraphicsSettings,
  Language,
  LightingPresetId,
  LightingSettings,
  MediaPlaybackState,
  PixelStreamingConfig,
} from '../types/cinema';

interface ControlDrawersProps {
  lang: Language;
  activeDrawer: ActiveDrawer;
  lighting: LightingSettings;
  audienceDensity: AudienceDensity;
  media: MediaPlaybackState;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  streaming: PixelStreamingConfig;
  onClose: () => void;
  onApplyLightingPreset: (preset: LightingPresetId) => void;
  onUpdateLighting: (patch: Partial<LightingSettings>) => void;
  onSetAudienceDensity: (d: AudienceDensity) => void;
  onGoToPanorama: (id: string) => void;
  onLoadYouTube: (url: string) => void;
  onLoadDirectVideo: (url: string, label: string) => void;
  onMediaControl: (action: 'play' | 'pause' | 'restart' | 'seek' | 'clear' | 'fullscreen', val?: number) => void;
  onMediaVolume: (vol: number, muted: boolean) => void;
  onApplyGraphicsPreset: (preset: GraphicsPresetId) => void;
  onUpdateGraphics: (patch: Partial<GraphicsSettings>) => void;
  onUpdateAudio: (patch: Partial<AudioSettings>) => void;
}

const ACCENT_SWATCHES = ['#f2c179', '#f8fafc', '#60a5fa', '#fb923c', '#f472b6', '#ef4444'];

export const ControlDrawers: React.FC<ControlDrawersProps> = ({
  lang,
  activeDrawer,
  lighting,
  audienceDensity,
  media,
  graphics,
  audio,
  streaming,
  onClose,
  onApplyLightingPreset,
  onUpdateLighting,
  onSetAudienceDensity,
  onGoToPanorama,
  onLoadYouTube,
  onLoadDirectVideo,
  onMediaControl,
  onMediaVolume,
  onApplyGraphicsPreset,
  onUpdateGraphics,
  onUpdateAudio,
}) => {
  const t = TRANSLATIONS[lang];
  const [urlInput, setUrlInput] = useState(media.sourceUrl || '');
  const [mp4Input, setMp4Input] = useState('');
  const [signalUrl, setSignalUrl] = useState(streaming.signalingUrl);
  const [vrMessage, setVrMessage] = useState<string | null>(null);

  if (
    !activeDrawer ||
    activeDrawer === 'movies' ||
    activeDrawer === 'concessions' ||
    activeDrawer === 'booking' ||
    activeDrawer === 'floorplan'
  ) {
    return null;
  }

  const handleCheckVR = async () => {
    const nav = navigator as Navigator & { xr?: { isSessionSupported: (mode: string) => Promise<boolean> } };
    if (!nav.xr) {
      setVrMessage(
        lang === 'ar'
          ? 'هذا المتصفح لا يدعم WebXR حالياً. يتوفر دعم OpenXR الكامل في نسخة Unreal Engine 5 المرفقة في مجلد /ue5.'
          : 'WebXR headset runtime not detected in this browser. Full OpenXR VR support is configured in the included Unreal Engine 5 project (/ue5).',
      );
      return;
    }
    try {
      const supported = await nav.xr.isSessionSupported('immersive-vr');
      if (supported) {
        setVrMessage('WebXR immersive-vr headset detected and ready to launch.');
      } else {
        setVrMessage(
          'No connected VR headset detected. Standard desktop & 360° navigation remain active; OpenXR is configured for native UE5 deployment.',
        );
      }
    } catch {
      setVrMessage('VR runtime check unavailable in embedded preview iframe.');
    }
  };

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    onLoadDirectVideo(blobUrl, file.name);
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 w-[min(720px,94vw)] pointer-events-auto">
      <div className="rounded-2xl border border-neutral-200 dark:border-white/12 bg-white/95 dark:bg-[#0c0d12]/95 text-neutral-900 dark:text-neutral-100 shadow-2xl overflow-hidden max-h-[58vh] flex flex-col">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {activeDrawer === 'lighting' && <Sun className="w-4 h-4 text-amber-500" />}
            {activeDrawer === 'media' && <Youtube className="w-4 h-4 text-red-500" />}
            {activeDrawer === 'audience' && <Users className="w-4 h-4 text-blue-500" />}
            {activeDrawer === 'panorama' && <Compass className="w-4 h-4 text-amber-500" />}
            {activeDrawer === 'graphics' && <Sliders className="w-4 h-4 text-emerald-500" />}
            {activeDrawer === 'audio' && <Volume2 className="w-4 h-4 text-sky-500" />}
            {activeDrawer === 'vr' && <Glasses className="w-4 h-4 text-violet-500" />}
            {activeDrawer === 'ue5' && <Cpu className="w-4 h-4 text-amber-500" />}
            <span>
              {activeDrawer === 'lighting' && (lang === 'ar' ? 'نظام الإضاءة المعمارية الديناميكي' : 'Dynamic Architectural Lighting')}
              {activeDrawer === 'media' && (lang === 'ar' ? 'شاشة السينما وتشغيل يوتيوب والفيديو' : 'Cinema Screen · YouTube & Media Player')}
              {activeDrawer === 'audience' && (lang === 'ar' ? 'محاكاة كثافة الجمهور وزوايا الرؤية' : 'Audience Simulation & Occupancy')}
              {activeDrawer === 'panorama' && (lang === 'ar' ? 'نقاط الاستكشاف البانورامي 360°' : '360° Panoramic Viewpoints (14 Locations)')}
              {activeDrawer === 'graphics' && (lang === 'ar' ? 'إعدادات الجودة الرسومية والأداء' : 'Graphics Quality & Rendering Scalability')}
              {activeDrawer === 'audio' && (lang === 'ar' ? 'الصوت المكاني وأجواء السينما' : 'Spatial Audio & Cinema Atmosphere')}
              {activeDrawer === 'vr' && (lang === 'ar' ? 'الواقع الافتراضي OpenXR / WebXR' : 'Virtual Reality (OpenXR & WebXR)')}
              {activeDrawer === 'ue5' && (lang === 'ar' ? 'بنية Unreal Engine 5 وبث Pixel Streaming' : 'Unreal Engine 5 Architecture & Pixel Streaming')}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-4 overflow-y-auto cinema-scroll space-y-4 text-xs">
          {/* LIGHTING STUDIO */}
          {activeDrawer === 'lighting' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(LIGHTING_PRESETS) as LightingPresetId[]).map((pid) => (
                  <button
                    key={pid}
                    onClick={() => onApplyLightingPreset(pid)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-colors ${
                      lighting.preset === pid
                        ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-amber-400 dark:text-neutral-950 dark:border-amber-400'
                        : 'border-neutral-300 dark:border-white/15 hover:border-amber-400'
                    }`}
                  >
                    {pid === 'preshow' ? 'Pre-Show' : pid === 'full' ? 'Full Lights' : pid}
                  </button>
                ))}
                <button
                  onClick={() => onUpdateLighting({ exteriorDaytime: !lighting.exteriorDaytime, preset: 'custom' })}
                  className="px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium"
                >
                  {lighting.exteriorDaytime ? 'Exterior: Day' : 'Exterior: Night'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
                {[
                  { key: 'ceilingLights', label: 'Ceiling Lights', min: 0, max: 1, step: 0.05 },
                  { key: 'wallSlats', label: 'Architectural Wall Slats', min: 0, max: 1, step: 0.05 },
                  { key: 'ledStrips', label: 'Cove LED Strips', min: 0, max: 1, step: 0.05 },
                  { key: 'stairLights', label: 'Staircase Nosing Lights', min: 0, max: 1, step: 0.05 },
                  { key: 'aisleLights', label: 'Aisle Footwell Lights', min: 0, max: 1, step: 0.05 },
                  { key: 'seatLights', label: 'Seat Accent Lighting', min: 0, max: 1, step: 0.05 },
                  { key: 'emergencyLights', label: 'Emergency Lighting', min: 0, max: 1, step: 0.05 },
                  { key: 'exitSigns', label: 'Exit Signs Intensity', min: 0, max: 1, step: 0.05 },
                  { key: 'screenBrightness', label: 'Screen Illumination', min: 0.1, max: 1.5, step: 0.05 },
                  { key: 'ambientLight', label: 'Ambient Fill', min: 0, max: 1, step: 0.05 },
                  { key: 'exposure', label: 'Camera Exposure', min: 0.6, max: 1.6, step: 0.04 },
                  { key: 'colorTemperature', label: 'Color Temp (K)', min: 2400, max: 6500, step: 100 },
                  { key: 'lobbyLights', label: 'Grand Lobby Lights', min: 0, max: 1, step: 0.05 },
                  { key: 'exteriorLights', label: 'Exterior Facade Lights', min: 0, max: 1, step: 0.05 },
                ].map((ctrl) => {
                  const val = lighting[ctrl.key as keyof LightingSettings] as number;
                  return (
                    <label key={ctrl.key} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[11px] text-neutral-600 dark:text-neutral-300 tabular-nums">
                        <span>{ctrl.label}</span>
                        <span className="font-mono-tabular">
                          {ctrl.key === 'colorTemperature' ? `${Math.round(val)}K` : `${Math.round(val * 100)}%`}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="cinema-slider w-full"
                        min={ctrl.min}
                        max={ctrl.max}
                        step={ctrl.step}
                        value={val}
                        onChange={(e) =>
                          onUpdateLighting({
                            [ctrl.key]: Number(e.target.value),
                            preset: 'custom',
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-white/10">
                <span className="text-[11px] text-neutral-500">Architectural Wall Accent Hue</span>
                <div className="flex items-center gap-2">
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => onUpdateLighting({ accentColor: hex, preset: 'custom' })}
                      className={`w-5 h-5 rounded-full border-2 ${
                        lighting.accentColor === hex ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* YOUTUBE & CINEMA SCREEN CONTROLS */}
          {activeDrawer === 'media' && (
            <div className="space-y-4">
              {/* YouTube URL Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium">YouTube Video URL (Official IFrame Embed)</span>
                  <span className="text-[11px] text-neutral-500">youtube.com · youtu.be · embed</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-black/40 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => onLoadYouTube(urlInput)}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors whitespace-nowrap"
                  >
                    Load YouTube
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Respects YouTube official IFrame embedding &amp; CORS policies: YouTube playback opens in a cinema-framed synced player overlay; direct MP4 &amp; local uploads render natively onto the curved 3D auditorium screen with real-time screen glow.
                </p>
              </div>

              {/* Direct MP4 URL & Local Video File Upload (Direct 3D Screen Texture!) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-200 dark:border-white/10">
                <div className="space-y-1.5">
                  <span className="font-medium block">Direct MP4 URL (3D Screen Texture)</span>
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      placeholder="https://.../video.mp4"
                      value={mp4Input}
                      onChange={(e) => setMp4Input(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-black/40"
                    />
                    <button
                      onClick={() => mp4Input.trim() && onLoadDirectVideo(mp4Input.trim(), 'Direct MP4 Stream')}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-medium whitespace-nowrap"
                    >
                      Project
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-medium block">Local Video File (3D Screen Texture)</span>
                  <label className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-500/15 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload MP4 / WebM to 3D Screen</span>
                    <input type="file" accept="video/mp4,video/webm" onChange={handleLocalFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Playback Transport Bar */}
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-white/5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onMediaControl(media.isPlaying ? 'pause' : 'play')}
                    className="p-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                    title={media.isPlaying ? 'Pause' : 'Play'}
                  >
                    {media.isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => onMediaControl('restart')}
                    className="p-2 rounded-lg border border-neutral-300 dark:border-white/15 hover:bg-white/10"
                    title="Restart"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onMediaControl('seek', -10)}
                    className="p-2 rounded-lg border border-neutral-300 dark:border-white/15 hover:bg-white/10"
                    title="Seek -10s"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onMediaControl('seek', 10)}
                    className="p-2 rounded-lg border border-neutral-300 dark:border-white/15 hover:bg-white/10"
                    title="Seek +10s"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onMediaControl('fullscreen')}
                    className="p-2 rounded-lg border border-neutral-300 dark:border-white/15 hover:bg-white/10"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onMediaControl('clear')}
                    className="p-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10"
                    title="Clear Video & Restore Demo Reel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 min-w-[160px]">
                  <button onClick={() => onMediaVolume(media.volume, !media.muted)}>
                    {media.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    className="cinema-slider w-24"
                    min={0}
                    max={1}
                    step={0.05}
                    value={media.volume}
                    onChange={(e) => onMediaVolume(Number(e.target.value), false)}
                  />
                  <span className="text-[11px] text-neutral-500 truncate max-w-[140px]">{media.title}</span>
                </div>
              </div>
            </div>
          )}

          {/* AUDIENCE SIMULATION */}
          {activeDrawer === 'audience' && (
            <div className="space-y-3">
              <p className="text-neutral-500 dark:text-neutral-400">
                Populate auditorium seats with scaled audience silhouettes to evaluate realistic head clearance and sightlines from your selected seat.
              </p>
              <div className="grid grid-cols-5 gap-2">
                {([0, 25, 50, 75, 100] as AudienceDensity[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => onSetAudienceDensity(d)}
                    className={`py-2.5 px-2 rounded-xl border text-center font-medium tabular-nums transition-colors ${
                      audienceDensity === d
                        ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-amber-400 dark:text-neutral-950 dark:border-amber-400'
                        : 'border-neutral-300 dark:border-white/15 hover:border-amber-400'
                    }`}
                  >
                    {d === 0 ? 'Empty' : d === 100 ? 'Full' : `${d}%`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 360° PANORAMIC VIEWPOINTS */}
          {activeDrawer === 'panorama' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PANORAMA_POINTS.map((pt) => (
                <button
                  key={pt.id}
                  onClick={() => {
                    onGoToPanorama(pt.id);
                    onClose();
                  }}
                  className="text-start px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 hover:border-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <div className="font-medium truncate">{lang === 'ar' ? pt.nameAr : pt.name}</div>
                  <div className="text-[10px] text-neutral-500 capitalize">{pt.zone}</div>
                </button>
              ))}
            </div>
          )}

          {/* GRAPHICS SETTINGS */}
          {activeDrawer === 'graphics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(GRAPHICS_PRESETS) as GraphicsPresetId[]).map((gp) => (
                  <button
                    key={gp}
                    onClick={() => onApplyGraphicsPreset(gp)}
                    className={`py-2 rounded-lg border font-medium capitalize transition-colors ${
                      graphics.preset === gp
                        ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-amber-400 dark:text-neutral-950 dark:border-amber-400'
                        : 'border-neutral-300 dark:border-white/15 hover:border-amber-400'
                    }`}
                  >
                    {gp}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1">
                  <div className="flex justify-between tabular-nums">
                    <span>Render Resolution Scale</span>
                    <span className="font-mono-tabular">{Math.round(graphics.resolutionScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="cinema-slider w-full"
                    min={0.6}
                    max={2.0}
                    step={0.1}
                    value={graphics.resolutionScale}
                    onChange={(e) => onUpdateGraphics({ resolutionScale: Number(e.target.value) })}
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between tabular-nums">
                    <span>Environment Reflections</span>
                    <span className="font-mono-tabular">{Math.round(graphics.reflectionsIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="cinema-slider w-full"
                    min={0.2}
                    max={1.5}
                    step={0.05}
                    value={graphics.reflectionsIntensity}
                    onChange={(e) => onUpdateGraphics({ reflectionsIntensity: Number(e.target.value) })}
                  />
                </label>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 dark:border-white/10">
                  <span>Real-Time Shadows</span>
                  <input
                    type="checkbox"
                    checked={graphics.shadows}
                    onChange={(e) => onUpdateGraphics({ shadows: e.target.checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 dark:border-white/10">
                  <span>Dynamic Screen Room Bounce</span>
                  <input
                    type="checkbox"
                    checked={graphics.dynamicScreenGlow}
                    onChange={(e) => onUpdateGraphics({ dynamicScreenGlow: e.target.checked })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SPATIAL AUDIO MIXER */}
          {activeDrawer === 'audio' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">
                  Procedural Web Audio spatial ambience shifts naturally between Exterior, Lobby, and Auditorium.
                </span>
                <button
                  onClick={() => onUpdateAudio({ muted: !audio.muted })}
                  className={`px-3 py-1 rounded-lg border font-medium ${
                    audio.muted ? 'border-red-500 text-red-500' : 'border-neutral-300 dark:border-white/15'
                  }`}
                >
                  {audio.muted ? 'Unmute' : 'Mute All'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { key: 'masterVolume', label: 'Master Volume' },
                  { key: 'movieVolume', label: 'Movie & Screen Audio' },
                  { key: 'environmentVolume', label: 'Spatial Room Ambience' },
                  { key: 'musicVolume', label: 'Cinema Atmospheric Score' },
                  { key: 'sfxVolume', label: 'Footsteps & Seat SFX' },
                ].map((ch) => (
                  <label key={ch.key} className="space-y-1">
                    <div className="flex justify-between tabular-nums">
                      <span>{ch.label}</span>
                      <span className="font-mono-tabular">{Math.round((audio[ch.key as keyof AudioSettings] as number) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      className="cinema-slider w-full"
                      min={0}
                      max={1}
                      step={0.05}
                      value={audio[ch.key as keyof AudioSettings] as number}
                      onChange={(e) => onUpdateAudio({ [ch.key]: Number(e.target.value), muted: false })}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* VR MODE */}
          {activeDrawer === 'vr' && (
            <div className="space-y-3">
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Immersive VR uses OpenXR inside the native Unreal Engine 5 project (supporting head tracking, teleportation, seated cinema viewing, and controller interaction). In browser preview mode, compatible WebXR headsets can be checked below.
              </p>
              <button
                onClick={handleCheckVR}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold"
              >
                Check Connected WebXR Headset
              </button>
              {vrMessage && (
                <div className="p-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-300">
                  {vrMessage}
                </div>
              )}
            </div>
          )}

          {/* UE5 ARCHITECTURE & PIXEL STREAMING HUB */}
          {activeDrawer === 'ue5' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                <strong>Runtime Transparency:</strong> This browser viewport runs a real-time <strong>Three.js WebGL preview</strong>. Nanite, Lumen, and Hardware Ray Tracing require a native Unreal Engine 5 GPU host connected via Pixel Streaming below.
              </div>

              <div className="space-y-1.5">
                <span className="font-medium block">UE5 Pixel Streaming Cirrus Signaling Server URL</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={signalUrl}
                    onChange={(e) => setSignalUrl(e.target.value)}
                    placeholder="ws://localhost:80"
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-black/40 font-mono-tabular"
                  />
                  {streaming.status === 'connected' ? (
                    <button
                      onClick={() => pixelStreamingBridge.disconnect()}
                      className="px-3.5 py-2 rounded-lg bg-red-600 text-white font-semibold"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => pixelStreamingBridge.connect(signalUrl)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold whitespace-nowrap"
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      Connect UE5
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{streaming.lastMessage}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                  <div className="font-semibold mb-1">Included UE5 Project Scaffold (/ue5)</div>
                  <ul className="space-y-0.5 text-neutral-500 dark:text-neutral-400 font-mono-tabular">
                    <li>ImmersiveCinema5.uproject</li>
                    <li>Config/DefaultEngine.ini (Lumen + Nanite + OpenXR)</li>
                    <li>Source/CinemaSeatManager.h/.cpp (352 seats)</li>
                    <li>Source/CinemaLightingController.h/.cpp</li>
                    <li>Source/PixelStreamingBridge.h/.cpp</li>
                    <li>Scripts/build_cinema_environment.py</li>
                    <li>ASSET_MANIFEST.json &amp; DEPLOYMENT.md</li>
                  </ul>
                </div>
                <div className="p-2.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02]">
                  <div className="font-semibold mb-1">Live UE5 emitUIInteraction Commands</div>
                  <div className="space-y-1 max-h-28 overflow-y-auto cinema-scroll font-mono-tabular text-[10px] text-neutral-500 dark:text-neutral-400">
                    {pixelStreamingBridge.getRecentEvents().length === 0 ? (
                      <div>Interact with seats or lighting to inspect serialized UE5 commands.</div>
                    ) : (
                      pixelStreamingBridge
                        .getRecentEvents()
                        .slice()
                        .reverse()
                        .map((ev, i) => (
                          <div key={i} className="truncate">
                            {ev.type}: {JSON.stringify(ev.payload)}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
