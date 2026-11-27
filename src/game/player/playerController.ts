import * as THREE from 'three';
import { ColliderBox, PlayerSkinId, WeaponId } from '../types';
import { getBridgeDeckHeight, groundHeightAt, MAINLAND_BORDER, resolveCircleColliders, WATER_LEVEL } from '../world/worldLayout';
import { buildMemeCostumeAttachables } from './memeCostumes';
import { PLAYER_SKINS } from './skinCatalog';

export class PlayerController {
  public root: THREE.Group;
  private torsoPivot: THREE.Group;
  private leftArmPivot: THREE.Group;
  private rightArmPivot: THREE.Group;
  private leftLegPivot: THREE.Group;
  private rightLegPivot: THREE.Group;
  private heldGunGroup: THREE.Group;
  private hairMesh!: THREE.Mesh;
  private shadesMesh!: THREE.Mesh;
  private costumeTorsoAnchor: THREE.Group;
  private costumeHeadAnchor: THREE.Group;
  private memeCostumes: Partial<Record<PlayerSkinId, { torsoGroup: THREE.Group; headGroup: THREE.Group }>> = {};
  private weaponMeshes: Partial<Record<WeaponId, THREE.Group>> = {};
  private jacketMat: THREE.MeshStandardMaterial;
  private shirtMat: THREE.MeshStandardMaterial;
  private pantsMat: THREE.MeshStandardMaterial;
  private shoeMat: THREE.MeshStandardMaterial;
  public activeSkin: PlayerSkinId = 'classic';

  public x = 0;
  public y = 0;
  public z = -20;
  public vx = 0;
  public vy = 0;
  public vz = 0;
  public heading = Math.PI;

  public health = 100;
  public maxHealth = 100;
  public armor = 50;
  public maxArmor = 100;
  public stamina = 100;
  public maxStamina = 100;

  public onGround = true;
  public isSwimming = false;
  public isSprinting = false;
  public inInterior = false;
  public interiorCenterX = 0;
  public interiorCenterZ = 0;
  public interiorFloorY = 0;
  public interiorHalfW = 11;
  public interiorHalfD = 11;

