export type EffectMode = 'oldTV' | 'channelSwitch';

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class OldTVEffect {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private isActive = false;
  private mode: EffectMode = 'oldTV';

  // Reusable offscreen canvas for snow (avoids allocation every frame)
  private snowCanvas: HTMLCanvasElement;
  private snowCtx: CanvasRenderingContext2D;

  // Cached static layers (rebuilt only on resize)
  private scanlinesCache: HTMLCanvasElement | null = null;
  private vignetteCache: HTMLCanvasElement | null = null;

  // VCR tracking config (default values from CodePen)
  private vcrConfig = {
    miny: 220,
    miny2: 220,
    maxy: 0,
    num: 70,
    fps: 60,
    blur: 1
  };

  // Throttle to 30fps — noise effect is imperceptible above this on TV
  private lastFrameTime = 0;
  private readonly frameDuration = 1000 / 30;

  constructor(canvas: HTMLCanvasElement, mode: EffectMode = 'oldTV') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.mode = mode;

    this.snowCanvas = document.createElement('canvas');
    this.snowCtx = this.snowCanvas.getContext('2d')!;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.vcrConfig.maxy = this.canvas.height;

    // Snow canvas runs at half resolution
    this.snowCanvas.width = Math.floor(this.canvas.width / 2);
    this.snowCanvas.height = Math.floor(this.canvas.height / 2);

    // Invalidate static caches so they're rebuilt at new size
    this.scanlinesCache = null;
    this.vignetteCache = null;
  }

  setMode(mode: EffectMode): void {
    this.mode = mode;
  }

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.lastFrameTime = 0;
    this.animationId = requestAnimationFrame((t) => this.animate(t));
  }

  stop(): void {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private animate(timestamp: number): void {
    if (!this.isActive) return;

    if (timestamp - this.lastFrameTime < this.frameDuration) {
      this.animationId = requestAnimationFrame((t) => this.animate(t));
      return;
    }
    this.lastFrameTime = timestamp;

    const { width, height } = this.canvas;

    this.ctx.clearRect(0, 0, width, height);

    if (this.mode === 'channelSwitch') {
      this.ctx.fillStyle = '#474545ff';
      this.ctx.fillRect(0, 0, width, height);
    }

    this.ctx.globalCompositeOperation = 'source-over';

    this.drawSnow(width, height);
    this.drawVCRTracking(width, height);
    this.drawScanlines(width, height);

    if (this.mode === 'channelSwitch') {
      this.drawVignette(width, height);
    }

    this.animationId = requestAnimationFrame((t) => this.animate(t));
  }

  // Generate CRT noise (snow)
  private drawSnow(width: number, height: number): void {
    const w = this.snowCanvas.width;
    const h = this.snowCanvas.height;
    const imageData = this.snowCtx.createImageData(w, h);
    const b = new Uint32Array(imageData.data.buffer);

    for (let i = 0; i < b.length; i++) {
      b[i] = ((255 * Math.random()) | 0) << 24;
    }
    this.snowCtx.putImageData(imageData, 0, 0);

    this.ctx.save();
    this.ctx.globalAlpha = this.mode === 'channelSwitch' ? 0.6 : 0.2;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.snowCanvas, 0, 0, width, height);
    this.ctx.restore();
  }

  // VCR tracking noise
  private drawVCRTracking(width: number, height: number): void {
    const radius = 2;
    let posy1 = this.vcrConfig.miny || 0;
    let posy2 = this.vcrConfig.maxy || height;
    let posy3 = this.vcrConfig.miny2 || 0;
    const num = this.vcrConfig.num || 20;

    this.ctx.save();
    this.ctx.fillStyle = '#fff';
    this.ctx.globalAlpha = this.mode === 'channelSwitch' ? 0 : 0.4;

    this.ctx.beginPath();
    for (let i = 0; i <= num; i++) {
      const x = Math.random() * width;
      const y1 = getRandomInt(posy1 += 3, posy2);
      const y2 = getRandomInt(0, posy3 -= 3);

      this.ctx.fillRect(x, y1, radius, radius);
      this.ctx.fillRect(x, y2, radius, radius);

      this.renderTail(x, y1, radius);
      this.renderTail(x, y2, radius);
    }
    this.ctx.closePath();
    this.ctx.restore();
  }

  private renderTail(x: number, y: number, radius: number): void {
    const n = getRandomInt(1, 50);
    const dirs = [1, -1];
    let rd = radius;
    const dir = dirs[Math.floor(Math.random() * dirs.length)];

    for (let i = 0; i < n; i++) {
      const step = 0.01;
      const r = getRandomInt((rd -= step), radius);
      let dx = getRandomInt(1, 4);
      radius -= 0.1;
      dx *= dir;

      this.ctx.fillRect((x += dx), y, r, r);
      this.ctx.fill();
    }
  }

  // Horizontal scanlines — drawn once to an offscreen canvas, reused every frame
  private drawScanlines(width: number, height: number): void {
    if (!this.scanlinesCache) {
      this.scanlinesCache = document.createElement('canvas');
      this.scanlinesCache.width = width;
      this.scanlinesCache.height = height;
      const cacheCtx = this.scanlinesCache.getContext('2d')!;
      cacheCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      for (let y = 0; y < height; y += 4) {
        cacheCtx.fillRect(0, y, width, 2);
      }
    }
    this.ctx.drawImage(this.scanlinesCache, 0, 0);
  }

  // Vignette — drawn once to an offscreen canvas, reused every frame
  private drawVignette(width: number, height: number): void {
    if (!this.vignetteCache) {
      this.vignetteCache = document.createElement('canvas');
      this.vignetteCache.width = width;
      this.vignetteCache.height = height;
      const cacheCtx = this.vignetteCache.getContext('2d')!;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.sqrt(centerX * centerX + centerY * centerY);
      const gradient = cacheCtx.createRadialGradient(
        centerX, centerY, radius * 0.2,
        centerX, centerY, radius * 1.3
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)');
      gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      cacheCtx.fillStyle = gradient;
      cacheCtx.fillRect(0, 0, width, height);
    }
    this.ctx.drawImage(this.vignetteCache, 0, 0);
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', () => this.resize());
  }
}
