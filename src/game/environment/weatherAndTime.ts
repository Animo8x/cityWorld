import * as THREE from 'three';
import { TimePhase, WeatherType } from '../types';

export class WeatherAndTimeSystem {
  public timeHours = 10.5; // Starts in bright late morning
  public timeSpeed = 0.14; // ~1 game hour every 7 real seconds
  public weather: WeatherType = 'clear';
  public snowAmount = 0;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;
  private skyColor = new THREE.Color(0x7ec8f2);
  private groundColor = new THREE.Color(0x3b4252);

  // Pooled 3D Rain streaks
  private rainMesh: THREE.InstancedMesh;
  private rainCount: number;
  private rainOffsets: Array<{ x: number; y: number; z: number; speed: number }> = [];

  // Pooled 3D Snowflakes
  private snowMesh: THREE.InstancedMesh;
  private snowCount: number;
  private snowOffsets: Array<{ x: number; y: number; z: number; speed: number; swayPhase: number; size: number }> = [];
  private snowTime = 0;
  private randomWeatherTimer = 68 + Math.random() * 58;

  private _dummy = new THREE.Object3D();
  private _daySky = new THREE.Color();
  private _sunsetSky = new THREE.Color(0xd97757);
  private _nightSky = new THREE.Color(0x091124);
  private _sunDayColor = new THREE.Color(0xfff5e4);
  private _sunSunsetColor = new THREE.Color(0xff9e64);
  private isSoftwareGl: boolean;

  constructor(scene: THREE.Scene, isSoftwareGl: boolean, isMobile = false) {
    this.isSoftwareGl = isSoftwareGl;
    this.rainCount = isMobile ? 160 : 320;
    this.snowCount = isMobile ? 210 : 380;

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x334155, 0.78);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    this.sunLight.position.set(80, 140, 60);
    if (!isSoftwareGl) {
      this.sunLight.castShadow = true;
      const mapSize = isMobile ? 1024 : 2048;
      this.sunLight.shadow.mapSize.set(mapSize, mapSize);
      const d = isMobile ? 95 : 125;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 320;
      this.sunLight.shadow.bias = -0.0006;
      this.sunLight.shadow.normalBias = 0.035;
    }
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.fog = new THREE.FogExp2(0x8ecae6, 0.0014);
    scene.fog = this.fog;
    scene.background = this.skyColor;

