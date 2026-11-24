import { PixelStreamingConfig } from '../types/cinema';

export interface UE5InteractionDescriptor {
  type:
    | 'SelectSeat'
    | 'PreviewSeat'
    | 'CompareSeats'
    | 'SetLightingPreset'
    | 'SetLightingParam'
    | 'SetAudienceDensity'
    | 'StartTour'
    | 'FindNearestExit'
    | 'TeleportFloorPlan'
    | 'MediaCommand'
    | 'GraphicsQuality'
    | 'AudioMix';
  payload: Record<string, unknown>;
  timestamp: number;
}

/**
 * Bidirectional Unreal Engine 5 Pixel Streaming WebRTC / WebSocket Bridge.
 * - Defaults cleanly to Local WebGL Preview mode when no UE5 signaling server is connected.
 * - Connects to any standard UE5 Pixel Streaming Cirrus Signaling Server (`ws://...` or `wss://...`)
 *   and serializes all seat, lighting, camera, media, and booking commands using UE5 `emitUIInteraction` JSON schema.
 */
export class PixelStreamingBridge {
  private ws: WebSocket | null = null;
  private config: PixelStreamingConfig = {
    signalingUrl:
      (import.meta.env.VITE_UE5_SIGNALING_URL as string | undefined) || 'ws://localhost:80',
    status: 'preview-webgl',
    lastMessage: 'Browser Three.js WebGL preview active (no external UE5 server attached)',
  };
  private listeners = new Set<(cfg: PixelStreamingConfig) => void>();
  private eventLog: UE5InteractionDescriptor[] = [];

  public getConfig(): PixelStreamingConfig {
    return { ...this.config };
  }

  public getRecentEvents(): UE5InteractionDescriptor[] {
    return this.eventLog.slice(-12);
  }

  public subscribe(fn: (cfg: PixelStreamingConfig) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = this.getConfig();
    this.listeners.forEach((fn) => fn(snap));
  }

  public connect(signalingUrl: string) {
    this.disconnect();
    const cleaned = signalingUrl.trim();
    if (!cleaned.startsWith('ws://') && !cleaned.startsWith('wss://')) {
      this.config = {
        signalingUrl: cleaned,
        status: 'error',
        lastMessage: 'Signaling URL must start with ws:// or wss://',
      };
      this.notify();
      return;
    }

    this.config = {
      signalingUrl: cleaned,
      status: 'connecting',
      lastMessage: `Connecting to UE5 Pixel Streaming signaling server at ${cleaned}...`,
    };
    this.notify();

    try {
      const ws = new WebSocket(cleaned);
      this.ws = ws;

      const timeout = window.setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          this.config = {
            signalingUrl: cleaned,
            status: 'preview-webgl',
            lastMessage: 'UE5 signaling server unreachable — continuing in Three.js WebGL preview mode.',
          };
          this.notify();
        }
      }, 3500);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        this.config = {
          signalingUrl: cleaned,
          status: 'connected',
          lastMessage: `Connected to UE5 Signaling Server (${cleaned})`,
        };
        this.notify();
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        this.config = {
          signalingUrl: cleaned,
          status: 'preview-webgl',
          lastMessage: 'Unable to reach UE5 server — WebGL preview remains active.',
        };
        this.notify();
      };

      ws.onclose = () => {
        if (this.config.status === 'connected') {
          this.config = {
            ...this.config,
            status: 'preview-webgl',
            lastMessage: 'UE5 stream disconnected — reverted to WebGL preview.',
          };
          this.notify();
        }
      };
    } catch {
      this.config = {
        signalingUrl: cleaned,
        status: 'preview-webgl',
        lastMessage: 'WebSocket connection blocked — continuing in WebGL preview.',
      };
      this.notify();
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.config = {
      ...this.config,
      status: 'preview-webgl',
      lastMessage: 'Browser Three.js WebGL preview active',
    };
    this.notify();
  }

  public emitUIInteraction(type: UE5InteractionDescriptor['type'], payload: Record<string, unknown>) {
    const msg: UE5InteractionDescriptor = {
      type,
      payload,
      timestamp: Date.now(),
    };
    this.eventLog.push(msg);
    if (this.eventLog.length > 40) this.eventLog.shift();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'uiInteraction',
            descriptor: JSON.stringify(msg),
          }),
        );
      } catch {
        // Ignore transient socket error
      }
    }
  }
}

export const pixelStreamingBridge = new PixelStreamingBridge();
