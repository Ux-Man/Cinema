import * as THREE from 'three';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createCarpetTexture(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#181920';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle woven geometric cinema carpet pattern
  for (let y = 0; y < 512; y += 8) {
    for (let x = 0; x < 512; x += 8) {
      const n = ((Math.sin(x * 0.19 + y * 0.11) + 1) * 0.5) * 14;
      const v = Math.floor(20 + n);
      ctx.fillStyle = `rgb(${v + 4}, ${v + 2}, ${v + 8})`;
      ctx.fillRect(x, y, 7, 7);
    }
  }
  // Fine diagonal acoustic carpet weave lines
  ctx.strokeStyle = 'rgba(229, 184, 105, 0.055)';
  ctx.lineWidth = 1.5;
  for (let i = -512; i < 1024; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 18);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const [bCanvas, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const v = 110 + Math.floor(Math.abs(Math.sin(x * 1.3 + y * 0.7)) * 36);
      bCtx.fillStyle = `rgb(${v},${v},${v})`;
      bCtx.fillRect(x, y, 3, 3);
    }
  }
  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(14, 18);

  return { map, bumpMap };
}

export function createMarbleTexture(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#15171c';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tile grid (large format 2x2 architectural slabs)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.strokeRect(257, 1, 254, 254);
  ctx.strokeRect(1, 257, 254, 254);
  ctx.strokeRect(257, 257, 254, 254);

  // Warm gold & silver mineral veins
  for (let v = 0; v < 22; v++) {
    ctx.beginPath();
    let x = (v * 97) % 512;
    let y = (v * 53) % 512;
    ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) {
      x += Math.sin(v + s * 0.7) * 32 + 18;
      y += Math.cos(v * 0.5 + s * 0.5) * 26 + 10;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = v % 3 === 0 ? 'rgba(229, 184, 105, 0.14)' : 'rgba(205, 215, 230, 0.08)';
    ctx.lineWidth = v % 4 === 0 ? 2.2 : 1.1;
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(10, 8);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const [rCanvas, rCtx] = makeCanvas(256, 256);
  rCtx.fillStyle = '#323232';
  rCtx.fillRect(0, 0, 256, 256);
  rCtx.strokeStyle = '#707070';
  rCtx.lineWidth = 3;
  rCtx.strokeRect(0, 0, 128, 128);
  rCtx.strokeRect(128, 128, 128, 128);
  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(10, 8);

  return { map, roughnessMap };
}

export function createLeatherBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#7e7e7e';
  ctx.fillRect(0, 0, 256, 256);

  // Micro-pebbled luxury leather grain
  for (let y = 0; y < 256; y += 3) {
    for (let x = 0; x < 256; x += 3) {
      const n = Math.sin(x * 0.8 + Math.cos(y * 0.9) * 2.1) * 16;
      const v = Math.floor(128 + n);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  // Subtle quilted seam lines
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAcousticPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#171619';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = '#232024';
    ctx.fillRect(x, 0, 10, 256);
    ctx.fillStyle = '#111013';
    ctx.fillRect(x + 10, 0, 6, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createExitSignTexture(text = 'EXIT'): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 96);
  ctx.fillStyle = '#052e16';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 88);

  ctx.fillStyle = '#dcfce7';
  ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMarqueeSignTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 256);
  const grad = ctx.createLinearGradient(0, 0, 1024, 256);
  grad.addColorStop(0, '#0c0d11');
  grad.addColorStop(0.5, '#18161a');
  grad.addColorStop(1, '#0c0d11');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = '#e5b869';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 1000, 232);

  ctx.fillStyle = '#f8e7c2';
  ctx.font = '700 68px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 512, 108);

  ctx.fillStyle = '#e5b869';
  ctx.font = '500 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle, 512, 180);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dynamic Cinema Preview Reel Renderer (renders rich animated cinematic motion onto the 3D screen!)
export class CinemaScreenReel {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  public dominantColor = new THREE.Color('#3b82f6');
  private movieTitle = 'CHRONOS HORIZON';
  private movieTagline = 'IMAX LASER · DOLBY ATMOS EXPERIENCE';
  private accent = '#e5b869';