  private coyoteTimer = 0;
  private walkPhase = 0;
  private peakAirY = 0;
  private aimTimer = 0;
  private punchTimer = 0;
  private punchHand = 1;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(scene: THREE.Scene) {
    this.root = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2b18e, roughness: 0.65 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.55, metalness: 0.12 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x271912, roughness: 0.85 });
    this.jacketMat = jacketMat;
    this.shirtMat = shirtMat;
    this.pantsMat = pantsMat;
    this.shoeMat = shoeMat;
    this.disposables.push(skinMat, jacketMat, shirtMat, pantsMat, shoeMat, hairMat);

    // 10-part articulated composite character pivoted at bottom-center (feet at y = 0)
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.set(0, 0.88, 0);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.25), jacketMat);
    chest.position.set(0, 0.28, 0);
    chest.castShadow = true;

    const undershirt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.265), shirtMat);
    undershirt.position.set(0, 0.27, 0.005);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.27, 0.26), skinMat);
    head.position.set(0, 0.72, 0);
    head.castShadow = true;

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.28), hairMat);
    hair.position.set(0, 0.84, -0.01);
    this.hairMesh = hair;

    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.06, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.15, metalness: 0.8 })
    );
    shades.position.set(0, 0.74, 0.13);
    this.shadesMesh = shades;

    this.costumeTorsoAnchor = new THREE.Group();
    this.costumeTorsoAnchor.position.set(0, 0.28, 0);
    this.costumeHeadAnchor = new THREE.Group();
    this.costumeHeadAnchor.position.set(0, 0.72, 0);

    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.31, 0.52, 0);
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.15), jacketMat);
    lArm.position.set(0, -0.22, 0);
    lArm.castShadow = true;
    const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), skinMat);
    lHand.position.set(0, -0.51, 0);
    this.leftArmPivot.add(lArm, lHand);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.31, 0.52, 0);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.15), jacketMat);
    rArm.position.set(0, -0.22, 0);
    rArm.castShadow = true;
    const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), skinMat);
    rHand.position.set(0, -0.51, 0);

    // Held weapon visuals attached to right hand
    this.heldGunGroup = new THREE.Group();
    this.heldGunGroup.position.set(0, -0.52, 0.14);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.72 });
    const rpgOliveMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.55, metalness: 0.25 });
    const warheadMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.45 });
    this.disposables.push(gunMat, gripMat, woodMat, rpgOliveMat, warheadMat);

    // Pistol
    const pistolGrp = new THREE.Group();
    const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.28), gunMat);
    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.08), gripMat);
    pGrip.position.set(0, -0.08, -0.07);
    pistolGrp.add(pBody, pGrip);

    // SMG
    const smgGrp = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.48), gunMat);
    sBody.position.set(0, 0, 0.08);
    const sMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.19, 0.07), gripMat);
    sMag.position.set(0, -0.12, 0.08);
    smgGrp.add(sBody, sMag);

    // Shotgun
    const shotGrp = new THREE.Group();
    const shBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.68), gunMat);
    shBarrel.position.set(0, 0.02, 0.16);
    const shStock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.34), woodMat);
    shStock.position.set(0, -0.02, -0.18);
    const shPump = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.2), woodMat);
    shPump.position.set(0, -0.03, 0.24);
    shotGrp.add(shBarrel, shStock, shPump);

    // Assault Rifle
    const rifleGrp = new THREE.Group();
    const rfBody = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.72), gunMat);
    rfBody.position.set(0, 0.02, 0.18);
    const rfMag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.2, 0.08), gripMat);
    rfMag.position.set(0, -0.12, 0.12);
    rfMag.rotation.x = 0.22;
    const rfStock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.26), gripMat);
    rfStock.position.set(0, 0, -0.2);
    rifleGrp.add(rfBody, rfMag, rfStock);

    // Shoulder-mounted HX-7 RPG
    const rpgGrp = new THREE.Group();
    rpgGrp.position.set(0.06, 0.16, -0.05);
    const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.15, 10), rpgOliveMat);
    rpgTube.rotation.x = Math.PI / 2;
    rpgTube.position.set(0, 0, 0.1);
    const rpgBell = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.065, 0.22, 10), gripMat);
    rpgBell.rotation.x = Math.PI / 2;
    rpgBell.position.set(0, 0, -0.52);
    const rpgWarhead = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.28, 10), warheadMat);
    rpgWarhead.rotation.x = Math.PI / 2;
    rpgWarhead.position.set(0, 0, 0.76);
    rpgGrp.add(rpgTube, rpgBell, rpgWarhead);

    this.weaponMeshes = {
      pistol: pistolGrp,
      smg: smgGrp,
      shotgun: shotGrp,
      rifle: rifleGrp,
      rpg: rpgGrp,
    };
    this.heldGunGroup.add(pistolGrp, smgGrp, shotGrp, rifleGrp, rpgGrp);
    this.rightArmPivot.add(rArm, rHand, this.heldGunGroup);

    this.torsoPivot.add(
      chest,
      undershirt,
      head,
      hair,
      shades,
      this.costumeTorsoAnchor,
      this.costumeHeadAnchor,
      this.leftArmPivot,
      this.rightArmPivot
    );

    // Legs pivoted at hip
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.12, 0.88, 0);
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.2), pantsMat);
    lLeg.position.set(0, -0.4, 0);
    lLeg.castShadow = true;
    const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.28), shoeMat);
    lShoe.position.set(0, -0.82, 0.04);
    this.leftLegPivot.add(lLeg, lShoe);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.12, 0.88, 0);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.2), pantsMat);
    rLeg.position.set(0, -0.4, 0);
    rLeg.castShadow = true;
    const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.28), shoeMat);
    rShoe.position.set(0, -0.82, 0.04);
    this.rightLegPivot.add(rLeg, rShoe);

    this.root.add(this.torsoPivot, this.leftLegPivot, this.rightLegPivot);
    this.root.position.set(this.x, this.y, this.z);
    scene.add(this.root);
  }

  public applyDamage(amount: number): void {
    if (amount <= 0) return;
    let rem = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rem * 0.7);
      this.armor = Math.max(0, this.armor - absorbed);
      rem -= absorbed;
    }
    this.health = Math.max(0, this.health - rem);
  }

  public applySkin(skinId: PlayerSkinId): void {
    const def = PLAYER_SKINS[skinId];
    if (!def) return;
    this.activeSkin = skinId;
    this.jacketMat.color.setHex(def.jacketColor);
    this.jacketMat.metalness = def.metalness;
    this.jacketMat.roughness = def.roughness;
    this.jacketMat.emissive.setHex(def.emissive ?? 0x000000);
    this.jacketMat.emissiveIntensity = def.emissiveIntensity ?? 0;

    this.shirtMat.color.setHex(def.shirtColor);
    this.shirtMat.metalness = def.metalness * 0.6;
    this.shirtMat.roughness = Math.max(0.2, def.roughness);

    this.pantsMat.color.setHex(def.pantsColor);
    this.pantsMat.metalness = def.metalness * 0.75;
    this.pantsMat.roughness = Math.min(0.85, def.roughness + 0.12);
    this.pantsMat.emissive.setHex(def.emissive ?? 0x000000);
    this.pantsMat.emissiveIntensity = (def.emissiveIntensity ?? 0) * 0.5;

    this.shoeMat.color.setHex(def.shoeColor);
    this.shoeMat.metalness = def.metalness * 0.8;
    this.shoeMat.roughness = def.roughness;

    const isMeme = Boolean(def.isMeme);
    this.hairMesh.visible = !isMeme;
    this.shadesMesh.visible = !isMeme;

    (Object.keys(this.memeCostumes) as PlayerSkinId[]).forEach((k) => {
      const grp = this.memeCostumes[k];
      if (grp) {
        grp.torsoGroup.visible = false;
        grp.headGroup.visible = false;
      }
    });

    if (isMeme) {
      let grp = this.memeCostumes[skinId];
      if (!grp) {
        grp = buildMemeCostumeAttachables(skinId);
        this.costumeTorsoAnchor.add(grp.torsoGroup);
        this.costumeHeadAnchor.add(grp.headGroup);
        this.memeCostumes[skinId] = grp;
      }
      grp.torsoGroup.visible = true;
      grp.headGroup.visible = true;
    }
  }

  public setHeldWeaponVisual(weaponId: WeaponId, visible: boolean): void {
    this.heldGunGroup.visible = visible && weaponId !== 'fists';
    (Object.keys(this.weaponMeshes) as WeaponId[]).forEach((k) => {
      const m = this.weaponMeshes[k];
      if (m) m.visible = visible && k === weaponId;
    });
  }

  public setRidingPose(mode: 'none' | 'motorcycle' | 'bicycle', pedalPhase: number, steerAngle: number): void {
    if (mode === 'none') {
      this.root.rotation.z = 0;
      this.torsoPivot.position.y = 0.88;
      this.torsoPivot.rotation.set(0, 0, 0);
      this.leftArmPivot.rotation.set(0, 0, 0);
      this.rightArmPivot.rotation.set(0, 0, 0);
      this.leftLegPivot.position.set(-0.12, 0.88, 0);
      this.rightLegPivot.position.set(0.12, 0.88, 0);
      this.leftLegPivot.rotation.set(0, 0, 0);
      this.rightLegPivot.rotation.set(0, 0, 0);
      return;
    }

    const isBicycle = mode === 'bicycle';
    this.torsoPivot.position.y = isBicycle ? 0.56 : 0.62;
    this.torsoPivot.rotation.x = isBicycle ? 0.42 : 0.3;
    this.torsoPivot.rotation.y = steerAngle * 0.28;

    // Hands grip the bike handlebars
    this.leftArmPivot.rotation.set(-1.18, steerAngle * 0.35, 0.18);
    this.rightArmPivot.rotation.set(-1.18, steerAngle * 0.35, -0.18);

    // Legs either straddle motorcycle tank or pedal out-of-phase on bicycle
    if (isBicycle) {
      this.leftLegPivot.position.set(-0.14, 0.56 + Math.sin(pedalPhase) * 0.11, 0.04);
      this.rightLegPivot.position.set(0.14, 0.56 - Math.sin(pedalPhase) * 0.11, 0.04);
      this.leftLegPivot.rotation.set(-0.78 + Math.cos(pedalPhase) * 0.44, 0, -0.12);
      this.rightLegPivot.rotation.set(-0.78 - Math.cos(pedalPhase) * 0.44, 0, 0.12);
    } else {
      this.leftLegPivot.position.set(-0.18, 0.6, 0.08);
      this.rightLegPivot.position.set(0.18, 0.6, 0.08);
      this.leftLegPivot.rotation.set(-0.68, 0, -0.26);
      this.rightLegPivot.rotation.set(-0.68, 0, 0.26);
    }
  }

  public triggerAimPose(heading?: number): void {
    this.aimTimer = 0.45;
    if (heading !== undefined) {
      this.heading = heading;
    }
  }

  public triggerPunchPose(heading?: number): void {
    this.punchTimer = 0.34;
    this.punchHand *= -1;
    if (heading !== undefined) {
      this.heading = heading;
    }
  }

  public respawnAtHospital(): void {
    // Respawn outside CityWorld General Hospital entrance
    this.x = -56;
    this.z = -54;
    this.y = groundHeightAt(this.x, this.z);
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.heading = Math.PI * 0.25;
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.inInterior = false;
    this.setRidingPose('none', 0, 0);
    this.root.visible = true;
  }

  public update(
    dt: number,
    input: { moveX: number; moveZ: number; sprint: boolean; jumpJustPressed: boolean },
    cameraYaw: number,
    colliders: ColliderBox[],
    onFootstep: (sprinting: boolean, inWater: boolean) => void,
    onFallImpact: (damage: number) => void,
    onHitWorldBorder?: () => void
  ): void {
    const hasMove = Math.abs(input.moveX) > 0.05 || Math.abs(input.moveZ) > 0.05;
    this.isSprinting = hasMove && input.sprint && this.stamina > 2 && !this.isSwimming;

    if (this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - 18 * dt);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + 14 * dt);
    }

    const baseSpeed = this.isSwimming ? 4.4 : this.isSprinting ? 10.2 : 5.4;

    if (hasMove) {
      // Camera-relative movement direction
      const sinYaw = Math.sin(cameraYaw);
      const cosYaw = Math.cos(cameraYaw);
      const worldX = input.moveX * cosYaw - input.moveZ * sinYaw;
      const worldZ = -input.moveX * sinYaw - input.moveZ * cosYaw;
      const len = Math.hypot(worldX, worldZ) || 1;
      const dirX = worldX / len;
      const dirZ = worldZ / len;

      this.vx = THREE.MathUtils.damp(this.vx, dirX * baseSpeed, 14, dt);
      this.vz = THREE.MathUtils.damp(this.vz, dirZ * baseSpeed, 14, dt);

      const targetHeading = Math.atan2(dirX, dirZ);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, 12 * dt);
    } else {
      this.vx = THREE.MathUtils.damp(this.vx, 0, 14, dt);
      this.vz = THREE.MathUtils.damp(this.vz, 0, 14, dt);
    }

    // Horizontal move + collision (strict mainland world border on foot/swim, unless already landed on Island!)
    const rawNextX = this.x + this.vx * dt;
    const rawNextZ = this.z + this.vz * dt;
    let nextX = rawNextX;
    let nextZ = rawNextZ;
    if (this.inInterior) {
      // Keep strictly inside explicit interior room bounds
      const roomCenterX = this.interiorCenterX;
      const roomCenterZ = this.interiorCenterZ;
      nextX = THREE.MathUtils.clamp(nextX, roomCenterX - this.interiorHalfW, roomCenterX + this.interiorHalfW);
      nextZ = THREE.MathUtils.clamp(nextZ, roomCenterZ - this.interiorHalfD, roomCenterZ + this.interiorHalfD);
    } else {
      const onIslandAlready = this.z > 620;
      const onAuroriaAlready = this.x >= 720;
      if (onIslandAlready) {
        // Keep safely on/around the Tropical Island beach perimeter when walking on the Island
        nextX = THREE.MathUtils.clamp(nextX, -295, -65);
        nextZ = THREE.MathUtils.clamp(nextZ, 645, 875);
      } else if (onAuroriaAlready) {
        nextX = THREE.MathUtils.clamp(nextX, 740, 1180);
        nextZ = THREE.MathUtils.clamp(nextZ, -340, 100);
      } else {
        nextX = THREE.MathUtils.clamp(nextX, -MAINLAND_BORDER, MAINLAND_BORDER);
        nextZ = THREE.MathUtils.clamp(nextZ, -MAINLAND_BORDER, MAINLAND_BORDER);
      }
      if ((nextX !== rawNextX || nextZ !== rawNextZ) && onHitWorldBorder) {
        onHitWorldBorder();
      }
      const col = resolveCircleColliders(nextX, nextZ, this.y, 0.42, colliders);
      nextX = col.x;
      nextZ = col.z;
    }
    this.x = nextX;
    this.z = nextZ;

    // Ground & Water elevation
    let supportY = this.interiorFloorY;
    if (!this.inInterior) {
      const terrainY = groundHeightAt(this.x, this.z);
      const bridgeY = getBridgeDeckHeight(this.x, this.z);
      supportY = bridgeY !== null && this.y >= bridgeY - 1.5 ? Math.max(terrainY, bridgeY) : terrainY;
    }

    this.isSwimming = !this.inInterior && supportY < WATER_LEVEL - 0.55;

    if (this.isSwimming) {
      // Buoyancy at water surface
      const targetSwimY = WATER_LEVEL - 0.85;
      this.y = THREE.MathUtils.damp(this.y, targetSwimY, 6, dt);
      this.vy = 0;
      this.onGround = false;
      this.peakAirY = this.y;
    } else {
      if (this.onGround) {
        this.coyoteTimer = 0.14;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }

      if (input.jumpJustPressed && this.coyoteTimer > 0) {
        this.vy = 8.4;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.peakAirY = this.y;
      }

      this.vy -= 21 * dt;
      this.y += this.vy * dt;
      if (this.y > this.peakAirY) this.peakAirY = this.y;

      if (this.y <= supportY) {
        if (!this.onGround) {
          const fallDrop = this.peakAirY - supportY;
          if (fallDrop > 6.5) {
            const dmg = Math.round((fallDrop - 6.0) * 9);
            this.applyDamage(dmg);
            onFallImpact(dmg);
          }
        }
        this.y = supportY;
        this.vy = 0;
        this.onGround = true;
        this.peakAirY = this.y;
      } else {
        this.onGround = false;
      }
    }

    // Procedural limb animation
    const hSpeed = Math.hypot(this.vx, this.vz);
    if (this.isSwimming) {
      this.walkPhase += dt * (2.5 + hSpeed * 1.1);
      this.torsoPivot.rotation.x = THREE.MathUtils.damp(this.torsoPivot.rotation.x, 1.15, 8, dt);
      this.leftArmPivot.rotation.x = Math.sin(this.walkPhase) * 1.1 - 0.4;
      this.rightArmPivot.rotation.x = Math.cos(this.walkPhase) * 1.1 - 0.4;
      this.leftLegPivot.rotation.x = Math.sin(this.walkPhase * 1.5) * 0.45 + 0.5;
      this.rightLegPivot.rotation.x = -Math.sin(this.walkPhase * 1.5) * 0.45 + 0.5;
      if (hSpeed > 1) onFootstep(false, true);
    } else if (!this.onGround) {
      this.torsoPivot.rotation.x = THREE.MathUtils.damp(this.torsoPivot.rotation.x, 0.08, 8, dt);
      this.leftArmPivot.rotation.x = -0.6;
      this.rightArmPivot.rotation.x = 0.4;
      this.leftLegPivot.rotation.x = 0.35;
      this.rightLegPivot.rotation.x = -0.25;
    } else if (hSpeed > 0.35) {
      const freq = this.isSprinting ? 13 : 8.5;
      const amp = this.isSprinting ? 0.85 : 0.52;
      this.walkPhase += dt * freq;
      const s = Math.sin(this.walkPhase) * amp;
      this.leftLegPivot.rotation.x = s;
      this.rightLegPivot.rotation.x = -s;
      this.leftArmPivot.rotation.x = -s * 0.85;
      this.rightArmPivot.rotation.x = s * 0.85;
      this.torsoPivot.rotation.x = THREE.MathUtils.damp(
        this.torsoPivot.rotation.x,
        this.isSprinting ? 0.16 : 0.05,
        10,
        dt
      );
      this.torsoPivot.position.y = 0.88 + Math.abs(Math.cos(this.walkPhase)) * 0.04;
      onFootstep(this.isSprinting, false);
    } else {
      this.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.leftLegPivot.rotation.x, 0, 10, dt);
      this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, 0, 10, dt);
      this.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.leftArmPivot.rotation.x, 0, 10, dt);
      this.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.rightArmPivot.rotation.x, 0, 10, dt);
      this.torsoPivot.rotation.x = THREE.MathUtils.damp(this.torsoPivot.rotation.x, 0, 10, dt);
      this.torsoPivot.position.y = 0.88 + Math.sin(performance.now() * 0.0025) * 0.012;
    }

    if (this.punchTimer > 0) {
      this.punchTimer = Math.max(0, this.punchTimer - dt);
      const swing = Math.sin((this.punchTimer / 0.34) * Math.PI);
      if (this.punchHand > 0) {
        this.rightArmPivot.rotation.x = -swing * 1.65;
        this.torsoPivot.rotation.y = -swing * 0.35;
      } else {
        this.leftArmPivot.rotation.x = -swing * 1.65;
        this.torsoPivot.rotation.y = swing * 0.35;
      }
    } else {
      this.torsoPivot.rotation.y = THREE.MathUtils.damp(this.torsoPivot.rotation.y, 0, 12, dt);
      if (this.aimTimer > 0) {
        this.aimTimer = Math.max(0, this.aimTimer - dt);
        this.rightArmPivot.rotation.x = -Math.PI * 0.48;
      }
    }

    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.heading;
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