    // Rain particle instanced mesh
    const rainGeo = new THREE.BoxGeometry(0.035, 1.35, 0.035);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, this.rainCount);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;
    for (let i = 0; i < this.rainCount; i++) {
      this.rainOffsets.push({
        x: (Math.random() - 0.5) * 75,
        y: Math.random() * 28,
        z: (Math.random() - 0.5) * 75,
        speed: 26 + Math.random() * 10,
      });
    }
    scene.add(this.rainMesh);

    // Snowflakes particle instanced mesh
    const snowGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const snowMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, this.snowCount);
    this.snowMesh.frustumCulled = false;
    this.snowMesh.visible = false;
    for (let i = 0; i < this.snowCount; i++) {
      this.snowOffsets.push({
        x: (Math.random() - 0.5) * 78,
        y: Math.random() * 28,
        z: (Math.random() - 0.5) * 78,
        speed: 3.4 + Math.random() * 2.8,
        swayPhase: Math.random() * Math.PI * 2,
        size: 0.75 + Math.random() * 0.7,
      });
    }
    scene.add(this.snowMesh);
  }

  public setShadowsEnabled(enabled: boolean): void {
    this.sunLight.castShadow = !this.isSoftwareGl && enabled;
  }

  public setWeatherImmediate(next: WeatherType): void {
    this.weather = next;
    this.snowAmount = next === 'snow' ? 1 : 0;
  }

  public getTimePhase(): TimePhase {
    const h = this.timeHours;
    if (h >= 5 && h < 7.5) return 'Dawn';
    if (h >= 7.5 && h < 11.5) return 'Morning';
    if (h >= 11.5 && h < 15.5) return 'Noon';
    if (h >= 15.5 && h < 18.5) return 'Afternoon';
    if (h >= 18.5 && h < 20.5) return 'Sunset';
    return 'Night';
  }

  public isNight(): boolean {
    return this.timeHours < 6.0 || this.timeHours >= 19.5;
  }

  public formatClock(): string {
    const h = Math.floor(this.timeHours) % 24;
    const m = Math.floor((this.timeHours % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  public cycleWeather(): WeatherType {
    const order: WeatherType[] = ['clear', 'cloudy', 'rain', 'fog', 'snow'];
    const next = order[(order.indexOf(this.weather) + 1) % order.length];
    this.weather = next;
    this.randomWeatherTimer = 75 + Math.random() * 60;
    return next;
  }

  public rollRandomWeather(): WeatherType {
    const r = Math.random();
    let candidate: WeatherType;
    if (r < 0.36) candidate = 'clear';
    else if (r < 0.58) candidate = 'cloudy';
    else if (r < 0.74) candidate = 'rain';
    else if (r < 0.86) candidate = 'fog';
    else candidate = 'snow';

    if (candidate === this.weather) {
      candidate = this.weather === 'clear' ? 'snow' : 'clear';
    }
    this.weather = candidate;
    return candidate;
  }

  public advanceTimePreset(): void {
    const presets = [6.5, 12.5, 18.8, 22.5];
    const next = presets.find((p) => p > this.timeHours + 0.5) ?? presets[0];
    this.timeHours = next;
  }

  public sleepAdvanceHours(hours = 7): void {
    this.timeHours = (this.timeHours + hours) % 24;
  }

  public update(dt: number, focusX: number, focusZ: number, inInterior: boolean, allowRandomWeather = false): void {
    this.timeHours = (this.timeHours + this.timeSpeed * dt) % 24;
    this.snowTime += dt;

    if (allowRandomWeather && !inInterior) {
      this.randomWeatherTimer -= dt;
      if (this.randomWeatherTimer <= 0) {
        this.rollRandomWeather();
        this.randomWeatherTimer = 65 + Math.random() * 65;
      }
    }

    const targetSnow = this.weather === 'snow' ? 1 : 0;
    if (this.snowAmount < targetSnow) {
      this.snowAmount = Math.min(1, this.snowAmount + dt * 0.65);
    } else if (this.snowAmount > targetSnow) {
      this.snowAmount = Math.max(0, this.snowAmount - dt * 0.42);
    }

    // Sun orbital arc (6:00 sunrise -> 12:00 zenith -> 19:00 sunset)
    const sunAngle = ((this.timeHours - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);

    this.sunLight.position.set(focusX + sunX * 140, Math.max(25, sunY * 140), focusZ + 70);
    this.sunLight.target.position.set(focusX, 0, focusZ);

    const daylight = THREE.MathUtils.clamp((sunY + 0.15) / 0.55, 0, 1);
    const sunsetFactor = THREE.MathUtils.clamp(1 - Math.abs(sunY) * 4.2, 0, 1) * (daylight > 0 ? 1 : 0.35);

    // Sky & Fog colors (zero per-frame allocations)
    this._daySky.setHex(
      this.weather === 'rain'
        ? 0x475569
        : this.weather === 'cloudy'
          ? 0x64748b
          : this.weather === 'fog'
            ? 0x94a3b8
            : this.weather === 'snow'
              ? 0xcbd5e1
              : 0x6cb4e8
    );

    this.skyColor.copy(this._nightSky).lerp(this._daySky, daylight).lerp(this._sunsetSky, sunsetFactor * 0.65);
    this.fog.color.copy(this.skyColor);

    const baseFog =
      this.weather === 'fog'
        ? 0.0052
        : this.weather === 'rain'
          ? 0.0028
          : this.weather === 'snow'
            ? 0.0024
            : this.weather === 'cloudy'
              ? 0.0019
              : 0.0012;
    this.fog.density = inInterior ? 0.0005 : baseFog;

    // Sun & Hemisphere light intensities
    const weatherDim =
      this.weather === 'rain'
        ? 0.55
        : this.weather === 'cloudy'
          ? 0.72
          : this.weather === 'fog'
            ? 0.65
            : this.weather === 'snow'
              ? 0.84
              : 1.0;
    this.sunLight.intensity = (0.35 + daylight * 2.1) * weatherDim;
    this.sunLight.color
      .setHex(0x93c5fd) // moonlight cool
      .lerp(this._sunDayColor, daylight)
      .lerp(this._sunSunsetColor, sunsetFactor * 0.65);

    this.hemiLight.intensity = (0.28 + daylight * 0.6) * weatherDim;
    this.hemiLight.color.copy(this.skyColor);
    this.groundColor.setHex(
      daylight > 0.3 ? (this.snowAmount > 0.35 ? 0x94a3b8 : 0x3b4252) : this.snowAmount > 0.35 ? 0x1e293b : 0x0f172a
    );
    this.hemiLight.groundColor.copy(this.groundColor);

    // Rain particle update around camera focus
    if (this.weather === 'rain' && !inInterior) {
      this.rainMesh.visible = true;
      for (let i = 0; i < this.rainCount; i++) {
        const r = this.rainOffsets[i];
        r.y -= r.speed * dt;
        if (r.y < 0) r.y = 28;
        this._dummy.position.set(focusX + r.x, r.y, focusZ + r.z);
        this._dummy.rotation.set(0, 0, 0.08);
        this._dummy.scale.set(1, 1, 1);
        this._dummy.updateMatrix();
        this.rainMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.rainMesh.visible = false;
    }

    // Snowflakes particle update around camera focus
    if (this.weather === 'snow' && !inInterior) {
      this.snowMesh.visible = true;
      for (let i = 0; i < this.snowCount; i++) {
        const s = this.snowOffsets[i];
        s.y -= s.speed * dt;
        if (s.y < 0) s.y = 28;
        const swayX = Math.sin(this.snowTime * 1.4 + s.swayPhase) * 1.25;
        const swayZ = Math.cos(this.snowTime * 1.1 + s.swayPhase * 1.3) * 1.25;
        this._dummy.position.set(focusX + s.x + swayX, s.y, focusZ + s.z + swayZ);
        this._dummy.rotation.set(this.snowTime + s.swayPhase, this.snowTime * 0.7, s.swayPhase);
        this._dummy.scale.setScalar(s.size);
        this._dummy.updateMatrix();
        this.snowMesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.snowMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.snowMesh.visible = false;
    }
  }

  public dispose(): void {
    this.rainMesh.geometry.dispose();
    (this.rainMesh.material as THREE.Material).dispose();
    this.snowMesh.geometry.dispose();
    (this.snowMesh.material as THREE.Material).dispose();
  }
}
