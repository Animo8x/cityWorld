import * as THREE from 'three';
import { Language, MissionDefinition } from '../types';
import { groundHeightAt } from '../world/worldLayout';

export const MISSION_REGISTRY: MissionDefinition[] = [
  {
    id: 'downtown_express',
    title: 'Downtown Express',
    titleAr: 'توصيل وسط المدينة السريع',
    giver: 'Elena Vance · Civic Dispatch',
    giverAr: 'إيلينا فانس · مكتب الإرسال المدني',
    district: 'downtown',
    description: 'Pick up a VIP envoy at Downtown Plaza and drive them to the Crestwood Hills Estate.',
    descriptionAr: 'التقط مبعوثاً مهماً من ساحة وسط المدينة وأوصله إلى قصر حي الفلل الفاخرة.',
    rewardMoney: 650,
    startPos: { x: 18, z: -20 },
    steps: [
      {
        id: 'step_1',
        description: 'Drive or walk to Downtown Civic Plaza fountain.',
        descriptionAr: 'توجّه سيراً أو بالسيارة إلى نافورة ساحة وسط المدينة.',
        type: 'goto',
        targetPos: { x: 0, z: 16 },
        radius: 6.5,
      },
      {
        id: 'step_2',
        description: 'Transport the envoy to Crestwood Hills Villa before the timer expires.',
        descriptionAr: 'انقل المبعوث إلى فيلا حي الفلل الفاخرة قبل انتهاء الوقت.',
        type: 'timed_checkpoint',
        targetPos: { x: -210, z: -150 },
        radius: 8,
        timeLimit: 75,
      },
    ],
  },
  {
    id: 'harbor_run',
    title: 'Harbor Sprint',
    titleAr: 'سباق شحن الميناء',
    giver: 'Marcus Cole · Port Logistics',
    giverAr: 'ماركوس كول · لوجستيات الميناء',
    district: 'industrial',
    description: 'Deliver high-priority manifest cargo from Ironworks Depot to CityWorld Harbor Pier.',
    descriptionAr: 'انقل شحنة عاجلة من مستودع المنطقة الصناعية إلى رصيف الميناء البحري.',
    rewardMoney: 800,
    startPos: { x: 160, z: 10 },
    steps: [
      {
        id: 'step_1',
        description: 'Reach the Harbor Container Pier on the southeast docks before time runs out.',
        descriptionAr: 'صل إلى رصيف حاويات الميناء في الجنوب الشرقي قبل انتهاء المؤقت.',
        type: 'timed_checkpoint',
        targetPos: { x: 245, z: 310 },
        radius: 10,
        timeLimit: 65,
      },
    ],
  },
  {
    id: 'coastal_supply',
    title: 'Coastal Salvage',
    titleAr: 'إنقاذ صناديق الشاطئ',
    giver: 'Maya Lin · Beach Patrol',
    giverAr: 'مايا لين · دورية الشاطئ',
    district: 'beach',
    description: 'Collect 4 drift-crates washed up along the Azure Coastline boardwalk & sands.',
    descriptionAr: 'اجمع 4 صناديق إمداد منجرفة على طول رمال وكورنيش الشاطئ.',
    rewardMoney: 550,
    startPos: { x: -60, z: 298 },
    steps: [
      {
        id: 'step_1',
        description: 'Collect all 4 Coastal Supply Crates along the beach.',
        descriptionAr: 'اجمع جميع صناديق الإمداد الأربعة على طول الشاطئ.',
        type: 'collect_all',
        collectPoints: [
          { x: -120, z: 325 },
          { x: -185, z: 332 },
          { x: -245, z: 322 },
          { x: -30, z: 330 },
        ],
        radius: 4.5,
      },
    ],
  },
  {
    id: 'runway_courier',
    title: 'Runway Intercept',
    titleAr: 'سباق مدرج المطار',
    giver: 'Capt. Hayes · Skyline ATC',
    giverAr: 'الكابتن هايز · برج المراقبة',
    district: 'airport',
    description: 'Race across Skyline International Airport runway to deliver flight logs to the Terminal.',
    descriptionAr: 'انطلق عبر مدرج المطار الدولي لإيصال سجلات الرحلة إلى مبنى الركاب.',
    rewardMoney: 900,
    startPos: { x: 240, z: -215 },
    steps: [
      {
        id: 'step_1',
        description: 'Hit the east runway checkpoint.',
        descriptionAr: 'صل إلى نقطة التفتيش في نهاية المدرج الشرقي.',
        type: 'timed_checkpoint',
        targetPos: { x: 440, z: -310 },
        radius: 11,
        timeLimit: 50,
      },
      {
        id: 'step_2',
        description: 'Return to the Airport Control Tower apron.',
        descriptionAr: 'عُد مسرعاً إلى ساحة برج مراقبة المطار.',
        type: 'timed_checkpoint',
        targetPos: { x: 265, z: -230 },
        radius: 9,
        timeLimit: 40,
      },
    ],
  },
  {
    id: 'heatwave_escape',
    title: 'Heatwave Escape',
    titleAr: 'الهروب من مطاردة الشرطة',
    giver: 'Anonymous Fixer',
    giverAr: 'وسيط مجهول',
    district: 'poor',
    description: 'Shake off a 2-star CWPD pursuit and reach the Pinecrest Valley Safe House.',
    descriptionAr: 'تخلّص من مطاردة الشرطة (نجمتان) ثم وصل إلى البيت الآمن في الريف.',
    rewardMoney: 1100,
    startPos: { x: -20, z: 185 },
    steps: [
      {
        id: 'step_1',
        description: 'Evade the CWPD patrol and lose all Wanted Stars!',
        descriptionAr: 'اهرب من دوريات الشرطة وتخلّص من جميع نجوم المطاردة!',
        type: 'evade_police',
        wantedTarget: 2,
      },
      {
        id: 'step_2',
        description: 'Drive north to the Pinecrest Valley Safe House.',
        descriptionAr: 'قد شمالاً إلى البيت الآمن في منطقة الريف والجبال.',
        type: 'goto',
        targetPos: { x: -165, z: -380 },
        radius: 8,
      },
    ],
  },
  {
    id: 'highway_circuit',
    title: 'Expressway Overpass Run',
    titleAr: 'تحدي الطريق السريع والجسر',
    giver: 'Veloce Motorsport Club',
    giverAr: 'نادي فيلوسي للسيارات الرياضية',
    district: 'highway',
    description: 'Blast across the Metro Ring Overpass Bridge and finish at Maple Oaks Central Park.',
    descriptionAr: 'انطلق بأقصى سرعة فوق جسر الطريق الدائري ثم اختم السباق في الحي السكني.',
    rewardMoney: 750,
    startPos: { x: 95, z: -265 },
    steps: [
      {
        id: 'step_1',
        description: 'Cross the elevated Northern Overpass Bridge.',
        descriptionAr: 'اعبر الجسر العلوي للطريق السريع الشمالي.',
        type: 'timed_checkpoint',
        targetPos: { x: 0, z: -265 },
        radius: 9,
        timeLimit: 45,
      },
      {
        id: 'step_2',
        description: 'Reach Maple Oaks Boulevard.',
        descriptionAr: 'صل إلى شارع الحي السكني الرئيسي.',
        type: 'timed_checkpoint',
        targetPos: { x: -240, z: 110 },
        radius: 10,
        timeLimit: 55,
      },
    ],
  },
];

