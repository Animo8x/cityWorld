import { VehicleClassId, WeatherType } from '../types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private engineGain: GainNode | null = null;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private rainGain: GainNode | null = null;
  private screechGain: GainNode | null = null;

  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  private initialized = false;
  private _muted = false;
  private lastFootstepTime = 0;
  private sirenPhase = 0;

  get muted(): boolean {
    return this._muted;
  }

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
    } catch {
      return;
    }
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._muted ? 0 : 0.65;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.masterGain);

    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0.35;
    this.ambienceGain.connect(this.masterGain);

    // Engine synth
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 55;

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 110;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // Shared noise buffer for rain, city wind, and tire screech
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Rain loop
    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer;
    rainSrc.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1350;
    rainFilter.Q.value = 0.6;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.ambienceGain);
    rainSrc.start();

    // Tire screech loop
    const screechSrc = this.ctx.createBufferSource();
    screechSrc.buffer = noiseBuffer;
    screechSrc.loop = true;
    const screechFilter = this.ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 2100;
    screechFilter.Q.value = 5.5;
    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;
    screechSrc.connect(screechFilter);
    screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.sfxGain);
    screechSrc.start();

    // Police siren
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxGain);
    this.sirenOsc.start();

    this.initialized = true;
  }

  public setMuted(muted: boolean): void {
    this._muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  public updateContinuous(params: {
    dt: number;
    inVehicle: boolean;
    vehicleClass: VehicleClassId;
    speedRatio: number;
    drifting: boolean;
    weather: WeatherType;
    policeActive: boolean;
    nearestPoliceDist: number;
    paused: boolean;
  }): void {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (params.paused) {
      this.engineGain?.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain?.gain.setTargetAtTime(0, now, 0.08);
      this.sirenGain?.gain.setTargetAtTime(0, now, 0.08);
      this.rainGain?.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Engine pitch & gain
    if (this.engineGain && this.engineOsc1 && this.engineOsc2 && this.engineFilter) {
      const isBicycle = params.vehicleClass === 'bicycle' || params.vehicleClass === 'speed_bicycle';
      if (params.inVehicle && !isBicycle) {
        let baseFreq = 52;
        if (
          params.vehicleClass === 'voxel_sesto' ||
          params.vehicleClass === 'voxel_centenario' ||
          params.vehicleClass === 'voxel_revuelto' ||
          params.vehicleClass === 'voxel_bolide' ||
          params.vehicleClass === 'voxel_jesko' ||
          params.vehicleClass === 'nova_x' ||
          params.vehicleClass === 'gold_wing_sovereign' ||
          params.vehicleClass === 'gold_wing_hyper'
        ) {
          baseFreq = 82;
        } else if (
          params.vehicleClass === 'supercar' ||
          params.vehicleClass === 'hyper_viper' ||
          params.vehicleClass === 'track_phantom' ||
          params.vehicleClass === 'gold_wing_coupe' ||
          params.vehicleClass === 'airplane'
        ) {
          baseFreq = 76;
        } else if (
          params.vehicleClass === 'sports' ||
          params.vehicleClass === 'motorcycle' ||
          params.vehicleClass === 'coupe' ||
          params.vehicleClass === 'convertible'
        ) {
          baseFreq = 68;
        } else if (params.vehicleClass === 'muscle') baseFreq = 44;
        else if (params.vehicleClass === 'truck' || params.vehicleClass === 'bus') baseFreq = 36;
        else if (params.vehicleClass === 'luxury') baseFreq = 48;

        const rpmFreq = baseFreq + params.speedRatio * baseFreq * 2.1;
        this.engineOsc1.frequency.setTargetAtTime(rpmFreq, now, 0.06);
        this.engineOsc2.frequency.setTargetAtTime(rpmFreq * 2.01, now, 0.06);
        this.engineFilter.frequency.setTargetAtTime(240 + params.speedRatio * 750, now, 0.06);
        this.engineGain.gain.setTargetAtTime(0.08 + params.speedRatio * 0.09, now, 0.08);
      } else {
        this.engineGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }

    // Tire screech
    if (this.screechGain) {
      const targetScreech = params.inVehicle && params.drifting ? 0.12 : 0;
      this.screechGain.gain.setTargetAtTime(targetScreech, now, 0.05);
    }

    // Rain ambience
    if (this.rainGain) {
      const targetRain = params.weather === 'rain' ? 0.35 : params.weather === 'cloudy' ? 0.05 : 0.02;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.3);
    }

    // Police siren wail
    if (this.sirenOsc && this.sirenGain) {
      if (params.policeActive && params.nearestPoliceDist < 160) {
        this.sirenPhase += params.dt * 2.6;
        const sirenFreq = 640 + Math.sin(this.sirenPhase) * 240;
        const atten = Math.max(0, 1 - params.nearestPoliceDist / 160);
        this.sirenOsc.frequency.setTargetAtTime(sirenFreq, now, 0.03);
        this.sirenGain.gain.setTargetAtTime(atten * 0.08, now, 0.05);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }
  }

  public playFootstep(sprinting: boolean, inWater: boolean): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const now = performance.now();
    const interval = sprinting ? 290 : 440;
    if (now - this.lastFootstepTime < interval) return;
    this.lastFootstepTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = inWater ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(inWater ? 260 : 120 + Math.random() * 25, t);
    osc.frequency.exponentialRampToValueAtTime(inWater ? 110 : 50, t + 0.07);
    gain.gain.setValueAtTime(inWater ? 0.07 : 0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playDoorLatch(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.09);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playHorn(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [340, 425].forEach((freq) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playBikeBell(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [0, 0.12].forEach((offset) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1680, t + offset);
      gain.gain.setValueAtTime(0.11, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.14);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.15);
    });
  }

  public playImpact(intensity: number): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const vol = Math.min(0.32, Math.max(0.04, intensity * 0.25));
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.18);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playMissionCue(kind: 'start' | 'step' | 'success' | 'fail'): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const notes =
      kind === 'success'
        ? [523.25, 659.25, 783.99, 1046.5]
        : kind === 'fail'
          ? [392, 349.23, 293.66]
          : kind === 'start'
            ? [440, 554.37, 659.25]
            : [587.33, 783.99];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const start = t + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playPhoneRing(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [0, 0.22, 0.55, 0.77].forEach((offset, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i % 2 === 0 ? 1180 : 1480, t + offset);
      gain.gain.setValueAtTime(0.12, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.17);
    });
  }

  public playCashPickup(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [659.25, 880, 1174.66, 1567.98].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const start = t + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  public playGunshot(isSmg: boolean): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isSmg ? 340 : 250, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + (isSmg ? 0.08 : 0.12));
    gain.gain.setValueAtTime(isSmg ? 0.14 : 0.19, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isSmg ? 0.09 : 0.14));
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playShotgun(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.24);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playRifle(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.11);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playRpgLaunch(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.35);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  public playPunch(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  public playExplosion(): void {
    if (!this.initialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Deep sub-bass boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(125, t);
    osc.frequency.exponentialRampToValueAtTime(24, t + 0.75);
    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.9);

    // Noise blast
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.7);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.22));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.65);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.45, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t);
  }

  public dispose(): void {
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.sirenOsc?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore audio shutdown errors
    }
    this.initialized = false;
  }
}
