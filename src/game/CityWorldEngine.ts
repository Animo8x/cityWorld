import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PedestrianSystem } from './ai/pedestrianSystem';
import { TrafficAgent, TrafficSystem } from './ai/trafficSystem';
import { SoundEngine } from './audio/soundEngine';
import { WeaponSystem } from './combat/weaponSystem';
import { WeatherAndTimeSystem } from './environment/weatherAndTime';
import { MISSION_REGISTRY, MissionSystem } from './missions/missionSystem';
import { ThirdPersonCameraController } from './player/cameraController';
import { FirstPersonViewmodel } from './player/firstPersonRig';
import { PlayerController } from './player/playerController';
import { PoliceUnit, WantedSystem } from './police/wantedSystem';
import {
  GamePhase,
  GpsPoint,
  HudSnapshot,
  InteriorPortalDef,
  Language,
  MapMarker,
  PlayerSkinId,
  QualityMode,
  VehicleClassId,
  WeaponId,
} from './types';
import { PLAYER_SKIN_LIST, PLAYER_SKINS } from './player/skinCatalog';
import { VEHICLE_CATALOG } from './vehicles/vehicleCatalog';
import { ExplosionSystem } from './vehicles/explosionSystem';
import {
  applyBulletImpactToVehicleRig,
  CollidableVehicle,
  findSafeVehicleSpawnNearPlayer,
  isAirplaneClass,
  isBicycleClass,
  resolveVehiclePairCollision,
  VehicleManager,
  WorldVehicle,
} from './vehicles/vehiclePhysics';
import { computeRoadGpsPath, GpsPathRenderer } from './world/gpsNavigation';
import { buildInteriors, InteriorsHandle } from './world/interiors';
import { createProceduralTextures, ProceduralTextureSet } from './world/textures';
import { buildCityWorld, WorldBuildResult } from './world/worldBuilder';
import { getDistrictAt, groundHeightAt, INTERIOR_PORTALS } from './world/worldLayout';