export class MissionSystem {
  public activeMission: MissionDefinition | null = null;
  public currentStepIndex = 0;
  public timeRemaining: number | null = null;
  public completedIds = new Set<string>();
  public collectedMask: boolean[] = [];

  private scene: THREE.Scene;
  private startBeacons = new Map<string, THREE.Mesh>();
  private objectiveRing: THREE.Mesh;
  private objectiveBeam: THREE.Mesh;
  private cratePool: THREE.Mesh[] = [];
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Mission start markers
    const beaconGeo = new THREE.CylinderGeometry(1.1, 1.1, 3.2, 16, 1, true);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(beaconGeo, beaconMat);

    MISSION_REGISTRY.forEach((m) => {
      const mMesh = new THREE.Mesh(beaconGeo, beaconMat);
      const y = groundHeightAt(m.startPos.x, m.startPos.z);
      mMesh.position.set(m.startPos.x, y + 1.6, m.startPos.z);
      scene.add(mMesh);
      this.startBeacons.set(m.id, mMesh);
    });

    // Active Objective Target Beacon
    const objRingGeo = new THREE.TorusGeometry(2.6, 0.18, 10, 28);
    const objRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.0,
    });
    this.objectiveRing = new THREE.Mesh(objRingGeo, objRingMat);
    this.objectiveRing.rotation.x = Math.PI / 2;
    this.objectiveRing.visible = false;

    const beamGeo = new THREE.CylinderGeometry(0.6, 1.8, 34, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.objectiveBeam = new THREE.Mesh(beamGeo, beamMat);
    this.objectiveBeam.visible = false;
    this.disposables.push(objRingGeo, objRingMat, beamGeo, beamMat);
    scene.add(this.objectiveRing, this.objectiveBeam);

    // Collectible crates pool
    const crateGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 1.2,
      roughness: 0.3,
    });
    this.disposables.push(crateGeo, crateMat);
    for (let i = 0; i < 8; i++) {
      const crate = new THREE.Mesh(crateGeo, crateMat);
      crate.visible = false;
      scene.add(crate);
      this.cratePool.push(crate);
    }
  }

  public startMission(
    missionId: string,
    onWantedTrigger: (stars: number) => void,
    onStartCue: () => void
  ): boolean {
    if (this.activeMission) return false;
    const def = MISSION_REGISTRY.find((m) => m.id === missionId);
    if (!def) return false;

    this.activeMission = def;
    this.currentStepIndex = 0;
    this.setupStep(onWantedTrigger);
    onStartCue();
    return true;
  }

  public abortMission(): void {
    this.activeMission = null;
    this.timeRemaining = null;
    this.objectiveRing.visible = false;
    this.objectiveBeam.visible = false;
    this.cratePool.forEach((c) => (c.visible = false));
  }

  private setupStep(onWantedTrigger: (stars: number) => void): void {
    if (!this.activeMission) return;
    const step = this.activeMission.steps[this.currentStepIndex];
    this.timeRemaining = step.timeLimit ?? null;
    this.cratePool.forEach((c) => (c.visible = false));

    if (step.type === 'collect_all' && step.collectPoints) {
      this.collectedMask = step.collectPoints.map(() => false);
      step.collectPoints.forEach((pt, idx) => {
        const crate = this.cratePool[idx];
        if (crate) {
          crate.visible = true;
          crate.position.set(pt.x, groundHeightAt(pt.x, pt.z) + 0.9, pt.z);
        }
      });
    } else if (step.type === 'evade_police' && step.wantedTarget) {
      onWantedTrigger(step.wantedTarget);
    }
  }

  public findNearestStartMission(px: number, pz: number): MissionDefinition | null {
    if (this.activeMission) return null;
    for (const m of MISSION_REGISTRY) {
      const dx = m.startPos.x - px;
      const dz = m.startPos.z - pz;
      if (dx * dx + dz * dz < 16) {
        return m;
      }
    }
    return null;
  }

  public getCurrentTargetPos(): { x: number; z: number } | null {
    if (!this.activeMission) return null;
    const step = this.activeMission.steps[this.currentStepIndex];
    if (step.targetPos) return step.targetPos;
    if (step.type === 'collect_all' && step.collectPoints) {
      const idx = this.collectedMask.findIndex((c) => !c);
      if (idx >= 0) return step.collectPoints[idx];
    }
    return null;
  }

  public getProgressText(lang: Language = 'en'): string | null {
    if (!this.activeMission) return null;
    const step = this.activeMission.steps[this.currentStepIndex];
    if (step.type === 'collect_all' && step.collectPoints) {
      const got = this.collectedMask.filter(Boolean).length;
      return lang === 'ar'
        ? `${got}/${step.collectPoints.length} صناديق`
        : `${got}/${step.collectPoints.length} Crates`;
    }
    return lang === 'ar'
      ? `الخطوة ${this.currentStepIndex + 1}/${this.activeMission.steps.length}`
      : `Step ${this.currentStepIndex + 1}/${this.activeMission.steps.length}`;
  }

  public update(
    dt: number,
    elapsed: number,
    playerX: number,
    playerZ: number,
    wantedStars: number,
    lang: Language,
    onWantedTrigger: (stars: number) => void,
    onEvent: (event: { kind: 'step' | 'success' | 'fail'; title: string; subtitle: string; reward?: number }) => void
  ): void {
    // Animate start beacons
    this.startBeacons.forEach((mesh, id) => {
      mesh.visible = !this.activeMission;
      mesh.rotation.y = elapsed * 1.4;
      mesh.scale.y = 1 + Math.sin(elapsed * 3 + id.length) * 0.12;
    });

    if (!this.activeMission) {
      this.objectiveRing.visible = false;
      this.objectiveBeam.visible = false;
      return;
    }

    const step = this.activeMission.steps[this.currentStepIndex];

    // Timer check
    if (this.timeRemaining !== null) {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        const failedTitle = lang === 'ar' ? this.activeMission.titleAr : this.activeMission.title;
        this.abortMission();
        onEvent({
          kind: 'fail',
          title: lang === 'ar' ? 'فشلت المهمة' : 'Mission Failed',
          subtitle: lang === 'ar' ? `${failedTitle} — انتهى الوقت` : `${failedTitle} — Time Expired`,
        });
        return;
      }
    }

    // Objective beacon rendering
    const target = this.getCurrentTargetPos();
    if (target) {
      const ty = groundHeightAt(target.x, target.z);
      this.objectiveRing.visible = true;
      this.objectiveBeam.visible = true;
      this.objectiveRing.position.set(target.x, ty + 0.35 + Math.sin(elapsed * 4) * 0.15, target.z);
      this.objectiveBeam.position.set(target.x, ty + 17, target.z);
    } else {
      this.objectiveRing.visible = false;
      this.objectiveBeam.visible = false;
    }

    // Rotate collectibles
    this.cratePool.forEach((c) => {
      if (c.visible) c.rotation.y += dt * 1.8;
    });

    // Step completion checks
    let stepComplete = false;
    if ((step.type === 'goto' || step.type === 'timed_checkpoint') && step.targetPos) {
      const r = step.radius ?? 7;
      const dx = playerX - step.targetPos.x;
      const dz = playerZ - step.targetPos.z;
      if (dx * dx + dz * dz <= r * r) stepComplete = true;
    } else if (step.type === 'collect_all' && step.collectPoints) {
      const r = step.radius ?? 4.5;
      step.collectPoints.forEach((pt, idx) => {
        if (this.collectedMask[idx]) return;
        const dx = playerX - pt.x;
        const dz = playerZ - pt.z;
        if (dx * dx + dz * dz <= r * r) {
          this.collectedMask[idx] = true;
          if (this.cratePool[idx]) this.cratePool[idx].visible = false;
        }
      });
      if (this.collectedMask.every(Boolean)) stepComplete = true;
    } else if (step.type === 'evade_police') {
      if (wantedStars === 0) stepComplete = true;
    }

    if (stepComplete) {
      this.currentStepIndex++;
      if (this.currentStepIndex >= this.activeMission.steps.length) {
        const finished = this.activeMission;
        this.completedIds.add(finished.id);
        this.abortMission();
        onEvent({
          kind: 'success',
          title: lang === 'ar' ? 'نجحت المهمة!' : 'Mission Passed',
          subtitle: `${lang === 'ar' ? finished.titleAr : finished.title} · +$${finished.rewardMoney}`,
          reward: finished.rewardMoney,
        });
      } else {
        this.setupStep(onWantedTrigger);
        const nextStep = this.activeMission.steps[this.currentStepIndex];
        onEvent({
          kind: 'step',
          title: lang === 'ar' ? this.activeMission.titleAr : this.activeMission.title,
          subtitle: lang === 'ar' ? nextStep.descriptionAr : nextStep.description,
        });
      }
    }
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
