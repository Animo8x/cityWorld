import * as THREE from 'three';
import { sanitizePlayerName } from './protocol';

const NAME_STORAGE_KEY = 'cityworld_mp_custom_name';
const SETTINGS_STORAGE_KEY = 'cityworld_mp_settings';

export interface StoredMpSettings {
  networkQuality: 'low' | 'medium' | 'high';
  region: 'auto' | 'me_eu' | 'us_east' | 'asia';
  mpAudioEnabled: boolean;
}

export function loadSavedCustomName(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return sanitizePlayerName(window.localStorage.getItem(NAME_STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

export function saveCustomName(name: string): string {
  const cleaned = sanitizePlayerName(name);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (cleaned) window.localStorage.setItem(NAME_STORAGE_KEY, cleaned);
      else window.localStorage.removeItem(NAME_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted iframes
  }
  return cleaned;
}

export function loadStoredMpSettings(): StoredMpSettings {
  const defaults: StoredMpSettings = {
    networkQuality: 'medium',
    region: 'auto',
    mpAudioEnabled: true,
  };
  try {
    if (typeof window === 'undefined' || !window.localStorage) return defaults;
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StoredMpSettings>;
    return {
      networkQuality:
        parsed.networkQuality === 'low' ||
        parsed.networkQuality === 'medium' ||
        parsed.networkQuality === 'high'
          ? parsed.networkQuality
          : 'medium',
      region:
        parsed.region === 'auto' ||
        parsed.region === 'me_eu' ||
        parsed.region === 'us_east' ||
        parsed.region === 'asia'
          ? parsed.region
          : 'auto',
      mpAudioEnabled: parsed.mpAudioEnabled !== false,
    };
  } catch {
    return defaults;
  }
}

export function saveStoredMpSettings(settings: StoredMpSettings): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // Ignore storage errors
  }
}

export class PlayerNameplate {
  public readonly sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private material: THREE.SpriteMaterial;
  private currentText = '';

  constructor(initialName: string) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 128;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable for nameplate');
    this.ctx = ctx;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.position.set(0, 2.38, 0);
    this.sprite.scale.set(2.35, 0.58, 1);
    this.setName(initialName);
  }

  public setName(name: string): void {
    const clean = name || 'Player';
    if (clean === this.currentText) return;
    this.currentText = clean;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.font = 'bold 44px system-ui, -apple-system, Segoe UI, Tahoma, sans-serif';
    const textWidth = Math.min(w - 48, ctx.measureText(clean).width);
    const pillW = Math.max(170, textWidth + 56);
    const pillH = 74;
    const x = (w - pillW) / 2;
    const y = (h - pillH) / 2;

    // Rounded dark translucent plate with emerald online border
    ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
    this.roundRect(ctx, x, y, pillW, pillH, 16);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.92)';
    this.roundRect(ctx, x, y, pillW, pillH, 16);
    ctx.stroke();

    // Small green online indicator dot
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(x + 26, h / 2, 8, 0, Math.PI * 2);
    ctx.fill();

    // Name text
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clean, w / 2 + 10, h / 2 + 1, pillW - 58);

    this.texture.needsUpdate = true;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  public dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }
}