export class CityWorldEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: HudSnapshot) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private isMobile: boolean;
  private qualityMode: QualityMode = 'medium';
  private language: Language = 'en';
  private shadowFrameCounter = 0;
  private streamRadius = 640;
  private pedCullDist = 200;
  private trafficCullDist = 300;

  private textures: ProceduralTextureSet;
  private world: WorldBuildResult;
  private interiors: InteriorsHandle;
  private player: PlayerController;
  private fpRig: FirstPersonViewmodel;
  private cameraCtrl: ThirdPersonCameraController;
  private vehicleMgr: VehicleManager;
  private explosions: ExplosionSystem;
  private traffic: TrafficSystem;
  private pedestrians: PedestrianSystem;
  private wanted: WantedSystem;
  private weapons: WeaponSystem;
  private missions: MissionSystem;
  private weatherTime: WeatherAndTimeSystem;
  private gpsRenderer: GpsPathRenderer;
  public sound: SoundEngine;

  public phase: GamePhase = 'title';
  private activeVehicle: WorldVehicle | null = null;
  private activeInterior: InteriorPortalDef | null = null;
  private money = 1500;
  private ownedVehicles = new Set<VehicleClassId>();
  private ownedSkins = new Set<PlayerSkinId>(['classic']);
  private ownedHouses = new Set<string>();
  private customWaypoint: { x: number; z: number } | null = null;
  private gpsPath: GpsPoint[] = [];
  private gpsTargetPos: GpsPoint | null = null;
  private gpsLastCalcX = 9999;
  private gpsLastCalcZ = 9999;
  private gpsLastTargetKey = '';
  private missionBanner: HudSnapshot['missionBanner'] = null;
  private bannerTimer = 0;
  private worldBorderNoticeTimer = 0;
  private devCodeActivated = false;

  // Input state: held vs justPressed + Mobile virtual input
  private held = new Set<string>();
  private justPressed = new Set<string>();
  private firingActive = false;
  private virtualInput = {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jump: false,
    throttle: 0,
    steer: 0,
    handbrake: false,
    climb: 0,
  };
  private isDraggingCamera = false;
  private downPointerX = 0;
  private downPointerY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private activeTouchId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private lastPinchDist = 0;
  private manualOrbitTimer = 0;

  // Loop & timing
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private simTime = 0;
  private hudAccum = 0;
  private streamAccum = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private envTexture: THREE.Texture | null = null;
  private readonly emptyRocketTargets: Array<{ x: number; y: number; z: number; radius: number }> = [];

  constructor(container: HTMLElement, onHudUpdate: (hud: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    this.isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth < 768);

    // 1. Software WebGL detection
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer setup (Full visual fidelity preserved: highp shaders, antialiasing, crisp resolution, soft shadows)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.35));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = !this.isMobile;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.25,
      1150
    );

    this.qualityMode = this.isMobile ? 'medium' : 'high';
    let savedLang: string | null = null;
    try {
      savedLang = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('cityworld_lang') : null;
    } catch {
      savedLang = null;
    }
    if (savedLang === 'ar' || savedLang === 'en') {
      this.language = savedLang;
    }

    // 4. Initialize Subsystems
    this.sound = new SoundEngine();
    this.weatherTime = new WeatherAndTimeSystem(this.scene, this.isSoftwareGl, this.isMobile);
    this.textures = createProceduralTextures(this.renderer);
    this.world = buildCityWorld(this.scene, this.textures, this.isMobile);
    this.interiors = buildInteriors(this.scene);

    this.player = new PlayerController(this.scene);
    this.fpRig = new FirstPersonViewmodel();
    this.scene.add(this.camera);
    this.camera.add(this.fpRig.root);
    this.cameraCtrl = new ThirdPersonCameraController();
    this.vehicleMgr = new VehicleManager(this.scene);
    this.vehicleMgr.spawnInitialFleet();
    this.explosions = new ExplosionSystem(this.scene);

    this.traffic = new TrafficSystem(this.scene, 36);
    this.pedestrians = new PedestrianSystem(this.scene, 42);
    this.wanted = new WantedSystem(this.scene);
    this.weapons = new WeaponSystem(this.scene);
    this.missions = new MissionSystem(this.scene);
    this.gpsRenderer = new GpsPathRenderer(this.scene);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.applyQualitySettings();
    this.bindEvents();
    this.pushHud();
    this.clock.start();
    this.tick();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd);
    canvas.addEventListener('touchcancel', this.handleTouchEnd);
    canvas.addEventListener('wheel', this.handleWheel, { passive: true });
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    canvas.removeEventListener('touchstart', this.handleTouchStart);
    canvas.removeEventListener('touchmove', this.handleTouchMove);
    canvas.removeEventListener('touchend', this.handleTouchEnd);
    canvas.removeEventListener('touchcancel', this.handleTouchEnd);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleContextMenu = (e: MouseEvent) => e.preventDefault();

  private handleResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleBlur = () => {
    this.held.clear();
    this.isDraggingCamera = false;
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      if (e.code === 'Escape') {
        target.blur();
      }
      return;
    }
    if (e.repeat) return;
    this.sound.init();
    if (e.code === 'Tab') e.preventDefault();
    this.held.add(e.code);
    this.justPressed.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  private handleMouseDown = (e: MouseEvent) => {
    this.sound.init();
    if (this.phase === 'playing' && e.button === 0) {
      this.isDraggingCamera = true;
      this.downPointerX = e.clientX;
      this.downPointerY = e.clientY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.cameraCtrl.rotate(e.movementX, e.movementY);
      this.manualOrbitTimer = 2.5;
    } else if (this.isDraggingCamera) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.cameraCtrl.rotate(dx, dy);
      this.manualOrbitTimer = 2.5;
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (this.isDraggingCamera && e.button === 0 && this.phase === 'playing') {
      const moved = Math.hypot(e.clientX - this.downPointerX, e.clientY - this.downPointerY);
      if (moved < 6 && !this.activeVehicle && !this.player.inInterior) {
        this.justPressed.add('FireWeapon');
      }
    }
    this.isDraggingCamera = false;
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.phase === 'playing') {
      this.cameraCtrl.zoom(e.deltaY);
    }
  };

  private handleTouchStart = (e: TouchEvent) => {
    this.sound.init();
    if (this.phase !== 'playing') return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this.activeTouchId = t.identifier;
      this.lastTouchX = t.clientX;
      this.lastTouchY = t.clientY;
    } else if (e.touches.length === 2) {
      this.activeTouchId = null;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.lastPinchDist = Math.hypot(dx, dy);
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (this.phase !== 'playing') return;
    e.preventDefault();
    if (e.touches.length === 1 && this.activeTouchId !== null) {
      const t = Array.from(e.touches).find((pt) => pt.identifier === this.activeTouchId);
      if (!t) return;
      const dx = t.clientX - this.lastTouchX;
      const dy = t.clientY - this.lastTouchY;
      this.lastTouchX = t.clientX;
      this.lastTouchY = t.clientY;
      this.cameraCtrl.rotate(dx * 1.4, dy * 1.4);
      this.manualOrbitTimer = 2.5;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (this.lastPinchDist > 0) {
        this.cameraCtrl.zoom((this.lastPinchDist - dist) * 2.2);
      }
      this.lastPinchDist = dist;
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      this.activeTouchId = null;
      this.lastPinchDist = 0;
    }
  };

  public setVirtualInput(next: Partial<typeof this.virtualInput>): void {
    Object.assign(this.virtualInput, next);
  }

  public triggerEnterExitVehicle(): void {
    this.sound.init();
    this.justPressed.add('KeyF');
  }

  public triggerInteract(): void {
    this.sound.init();
    this.justPressed.add('KeyE');
  }

  public triggerHorn(): void {
    this.sound.init();
    this.justPressed.add('KeyH');
  }

  public triggerHeadlights(): void {
    this.sound.init();
    this.justPressed.add('KeyL');
  }

  public setFiring(active: boolean): void {
    this.sound.init();
    this.firingActive = active;
    if (active) {
      this.justPressed.add('FireWeapon');
    }
  }

  public triggerPunch(): void {
    this.sound.init();
    this.justPressed.add('PunchAction');
  }

  public cycleWeapon(): void {
    this.sound.init();
    this.weapons.cycleWeapon();
    this.pushHud();
  }

  public toggleFirstPerson(): void {
    this.sound.init();
    const fp = this.cameraCtrl.toggleFirstPerson(this.activeVehicle?.heading ?? this.player.heading);
    if (!fp && this.activeVehicle) {
      this.activeVehicle.rig.cabinGroup.visible = true;
    }
    this.missionBanner = {
      title:
        this.language === 'ar'
          ? fp
            ? 'منظور الشخص الأول'
            : 'منظور الشخص الثالث'
          : fp
            ? 'First-Person View'
            : 'Third-Person View',
      subtitle:
        this.language === 'ar'
          ? fp
            ? 'اضغط C أو زر الكاميرا للتبديل'
            : 'تمت العودة للمنظور الخارجي'
          : fp
            ? 'Press C or Camera icon anytime to toggle'
            : 'Switched back to chase camera',
      kind: 'info',
    };
    this.bannerTimer = 2.0;
    this.pushHud();
  }

  public setLanguage(lang: Language): void {
    this.language = lang;
    try {
      window.localStorage.setItem('cityworld_lang', lang);
    } catch {
      // ignore storage failure
    }
    this.pushHud();
  }

  public setQualityMode(mode: QualityMode): void {
    this.qualityMode = mode;
    this.applyQualitySettings();
    this.pushHud();
  }

  private applyQualitySettings(): void {
    const dpr = window.devicePixelRatio || 1;
    let targetPr = 1.0;
    let shadowsOn = false;
    let shadowAuto = false;
    let farPlane = 950;
    let trafficCount = 28;
    let pedCount = 28;
    let useEnvIbl = true;

    switch (this.qualityMode) {
      case 'very_low':
        targetPr = Math.min(dpr, 0.9);
        shadowsOn = false;
        useEnvIbl = false;
        farPlane = 600;
        this.streamRadius = 480;
        this.trafficCullDist = 200;
        this.pedCullDist = 140;
        trafficCount = 16;
        pedCount = 14;
        break;
      case 'low':
        targetPr = Math.min(dpr, 1.15);
        shadowsOn = !this.isSoftwareGl;
        shadowAuto = false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        farPlane = 780;
        this.streamRadius = 560;
        this.trafficCullDist = 250;
        this.pedCullDist = 175;
        trafficCount = 22;
        pedCount = 20;
        break;
      case 'medium':
        targetPr = Math.min(dpr, 1.35);
        shadowsOn = !this.isSoftwareGl;
        shadowAuto = false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        farPlane = 950;
        this.streamRadius = 640;
        this.trafficCullDist = 300;
        this.pedCullDist = 200;
        trafficCount = 28;
        pedCount = 28;
        break;
      case 'high':
        targetPr = Math.min(dpr, 1.75);
        shadowsOn = !this.isSoftwareGl;
        shadowAuto = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        farPlane = 1150;
        this.streamRadius = 760;
        this.trafficCullDist = 360;
        this.pedCullDist = 250;
        trafficCount = 34;
        pedCount = 36;
        break;
      case 'ultra':
        targetPr = Math.min(dpr, 2.0);
        shadowsOn = !this.isSoftwareGl;
        shadowAuto = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        farPlane = 1350;
        this.streamRadius = 920;
        this.trafficCullDist = 420;
        this.pedCullDist = 290;
        trafficCount = 36;
        pedCount = 42;
        break;
    }

    if (useEnvIbl && !this.isSoftwareGl) {
      if (!this.envTexture) {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
      }
      this.scene.environment = this.envTexture;
    } else {
      this.scene.environment = null;
    }

    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : targetPr);
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);

    this.renderer.shadowMap.enabled = shadowsOn;
    this.weatherTime.setShadowsEnabled(shadowsOn);
    this.renderer.shadowMap.autoUpdate = shadowAuto;
    this.renderer.shadowMap.needsUpdate = true;

    this.traffic.setActiveCount(trafficCount);
    this.pedestrians.setActiveCount(pedCount);

    this.camera.far = farPlane;
    this.camera.updateProjectionMatrix();
  }

  public startGame(): void {
    this.sound.init();
    this.phase = 'playing';
    this.missionBanner = {
      title: this.language === 'ar' ? 'أهلاً بك في CityWorld' : 'Welcome to CityWorld',
      subtitle:
        this.language === 'ar'
          ? 'اسرق أي سيارة في الشارع أو الشرطة، أو استخدم زر البوكس والأسلحة!'
          : 'Steal any street or police car, use the Punch button near people, or fire weapons.',
      kind: 'info',
    };
    this.bannerTimer = 5.5;
    this.pushHud();
  }

  public setPhase(next: GamePhase): void {
    this.phase = next;
    this.held.clear();
    this.firingActive = false;
    this.pushHud();
  }

  public togglePause(): void {
    if (this.phase === 'playing') this.setPhase('paused');
    else if (
      this.phase === 'paused' ||
      this.phase === 'map' ||
      this.phase === 'interior_shop' ||
      this.phase === 'phone' ||
      this.phase === 'backpack'
    ) {
      this.setPhase('playing');
    }
  }

  public toggleMap(): void {
    if (this.phase === 'playing') this.setPhase('map');
    else if (this.phase === 'map') this.setPhase('playing');
  }

  public togglePhone(): void {
    if (this.phase === 'playing') this.setPhase('phone');
    else if (this.phase === 'phone') this.setPhase('playing');
  }

  public toggleBackpack(): void {
    if (this.phase === 'playing') this.setPhase('backpack');
    else if (this.phase === 'backpack') this.setPhase('playing');
  }

  public equipSkin(skinId: PlayerSkinId): void {
    if (!this.ownedSkins.has(skinId)) return;
    this.player.applySkin(skinId);
    this.fpRig.syncSkin(skinId);
    this.sound.playMissionCue('step');
    const skin = PLAYER_SKINS[skinId];
    this.missionBanner = {
      title: this.language === 'ar' ? skin.nameAr : skin.name,
      subtitle: this.language === 'ar' ? 'تم ارتداء السكن الجديد!' : 'Skin equipped!',
      kind: 'success',
    };
    this.bannerTimer = 2.8;
    this.pushHud();
  }

  public summonOwnedVehicle(classId: VehicleClassId): void {
    if (!this.ownedVehicles.has(classId)) return;
    this.sound.init();

    if (this.player.inInterior && this.activeInterior) {
      this.exitInterior();
    }

    if (this.activeVehicle) {
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle.rig.cabinGroup.visible = true;
      this.player.setRidingPose('none', 0, 0);
      this.player.root.visible = !this.cameraCtrl.firstPerson;
      this.activeVehicle = null;
    }

    // Keep at most 3 previously delivered phone vehicles
    const summoned = this.vehicleMgr.vehicles.filter((v) => v.id.startsWith('phone_') && !v.occupiedByPlayer);
    if (summoned.length >= 3) {
      const oldest = summoned[0];
      const idx = this.vehicleMgr.vehicles.indexOf(oldest);
      if (idx >= 0) {
        this.scene.remove(oldest.rig.root);
        oldest.rig.dispose();
        this.vehicleMgr.vehicles.splice(idx, 1);
      }
    }

    const safe = findSafeVehicleSpawnNearPlayer(
      this.player.x,
      this.player.y,
      this.player.z,
      this.player.heading,
      classId,
      this.world.colliders,
      this.vehicleMgr.vehicles,
      this.traffic.agents
    );

    this.vehicleMgr.spawnVehicle(`phone_${Date.now()}`, classId, safe.x, safe.z, safe.heading);
    const spec = VEHICLE_CATALOG[classId];
    this.sound.playMissionCue('step');
    this.phase = 'playing';
    this.missionBanner = {
      title: this.language === 'ar' ? spec.nameAr : spec.name,
      subtitle:
        this.language === 'ar'
          ? 'تم إحضار سيارتك في مكان آمن قريب منك!'
          : 'Your vehicle has been safely delivered nearby!',
      kind: 'success',
    };
    this.bannerTimer = 3.5;
    this.pushHud();
  }

  public redeemSecretCode(rawCode: string): { ok: boolean; message: string } {
    const code = rawCode.trim();
    if (code !== 'MUHAMMD8') {
      return {
        ok: false,
        message: this.language === 'ar' ? 'الكود غير صحيح! جرب الكود المخصص.' : 'Invalid code! Access denied.',
      };
    }

    this.sound.init();
    this.devCodeActivated = true;
    this.money = Math.max(this.money, 1_000_000);
    this.player.health = this.player.maxHealth;
    this.player.armor = this.player.maxArmor;
    this.player.stamina = this.player.maxStamina;

    (['pistol', 'smg', 'shotgun', 'rifle', 'rpg'] as WeaponId[]).forEach((w) => {
      this.weapons.ownedWeapons.add(w);
      this.weapons.ammoByWeapon[w] = w === 'rpg' ? 99 : 999;
    });
    this.weapons.ownedWeapons.add('fists');

    PLAYER_SKIN_LIST.forEach((s) => this.ownedSkins.add(s.id));
    INTERIOR_PORTALS.filter((p) => p.kind === 'house').forEach((p) => this.ownedHouses.add(p.id));
    (Object.keys(VEHICLE_CATALOG) as VehicleClassId[]).forEach((v) => this.ownedVehicles.add(v));

    this.sound.playMissionCue('success');
    this.missionBanner = {
      title: this.language === 'ar' ? 'تم تفعيل كود المطورين MUHAMMD8!' : 'Developer Code MUHAMMD8 Activated!',
      subtitle:
        this.language === 'ar'
          ? 'تم منحك $1,000,000 وفتح جميع السيارات والطائرات والأسلحة والسكنات والبيوت!'
          : '$1,000,000 added & all vehicles, weapons, skins, and houses unlocked!',
      kind: 'success',
    };
    this.bannerTimer = 5.0;
    this.pushHud();

    return {
      ok: true,
      message:
        this.language === 'ar'
          ? 'تم التفعيل بنجاح! لديك الآن $1,000,000 وكل شيء مفتوح في الهاتف والحقيبة.'
          : 'Unlocked! $1,000,000 & all vehicles, skins, weapons, and houses are yours.',
    };
  }

  public teleportToHouse(houseId: string): void {
    if (!this.ownedHouses.has(houseId)) return;
    const portal = INTERIOR_PORTALS.find((p) => p.id === houseId && p.kind === 'house');
    if (!portal) return;

    this.sound.init();
    if (this.player.inInterior && this.activeInterior) {
      this.exitInterior();
    }
    if (this.activeVehicle) {
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle.rig.cabinGroup.visible = true;
      this.activeVehicle = null;
    }

    this.player.inInterior = false;
    this.player.setRidingPose('none', 0, 0);
    this.player.root.visible = !this.cameraCtrl.firstPerson;
    this.player.x = portal.exteriorPos.x;
    this.player.z = portal.exteriorPos.z + 2.8;
    this.player.y = groundHeightAt(this.player.x, this.player.z);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.heading = Math.PI;
    this.cameraCtrl.yaw = this.cameraCtrl.firstPerson ? 0 : 0;

    if (
      this.customWaypoint &&
      Math.hypot(this.customWaypoint.x - portal.exteriorPos.x, this.customWaypoint.z - portal.exteriorPos.z) < 20
    ) {
      this.customWaypoint = null;
    }

    this.phase = 'playing';
    this.sound.playMissionCue('step');
    const hName = this.language === 'ar' ? portal.nameAr : portal.name;
    this.missionBanner = {
      title: hName,
      subtitle:
        this.language === 'ar'
          ? 'تم الانتقال الفوري إلى منزلك! اضغط E للدخول.'
          : 'Teleported to your home! Press E to step inside.',
      kind: 'success',
    };
    this.bannerTimer = 3.5;
    this.pushHud();
  }

  public setCustomWaypoint(pt: { x: number; z: number } | null): void {
    this.customWaypoint = pt;
    this.gpsLastTargetKey = '';
    this.refreshGpsRoute(true);
    this.pushHud();
  }

  public cycleWeather(): void {
    this.weatherTime.cycleWeather();
    this.pushHud();
  }

  public advanceTimePreset(): void {
    this.weatherTime.advanceTimePreset();
    this.pushHud();
  }

  public toggleMute(): void {
    this.sound.init();
    this.sound.toggleMute();
    this.pushHud();
  }

  public startMissionById(id: string): void {
    this.sound.init();
    if (this.missions.activeMission) {
      this.missions.abortMission();
    }
    const ok = this.missions.startMission(
      id,
      (stars) => this.wanted.addCrimeHeat(stars * 95),
      () => this.sound.playMissionCue('start')
    );
    if (ok && this.missions.activeMission) {
      const m = this.missions.activeMission;
      this.missionBanner = {
        title: this.language === 'ar' ? m.titleAr : m.title,
        subtitle: this.language === 'ar' ? m.steps[0].descriptionAr : m.steps[0].description,
        kind: 'info',
      };
      this.bannerTimer = 4.5;
      if (this.phase !== 'playing') this.phase = 'playing';
      this.pushHud();
    }
  }

  public abortActiveMission(): void {
    this.missions.abortMission();
    this.pushHud();
  }

  public executeInteriorAction(actionId: string): void {
    if (!this.activeInterior) return;
    const action = this.activeInterior.shopActions.find((a) => a.id === actionId);
    if (!action) return;

    // Check if buying a skin already owned -> free equip without charging
    if (actionId.startsWith('buy_skin_')) {
      const skinId = actionId.replace('buy_skin_', '') as PlayerSkinId;
      if (this.ownedSkins.has(skinId)) {
        this.player.applySkin(skinId);
        this.fpRig.syncSkin(skinId);
        this.sound.playMissionCue('step');
        this.missionBanner = {
          title: this.language === 'ar' ? action.labelAr : action.label,
          subtitle: this.language === 'ar' ? 'تم تجهيز السكن المملوك!' : 'Owned skin equipped!',
          kind: 'success',
        };
        this.bannerTimer = 3.0;
        this.pushHud();
        return;
      }
    }

    if (actionId === 'buy_house') {
      if (this.ownedHouses.has(this.activeInterior.id)) {
        this.missionBanner = {
          title: this.language === 'ar' ? this.activeInterior.nameAr : this.activeInterior.name,
          subtitle: this.language === 'ar' ? 'أنت تمتلك هذا المنزل بالفعل!' : 'You already own this home!',
          kind: 'info',
        };
        this.bannerTimer = 2.8;
        this.pushHud();
        return;
      }
    }

    if ((actionId === 'house_eat' || actionId === 'house_sleep') && !this.ownedHouses.has(this.activeInterior.id)) {
      this.missionBanner = {
        title: this.language === 'ar' ? 'يجب شراء المنزل أولاً' : 'Home Ownership Required',
        subtitle:
          this.language === 'ar'
            ? 'قم بشراء هذا المنزل أولاً لتتمكن من الأكل والنوم بداخله.'
            : 'Buy this house first to eat and sleep inside.',
        kind: 'fail',
      };
      this.bannerTimer = 3.2;
      this.pushHud();
      return;
    }

    if (this.money < action.cost) {
      this.missionBanner = {
        title: this.language === 'ar' ? 'الرصيد غير كافٍ' : 'Insufficient Funds',
        subtitle: this.language === 'ar' ? `يتطلب $${action.cost}` : `Requires $${action.cost}`,
        kind: 'fail',
      };
      this.bannerTimer = 3.0;
      this.pushHud();
      return;
    }

    this.money -= action.cost;
    if (actionId === 'buy_house') {
      this.ownedHouses.add(this.activeInterior.id);
    } else if (actionId === 'house_eat') {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 60);
      this.player.stamina = this.player.maxStamina;
    } else if (actionId === 'house_sleep') {
      this.player.health = this.player.maxHealth;
      this.player.stamina = this.player.maxStamina;
      this.wanted.clearWanted();
      this.weatherTime.sleepAdvanceHours(7);
    } else if (actionId === 'repair_armor' || actionId === 'buy_armor') {
      this.player.health = this.player.maxHealth;
      this.player.armor = this.player.maxArmor;
    } else if (actionId === 'buy_energy_drink') {
      this.player.stamina = this.player.maxStamina;
    } else if (actionId === 'buy_hot_meal') {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 45);
    } else if (actionId === 'buy_medkit') {
      this.player.health = this.player.maxHealth;
    } else if (actionId === 'buy_light_vest') {
      this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 60);
    } else if (actionId === 'buy_ammo_rpg' || actionId === 'buy_weapon_ammo_crate') {
      this.weapons.addSupermarketAmmoPack();
    } else if (actionId === 'buy_weapon_pistol') {
      this.weapons.unlockOrRefillWeapon('pistol', 90);
    } else if (actionId === 'buy_weapon_smg') {
      this.weapons.unlockOrRefillWeapon('smg', 180);
    } else if (actionId === 'buy_weapon_shotgun') {
      this.weapons.unlockOrRefillWeapon('shotgun', 36);
    } else if (actionId === 'buy_weapon_rifle') {
      this.weapons.unlockOrRefillWeapon('rifle', 150);
    } else if (actionId === 'buy_weapon_rpg') {
      this.weapons.unlockOrRefillWeapon('rpg', 6);
    } else if (actionId.startsWith('buy_skin_')) {
      const skinId = actionId.replace('buy_skin_', '') as PlayerSkinId;
      this.ownedSkins.add(skinId);
      this.player.applySkin(skinId);
      this.fpRig.syncSkin(skinId);
    } else if (actionId === 'collect_dividend') {
      this.money += 350;
    } else if (actionId === 'clear_wanted') {
      this.wanted.clearWanted();
    } else if (actionId === 'rest_heal') {
      this.player.health = this.player.maxHealth;
      this.player.stamina = this.player.maxStamina;
      this.wanted.clearWanted();
    } else if (actionId.startsWith('spawn_') || actionId.startsWith('buy_car_')) {
      const clsMap: Record<string, VehicleClassId> = {
        spawn_supercar: 'supercar',
        spawn_sports: 'sports',
        spawn_luxury: 'luxury',
        spawn_moto: 'motorcycle',
        spawn_suv: 'suv',
        spawn_speed_bike: 'speed_bicycle',
        buy_car_compact: 'compact',
        buy_car_sedan: 'sedan',
        buy_car_suv: 'suv',
        buy_car_motorcycle: 'motorcycle',
        buy_car_muscle: 'muscle',
        buy_car_sports: 'sports',
        buy_car_luxury: 'luxury',
        buy_car_supercar: 'supercar',
        buy_car_hyper_viper: 'hyper_viper',
        buy_car_track_phantom: 'track_phantom',
        buy_car_nova_x: 'nova_x',
        buy_car_airplane: 'airplane',
      };
      const cls = clsMap[actionId] ?? 'sports';
      this.ownedVehicles.add(cls);
      const ext = this.activeInterior.exteriorPos;
      const spawnZOffset = this.activeInterior.kind === 'garage' || this.activeInterior.kind === 'supermarket' ? 6 : -6;
      this.exitInterior();
      const safe = findSafeVehicleSpawnNearPlayer(
        ext.x,
        ext.y,
        ext.z + spawnZOffset,
        Math.PI,
        cls,
        this.world.colliders,
        this.vehicleMgr.vehicles,
        this.traffic.agents
      );
      this.vehicleMgr.spawnVehicle(`bought_${Date.now()}`, cls, safe.x, safe.z, safe.heading);
    }

    this.sound.playMissionCue('step');
    this.missionBanner = {
      title: this.language === 'ar' ? action.labelAr : action.label,
      subtitle:
        actionId === 'buy_house'
          ? this.language === 'ar'
            ? 'أصبح المنزل ملكك! يمكنك الأكل والنوم بداخله في أي وقت.'
            : 'Property purchased! Eat and sleep inside anytime.'
          : actionId === 'house_eat'
            ? this.language === 'ar'
              ? 'تناولت وجبة شهية! تم شحن الصحة والطاقة.'
              : 'Meal enjoyed! Health & stamina restored.'
            : actionId === 'house_sleep'
              ? this.language === 'ar'
                ? 'نمت جيداً (+7 ساعات)! صحة كاملة وإزالة الشرطة.'
                : 'Slept 7 hours! Full health & wanted cleared.'
              : actionId.startsWith('buy_skin_')
                ? this.language === 'ar'
                  ? 'تم الشراء! يمكنك التبديل بين السكنات من الحقيبة.'
                  : 'Purchased! Swap skins anytime in your Backpack.'
                : actionId.startsWith('buy_car_') || actionId.startsWith('spawn_')
                  ? this.language === 'ar'
                    ? 'تم الشراء وإضافتها إلى هاتفك!'
                    : 'Purchased & added to your Phone!'
                  : this.language === 'ar'
                    ? 'تمت العملية بنجاح!'
                    : 'Transaction complete!',
      kind: 'success',
    };
    this.bannerTimer = 3.4;
    this.pushHud();
  }

  public exitInterior(): void {
    if (!this.activeInterior) return;
    const ext = this.activeInterior.exteriorPos;
    const kind = this.activeInterior.kind;
    const exitOffsetZ = kind === 'gunshop' || kind === 'skins' || kind === 'dealership' ? -3.2 : 3.2;
    this.player.inInterior = false;
    this.player.interiorFloorY = 0;
    this.player.interiorHalfW = 11;
    this.player.interiorHalfD = 11;
    this.player.x = ext.x;
    this.player.y = ext.y;
    this.player.z = ext.z + exitOffsetZ;
    this.activeInterior = null;
    this.interiors.setActiveInterior(null);
    this.phase = 'playing';
    this.sound.playDoorLatch();
    this.pushHud();
  }

  public respawnAfterWasted(): void {
    this.player.respawnAtHospital();
    this.weapons.refillAmmo();
    this.wanted.clearWanted();
    if (this.activeVehicle) {
      this.activeVehicle.occupiedByPlayer = false;
      this.activeVehicle.rig.cabinGroup.visible = true;
    }
    this.activeVehicle = null;
    this.activeInterior = null;
    this.interiors.setActiveInterior(null);
    this.firingActive = false;
    this.phase = 'playing';
    this.missionBanner = {
      title: this.language === 'ar' ? 'مستشفى CityWorld العام' : 'CityWorld General Hospital',
      subtitle:
        this.language === 'ar'
          ? 'تم علاجك وإعادة تعبئة أسلحتك وإزالة الملاحقة.'
          : 'Treated & discharged outside Downtown Hospital. Weapons restocked.',
      kind: 'info',
    };
    this.bannerTimer = 4.5;
    this.pushHud();
  }

  private getInteractionContext(): {
    prompt: string | null;
    nearVehicle: WorldVehicle | null;
    nearTrafficAgent: TrafficAgent | null;
    nearPoliceUnit: PoliceUnit | null;
    nearMissionId: string | null;
    nearPortal: InteriorPortalDef | null;
    nearInteriorExit: boolean;
    nearHouseFood: boolean;
    nearHouseBed: boolean;
  } {
    if (this.activeVehicle) {
      return {
        prompt: null,
        nearVehicle: null,
        nearTrafficAgent: null,
        nearPoliceUnit: null,
        nearMissionId: null,
        nearPortal: null,
        nearInteriorExit: false,
        nearHouseFood: false,
        nearHouseBed: false,
      };
    }

    if (this.player.inInterior && this.activeInterior) {
      const cx = this.activeInterior.interiorCenter.x;
      const shopName = this.language === 'ar' ? this.activeInterior.nameAr : this.activeInterior.name;

      if (this.activeInterior.kind === 'house') {
        const tier = this.activeInterior.houseSizeTier ?? 1;
        const halfW = tier === 1 ? 9 : tier === 2 ? 11 : tier === 3 ? 14 : 17;
        const halfD = tier === 1 ? 9 : tier === 2 ? 11 : tier === 3 ? 13 : 15;
        const foodX = cx - halfW * 0.48;
        const bedX = cx + halfW * 0.48;
        const owned = this.ownedHouses.has(this.activeInterior.id);

        if (Math.hypot(this.player.x - foodX, this.player.z - -1.5) < 3.0) {
          return {
            prompt: owned
              ? this.language === 'ar'
                ? '[E] تناول الطعام في البيت (+60 صحة)'
                : '[E] Eat Home Food (+60 HP)'
              : this.language === 'ar'
                ? `[E] شراء البيت أولاً ($${this.activeInterior.housePrice ?? 5500})`
                : `[E] Buy House First ($${this.activeInterior.housePrice ?? 5500})`,
            nearVehicle: null,
            nearTrafficAgent: null,
            nearPoliceUnit: null,
            nearMissionId: null,
            nearPortal: null,
            nearInteriorExit: false,
            nearHouseFood: owned,
            nearHouseBed: false,
          };
        }

        if (Math.hypot(this.player.x - bedX, this.player.z - -1.5) < 3.2) {
          return {
            prompt: owned
              ? this.language === 'ar'
                ? '[E] النوم على السرير (+7 ساعات وشفاء كامل)'
                : '[E] Sleep in Bed (+7h & Full Heal)'
              : this.language === 'ar'
                ? `[E] شراء البيت أولاً ($${this.activeInterior.housePrice ?? 5500})`
                : `[E] Buy House First ($${this.activeInterior.housePrice ?? 5500})`,
            nearVehicle: null,
            nearTrafficAgent: null,
            nearPoliceUnit: null,
            nearMissionId: null,
            nearPortal: null,
            nearInteriorExit: false,
            nearHouseFood: false,
            nearHouseBed: owned,
          };
        }

        const deskZ = -halfD + 3.2;
        if (Math.abs(this.player.x - cx) < 3.6 && Math.abs(this.player.z - deskZ) < 3.4) {
          return {
            prompt: this.language === 'ar' ? `[E] قائمة ${shopName}` : `[E] ${shopName} Menu`,
            nearVehicle: null,
            nearTrafficAgent: null,
            nearPoliceUnit: null,
            nearMissionId: null,
            nearPortal: null,
            nearInteriorExit: false,
            nearHouseFood: false,
            nearHouseBed: false,
          };
        }

        if (this.player.z > halfD - 2.6) {
          return {
            prompt: this.language === 'ar' ? '[E] الخروج إلى المدينة' : '[E] Exit to CityWorld',
            nearVehicle: null,
            nearTrafficAgent: null,
            nearPoliceUnit: null,
            nearMissionId: null,
            nearPortal: null,
            nearInteriorExit: true,
            nearHouseFood: false,
            nearHouseBed: false,
          };
        }

        return {
          prompt: null,
          nearVehicle: null,
          nearTrafficAgent: null,
          nearPoliceUnit: null,
          nearMissionId: null,
          nearPortal: null,
          nearInteriorExit: false,
          nearHouseFood: false,
          nearHouseBed: false,
        };
      }

      const dzDesk = Math.abs(this.player.z - -3);
      const dxDesk = Math.abs(this.player.x - cx);
      if (dxDesk < 4 && dzDesk < 4) {
        return {
          prompt: this.language === 'ar' ? `[E] فتح قائمة ${shopName}` : `[E] Open ${shopName}`,
          nearVehicle: null,
          nearTrafficAgent: null,
          nearPoliceUnit: null,
          nearMissionId: null,
          nearPortal: null,
          nearInteriorExit: false,
          nearHouseFood: false,
          nearHouseBed: false,
        };
      }
      if (this.player.z > 8.5) {
        return {
          prompt: this.language === 'ar' ? '[E] الخروج إلى المدينة' : '[E] Exit to CityWorld',
          nearVehicle: null,
          nearTrafficAgent: null,
          nearPoliceUnit: null,
          nearMissionId: null,
          nearPortal: null,
          nearInteriorExit: true,
          nearHouseFood: false,
          nearHouseBed: false,
        };
      }
      return {
        prompt: null,
        nearVehicle: null,
        nearTrafficAgent: null,
        nearPoliceUnit: null,
        nearMissionId: null,
        nearPortal: null,
        nearInteriorExit: false,
        nearHouseFood: false,
        nearHouseBed: false,
      };
    }

    const nearVehicle = this.vehicleMgr.findNearestVehicle(this.player.x, this.player.z, 4.6);
    if (nearVehicle) {
      const vName = this.language === 'ar' ? nearVehicle.rig.spec.nameAr : nearVehicle.rig.spec.name;
      const topKmh = Math.round(nearVehicle.rig.spec.maxSpeed * 3.6);
      return {
        prompt:
          this.language === 'ar'
            ? `[F] ركوب ${vName} (${topKmh} كم/س)`
            : `[F] Enter ${vName} (${topKmh} km/h)`,
        nearVehicle,
        nearTrafficAgent: null,
        nearPoliceUnit: null,
        nearMissionId: null,
        nearPortal: null,
        nearInteriorExit: false,
        nearHouseFood: false,
        nearHouseBed: false,
      };
    }

    const nearPoliceUnit = this.wanted.findNearestPoliceCruiser(this.player.x, this.player.z, 5.2);
    if (nearPoliceUnit) {
      const copKmh = Math.round(VEHICLE_CATALOG.police.maxSpeed * 3.6);
      return {
        prompt:
          this.language === 'ar'
            ? `[F] سرقة سيارة الشرطة (${copKmh} كم/س)`
            : `[F] Hijack CWPD Cruiser (${copKmh} km/h)`,
        nearVehicle: null,
        nearTrafficAgent: null,
        nearPoliceUnit,
        nearMissionId: null,
        nearPortal: null,
        nearInteriorExit: false,
        nearHouseFood: false,
        nearHouseBed: false,
      };
    }

    const nearTrafficAgent = this.traffic.findNearestAgent(this.player.x, this.player.z, 5.2);
    if (nearTrafficAgent) {
      const spec = VEHICLE_CATALOG[nearTrafficAgent.classId];
      const carName = this.language === 'ar' ? spec.nameAr : spec.name;
      const topKmh = Math.round(spec.maxSpeed * 3.6);
      return {
        prompt:
          this.language === 'ar'
            ? `[F] سرقة ${carName} (${topKmh} كم/س)`
            : `[F] Steal ${carName} (${topKmh} km/h)`,
        nearVehicle: null,
        nearTrafficAgent,
        nearPoliceUnit: null,
        nearMissionId: null,
        nearPortal: null,
        nearInteriorExit: false,
        nearHouseFood: false,
        nearHouseBed: false,
      };
    }

    const nearMission = this.missions.findNearestStartMission(this.player.x, this.player.z);
    if (nearMission) {
      const mTitle = this.language === 'ar' ? nearMission.titleAr : nearMission.title;
      return {
        prompt:
          this.language === 'ar'
            ? `[E] بدء مهمة: ${mTitle} ($${nearMission.rewardMoney})`
            : `[E] Start Mission: ${mTitle} ($${nearMission.rewardMoney})`,
        nearVehicle: null,
        nearTrafficAgent: null,
        nearPoliceUnit: null,
        nearMissionId: nearMission.id,
        nearPortal: null,
        nearInteriorExit: false,
        nearHouseFood: false,
        nearHouseBed: false,
      };
    }

    for (const portal of INTERIOR_PORTALS) {
      const dx = portal.exteriorPos.x - this.player.x;
      const dz = portal.exteriorPos.z - this.player.z;
      if (dx * dx + dz * dz < 14) {
        const pName = this.language === 'ar' ? portal.nameAr : portal.name;
        const isLockedHouse = portal.kind === 'house' && !this.ownedHouses.has(portal.id);
        const hPrice = portal.housePrice ?? 5500;
        return {
          prompt: isLockedHouse
            ? this.language === 'ar'
              ? `[E] شراء ${pName} للدخول ($${hPrice.toLocaleString()})`
              : `[E] Buy ${pName} to Enter ($${hPrice.toLocaleString()})`
            : this.language === 'ar'
              ? `[E] دخول ${pName}`
              : `[E] Enter ${pName}`,
          nearVehicle: null,
          nearTrafficAgent: null,
          nearPoliceUnit: null,
          nearMissionId: null,
          nearPortal: portal,
          nearInteriorExit: false,
          nearHouseFood: false,
          nearHouseBed: false,
        };
      }
    }

    return {
      prompt: null,
      nearVehicle: null,
      nearTrafficAgent: null,
      nearPoliceUnit: null,
      nearMissionId: null,
      nearPortal: null,
      nearInteriorExit: false,
      nearHouseFood: false,
      nearHouseBed: false,
    };
  }

  private handleExplosionAt(x: number, y: number, z: number, killedPlayer: boolean, scaleMult = 1): void {
    this.explosions.triggerExplosion(x, y, z, scaleMult);
    this.sound.playExplosion();
    this.cameraCtrl.addShake(Math.min(1.3, 0.95 * scaleMult));
    this.pedestrians.triggerPanicNear(x, z, 42);
    if (killedPlayer) {
      this.player.health = 0;
      this.wanted.setMinimumStars(3);
    }
  }

  private notifyWorldBorder(inAirplane = false): void {
    if (this.worldBorderNoticeTimer > 0) return;
    this.worldBorderNoticeTimer = 3.6;
    this.missionBanner = {
      title: this.language === 'ar' ? 'حدود العالم' : 'World Border Reached',
      subtitle: inAirplane
        ? this.language === 'ar'
          ? 'وصلت إلى نهاية المجال الجوي! اتجه نحو الجزيرة أو المطار.'
          : 'Outer airspace boundary reached! Head back toward the Island or Airport.'
        : this.language === 'ar'
          ? 'لا يمكنك مغادرة الحدود سيراً أو بالسيارة! اذهب إلى المطار واركب طائرة للسفر إلى الجزيرة.'
          : 'Border locked on land/sea! Fly an Airplane from the Airport to cross to the Island.',
      kind: 'info',
    };
    this.bannerTimer = 3.5;
  }

  private handleVehicleDestroyed(v: WorldVehicle, occupied: boolean): void {
    v.rig.cabinGroup.visible = true;
    if (isBicycleClass(v.classId)) {
      this.explosions.triggerDustBurst(v.x, v.y, v.z);
      this.sound.playImpact(0.75);
      if (occupied) {
        v.occupiedByPlayer = false;
        this.activeVehicle = null;
        this.player.setRidingPose('none', 0, 0);
        this.player.x = v.x + Math.cos(v.heading) * 1.4;
        this.player.z = v.z - Math.sin(v.heading) * 1.4;
        this.player.y = groundHeightAt(this.player.x, this.player.z);
        this.player.root.visible = !this.cameraCtrl.firstPerson;
        this.player.applyDamage(18);
        this.missionBanner = {
          title: this.language === 'ar' ? 'تحطم البسكليت!' : 'Bicycle Wrecked!',
          subtitle:
            this.language === 'ar'
              ? 'تضرر البسكليت وسقطت على الطريق.'
              : 'Your bicycle broke apart from impact.',
          kind: 'fail',
        };
        this.bannerTimer = 3.2;
      }
    } else {
      this.handleExplosionAt(v.x, v.y, v.z, occupied, 1.25);
    }
  }

  private handleRpgDetonation(rx: number, ry: number, rz: number): void {
    this.handleExplosionAt(rx, ry, rz, false, 1.5);
    const blastRadiusSq = 8.0 * 8.0;

    // 1-hit destroy any parked/player WorldVehicles in blast radius
    for (const v of this.vehicleMgr.vehicles) {
      if (v.exploded) continue;
      const dSq = (v.x - rx) ** 2 + (v.z - rz) ** 2;
      if (dSq <= blastRadiusSq) {
        this.vehicleMgr.applyDamage(v, 500, (veh) =>
          this.handleVehicleDestroyed(veh, veh === this.activeVehicle)
        );
      }
    }

    // 1-hit destroy any Traffic vehicles in blast radius
    for (const a of this.traffic.agents) {
      if (!a.rig.root.visible || a.exploded) continue;
      const dSq = (a.x - rx) ** 2 + (a.z - rz) ** 2;
      if (dSq <= blastRadiusSq) {
        this.traffic.applyDamage(a, 500, (ex, ey, ez) => {
          if (isBicycleClass(a.classId)) this.explosions.triggerDustBurst(ex, ey, ez);
          else this.handleExplosionAt(ex, ey, ez, false, 1.15);
        });
      }
    }

    // 1-hit destroy police cruisers & officers in blast radius
    for (const u of this.wanted.units) {
      if (!u.active) continue;
      if (!u.stolen && !u.exploded && (u.x - rx) ** 2 + (u.z - rz) ** 2 <= blastRadiusSq) {
        this.wanted.applyCruiserDamage(u, 500, (ex, ey, ez) => this.handleExplosionAt(ex, ey, ez, false, 1.15));
      }
      if (u.officer.deployed && u.officer.hp > 0 && (u.officer.x - rx) ** 2 + (u.officer.z - rz) ** 2 <= blastRadiusSq) {
        const res = this.wanted.damageTarget(u.officer.id, 500);
        if (res.killedOfficer) this.money += 150;
      }
    }

    // Pedestrians caught in blast
    for (const p of this.pedestrians.peds) {
      if (p.respawnTimer > 0 || p.fallTimer > 0) continue;
      if ((p.x - rx) ** 2 + (p.z - rz) ** 2 <= 7.2 * 7.2) {
        this.pedestrians.damagePedestrian(p.id, 200, rx, rz);
      }
    }

    this.wanted.setMinimumStars(3);
  }

  private handlePunchAction(): void {
    if (this.activeVehicle || this.player.inInterior || this.player.isSwimming) return;
    const nearPed = this.pedestrians.findNearestPedestrian(this.player.x, this.player.z, 2.8);
    let aimHeading = this.player.heading;
    if (nearPed) {
      aimHeading = Math.atan2(nearPed.x - this.player.x, nearPed.z - this.player.z);
    } else {
      const aimDirX = -Math.sin(this.cameraCtrl.yaw);
      const aimDirZ = -Math.cos(this.cameraCtrl.yaw);
      aimHeading = Math.atan2(aimDirX, aimDirZ);
    }

    this.player.triggerPunchPose(aimHeading);
    this.fpRig.triggerPunch();
    this.sound.playPunch();

    if (nearPed) {
      const res = this.pedestrians.damagePedestrian(nearPed.id, 14, this.player.x, this.player.z);
      this.sound.playImpact(0.35);
      if (res.killed) {
        this.wanted.setMinimumStars(3);
      } else {
        this.wanted.reportMinorAssault();
      }
      return;
    }

    // Check melee against nearby police officers too
    const copTargets = this.wanted.getCombatTargets();
    for (const t of copTargets) {
      if (!t.id.startsWith('cop_officer_')) continue;
      if (Math.hypot(t.x - this.player.x, t.z - this.player.z) < 2.8) {
        this.wanted.damageTarget(t.id, 16);
        this.wanted.setMinimumStars(2);
        this.sound.playImpact(0.4);
        break;
      }
    }
  }

  private handleWeaponFire(): void {
    if (this.activeVehicle || this.player.inInterior || this.player.isSwimming) return;
    if (this.weapons.currentWeapon === 'fists') {
      this.handlePunchAction();
      return;
    }

    const aimDirX = -Math.sin(this.cameraCtrl.yaw);
    const aimDirZ = -Math.cos(this.cameraCtrl.yaw);
    const aimHeading = Math.atan2(aimDirX, aimDirZ);

    const targets = [
      ...this.wanted.getCombatTargets(),
      ...this.pedestrians.getCombatTargets(),
      ...this.vehicleMgr.vehicles
        .filter((v) => !v.exploded && v !== this.activeVehicle)
        .map((v) => ({ id: `wveh_${v.id}`, x: v.x, y: v.y, z: v.z, radius: 2.1 })),
      ...this.traffic.agents
        .filter((a) => !a.exploded && a.rig.root.visible)
        .map((a) => ({ id: `tagent_${a.id}`, x: a.x, y: a.y, z: a.z, radius: 2.1 })),
    ];

    const ox = this.player.x;
    const oy = this.player.y + 1.32;
    const oz = this.player.z;

    const fired = this.weapons.tryPlayerFire(
      ox,
      oy,
      oz,
      aimDirX,
      aimDirZ,
      targets,
      (id, dmg, rdx, rdy, rdz) => {
        if (id.startsWith('cop_car_')) {
          const u = this.wanted.units.find((item) => item.id === id);
          if (u) {
            applyBulletImpactToVehicleRig(u.rig, u.x, u.y, u.z, u.heading, ox, oy, oz, rdx, rdy, rdz);
            this.vehicleMgr.emitSmoke(u.x, u.y + 0.9, u.z, true);
          }
          this.wanted.damageTarget(id, Math.round(dmg * 0.45), (ex, ey, ez) =>
            this.handleExplosionAt(ex, ey, ez, false, 1.25)
          );
          this.sound.playImpact(0.45);
        } else if (id.startsWith('cop_')) {
          const res = this.wanted.damageTarget(id, dmg);
          this.wanted.setMinimumStars(2);
          if (res.killedOfficer) {
            this.money += 150;
          }
          this.sound.playImpact(0.45);
        } else if (id.startsWith('ped_')) {
          const res = this.pedestrians.damagePedestrian(id, dmg, this.player.x, this.player.z);
          if (res.killed) {
            this.wanted.setMinimumStars(3);
          } else {
            this.wanted.reportMinorAssault();
          }
          this.sound.playImpact(0.35);
        } else if (id.startsWith('wveh_')) {
          const vid = id.slice(5);
          const v = this.vehicleMgr.vehicles.find((item) => item.id === vid);
          if (v) {
            applyBulletImpactToVehicleRig(v.rig, v.x, v.y, v.z, v.heading, ox, oy, oz, rdx, rdy, rdz);
            this.vehicleMgr.emitSmoke(v.x, v.y + 0.9, v.z, true);
            this.vehicleMgr.applyDamage(v, Math.round(dmg * 0.48), (veh) =>
              this.handleVehicleDestroyed(veh, false)
            );
            this.sound.playImpact(0.45);
          }
        } else if (id.startsWith('tagent_')) {
          const aid = id.slice(7);
          const a = this.traffic.agents.find((item) => item.id === aid);
          if (a) {
            applyBulletImpactToVehicleRig(a.rig, a.x, a.y, a.z, a.heading, ox, oy, oz, rdx, rdy, rdz);
            this.vehicleMgr.emitSmoke(a.x, a.y + 0.9, a.z, true);
            this.traffic.applyDamage(a, Math.round(dmg * 0.48), (ex, ey, ez) => {
              if (isBicycleClass(a.classId)) this.explosions.triggerDustBurst(ex, ey, ez);
              else this.handleExplosionAt(ex, ey, ez, false);
            });
            this.wanted.addCrimeHeat(25);
            this.sound.playImpact(0.45);
          }
        }
      },
      (kind) => {
        if (kind === 'fists') {
          this.sound.playPunch();
        } else if (kind === 'rpg') {
          this.sound.playRpgLaunch();
          this.pedestrians.triggerPanicNear(this.player.x, this.player.z, 40);
        } else if (kind === 'shotgun') {
          this.sound.playShotgun();
          this.pedestrians.triggerPanicNear(this.player.x, this.player.z, 36);
        } else if (kind === 'rifle') {
          this.sound.playRifle();
          this.pedestrians.triggerPanicNear(this.player.x, this.player.z, 34);
        } else {
          this.sound.playGunshot(kind === 'smg');
          this.pedestrians.triggerPanicNear(this.player.x, this.player.z, 34);
        }
      }
    );

    if (fired) {
      this.player.triggerAimPose(aimHeading);
      this.fpRig.triggerFire(this.weapons.currentWeapon);
      const shake =
        this.weapons.currentWeapon === 'rpg'
          ? 0.42
          : this.weapons.currentWeapon === 'shotgun'
            ? 0.25
            : this.weapons.currentWeapon === 'smg'
              ? 0.08
              : 0.14;
      this.cameraCtrl.addShake(shake);
    }
  }

  private processEdgeInputs(): void {
    if (this.justPressed.has('Escape')) {
      this.togglePause();
    }
    if (this.justPressed.has('KeyM') && (this.phase === 'playing' || this.phase === 'map')) {
      this.toggleMap();
    }
    if (this.justPressed.has('KeyP') && (this.phase === 'playing' || this.phase === 'phone')) {
      this.togglePhone();
    }
    if (this.justPressed.has('KeyB') && (this.phase === 'playing' || this.phase === 'backpack')) {
      this.toggleBackpack();
    }
    if (this.justPressed.has('KeyN')) {
      this.toggleMute();
    }
    if (this.justPressed.has('KeyC') && this.phase === 'playing') {
      this.toggleFirstPerson();
    }

    if (this.phase !== 'playing') {
      this.justPressed.clear();
      return;
    }

    if (this.justPressed.has('KeyT')) {
      this.weatherTime.advanceTimePreset();
    }
    if (this.justPressed.has('KeyY')) {
      this.weatherTime.cycleWeather();
    }

    // Weapon selection [1-6 / Tab]
    if (this.justPressed.has('Digit1')) this.weapons.selectWeapon('fists');
    if (this.justPressed.has('Digit2')) this.weapons.selectWeapon('pistol');
    if (this.justPressed.has('Digit3')) this.weapons.selectWeapon('smg');
    if (this.justPressed.has('Digit4')) this.weapons.selectWeapon('shotgun');
    if (this.justPressed.has('Digit5')) this.weapons.selectWeapon('rifle');
    if (this.justPressed.has('Digit6')) this.weapons.selectWeapon('rpg');
    if (this.justPressed.has('Tab')) this.weapons.cycleWeapon();

    // Enter / Exit / Hijack ANY Vehicle [F]
    if (this.justPressed.has('KeyF') && !this.player.inInterior) {
      if (this.activeVehicle) {
        this.activeVehicle.occupiedByPlayer = false;
        this.activeVehicle.rig.cabinGroup.visible = true;
        const exitSideX = Math.cos(this.activeVehicle.heading) * (this.activeVehicle.rig.spec.width * 0.8 + 0.7);
        const exitSideZ = -Math.sin(this.activeVehicle.heading) * (this.activeVehicle.rig.spec.width * 0.8 + 0.7);
        this.player.x = this.activeVehicle.x + exitSideX;
        this.player.z = this.activeVehicle.z + exitSideZ;
        this.player.y = this.activeVehicle.y;
        this.player.vx = 0;
        this.player.vz = 0;
        this.player.setRidingPose('none', 0, 0);
        this.player.root.visible = !this.cameraCtrl.firstPerson;
        this.activeVehicle = null;
        this.sound.playDoorLatch();
      } else {
        const ctx = this.getInteractionContext();
        if (ctx.nearVehicle) {
          this.activeVehicle = ctx.nearVehicle;
          this.activeVehicle.occupiedByPlayer = true;
          const isOpenBike =
            this.activeVehicle.classId === 'motorcycle' || isBicycleClass(this.activeVehicle.classId);
          this.player.root.visible = isOpenBike && !this.cameraCtrl.firstPerson;
          this.sound.playDoorLatch();
          if (this.activeVehicle.classId === 'police') {
            this.wanted.setMinimumStars(1);
          }
        } else if (ctx.nearPoliceUnit) {
          const snap = this.wanted.hijackPoliceCruiser(ctx.nearPoliceUnit);
          const hijacked = this.vehicleMgr.spawnHijackedVehicle('police', snap.x, snap.z, snap.heading, 0x0f172a);
          this.activeVehicle = hijacked;
          this.activeVehicle.occupiedByPlayer = true;
          this.player.root.visible = false;
          this.sound.playDoorLatch();
          this.wanted.setMinimumStars(1);
        } else if (ctx.nearTrafficAgent) {
          const snap = this.traffic.hijackAgent(ctx.nearTrafficAgent);
          // Eject the NPC driver out onto the street before taking control!
          this.pedestrians.spawnEjectedDriver(snap.x, snap.z, snap.heading);
          const hijacked = this.vehicleMgr.spawnHijackedVehicle(
            snap.classId,
            snap.x,
            snap.z,
            snap.heading,
            snap.colorHex
          );
          hijacked.hp = snap.hp;
          hijacked.rig.damage.front = snap.damage.front;
          hijacked.rig.damage.rear = snap.damage.rear;
          hijacked.rig.damage.left = snap.damage.left;
          hijacked.rig.damage.right = snap.damage.right;
          this.activeVehicle = hijacked;
          this.activeVehicle.occupiedByPlayer = true;
          const isOpenBike =
            hijacked.classId === 'motorcycle' || isBicycleClass(hijacked.classId);
          this.player.root.visible = isOpenBike && !this.cameraCtrl.firstPerson;
          this.sound.playDoorLatch();
          this.pedestrians.triggerPanicNear(snap.x, snap.z, 22);
          this.wanted.setMinimumStars(1);
        }
      }
    }

    // Explicit Punch / Fire edge presses
    if (this.justPressed.has('PunchAction') || this.justPressed.has('KeyV')) {
      this.handlePunchAction();
    }
    if (this.justPressed.has('FireWeapon') || this.justPressed.has('KeyG')) {
      this.handleWeaponFire();
    }

    // Vehicle Lights / Signals / Horn
    if (this.activeVehicle) {
      if (this.justPressed.has('KeyL')) {
        this.activeVehicle.headlightsOn = !this.activeVehicle.headlightsOn;
      }
      if (this.justPressed.has('KeyQ')) {
        this.activeVehicle.turnSignal = this.activeVehicle.turnSignal === -1 ? 0 : -1;
      }
      if (this.justPressed.has('KeyE')) {
        this.activeVehicle.turnSignal = this.activeVehicle.turnSignal === 1 ? 0 : 1;
      }
      if (this.justPressed.has('KeyH')) {
        if (isBicycleClass(this.activeVehicle.classId)) {
          this.sound.playBikeBell();
        } else {
          this.sound.playHorn();
        }
        this.pedestrians.triggerPanicNear(this.activeVehicle.x, this.activeVehicle.z, 18);
      }
    } else if (this.justPressed.has('KeyE')) {
      // On-foot contextual interaction
      const ctx = this.getInteractionContext();
      if (ctx.nearMissionId) {
        this.startMissionById(ctx.nearMissionId);
      } else if (ctx.nearPortal) {
        if (ctx.nearPortal.kind === 'house' && !this.ownedHouses.has(ctx.nearPortal.id)) {
          const hPrice = ctx.nearPortal.housePrice ?? 5500;
          const hName = this.language === 'ar' ? ctx.nearPortal.nameAr : ctx.nearPortal.name;
          if (this.money >= hPrice) {
            this.money -= hPrice;
            this.ownedHouses.add(ctx.nearPortal.id);
            this.sound.playMissionCue('step');
            this.missionBanner = {
              title: this.language === 'ar' ? `تم شراء ${hName}!` : `Purchased ${hName}!`,
              subtitle:
                this.language === 'ar'
                  ? 'أصبح البيت ملكك الآن. اضغط E للدخول وتناول الطعام والنوم.'
                  : 'You now own this home! Press E again to enter.',
              kind: 'success',
            };
            this.bannerTimer = 3.8;
          } else {
            this.missionBanner = {
              title: this.language === 'ar' ? 'المنزل مقفل!' : 'House Locked!',
              subtitle:
                this.language === 'ar'
                  ? `يجب شراء ${hName} أولاً ($${hPrice.toLocaleString()}) قبل الدخول.`
                  : `You must buy ${hName} ($${hPrice.toLocaleString()}) before entering.`,
              kind: 'fail',
            };
            this.bannerTimer = 3.5;
          }
        } else {
          this.activeInterior = ctx.nearPortal;
          this.interiors.setActiveInterior(ctx.nearPortal.id);
          this.player.inInterior = true;
          this.player.interiorFloorY = ctx.nearPortal.interiorCenter.y;
          const isHouse = ctx.nearPortal.kind === 'house';
          const tier = ctx.nearPortal.houseSizeTier ?? 1;
          this.player.interiorHalfW = isHouse ? (tier === 1 ? 8 : tier === 2 ? 10 : tier === 3 ? 13 : 16) : 11;
          this.player.interiorHalfD = isHouse ? (tier === 1 ? 8 : tier === 2 ? 10 : tier === 3 ? 12 : 14) : 11;
          this.player.x = ctx.nearPortal.interiorCenter.x;
          this.player.y = ctx.nearPortal.interiorCenter.y;
          this.player.z = ctx.nearPortal.interiorCenter.z + (this.player.interiorHalfD - 3);
          this.sound.playDoorLatch();
        }
      } else if (ctx.nearHouseFood) {
        this.executeInteriorAction('house_eat');
      } else if (ctx.nearHouseBed) {
        this.executeInteriorAction('house_sleep');
      } else if (ctx.nearInteriorExit) {
        this.exitInterior();
      } else if (this.player.inInterior && this.activeInterior) {
        this.phase = 'interior_shop';
      }
    }

    this.justPressed.clear();
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    this.simTime += dt;

    // FPS meter
    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.processEdgeInputs();

    if (this.phase === 'title') {
      this.weatherTime.update(dt * 0.25, 0, 0, false);
      this.world.updateLightsAndWater(this.simTime, this.weatherTime.isNight(), this.weatherTime.weather === 'rain', this.simTime);
      this.world.updateStreaming(0, 0, this.streamRadius);
      this.fpRig.root.visible = false;
      this.traffic.update(dt, this.simTime, this.weatherTime.isNight(), 0, 0, false, this.trafficCullDist, () => {});
      this.cameraCtrl.updateTitleOrbit(this.camera, this.simTime);
    } else if (this.phase === 'playing') {
      this.manualOrbitTimer = Math.max(0, this.manualOrbitTimer - dt);
      if (this.worldBorderNoticeTimer > 0) this.worldBorderNoticeTimer = Math.max(0, this.worldBorderNoticeTimer - dt);
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) this.missionBanner = null;
      }

      // Sync held weapon mesh visibility
      this.player.setHeldWeaponVisual(
        this.weapons.currentWeapon,
        !this.activeVehicle &&
          !this.player.isSwimming &&
          !this.player.inInterior &&
          !this.cameraCtrl.firstPerson &&
          this.weapons.currentWeapon !== 'fists'
      );

      // Continuous firing (hold Fire button on mobile or hold G on desktop)
      if ((this.firingActive || this.held.has('KeyG')) && !this.activeVehicle && !this.player.inInterior) {
        this.handleWeaponFire();
      }

      // 1. Update Player or Active Vehicle
      if (this.activeVehicle) {
        const kbThrottle =
          (this.held.has('KeyW') || this.held.has('ArrowUp') ? 1 : 0) -
          (this.held.has('KeyS') || this.held.has('ArrowDown') ? 1 : 0);
        const kbSteer =
          (this.held.has('KeyA') || this.held.has('ArrowLeft') ? 1 : 0) -
          (this.held.has('KeyD') || this.held.has('ArrowRight') ? 1 : 0);
        const throttle = Math.abs(kbThrottle) > 0 ? kbThrottle : this.virtualInput.throttle;
        const steer = Math.abs(kbSteer) > 0 ? kbSteer : this.virtualInput.steer;
        const handbrake = this.held.has('Space') || this.virtualInput.handbrake;
        const kbClimb =
          (this.held.has('Space') ? 1 : 0) -
          (this.held.has('ShiftLeft') || this.held.has('ShiftRight') || this.held.has('KeyX') ? 1 : 0);
        const climb = kbClimb !== 0 ? kbClimb : this.virtualInput.climb;

        const activeIsPlane = isAirplaneClass(this.activeVehicle.classId);
        this.vehicleMgr.update(
          dt,
          this.activeVehicle,
          { throttle, steer, handbrake, climb },
          this.world.colliders,
          this.weatherTime.weather,
          this.weatherTime.isNight(),
          (intensity) => {
            this.sound.playImpact(intensity);
            this.cameraCtrl.addShake(intensity * 0.85);
            if (this.activeVehicle) {
              this.pedestrians.triggerPanicNear(this.activeVehicle.x, this.activeVehicle.z, 24);
            }
          },
          (v) => {
            this.handleVehicleDestroyed(v, v === this.activeVehicle);
          },
          () => this.notifyWorldBorder(activeIsPlane),
          this.player.x,
          this.player.z
        );

        if (this.activeVehicle) {
          this.player.x = this.activeVehicle.x;
          this.player.y = this.activeVehicle.y;
          this.player.z = this.activeVehicle.z;
          this.player.heading = this.activeVehicle.heading;

          const isBike = isBicycleClass(this.activeVehicle.classId);
          const isOpenRider = isBike || this.activeVehicle.classId === 'motorcycle';
          this.activeVehicle.rig.cabinGroup.visible = !(this.cameraCtrl.firstPerson && !isOpenRider);
          this.player.root.visible = isOpenRider && !this.cameraCtrl.firstPerson;
          if (isOpenRider) {
            this.player.root.position.set(this.activeVehicle.x, this.activeVehicle.y, this.activeVehicle.z);
            this.player.root.rotation.y = this.activeVehicle.heading;
            this.player.root.rotation.z = this.activeVehicle.roll;
            this.player.setRidingPose(
              isBike ? 'bicycle' : 'motorcycle',
              this.activeVehicle.pedalPhase,
              this.activeVehicle.steerAngle
            );
          } else {
            this.player.setRidingPose('none', 0, 0);
          }
        }
      } else {
        this.player.setRidingPose('none', 0, 0);
        this.player.root.visible = !this.cameraCtrl.firstPerson;
        this.vehicleMgr.update(
          dt,
          null,
          { throttle: 0, steer: 0, handbrake: false, climb: 0 },
          this.world.colliders,
          this.weatherTime.weather,
          this.weatherTime.isNight(),
          () => {},
          (v) => this.handleVehicleDestroyed(v, false),
          undefined,
          this.player.x,
          this.player.z
        );

        const kbMoveX =
          (this.held.has('KeyD') || this.held.has('ArrowRight') ? 1 : 0) -
          (this.held.has('KeyA') || this.held.has('ArrowLeft') ? 1 : 0);
        const kbMoveZ =
          (this.held.has('KeyW') || this.held.has('ArrowUp') ? 1 : 0) -
          (this.held.has('KeyS') || this.held.has('ArrowDown') ? 1 : 0);
        const moveX = Math.abs(kbMoveX) > 0 ? kbMoveX : this.virtualInput.moveX;
        const moveZ = Math.abs(kbMoveZ) > 0 ? kbMoveZ : this.virtualInput.moveZ;
        const sprint = this.held.has('ShiftLeft') || this.held.has('ShiftRight') || this.virtualInput.sprint;
        const jump = this.held.has('Space') || this.virtualInput.jump;

        this.player.update(
          dt,
          { moveX, moveZ, sprint, jumpJustPressed: jump },
          this.cameraCtrl.yaw,
          this.world.colliders,
          (sp, inW) => this.sound.playFootstep(sp, inW),
          (dmg) => {
            this.sound.playImpact(dmg / 40);
            this.cameraCtrl.addShake(0.5);
          },
          () => this.notifyWorldBorder(false)
        );
      }

      // 2. Camera Follow + First-Person Viewmodel Sync
      const speedRatio = this.activeVehicle
        ? Math.min(1, Math.abs(this.activeVehicle.forwardSpeed) / this.activeVehicle.rig.spec.maxSpeed)
        : this.player.isSprinting
          ? 0.45
          : 0;

      const fpVehicleType: 'none' | 'car' | 'bike' | 'airplane' = !this.activeVehicle
        ? 'none'
        : isAirplaneClass(this.activeVehicle.classId)
          ? 'airplane'
          : isBicycleClass(this.activeVehicle.classId) || this.activeVehicle.classId === 'motorcycle'
            ? 'bike'
            : 'car';

      this.cameraCtrl.updateFollow(
        this.camera,
        dt,
        this.player.x,
        this.player.y,
        this.player.z,
        this.player.heading,
        Boolean(this.activeVehicle),
        speedRatio,
        this.manualOrbitTimer <= 0,
        this.player.inInterior,
        fpVehicleType
      );

      this.fpRig.update(dt, {
        active: this.cameraCtrl.firstPerson,
        mode: fpVehicleType === 'none' ? 'on_foot' : fpVehicleType,
        weaponId: this.player.inInterior ? 'fists' : this.weapons.currentWeapon,
        steerAngle: this.activeVehicle?.steerAngle ?? 0,
        speed: this.activeVehicle ? this.activeVehicle.forwardSpeed : Math.hypot(this.player.vx, this.player.vz),
        isMoving: !this.activeVehicle && Math.hypot(this.player.vx, this.player.vz) > 0.4,
        isSprinting: this.player.isSprinting,
        isSwimming: this.player.isSwimming,
      });

      // 3. World, Weather, Traffic, Pedestrians, Police, Weapons, Explosions, Missions
      const focusX = this.player.inInterior && this.activeInterior ? this.activeInterior.exteriorPos.x : this.player.x;
      const focusZ = this.player.inInterior && this.activeInterior ? this.activeInterior.exteriorPos.z : this.player.z;

      this.weatherTime.update(dt, focusX, focusZ, this.player.inInterior);
      this.world.updateLightsAndWater(
        this.simTime,
        this.weatherTime.isNight(),
        this.weatherTime.weather === 'rain',
        this.simTime
      );
      this.streamAccum += dt;
      if (this.streamAccum >= 0.25) {
        this.streamAccum = 0;
        this.world.updateStreaming(focusX, focusZ, this.streamRadius);
      }

      const rocketDynamicTargets = this.weapons.hasActiveRockets()
        ? [
            ...this.vehicleMgr.vehicles
              .filter((v) => !v.exploded && v !== this.activeVehicle)
              .map((v) => ({ x: v.x, y: v.y, z: v.z, radius: Math.max(1.8, v.rig.spec.width * 0.9) })),
            ...this.traffic.agents
              .filter((a) => !a.exploded && a.rig.root.visible)
              .map((a) => ({ x: a.x, y: a.y, z: a.z, radius: 2.0 })),
            ...this.wanted.getCombatTargets().map((t) => ({ x: t.x, y: t.y, z: t.z, radius: t.radius })),
            ...this.pedestrians.getCombatTargets().map((t) => ({ x: t.x, y: t.y, z: t.z, radius: t.radius })),
          ]
        : this.emptyRocketTargets;
      this.weapons.update(
        dt,
        this.world.colliders,
        rocketDynamicTargets,
        (x, y, z) => this.vehicleMgr.emitSmoke(x, y, z, false),
        (rx, ry, rz) => this.handleRpgDetonation(rx, ry, rz)
      );
      this.explosions.update(dt);

      const playerSpeed = this.activeVehicle
        ? Math.abs(this.activeVehicle.forwardSpeed)
        : Math.hypot(this.player.vx, this.player.vz);

      if (!this.player.inInterior) {
        this.traffic.update(
          dt,
          this.simTime,
          this.weatherTime.isNight(),
          this.player.x,
          this.player.z,
          Boolean(this.activeVehicle),
          this.trafficCullDist,
          (intensity) => {
            this.sound.playImpact(intensity);
            this.cameraCtrl.addShake(intensity * 0.7);
            if (!this.activeVehicle) {
              this.player.applyDamage(Math.round(intensity * 24));
            }
          }
        );

        // Solid rigid-body collision between active player car and NPC Traffic / Police Cruisers (no ghosting!)
        if (this.activeVehicle && !this.activeVehicle.exploded) {
          const pCar = this.activeVehicle;
          const pWrap: CollidableVehicle = {
            x: pCar.x,
            y: pCar.y,
            z: pCar.z,
            heading: pCar.heading,
            vx: pCar.vx,
            vz: pCar.vz,
            mass: pCar.rig.spec.mass,
            length: pCar.rig.spec.length,
            width: pCar.rig.spec.width,
            hp: pCar.hp,
            exploded: pCar.exploded,
            rig: pCar.rig,
          };

          for (const agent of this.traffic.agents) {
            if (!agent.rig.root.visible) continue;
            const aSpec = agent.rig.spec;
            const aWrap: CollidableVehicle = {
              x: agent.x,
              y: agent.y,
              z: agent.z,
              heading: agent.heading,
              vx: agent.vx,
              vz: agent.vz,
              mass: aSpec.mass,
              length: aSpec.length,
              width: aSpec.width,
              hp: agent.hp,
              exploded: agent.exploded,
              rig: agent.rig,
            };
            const res = resolveVehiclePairCollision(pWrap, aWrap);
            if (res.collided) {
              pCar.x = pWrap.x;
              pCar.z = pWrap.z;
              pCar.vx = pWrap.vx;
              pCar.vz = pWrap.vz;
              agent.x = aWrap.x;
              agent.z = aWrap.z;
              agent.vx = aWrap.vx;
              agent.vz = aWrap.vz;
              agent.knockedTimer = Math.max(agent.knockedTimer, 3.8);
              agent.spinVel = (Math.random() - 0.5) * Math.min(4.5, res.impactSpeed * 0.22);

              if (res.impactSpeed > 4.2) {
                this.sound.playImpact(Math.min(1, res.impactSpeed / 26));
                this.cameraCtrl.addShake(Math.min(0.85, res.impactSpeed / 28));
                this.pedestrians.triggerPanicNear(pCar.x, pCar.z, 22);
                this.vehicleMgr.applyDamage(pCar, res.dmgA, (v) => this.handleVehicleDestroyed(v, true));
                this.traffic.applyDamage(agent, res.dmgB, (ex, ey, ez) => {
                  if (isBicycleClass(agent.classId)) this.explosions.triggerDustBurst(ex, ey, ez);
                  else this.handleExplosionAt(ex, ey, ez, false);
                });
                if (res.impactSpeed > 11) {
                  this.wanted.addCrimeHeat(28);
                }
              }
            }
          }

          for (const cop of this.wanted.units) {
            if (!cop.active || cop.stolen) continue;
            const cSpec = cop.rig.spec;
            const cWrap: CollidableVehicle = {
              x: cop.x,
              y: cop.y,
              z: cop.z,
              heading: cop.heading,
              vx: cop.vx,
              vz: cop.vz,
              mass: cSpec.mass,
              length: cSpec.length,
              width: cSpec.width,
              hp: cop.hp,
              exploded: cop.exploded,
              rig: cop.rig,
            };
            const res = resolveVehiclePairCollision(pWrap, cWrap);
            if (res.collided) {
              pCar.x = pWrap.x;
              pCar.z = pWrap.z;
              pCar.vx = pWrap.vx;
              pCar.vz = pWrap.vz;
              cop.x = cWrap.x;
              cop.z = cWrap.z;
              cop.vx = cWrap.vx;
              cop.vz = cWrap.vz;
              if (res.impactSpeed > 4.2) {
                this.sound.playImpact(Math.min(1, res.impactSpeed / 24));
                this.cameraCtrl.addShake(Math.min(0.8, res.impactSpeed / 26));
                this.vehicleMgr.applyDamage(pCar, res.dmgA, (v) => this.handleVehicleDestroyed(v, true));
                this.wanted.applyCruiserDamage(cop, res.dmgB, (ex, ey, ez) =>
                  this.handleExplosionAt(ex, ey, ez, false)
                );
              }
            }
          }
        }

        this.pedestrians.update(
          dt,
          this.player.x,
          this.player.z,
          playerSpeed,
          Boolean(this.activeVehicle),
          this.pedCullDist,
          (killed) => {
            if (killed) {
              this.wanted.setMinimumStars(3);
            } else {
              this.wanted.setMinimumStars(2);
            }
            this.sound.playImpact(0.45);
          }
        );

        const camDirX = -Math.sin(this.cameraCtrl.yaw);
        const camDirZ = -Math.cos(this.cameraCtrl.yaw);
        this.wanted.update(
          dt,
          this.player.x,
          this.player.y,
          this.player.z,
          Boolean(this.activeVehicle),
          camDirX,
          camDirZ,
          this.world.colliders,
          this.weatherTime.isNight(),
          (dmg) => {
            this.sound.playImpact(0.75);
            this.cameraCtrl.addShake(0.65);
            if (!this.activeVehicle) {
              this.player.applyDamage(dmg);
            } else {
              this.vehicleMgr.applyDamage(this.activeVehicle, Math.round(dmg * 0.7), (v) =>
                this.handleVehicleDestroyed(v, true)
              );
            }
          },
          (ox, oy, oz, dx, dy, dz, hitPlayer) => {
            this.weapons.spawnTracer(ox, oy, oz, dx, dy, dz, true);
            this.sound.playGunshot(false);
            if (hitPlayer) {
              this.player.applyDamage(this.activeVehicle ? 3 : 8);
              if (this.activeVehicle) {
                this.vehicleMgr.applyDamage(this.activeVehicle, 2, (v) =>
                  this.handleVehicleDestroyed(v, true)
                );
              }
              this.cameraCtrl.addShake(0.18);
            }
          },
          () => {
            this.sound.playMissionCue('success');
            this.missionBanner = {
              title: this.language === 'ar' ? 'تم الإفلات من الشرطة!' : 'Escaped the Police!',
              subtitle:
                this.language === 'ar'
                  ? 'ابتعدت عن الشرطة لمدة 20 ثانية وتمت إزالة النجوم.'
                  : 'Stayed clear for 20 seconds — Wanted Level cleared.',
              kind: 'success',
            };
            this.bannerTimer = 3.8;
          }
        );
      }

      this.missions.update(
        dt,
        this.simTime,
        this.player.x,
        this.player.z,
        this.wanted.stars,
        this.language,
        (stars) => this.wanted.addCrimeHeat(stars * 95),
        (evt) => {
          if (evt.reward) this.money += evt.reward;
          this.sound.playMissionCue(evt.kind);
          this.missionBanner = {
            title: evt.title,
            subtitle: evt.subtitle,
            kind: evt.kind === 'fail' ? 'fail' : evt.kind === 'success' ? 'success' : 'info',
          };
          this.bannerTimer = 5.0;
        }
      );

      // Clear custom waypoint when reached & update Road GPS Ribbon
      if (this.customWaypoint) {
        const dx = this.customWaypoint.x - this.player.x;
        const dz = this.customWaypoint.z - this.player.z;
        if (dx * dx + dz * dz < 81) {
          this.customWaypoint = null;
          this.missionBanner = {
            title: this.language === 'ar' ? 'تم الوصول للوجهة' : 'Destination Reached',
            subtitle: this.language === 'ar' ? 'تم إخفاء مسار الـ GPS.' : 'GPS route cleared.',
            kind: 'info',
          };
          this.bannerTimer = 2.6;
        }
      }
      this.refreshGpsRoute(false);

      // Check player death
      if (this.player.health <= 0) {
        this.phase = 'wasted';
        this.pushHud();
      }

      // Continuous Audio update
      this.sound.updateContinuous({
        dt,
        inVehicle: Boolean(this.activeVehicle),
        vehicleClass: this.activeVehicle?.classId ?? 'sedan',
        speedRatio,
        drifting: Boolean(this.activeVehicle?.drifting),
        weather: this.weatherTime.weather,
        policeActive: this.wanted.stars > 0,
        nearestPoliceDist: this.wanted.nearestPoliceDist,
        paused: false,
      });
    } else {
      this.sound.updateContinuous({
        dt,
        inVehicle: false,
        vehicleClass: 'sedan',
        speedRatio: 0,
        drifting: false,
        weather: this.weatherTime.weather,
        policeActive: false,
        nearestPoliceDist: 9999,
        paused: true,
      });
    }

    // On mobile, update shadow map every 2nd frame for higher GPU throughput
    if (this.renderer.shadowMap.enabled && !this.renderer.shadowMap.autoUpdate) {
      this.shadowFrameCounter = (this.shadowFrameCounter + 1) % 2;
      if (this.shadowFrameCounter === 0) {
        this.renderer.shadowMap.needsUpdate = true;
      }
    }

    this.renderer.render(this.scene, this.camera);

    // Push HUD snapshot at ~10.5Hz to minimize React re-render overhead
    this.hudAccum += rawDt;
    if (this.hudAccum >= 0.095) {
      this.hudAccum = 0;
      this.pushHud();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private refreshGpsRoute(force: boolean): void {
    const refX = this.activeInterior ? this.activeInterior.exteriorPos.x : this.player.x;
    const refZ = this.activeInterior ? this.activeInterior.exteriorPos.z : this.player.z;
    const missionTarget = this.missions.getCurrentTargetPos();
    const target = missionTarget ?? this.customWaypoint;

    this.gpsTargetPos = target;
    if (!target || this.player.inInterior) {
      this.gpsPath = [];
      this.gpsLastTargetKey = '';
      this.gpsRenderer.update([], null, this.simTime);
      return;
    }

    const targetKey = `${target.x.toFixed(1)},${target.z.toFixed(1)}`;
    const movedSq = (refX - this.gpsLastCalcX) ** 2 + (refZ - this.gpsLastCalcZ) ** 2;
    if (force || targetKey !== this.gpsLastTargetKey || movedSq > 12.25) {
      this.gpsLastCalcX = refX;
      this.gpsLastCalcZ = refZ;
      this.gpsLastTargetKey = targetKey;
      this.gpsPath = computeRoadGpsPath(refX, refZ, target.x, target.z, this.world.colliders);
    }

    const showCustomBeacon = !missionTarget && this.customWaypoint ? this.customWaypoint : null;
    this.gpsRenderer.update(this.gpsPath, showCustomBeacon, this.simTime);
  }

  private pushHud(): void {
    const ctx = this.getInteractionContext();
    const refX = this.activeInterior ? this.activeInterior.exteriorPos.x : this.player.x;
    const refZ = this.activeInterior ? this.activeInterior.exteriorPos.z : this.player.z;

    const markers: MapMarker[] = [
      {
        id: 'player',
        type: 'player',
        x: refX,
        z: refZ,
        heading: this.player.heading,
      },
    ];

    this.vehicleMgr.vehicles.forEach((v) => {
      if (v === this.activeVehicle) return;
      const topKmh = Math.round(v.rig.spec.maxSpeed * 3.6);
      const name = this.language === 'ar' ? v.rig.spec.nameAr : v.rig.spec.name;
      markers.push({ id: v.id, type: 'vehicle', x: v.x, z: v.z, label: `${name} (${topKmh} km/h)` });
    });

    this.wanted.units.forEach((u, idx) => {
      if (u.active) markers.push({ id: `cop_${idx}`, type: 'police', x: u.x, z: u.z });
    });

    INTERIOR_PORTALS.forEach((p) => {
      markers.push({
        id: p.id,
        type: 'interior',
        interiorKind: p.kind,
        x: p.exteriorPos.x,
        z: p.exteriorPos.z,
        label: this.language === 'ar' ? p.nameAr : p.name,
      });
    });

    if (!this.missions.activeMission) {
      MISSION_REGISTRY.forEach((m) => {
        markers.push({
          id: m.id,
          type: 'mission',
          x: m.startPos.x,
          z: m.startPos.z,
          label: this.language === 'ar' ? m.titleAr : m.title,
        });
      });
    } else {
      const target = this.missions.getCurrentTargetPos();
      if (target) {
        markers.push({
          id: 'obj',
          type: 'objective',
          x: target.x,
          z: target.z,
          label: this.language === 'ar' ? 'الهدف' : 'Objective',
        });
      }
    }

    if (this.customWaypoint) {
      markers.push({
        id: 'wp',
        type: 'waypoint',
        x: this.customWaypoint.x,
        z: this.customWaypoint.z,
        label: this.language === 'ar' ? 'علامتك' : 'Waypoint',
      });
    }

    const speedKmh = this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.forwardSpeed) * 3.6) : 0;
    const gear = !this.activeVehicle
      ? 'N'
      : this.activeVehicle.forwardSpeed < -0.5
        ? 'R'
        : speedKmh < 2
          ? 'P'
          : String(Math.min(6, Math.max(1, Math.ceil(speedKmh / 28))));

    const activeMissionObj = this.missions.activeMission
      ? {
          id: this.missions.activeMission.id,
          title:
            this.language === 'ar'
              ? this.missions.activeMission.titleAr
              : this.missions.activeMission.title,
          stepDescription:
            this.language === 'ar'
              ? this.missions.activeMission.steps[this.missions.currentStepIndex].descriptionAr
              : this.missions.activeMission.steps[this.missions.currentStepIndex].description,
          timeRemaining: this.missions.timeRemaining,
          progressText: this.missions.getProgressText(this.language),
          targetPos: this.missions.getCurrentTargetPos(),
        }
      : null;

    const nearPed =
      !this.activeVehicle && !this.player.inInterior && !this.player.isSwimming
        ? Boolean(this.pedestrians.findNearestPedestrian(this.player.x, this.player.z, 2.8))
        : false;

    const wantedRemainingSec =
      this.wanted.stars > 0 && this.wanted.isSearching
        ? Math.max(0, Math.ceil(this.wanted.evadeDuration - this.wanted.evadeTimer))
        : this.wanted.stars > 0
          ? this.wanted.evadeDuration
          : 0;

    this.onHudUpdate({
      phase: this.phase,
      language: this.language,
      health: Math.round(this.player.health),
      maxHealth: this.player.maxHealth,
      armor: Math.round(this.player.armor),
      maxArmor: this.player.maxArmor,
      stamina: Math.round(this.player.stamina),
      maxStamina: this.player.maxStamina,
      money: this.money,
      wantedStars: this.wanted.stars,
      wantedCooldownProgress: this.wanted.isSearching
        ? Math.min(1, this.wanted.evadeTimer / this.wanted.evadeDuration)
        : 0,
      wantedRemainingSec,
      isPoliceSearching: this.wanted.isSearching,
      district: getDistrictAt(refX, refZ),
      timeHours: this.weatherTime.timeHours,
      timeLabel: this.weatherTime.formatClock(),
      timePhase: this.weatherTime.getTimePhase(),
      weather: this.weatherTime.weather,
      inVehicle: Boolean(this.activeVehicle),
      isAirplane: Boolean(this.activeVehicle && isAirplaneClass(this.activeVehicle.classId)),
      altitude:
        this.activeVehicle && isAirplaneClass(this.activeVehicle.classId)
          ? Math.max(0, Math.round(this.activeVehicle.y - Math.max(groundHeightAt(this.activeVehicle.x, this.activeVehicle.z), -0.35)))
          : 0,
      firstPerson: this.cameraCtrl.firstPerson,
      vehicleName: this.activeVehicle
        ? this.language === 'ar'
          ? this.activeVehicle.rig.spec.nameAr
          : this.activeVehicle.rig.spec.name
        : '',
      vehicleMaxKmh: this.activeVehicle ? Math.round(this.activeVehicle.rig.spec.maxSpeed * 3.6) : 0,
      vehicleHealth: this.activeVehicle ? Math.round(this.activeVehicle.hp) : 100,
      speedKmh,
      gear,
      headlightsOn: Boolean(this.activeVehicle?.headlightsOn),
      turnSignal: this.activeVehicle?.turnSignal ?? 0,
      isSwimming: this.player.isSwimming,
      isSprinting: this.player.isSprinting,
      nearPedestrian: nearPed,
      weaponId: this.weapons.currentWeapon,
      weaponName: this.weapons.getSpec().name,
      ammo: this.weapons.ammoByWeapon[this.weapons.currentWeapon],
      ownedWeapons: Array.from(this.weapons.ownedWeapons) as WeaponId[],
      ownedVehicles: Array.from(this.ownedVehicles),
      ownedSkins: Array.from(this.ownedSkins),
      ownedHouses: Array.from(this.ownedHouses),
      activeSkin: this.player.activeSkin,
      qualityMode: this.qualityMode,
      interactionPrompt: ctx.prompt,
      activeMission: activeMissionObj,
      missionBanner: this.missionBanner,
      activeInterior: this.activeInterior,
      playerPos: { x: refX, y: this.player.y, z: refZ, heading: this.player.heading },
      markers,
      customWaypoint: this.customWaypoint,
      gpsPath: this.gpsPath,
      gpsTargetPos: this.gpsTargetPos,
      muted: this.sound.muted,
      fps: this.currentFps,
      devUnlocked: this.devCodeActivated,
      completedMissionIds: Array.from(this.missions.completedIds),
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.sound.dispose();
    this.player.dispose();
    this.fpRig.dispose();
    this.vehicleMgr.dispose();
    this.explosions.dispose();
    this.traffic.dispose();
    this.pedestrians.dispose();
    this.wanted.dispose();
    this.weapons.dispose();
    this.missions.dispose();
    this.gpsRenderer.dispose();
    this.weatherTime.dispose();
    this.world.dispose();
    this.interiors.dispose();
    this.textures.dispose();
    this.envTexture?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