  constructor(maxAnisotropy: number) {
    const [canvas, ctx] = makeCanvas(1024, 436);
    this.canvas = canvas;
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;
    this.renderFrame(0);
  }

  public setMovieInfo(title: string, tagline: string, accentColor: string) {
    this.movieTitle = title.toUpperCase();
    this.movieTagline = tagline;
    this.accent = accentColor;
  }

  public renderFrame(timeSec: number) {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Cinematic atmospheric sky / space / noir gradient shifting over time
    const phase = timeSec * 0.28;
    const r1 = Math.floor(14 + Math.sin(phase) * 12 + 12);
    const g1 = Math.floor(22 + Math.cos(phase * 0.7) * 16 + 16);
    const b1 = Math.floor(38 + Math.sin(phase * 0.5 + 1.2) * 24 + 24);

    const grad = ctx.createRadialGradient(
      w * (0.5 + Math.sin(phase * 0.6) * 0.16),
      h * 0.48,
      20,
      w * 0.5,
      h * 0.5,
      w * 0.68,
    );
    grad.addColorStop(0, `rgb(${r1 + 48}, ${g1 + 58}, ${b1 + 44})`);
    grad.addColorStop(0.45, `rgb(${r1 + 10}, ${g1 + 18}, ${b1 + 22})`);
    grad.addColorStop(1, '#06080d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Anamorphic planetary / architectural horizon arcs
    ctx.save();
    ctx.translate(w * 0.5, h * 0.55);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const rad = 170 + i * 74 + Math.sin(phase + i) * 14;
      ctx.ellipse(0, 95, rad * 1.85, rad * 0.42, Math.sin(phase * 0.25) * 0.06, Math.PI, Math.PI * 2);
      ctx.strokeStyle = i === 0 ? `${this.accent}66` : 'rgba(180, 215, 255, 0.14)';
      ctx.lineWidth = i === 0 ? 3 : 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Drifting atmospheric volumetric light shafts
    for (let s = 0; s < 5; s++) {
      const sx = ((s * 240 + timeSec * (18 + s * 5)) % (w + 260)) - 130;
      const beamGrad = ctx.createLinearGradient(sx, 0, sx + 120, h);
      beamGrad.addColorStop(0, 'rgba(255, 232, 185, 0.0)');
      beamGrad.addColorStop(0.5, 'rgba(229, 184, 105, 0.09)');
      beamGrad.addColorStop(1, 'rgba(255, 232, 185, 0.0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + 90, 0);
      ctx.lineTo(sx + 180, h);
      ctx.lineTo(sx + 70, h);
      ctx.closePath();
      ctx.fill();
    }

    // Starfield / dust motes
    ctx.fillStyle = 'rgba(255, 245, 225, 0.55)';
    for (let i = 0; i < 42; i++) {
      const px = ((i * 197.3 + timeSec * (6 + (i % 5) * 3)) % w);
      const py = ((i * 83.7) % (h - 40)) + 20;
      const sz = (i % 3) + 1;
      ctx.fillRect(px, py, sz, sz);
    }

    // Subtle horizontal anamorphic lens flare behind title
    const flare = ctx.createLinearGradient(w * 0.12, h * 0.48, w * 0.88, h * 0.48);
    flare.addColorStop(0, 'rgba(229, 184, 105, 0)');
    flare.addColorStop(0.5, `${this.accent}44`);
    flare.addColorStop(1, 'rgba(229, 184, 105, 0)');
    ctx.fillStyle = flare;
    ctx.fillRect(w * 0.12, h * 0.47, w * 0.76, 5);

    // Main theatrical title lockup
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.font = '700 68px "Plus Jakarta Sans", sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 24;
    ctx.fillText(this.movieTitle, w * 0.5, h * 0.47);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(235, 224, 200, 0.78)';
    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(this.movieTagline, w * 0.5, h * 0.61);

    // Subtle cinema letterbox bars & framing
    ctx.fillStyle = '#030406';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);

    // Update dynamic room bounce light color from current cinematic frame
    this.dominantColor.setRGB(
      Math.min(1, (r1 + 85) / 255),
      Math.min(1, (g1 + 92) / 255),
      Math.min(1, (b1 + 88) / 255),
    );
    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.texture.dispose();
  }
}
