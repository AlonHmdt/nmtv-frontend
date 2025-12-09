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
  private vcrInterval: number | null = null;
  private isActive = false;
  private mode: EffectMode = 'oldTV';

  // VCR tracking config (default values from CodePen)
  private vcrConfig = {
    miny: 220,
    miny2: 220,
    maxy: 0,
    num: 70,
    fps: 60,
    blur: 1
  };

  constructor(canvas: HTMLCanvasElement, mode: EffectMode = 'oldTV') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.mode = mode;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.vcrConfig.maxy = this.canvas.height;
  }

  setMode(mode: EffectMode): void {
    this.mode = mode;
  }

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.animate();
  }

  stop(): void {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.vcrInterval) {
      clearInterval(this.vcrInterval);
      this.vcrInterval = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private animate(): void {
    if (!this.isActive) return;

    const { width, height } = this.canvas;

    // Clear canvas with fully transparent background
    this.ctx.clearRect(0, 0, width, height);

    // For channel switch mode, add grey background to simulate TV snow
    if (this.mode === 'channelSwitch') {
      this.ctx.fillStyle = '#474545ff';
      this.ctx.fillRect(0, 0, width, height);
    }

    // Reset any global composite operations
    this.ctx.globalCompositeOperation = 'source-over';

    // Layer 1: Snow (CRT noise)
    this.drawSnow(width, height);

    // Layer 2: VCR tracking noise
    this.drawVCRTracking(width, height);

    // Layer 3: Scanlines
    this.drawScanlines(width, height);

    // Layer 4: Vintage vignette effect (only for channel switch)
    if (this.mode === 'channelSwitch') {
      this.drawVignette(width, height);
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  // Generate CRT noise (snow)
  private drawSnow(width: number, height: number): void {
    const w = width / 2; // Reduce resolution for performance
    const h = height / 2;
    const imageData = this.ctx.createImageData(w, h);
    const b = new Uint32Array(imageData.data.buffer);
    const len = b.length;

    for (let i = 0; i < len; i++) {
      b[i] = ((255 * Math.random()) | 0) << 24;
    }

    // Draw scaled up for full coverage
    this.ctx.save();
    this.ctx.globalAlpha = this.mode === 'channelSwitch' ? 0.6 : 0.2; // Higher opacity for channel switch
    this.ctx.imageSmoothingEnabled = false;

    // Create temporary canvas for scaling
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    this.ctx.drawImage(tempCanvas, 0, 0, width, height);
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
    // Use stronger effect for channel switch
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

  // Horizontal scanlines
  private drawScanlines(width: number, height: number): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';

    for (let y = 0; y < height; y += 4) {
      this.ctx.fillRect(0, y, width, 2);
    }

    this.ctx.restore();
  }

  // Vintage vignette effect (darkening around edges) - similar to CodePen implementation
  private drawVignette(width: number, height: number): void {
    this.ctx.save();
    
    // Create radial gradient from center (matching CodePen vignette style)
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.sqrt(centerX * centerX + centerY * centerY);
    
    const gradient = this.ctx.createRadialGradient(
      centerX, centerY, radius * 0.2,  // Inner radius (clear center)
      centerX, centerY, radius * 1.3   // Outer radius (extended for smooth fade)
    );
    
    // Gradient stops for vintage look
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');      // Fully transparent center
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.15)'); // Subtle darkening starts
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.5)');  // More visible darkening
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');    // Strong dark edges
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
    
    this.ctx.restore();
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', () => this.resize());
  }
}
