import { AudioSettings } from '../types/cinema';

/**
 * Procedural Spatial Cinema Audio Engine (100% Web Audio API, zero external MP3 dependencies).
 * Smoothly shifts acoustic ambience between Exterior Plaza, Grand Lobby, and Main Auditorium.
 */
export class CinemaSpatialAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private envGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private movieGain: GainNode | null = null;

  private lobbyFilter: BiquadFilterNode | null = null;
  private audFilter: BiquadFilterNode | null = null;
  private lobbyZoneGain: GainNode | null = null;
  private audZoneGain: GainNode | null = null;

  private started = false;
  private settings: AudioSettings = {
    masterVolume: 0.55,
    movieVolume: 0.75,
    environmentVolume: 0.45,
    musicVolume: 0.3,
    sfxVolume: 0.65,
    muted: false,
  };
  private currentZone: 'exterior' | 'lobby' | 'auditorium' = 'auditorium';

  public initIfNeeded() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.envGain = ctx.createGain();
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.movieGain = ctx.createGain();

      this.envGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.movieGain.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // Generate warm pink/brown noise buffer for ventilation & distant lobby murmur
      const bufLen = ctx.sampleRate * 4;
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (last + 0.03 * white) / 1.03;
        last = data[i];
        data[i] *= 2.4;
      }

      // Auditorium HVAC + subtle cinema sub-room resonance
      const audNoise = ctx.createBufferSource();
      audNoise.buffer = noiseBuf;
      audNoise.loop = true;
      this.audFilter = ctx.createBiquadFilter();
      this.audFilter.type = 'lowpass';
      this.audFilter.frequency.value = 165;
      this.audZoneGain = ctx.createGain();
      this.audZoneGain.gain.value = 0.22;
      audNoise.connect(this.audFilter);
      this.audFilter.connect(this.audZoneGain);
      this.audZoneGain.connect(this.envGain);
      audNoise.start();

      // Lobby warm reverberant chatter + espresso/popcorn gentle hiss
      const lobbyNoise = ctx.createBufferSource();
      lobbyNoise.buffer = noiseBuf;
      lobbyNoise.loop = true;
      this.lobbyFilter = ctx.createBiquadFilter();
      this.lobbyFilter.type = 'bandpass';
      this.lobbyFilter.frequency.value = 540;
      this.lobbyFilter.Q.value = 0.7;
      this.lobbyZoneGain = ctx.createGain();
      this.lobbyZoneGain.gain.value = 0.04;
      lobbyNoise.connect(this.lobbyFilter);
      this.lobbyFilter.connect(this.lobbyZoneGain);
      this.lobbyZoneGain.connect(this.envGain);
      lobbyNoise.start();

      // Subtle atmospheric cinema pad chord (D minor 9 warm drone)
      const freqs = [73.42, 110.0, 146.83, 174.61];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const padFilter = ctx.createBiquadFilter();
        const oscGain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 260;
        oscGain.gain.value = idx === 0 ? 0.045 : 0.018;
        osc.connect(padFilter);
        padFilter.connect(oscGain);
        oscGain.connect(this.musicGain!);
        osc.start();
      });

      this.started = true;
      this.applySettings(this.settings);
      this.setZone(this.currentZone);
    } catch {
      // Audio autoplay blocked or unsupported; silently stay ready
    }
  }

  public applySettings(next: AudioSettings) {
    this.settings = next;
    if (!this.ctx || !this.masterGain || !this.envGain || !this.musicGain || !this.sfxGain || !this.movieGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const master = next.muted ? 0 : next.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.08);
    this.envGain.gain.setTargetAtTime(next.environmentVolume, now, 0.08);
    this.musicGain.gain.setTargetAtTime(next.musicVolume, now, 0.1);
    this.sfxGain.gain.setTargetAtTime(next.sfxVolume, now, 0.05);
    this.movieGain.gain.setTargetAtTime(next.movieVolume, now, 0.08);
  }

  public setZone(zone: 'exterior' | 'lobby' | 'auditorium') {
    this.currentZone = zone;
    if (!this.ctx || !this.audZoneGain || !this.lobbyZoneGain) return;
    const now = this.ctx.currentTime;
    if (zone === 'auditorium') {
      this.audZoneGain.gain.setTargetAtTime(0.24, now, 0.35);
      this.lobbyZoneGain.gain.setTargetAtTime(0.02, now, 0.35);
    } else if (zone === 'lobby') {
      this.audZoneGain.gain.setTargetAtTime(0.06, now, 0.35);
      this.lobbyZoneGain.gain.setTargetAtTime(0.22, now, 0.35);
    } else {
      this.audZoneGain.gain.setTargetAtTime(0.12, now, 0.35);
      this.lobbyZoneGain.gain.setTargetAtTime(0.1, now, 0.35);
    }
  }

  public playSeatClick() {
    if (!this.started || !this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.075);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playFootstep(onMarble: boolean) {
    if (!this.started || !this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const base = onMarble ? 210 : 95;
    osc.frequency.setValueAtTime(base + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.055);
    g.gain.setValueAtTime(onMarble ? 0.07 : 0.045, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.started = false;
  }
}
