import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  Compass,
  Cpu,
  Eye,
  Film,
  Footprints,
  Glasses,
  Grid2X2,
  Languages,
  Map,
  Maximize,
  Minimize,
  Moon,
  Navigation,
  Pause,
  Play,
  Popcorn,
  RotateCcw,
  SkipForward,
  Sliders,
  Sun,
  Ticket,
  Users,
  Video,
  Volume2,
  X,
  Youtube,
  AlertTriangle,
} from 'lucide-react';
import {
  AUDITORIUM_SEATS,
  CONCESSION_ITEMS,
  DEMO_MOVIES,
  GRAPHICS_PRESETS,
  LIGHTING_PRESETS,
  TRANSLATIONS,
} from './data/cinemaData';
import { CinemaEngine } from './engine/cinemaScene';
import { pixelStreamingBridge } from './engine/pixelStreamingBridge';
import { CinemaSpatialAudio } from './engine/spatialAudio';
import {
  ActiveDrawer,
  AudienceDensity,
  AudioSettings,
  BookingConfirmation,
  CameraMode,
  CartItem,
  GraphicsPresetId,
  GraphicsSettings,
  Language,
  LightingPresetId,
  LightingSettings,
  MediaPlaybackState,
  MovieItem,
  PixelStreamingConfig,
  SeatData,
  UiTheme,
  WayfindingState,
} from './types/cinema';
import { BookingFlowModal } from './components/BookingFlowModal';
import { ControlDrawers } from './components/ControlDrawers';
import { FloorPlanModal } from './components/FloorPlanModal';
import { MiniSeatBar } from './components/MiniSeatBar';
import { SeatMapOverlay } from './components/SeatMapOverlay';
import { VirtualJoystick } from './components/VirtualJoystick';

function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CinemaEngine | null>(null);
  const audioRef = useRef<CinemaSpatialAudio | null>(null);

  // Core App & UX state
  const [lang, setLang] = useState<Language>('en');
  const [uiTheme, setUiTheme] = useState<UiTheme>('dark');
  const [dockVisible, setDockVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cinema & Booking state
  const [selectedMovie, setSelectedMovie] = useState<MovieItem>(DEMO_MOVIES[0]);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState<string>(DEMO_MOVIES[0].showtimes[1].id);
  const [ticketCount, setTicketCount] = useState<number>(2);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(['J10', 'J11']);
  const [primarySeatId, setPrimarySeatId] = useState<string>('J10');
  const [compareSeatIds, setCompareSeatIds] = useState<[string, string]>(['J10', 'P6']);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastBooking, setLastBooking] = useState<BookingConfirmation | null>(null);

  // Camera & Exploration state
  const [cameraMode, setCameraMode] = useState<CameraMode>('seat-map');
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);
  const [walkSeated, setWalkSeated] = useState(false);
  const [hovered3dSeatId, setHovered3dSeatId] = useState<string | null>(null);
  const [userPose, setUserPose] = useState<{
    x: number;
    y: number;
    z: number;
    yaw: number;
    zone: 'exterior' | 'lobby' | 'auditorium';
  }>({ x: 0, y: 26, z: 2, yaw: 0, zone: 'auditorium' });

  // Drone Tour state
  const [tourPaused, setTourPaused] = useState(false);
  const [tourCaption, setTourCaption] = useState('01 · Aerial Architectural Exterior');
  const [tourProgress, setTourProgress] = useState(0);

  // Lighting, Audience, Media, Graphics, Audio, Wayfinding, Pixel Streaming
  const [lighting, setLighting] = useState<LightingSettings>({ ...LIGHTING_PRESETS.preshow });
  const [audienceDensity, setAudienceDensity] = useState<AudienceDensity>(0);
  const [graphics, setGraphics] = useState<GraphicsSettings>({ ...GRAPHICS_PRESETS.high });
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    masterVolume: 0.55,
    movieVolume: 0.75,
    environmentVolume: 0.45,
    musicVolume: 0.3,
    sfxVolume: 0.65,
    muted: false,
  });
  const [media, setMedia] = useState<MediaPlaybackState>({
    sourceType: 'demo-reel',
    sourceUrl: '',
    youtubeId: null,
    title: 'Chronos Horizon · Theatrical Preview Reel',
    isPlaying: true,
    currentTime: 0,
    duration: 120,
    volume: 0.75,
    muted: false,
    quality: '4K Laser',
    fullscreenOverlay: false,
  });
  const [wayfinding, setWayfinding] = useState<WayfindingState>({
    active: false,
    mode: 'exit',
    accessibleOnly: false,
    targetName: '',
    distanceMeters: 0,
    estimatedSeconds: 0,
    points: [],
  });
  const [streaming, setStreaming] = useState<PixelStreamingConfig>(pixelStreamingBridge.getConfig());

  const t = TRANSLATIONS[lang];

  // Sync HTML direction & theme without touching 3D physical cinema lighting
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (uiTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [uiTheme]);

  // Subscribe to UE5 Pixel Streaming bridge updates
  useEffect(() => {
    return pixelStreamingBridge.subscribe(setStreaming);
  }, []);

  // Keyboard shortcuts (`H` to hide/show controls, `Escape` to close drawer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') setDockVisible((v) => !v);
      if (e.key === 'Escape') setActiveDrawer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Keep latest callbacks ref for stable Three.js WebGL mount
  const seatClickHandlerRef = useRef<(seatId: string) => void>(() => {});

  const handleSeatSelection = useCallback(
    (seat: SeatData) => {
      if (seat.status !== 'available') return;
      audioRef.current?.initIfNeeded();
      audioRef.current?.playSeatClick();

      // Smart adjacent group selection when clicking in seat-map mode
      if (ticketCount > 1) {
        const sameRow = AUDITORIUM_SEATS.filter(
          (s) => s.row === seat.row && s.section === seat.section && s.status === 'available',
        ).sort((a, b) => a.number - b.number);
        const idx = sameRow.findIndex((s) => s.id === seat.id);
        if (idx >= 0) {
          const slice = sameRow.slice(idx, idx + ticketCount);
          const group = slice.length === ticketCount ? slice : sameRow.slice(Math.max(0, sameRow.length - ticketCount));
          const ids = group.map((g) => g.id);
          setSelectedSeatIds(ids);
          setPrimarySeatId(ids[0]);
          pixelStreamingBridge.emitUIInteraction('SelectSeat', { seatIds: ids, primary: ids[0] });
          return;
        }
      }

      setSelectedSeatIds((prev) => {
        const exists = prev.includes(seat.id);
        const next = exists ? prev.filter((id) => id !== seat.id) : [...prev.slice(-(ticketCount - 1)), seat.id];
        if (next.length > 0) setPrimarySeatId(seat.id);
        pixelStreamingBridge.emitUIInteraction('SelectSeat', { seatIds: next, primary: seat.id });
        return next;
      });
    },
    [ticketCount],
  );

  seatClickHandlerRef.current = (seatId: string) => {
    const seat = AUDITORIUM_SEATS.find((s) => s.id === seatId);
    if (!seat) return;
    if (cameraMode === 'seat-preview' || cameraMode === 'free-walk' || cameraMode === 'panorama') {
      setPrimarySeatId(seat.id);
      if (seat.status === 'available' && !selectedSeatIds.includes(seat.id)) {
        handleSeatSelection(seat);
      }
      engineRef.current?.setCameraMode('seat-preview', seat.id);
      setCameraMode('seat-preview');
    } else {
      handleSeatSelection(seat);
    }
  };

  // Mount Three.js CinemaEngine ONCE
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const spatialAudio = new CinemaSpatialAudio();
    audioRef.current = spatialAudio;

    const engine = new CinemaEngine(mount, spatialAudio, {
      onSeatClick: (seatId) => seatClickHandlerRef.current(seatId),
      onSeatHover: (seatId) => setHovered3dSeatId(seatId),
      onTourProgress: (_idx, label, prog) => {
        setTourCaption(label);
        setTourProgress(prog);
      },
      onTourComplete: () => {
        setCameraMode('seat-preview');
      },
      onUserPoseChange: (x, y, z, yaw, zone) => {
        setUserPose({ x, y, z, yaw, zone });
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      spatialAudio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, []);

  // Synchronize React state -> Three.js Engine
  useEffect(() => {
    engineRef.current?.setSelectedSeats(selectedSeatIds, primarySeatId);
  }, [selectedSeatIds, primarySeatId]);

  useEffect(() => {
    engineRef.current?.setCompareSeats(compareSeatIds[0], compareSeatIds[1]);
  }, [compareSeatIds]);

  useEffect(() => {
    engineRef.current?.setLighting(lighting);
  }, [lighting]);

  useEffect(() => {
    engineRef.current?.setAudienceDensity(audienceDensity);
  }, [audienceDensity]);

  useEffect(() => {
    engineRef.current?.setGraphics(graphics);
  }, [graphics]);

  useEffect(() => {
    audioRef.current?.applySettings(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    engineRef.current?.setMovieReelInfo(selectedMovie.title, selectedMovie.tagline, selectedMovie.accentColor);
  }, [selectedMovie]);

  // Helper actions
  const switchCameraMode = (mode: CameraMode, seatOverride?: string) => {
    audioRef.current?.initIfNeeded();
    setActiveDrawer(null);
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode, seatOverride || primarySeatId);

    if (mode === 'seat-preview') {
      pixelStreamingBridge.emitUIInteraction('PreviewSeat', { seatId: seatOverride || primarySeatId });
    } else if (mode === 'drone-tour') {
      setTourPaused(false);
      pixelStreamingBridge.emitUIInteraction('StartTour', { autoplay: true });
    } else if (mode === 'compare-seats') {
      pixelStreamingBridge.emitUIInteraction('CompareSeats', { seats: compareSeatIds });
    }
  };

  const handleRecommendBestSeats = () => {
    // Pick highest-sightline adjacent available seats in center premium block
    const candidates = AUDITORIUM_SEATS.filter(
      (s) => s.section === 'center' && s.status === 'available' && s.rowIndex >= 7 && s.rowIndex <= 12,
    ).sort((a, b) => b.sightlineScore - a.sightlineScore);

    for (const anchor of candidates) {
      const sameRow = AUDITORIUM_SEATS.filter(
        (s) => s.row === anchor.row && s.section === 'center' && s.status === 'available',
      ).sort((a, b) => a.number - b.number);
      const start = sameRow.findIndex((s) => s.id === anchor.id);
      if (start >= 0 && start + ticketCount <= sameRow.length) {
        const block = sameRow.slice(start, start + ticketCount);
        // Verify consecutive seat numbers
        let contiguous = true;
        for (let i = 1; i < block.length; i++) {
          if (block[i].number !== block[i - 1].number + 1) contiguous = false;
        }
        if (contiguous) {
          const ids = block.map((b) => b.id);
          setSelectedSeatIds(ids);
          setPrimarySeatId(ids[0]);
          audioRef.current?.playSeatClick();
          return;
        }
      }
    }
  };

  const handleFindNearestExit = (accessibleOnly = false) => {
    if (!engineRef.current) return;
    const wf = engineRef.current.computeWayfinding('exit', accessibleOnly, primarySeatId);
    setWayfinding(wf);
    if (cameraMode === 'seat-map') {
      switchCameraMode('seat-preview');
    }
    pixelStreamingBridge.emitUIInteraction('FindNearestExit', { accessibleOnly, target: wf.targetName });
  };

  const handleGuideEntranceToSeat = () => {
    if (!engineRef.current) return;
    const wf = engineRef.current.computeWayfinding('seat', true, primarySeatId);
    setWayfinding(wf);
    engineRef.current.teleportToFloorPoint(0, 35.2);
    setCameraMode('free-walk');
  };

  const handleLoadYouTube = (url: string) => {
    const id = extractYouTubeId(url);
    if (!id) return;
    setMedia((prev) => ({
      ...prev,
      sourceType: 'youtube',
      sourceUrl: url,
      youtubeId: id,
      title: `YouTube · ${id}`,
      isPlaying: true,
      fullscreenOverlay: true,
    }));
    // Automatically dim lights subtly to Movie Mode for authentic theater feel
    setLighting({ ...LIGHTING_PRESETS.movie });
    pixelStreamingBridge.emitUIInteraction('MediaCommand', { source: 'youtube', youtubeId: id });
  };

  const handleLoadDirectVideo = (url: string, label: string) => {
    engineRef.current?.setDirectVideoSource(url);
    setMedia((prev) => ({
      ...prev,
      sourceType: 'direct-video',
      sourceUrl: url,
      youtubeId: null,
      title: label,
      isPlaying: true,
      fullscreenOverlay: false,
    }));
    setLighting({ ...LIGHTING_PRESETS.movie });
    if (cameraMode === 'seat-map') switchCameraMode('seat-preview');
    pixelStreamingBridge.emitUIInteraction('MediaCommand', { source: 'direct-video', url });
  };

  const handleMediaControl = (
    action: 'play' | 'pause' | 'restart' | 'seek' | 'clear' | 'fullscreen',
    val?: number,
  ) => {
    if (action === 'clear') {
      engineRef.current?.setDirectVideoSource(null);
      setMedia((prev) => ({
        ...prev,
        sourceType: 'demo-reel',
        sourceUrl: '',
        youtubeId: null,
        title: `${selectedMovie.title} · Preview Reel`,
        isPlaying: true,
        fullscreenOverlay: false,
      }));
      return;
    }
    if (action === 'fullscreen') {
      if (media.sourceType === 'youtube' && media.youtubeId) {
        setMedia((prev) => ({ ...prev, fullscreenOverlay: !prev.fullscreenOverlay }));
      } else {
        toggleFullscreen();
      }
      return;
    }
    engineRef.current?.controlMedia(action, val);
    if (action === 'play') setMedia((p) => ({ ...p, isPlaying: true }));
    if (action === 'pause') setMedia((p) => ({ ...p, isPlaying: false }));
    if (action === 'restart') setMedia((p) => ({ ...p, isPlaying: true }));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleUpdateCart = (itemId: string, sizeIndex: number, delta: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.itemId === itemId && c.sizeIndex === sizeIndex);
      if (idx === -1 && delta > 0) return [...prev, { itemId, sizeIndex, quantity: delta }];
      if (idx === -1) return prev;
      const nextQty = prev[idx].quantity + delta;
      if (nextQty <= 0) return prev.filter((_, i) => i !== idx);
      return prev.map((c, i) => (i === idx ? { ...c, quantity: nextQty } : c));
    });
  };

  const selectedShowtime =
    selectedMovie.showtimes.find((s) => s.id === selectedShowtimeId) || selectedMovie.showtimes[0];

  const totalOrderPrice = useMemo(() => {
    const seatsSum = AUDITORIUM_SEATS.filter((s) => selectedSeatIds.includes(s.id)).reduce(
      (sum, s) => sum + s.price,
      0,
    );
    const foodSum = cart.reduce((sum, c) => {
      const item = CONCESSION_ITEMS.find((i) => i.id === c.itemId);
      if (!item) return sum;
      const sz = item.sizes[c.sizeIndex] || item.sizes[0];
      return sum + (item.basePrice + sz.priceDelta) * c.quantity;
    }, 0);
    return seatsSum + foodSum;
  }, [selectedSeatIds, cart]);

  const hovered3dSeat = useMemo(
    () => (hovered3dSeatId ? AUDITORIUM_SEATS.find((s) => s.id === hovered3dSeatId) : null),
    [hovered3dSeatId],
  );

  const toggleDrawer = (d: ActiveDrawer) => {
    setActiveDrawer((prev) => (prev === d ? null : d));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06070a] text-neutral-900 dark:text-neutral-100 select-none">
      {/* ISOLATED 100% FULL-VIEWPORT THREE.JS WEBGL CANVAS */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full z-0" />

      {/* MINIMAL FLOATING TOP BAR (Clean 3-Zone Contract, Zero Pills, No Backdrop-Blur Stall) */}
      <header className="fixed top-0 inset-x-0 z-25 flex items-center justify-between gap-4 px-4 sm:px-6 h-14 bg-white/92 dark:bg-[#090a0e]/88 border-b border-neutral-200/80 dark:border-white/10">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => switchCameraMode('overview')}
            className="text-sm sm:text-base font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0"
          >
            {t.brand}
          </button>
          <span className="hidden lg:inline text-xs text-neutral-400" aria-hidden="true">·</span>
          <span className="hidden lg:inline text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {t.previewNotice}
          </span>
        </div>

        {/* Zone 2: Active Film & Zone Context (Unboxed Clean Typography) */}
        <div className="hidden md:flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 whitespace-nowrap overflow-hidden">
          <button
            onClick={() => toggleDrawer('movies')}
            className="font-semibold text-neutral-900 dark:text-white hover:underline truncate max-w-[180px]"
          >
            {lang === 'ar' ? selectedMovie.titleAr : selectedMovie.title}
          </button>
          <span aria-hidden="true" className="text-neutral-400">·</span>
          <span className="tabular-nums">{selectedShowtime.time}</span>
          <span aria-hidden="true" className="text-neutral-400">·</span>
          <span className="capitalize">{userPose.zone}</span>
        </div>

        {/* Zone 3: Compact Utilities & Primary CTA */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setLang((l) => (l === 'en' ? 'ar' : 'en'))}
            title="Switch Language (AR / EN)"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Languages className="w-3.5 h-3.5" />
            {lang === 'en' ? 'العربية' : 'EN'}
          </button>

          <button
            onClick={() => setUiTheme((m) => (m === 'dark' ? 'light' : 'dark'))}
            title="Toggle Interface Theme (Does not alter 3D cinema lights)"
            className="p-1.5 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 transition-colors"
          >
            {uiTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => engineRef.current?.resetCamera()}
            title={t.resetCamera}
            className="p-1.5 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            title={t.fullscreen}
            className="p-1.5 rounded-lg hover:bg-neutral-200/80 dark:hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          <button
            onClick={() => toggleDrawer('ue5')}
            title={t.ue5Hub}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              activeDrawer === 'ue5'
                ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : 'border-neutral-300 dark:border-white/15 hover:bg-neutral-200/70 dark:hover:bg-white/10'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            UE5
          </button>

          <button
            onClick={() => setActiveDrawer('booking')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition-opacity whitespace-nowrap tabular-nums"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>€{totalOrderPrice.toFixed(2)}</span>
          </button>
        </div>
      </header>

      {/* 3D HOVERED SEAT QUIET TOOLTIP (When hovering seats directly in 3D auditorium) */}
      {hovered3dSeat && cameraMode !== 'seat-map' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-[#0b0c10]/92 border border-amber-400/40 text-white text-xs pointer-events-none tabular-nums">
          <strong>{hovered3dSeat.id}</strong> · {t[hovered3dSeat.category]} · €{hovered3dSeat.price} · {hovered3dSeat.distanceToScreen}m · {hovered3dSeat.sightlineScore}% {t.sightline}
        </div>
      )}

      {/* ACTIVE CINEMATIC DRONE TOUR CONTROLS HUD */}
      {cameraMode === 'drone-tour' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 w-[min(560px,92vw)] rounded-xl border border-neutral-200 dark:border-white/15 bg-white/95 dark:bg-[#0b0c10]/92 px-4 py-2.5 shadow-xl pointer-events-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{tourCaption}</div>
              <div className="mt-1.5 w-48 sm:w-64 h-1.5 rounded-full bg-neutral-200 dark:bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${Math.round(tourProgress * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const next = !tourPaused;
                  setTourPaused(next);
                  engineRef.current?.setTourPaused(next);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-300 dark:border-white/15 hover:bg-neutral-100 dark:hover:bg-white/10"
              >
                {tourPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {tourPaused ? t.resumeTour : t.pauseTour}
              </button>
              <button
                onClick={() => engineRef.current?.skipTourChapter()}
                className="p-1.5 rounded-lg border border-neutral-300 dark:border-white/15 hover:bg-neutral-100 dark:hover:bg-white/10"
                title={t.skipChapter}
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => switchCameraMode('seat-preview')}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
              >
                {t.exitTour}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE WAYFINDING / EMERGENCY EXIT GUIDANCE BANNER */}
      {wayfinding.active && (
        <div className="fixed top-16 end-4 z-20 max-w-sm rounded-xl border border-emerald-500/40 bg-white/95 dark:bg-[#0b0c10]/94 px-4 py-3 shadow-xl pointer-events-auto text-xs space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
              <Navigation className="w-4 h-4 shrink-0" />
              <span>{wayfinding.targetName}</span>
            </div>
            <button
              onClick={() => {
                engineRef.current?.clearWayfinding();
                setWayfinding((w) => ({ ...w, active: false }));
              }}
              className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 tabular-nums">
            <span>{wayfinding.distanceMeters}m</span>
            <span aria-hidden="true">·</span>
            <span>~{wayfinding.estimatedSeconds}s walk</span>
            {wayfinding.accessibleOnly && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-sky-500 font-medium">Step-Free</span>
              </>
            )}
          </div>
          {wayfinding.mode === 'exit' && (
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-neutral-200 dark:border-white/10">
              <button
                onClick={() => handleFindNearestExit(!wayfinding.accessibleOnly)}
                className="text-[11px] underline text-sky-600 dark:text-sky-400"
              >
                {wayfinding.accessibleOnly ? 'Switch to Closest Exit' : t.accessibleRoute}
              </button>
              <button
                onClick={() => setLighting({ ...LIGHTING_PRESETS.emergency })}
                className="text-[11px] text-red-500 font-medium hover:underline"
              >
                Emergency Lights
              </button>
            </div>
          )}
          <p className="text-[10px] text-neutral-500 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
            {t.evacDisclaimer}
          </p>
        </div>
      )}

      {/* OFFICIAL YOUTUBE CINEMA-FRAMED OVERLAY (Honest YouTube IFrame Embed) */}
      {media.sourceType === 'youtube' && media.youtubeId && media.fullscreenOverlay && (
        <div className="fixed inset-x-4 top-20 bottom-24 z-25 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[920px] aspect-video rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-black shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-[#0b0c10] text-white text-xs border-b border-white/10">
              <span className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" />
                Official YouTube IFrame Theater Mode · Row {primarySeatId}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMedia((m) => ({ ...m, fullscreenOverlay: false }))}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20"
                >
                  Minimize to 3D View
                </button>
                <button
                  onClick={() => handleMediaControl('clear')}
                  className="px-2.5 py-1 rounded bg-red-600/80 hover:bg-red-600"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              className="w-full flex-1"
              src={`https://www.youtube.com/embed/${media.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
              title="Immersive Cinema 5 YouTube Screen"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* SYNCHRONIZED 2D / 3D SEAT SELECTION MAP OVERLAY */}
      {cameraMode === 'seat-map' && !activeDrawer && (
        <SeatMapOverlay
          lang={lang}
          movie={selectedMovie}
          showtime={selectedShowtime}
          selectedSeatIds={selectedSeatIds}
          ticketCount={ticketCount}
          onTicketCountChange={setTicketCount}
          onSelectSeat={handleSeatSelection}
          onRecommendBest={handleRecommendBestSeats}
          onPreviewSeat={() => switchCameraMode('seat-preview', primarySeatId)}
          onCompareSeats={() => {
            const second =
              selectedSeatIds[1] && selectedSeatIds[1] !== primarySeatId
                ? selectedSeatIds[1]
                : primarySeatId.startsWith('P')
                  ? 'J10'
                  : 'P6';
            setCompareSeatIds([primarySeatId, second]);
            switchCameraMode('compare-seats');
          }}
          onProceedBooking={() => setActiveDrawer('booking')}
        />
      )}

      {/* SEATED POV MINI-BAR & SPLIT-SCREEN COMPARE HEADER */}
      {!activeDrawer && (
        <MiniSeatBar
          lang={lang}
          mode={cameraMode}
          primarySeatId={primarySeatId}
          selectedSeatIds={selectedSeatIds}
          compareSeatIds={compareSeatIds}
          onFocusSeat={(id) => {
            setPrimarySeatId(id);
            engineRef.current?.focusSeatPov(id, true);
          }}
          onChangeCompareSeat={(slot, id) => {
            setCompareSeatIds((prev) => (slot === 0 ? [id, prev[1]] : [prev[0], id]));
          }}
          onOpenSeatMap={() => switchCameraMode('seat-map')}
          onToggleCompare={() => switchCameraMode('compare-seats')}
        />
      )}

      {/* FREE WALK VIRTUAL JOYSTICK & HEIGHT TOGGLE */}
      {cameraMode === 'free-walk' && !activeDrawer && (
        <VirtualJoystick
          lang={lang}
          seated={walkSeated}
          onToggleSeated={(seated) => {
            setWalkSeated(seated);
            engineRef.current?.setWalkSeated(seated);
          }}
          onMove={(x, y) => engineRef.current?.setJoystick(x, y)}
        />
      )}

      {/* COMPACT FLOATING CONTROL DRAWERS (Lighting, YouTube/Media, Audience, 360°, Graphics, Audio, VR, UE5) */}
      <ControlDrawers
        lang={lang}
        activeDrawer={activeDrawer}
        lighting={lighting}
        audienceDensity={audienceDensity}
        media={media}
        graphics={graphics}
        audio={audioSettings}
        streaming={streaming}
        onClose={() => setActiveDrawer(null)}
        onApplyLightingPreset={(preset) => {
          setLighting({ ...LIGHTING_PRESETS[preset] });
          pixelStreamingBridge.emitUIInteraction('SetLightingPreset', { preset });
        }}
        onUpdateLighting={(patch) => {
          setLighting((prev) => ({ ...prev, ...patch }));
          pixelStreamingBridge.emitUIInteraction('SetLightingParam', patch as Record<string, unknown>);
        }}
        onSetAudienceDensity={(d) => {
          setAudienceDensity(d);
          pixelStreamingBridge.emitUIInteraction('SetAudienceDensity', { percent: d });
        }}
        onGoToPanorama={(id) => {
          setCameraMode('panorama');
          engineRef.current?.goToPanorama(id);
        }}
        onLoadYouTube={handleLoadYouTube}
        onLoadDirectVideo={handleLoadDirectVideo}
        onMediaControl={handleMediaControl}
        onMediaVolume={(vol, muted) => {
          setMedia((m) => ({ ...m, volume: vol, muted }));
          engineRef.current?.setMediaVolume(vol, muted);
        }}
        onApplyGraphicsPreset={(preset) => {
          setGraphics({ ...GRAPHICS_PRESETS[preset] });
          pixelStreamingBridge.emitUIInteraction('GraphicsQuality', { preset });
        }}
        onUpdateGraphics={(patch) => setGraphics((prev) => ({ ...prev, ...patch }))}
        onUpdateAudio={(patch) => {
          audioRef.current?.initIfNeeded();
          setAudioSettings((prev) => ({ ...prev, ...patch }));
          pixelStreamingBridge.emitUIInteraction('AudioMix', patch as Record<string, unknown>);
        }}
      />

      {/* INTERACTIVE ARCHITECTURAL FLOOR PLAN MODAL */}
      {activeDrawer === 'floorplan' && (
        <FloorPlanModal
          lang={lang}
          userPose={userPose}
          wayfinding={wayfinding}
          onTeleport={(x, z) => {
            engineRef.current?.teleportToFloorPoint(x, z);
            setCameraMode('free-walk');
            pixelStreamingBridge.emitUIInteraction('TeleportFloorPlan', { x, z });
          }}
          onTriggerExitRoute={(accessibleOnly) => handleFindNearestExit(accessibleOnly)}
          onClose={() => setActiveDrawer(null)}
        />
      )}

      {/* COMPLETE BOOKING, MOVIES, CONCESSIONS & DIGITAL QR TICKET MODAL */}
      {(activeDrawer === 'movies' || activeDrawer === 'concessions' || activeDrawer === 'booking') && (
        <BookingFlowModal
          lang={lang}
          initialTab={activeDrawer}
          selectedMovie={selectedMovie}
          selectedShowtimeId={selectedShowtimeId}
          selectedSeatIds={selectedSeatIds}
          cart={cart}
          onSelectMovie={(m, stId) => {
            setSelectedMovie(m);
            setSelectedShowtimeId(stId);
          }}
          onUpdateCart={handleUpdateCart}
          onOpenSeatMap={() => switchCameraMode('seat-map')}
          onConfirmBooking={(conf) => setLastBooking(conf)}
          onGuideToSeat={handleGuideEntranceToSeat}
          onClose={() => setActiveDrawer(null)}
        />
      )}

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK (Zero Viewport Occlusion, All 22+ Functional Tools) */}
      <div
        className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center transition-transform duration-300 max-w-[96vw] ${
          dockVisible ? 'translate-y-0' : 'translate-y-[calc(100%-26px)]'
        }`}
      >
        <button
          onClick={() => setDockVisible((v) => !v)}
          className="flex items-center gap-1 px-3 py-0.5 mb-1 text-[10px] font-medium rounded-t-lg border border-b-0 border-neutral-200 dark:border-white/15 bg-white/95 dark:bg-[#0b0c10]/92 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
        >
          {dockVisible ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          {dockVisible ? t.hideControls : t.showControls}
        </button>

        <nav
          aria-label="Cinema Interactive Controls"
          className="flex items-center gap-1 px-2 py-1.5 rounded-2xl border border-neutral-200 dark:border-white/12 bg-white/95 dark:bg-[#0b0c10]/92 shadow-2xl overflow-x-auto max-w-[96vw] cinema-scroll"
        >
          {[
            {
              id: 'explore',
              label: t.exploreCinema,
              icon: Video,
              active: cameraMode === 'drone-tour',
              onClick: () => switchCameraMode('drone-tour'),
            },
            {
              id: 'walk',
              label: t.freeWalk,
              icon: Footprints,
              active: cameraMode === 'free-walk',
              onClick: () => switchCameraMode('free-walk'),
            },
            {
              id: 'seats',
              label: t.seats,
              icon: Grid2X2,
              active: cameraMode === 'seat-map' && !activeDrawer,
              onClick: () => switchCameraMode('seat-map'),
            },
            {
              id: 'preview',
              label: t.previewMySeat,
              icon: Eye,
              active: cameraMode === 'seat-preview',
              onClick: () => switchCameraMode('seat-preview', primarySeatId),
            },
            {
              id: 'compare',
              label: t.compareSeats,
              icon: Columns2,
              active: cameraMode === 'compare-seats',
              onClick: () => switchCameraMode('compare-seats'),
            },
            {
              id: '360',
              label: t.view360,
              icon: Compass,
              active: activeDrawer === 'panorama' || cameraMode === 'panorama',
              onClick: () => toggleDrawer('panorama'),
            },
            {
              id: 'floorplan',
              label: t.floorPlan,
              icon: Map,
              active: activeDrawer === 'floorplan',
              onClick: () => toggleDrawer('floorplan'),
            },
            {
              id: 'media',
              label: t.screenMedia,
              icon: Youtube,
              active: activeDrawer === 'media',
              onClick: () => toggleDrawer('media'),
            },
            {
              id: 'lighting',
              label: t.lighting,
              icon: Sun,
              active: activeDrawer === 'lighting',
              onClick: () => toggleDrawer('lighting'),
            },
            {
              id: 'audience',
              label: t.audience,
              icon: Users,
              active: activeDrawer === 'audience',
              onClick: () => toggleDrawer('audience'),
            },
            {
              id: 'exit',
              label: t.findNearestExit,
              icon: Navigation,
              active: wayfinding.active && wayfinding.mode === 'exit',
              onClick: () => handleFindNearestExit(false),
            },
            {
              id: 'movies',
              label: t.movies,
              icon: Film,
              active: activeDrawer === 'movies',
              onClick: () => toggleDrawer('movies'),
            },
            {
              id: 'food',
              label: t.foodDrinks,
              icon: Popcorn,
              active: activeDrawer === 'concessions',
              onClick: () => toggleDrawer('concessions'),
            },
            {
              id: 'graphics',
              label: t.graphics,
              icon: Sliders,
              active: activeDrawer === 'graphics',
              onClick: () => toggleDrawer('graphics'),
            },
            {
              id: 'audio',
              label: t.audio,
              icon: Volume2,
              active: activeDrawer === 'audio',
              onClick: () => toggleDrawer('audio'),
            },
            {
              id: 'vr',
              label: t.vrMode,
              icon: Glasses,
              active: activeDrawer === 'vr',
              onClick: () => toggleDrawer('vr'),
            },
          ].map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                onClick={btn.onClick}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  btn.active
                    ? 'bg-neutral-900 text-white dark:bg-amber-400 dark:text-neutral-950 font-semibold'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{btn.label}</span>
              </button>
            );
          })}

          {lastBooking && (
            <button
              onClick={handleGuideEntranceToSeat}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-semibold bg-blue-600 text-white whitespace-nowrap shrink-0"
            >
              <Navigation className="w-3.5 h-3.5" />
              {lastBooking.seatIds[0]}
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
