import * as THREE from 'three';
import { getBridgeDeckHeight, groundHeightAt } from '../world/worldLayout';

export class ThirdPersonCameraController {
  public yaw = 0;
  public pitch = 0.28;
  public distance = 6.5;
  public firstPerson = false;
  private currentTarget = new THREE.Vector3(0, 1.5, -20);
  private currentPos = new THREE.Vector3(0, 4, -13);
  private shakeIntensity = 0;

  public toggleFirstPerson(targetHeading?: number): boolean {
    this.firstPerson = !this.firstPerson;
    if (this.firstPerson) {
      this.pitch = 0.02;
      if (targetHeading !== undefined) {
        this.yaw = targetHeading + Math.PI;
      }
    } else {
      this.pitch = 0.28;
    }
    return this.firstPerson;
  }

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(1.0, this.shakeIntensity + amount);
  }

  public rotate(dx: number, dy: number): void {
    this.yaw -= dx * 0.0042;
    const minPitch = this.firstPerson ? -0.95 : -0.18;
    const maxPitch = this.firstPerson ? 0.95 : 1.15;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0036, minPitch, maxPitch);
  }

  public zoom(deltaY: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance + deltaY * 0.005, 3.6, 18.0);
  }

  public updateTitleOrbit(camera: THREE.PerspectiveCamera, elapsed: number): void {
    const angle = elapsed * 0.14;
    const radius = 155;
    camera.position.set(Math.cos(angle) * radius, 68 + Math.sin(elapsed * 0.25) * 10, Math.sin(angle) * radius);
    camera.lookAt(0, 18, 0);
  }

  public snapTo(
    x: number,
    y: number,
    z: number,
    heading: number,
    inInterior: boolean,
    interiorBounds?: { centerX: number; centerZ: number; halfW: number; halfD: number }
  ): void {
    this.yaw = heading + Math.PI;
    this.pitch = this.firstPerson ? 0.02 : 0.24;
    const lookY = y + 1.55;
    this.currentTarget.set(x, lookY, z);
    const dist = inInterior ? 4.2 : this.distance;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    let camX = x + Math.sin(this.yaw) * cosP * dist;
    const camY = inInterior ? Math.min(lookY + sinP * dist, y + 4.4) : lookY + sinP * dist;
    let camZ = z + Math.cos(this.yaw) * cosP * dist;
    if (inInterior && interiorBounds) {
      camX = THREE.MathUtils.clamp(
        camX,
        interiorBounds.centerX - interiorBounds.halfW,
        interiorBounds.centerX + interiorBounds.halfW
      );
      camZ = THREE.MathUtils.clamp(
        camZ,
        interiorBounds.centerZ - interiorBounds.halfD,
        interiorBounds.centerZ + interiorBounds.halfD
      );
    }
    this.currentPos.set(camX, camY, camZ);
  }

  public updateFollow(
    camera: THREE.PerspectiveCamera,
    dt: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    targetHeading: number,
    inVehicle: boolean,
    speedRatio: number,
    autoAlign: boolean,
    inInterior: boolean,
    vehicleType: 'none' | 'car' | 'bike' | 'airplane' | 'robot' = 'none',
    interiorBounds?: { centerX: number; centerZ: number; halfW: number; halfD: number }
  ): void {
    if (this.firstPerson) {
      if (Math.abs(camera.near - 0.08) > 0.005) {
        camera.near = 0.08;
        camera.updateProjectionMatrix();
      }

      // Gently re-center driver gaze forward along vehicle heading if not manually looking around
      if (inVehicle && autoAlign) {
        const desiredYaw = targetHeading + Math.PI;
        let diff = desiredYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, 5.2 * dt);
        this.pitch = THREE.MathUtils.damp(
          this.pitch,
          vehicleType === 'airplane' ? -0.02 : vehicleType === 'robot' ? -0.03 : -0.04,
          4,
          dt
        );
      }

      const fwdX = Math.sin(targetHeading);
      const fwdZ = Math.cos(targetHeading);
      const eyeY =
        vehicleType === 'robot'
          ? 2.72
          : vehicleType === 'bike'
            ? 1.48
            : vehicleType === 'airplane'
              ? 1.78
              : vehicleType === 'car'
                ? 1.24
                : 1.66;
      const forwardBias =
        vehicleType === 'robot'
          ? 0.25
          : vehicleType === 'car'
            ? 0.55
            : vehicleType === 'airplane'
              ? 1.15
              : vehicleType === 'bike'
                ? 0.18
                : 0.0;

      const desiredEyeX = targetX + fwdX * forwardBias;
      const desiredEyeY = targetY + eyeY;
      const desiredEyeZ = targetZ + fwdZ * forwardBias;

      // Instant or near-instant lock so driver seat never lags behind fast cars
      camera.position.set(desiredEyeX, desiredEyeY, desiredEyeZ);
      if (this.shakeIntensity > 0.005) {
        camera.position.x += (Math.random() - 0.5) * this.shakeIntensity * 0.25;
        camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.25;
        this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 10, dt);
      }

      const targetFov = inVehicle ? 72 + speedRatio * 10 : 70 + speedRatio * 9;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
        camera.updateProjectionMatrix();
      }

      // Look direction from camera yaw/pitch
      const lookDirX = -Math.sin(this.yaw) * Math.cos(this.pitch);
      const lookDirY = -Math.sin(this.pitch);
      const lookDirZ = -Math.cos(this.yaw) * Math.cos(this.pitch);
      camera.lookAt(
        camera.position.x + lookDirX * 20,
        camera.position.y + lookDirY * 20,
        camera.position.z + lookDirZ * 20
      );
      return;
    }

    if (Math.abs(camera.near - 0.2) > 0.01) {
      camera.near = 0.2;
      camera.updateProjectionMatrix();
    }

    // Gently auto-align 3rd-person camera behind moving vehicle unless user recently orbited
    if (inVehicle && autoAlign && speedRatio > 0.12) {
      const desiredYaw = targetHeading + Math.PI;
      let diff = desiredYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, 2.1 * dt);
    }

    const baseDist = inInterior
      ? 4.4
      : vehicleType === 'airplane'
        ? Math.max(11.5, this.distance * 1.55)
        : vehicleType === 'robot'
          ? Math.max(8.6, this.distance * 1.38)
          : inVehicle
            ? Math.max(7.2, this.distance * 1.28)
            : this.distance;
    const desiredDist =
      baseDist + speedRatio * (vehicleType === 'airplane' ? 4.2 : vehicleType === 'robot' ? 1.4 : inVehicle ? 2.8 : 0.8);
    const lookHeight =
      vehicleType === 'robot' ? 2.25 : vehicleType === 'airplane' ? 1.85 : inVehicle ? 1.5 : 1.55;

    this.currentTarget.x = THREE.MathUtils.damp(this.currentTarget.x, targetX, 16, dt);
    this.currentTarget.y = THREE.MathUtils.damp(this.currentTarget.y, targetY + lookHeight, 16, dt);
    this.currentTarget.z = THREE.MathUtils.damp(this.currentTarget.z, targetZ, 16, dt);

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    let desiredX = this.currentTarget.x + Math.sin(this.yaw) * cosP * desiredDist;
    let desiredY = this.currentTarget.y + sinP * desiredDist;
    let desiredZ = this.currentTarget.z + Math.cos(this.yaw) * cosP * desiredDist;

    if (!inInterior) {
      const groundY = groundHeightAt(desiredX, desiredZ);
      const bridgeY = getBridgeDeckHeight(desiredX, desiredZ);
      const minY = Math.max(groundY, bridgeY ?? -999) + 0.8;
      if (desiredY < minY) desiredY = minY;
    } else {
      desiredY = Math.min(desiredY, targetY + 4.4);
      if (interiorBounds) {
        desiredX = THREE.MathUtils.clamp(
          desiredX,
          interiorBounds.centerX - interiorBounds.halfW,
          interiorBounds.centerX + interiorBounds.halfW
        );
        desiredZ = THREE.MathUtils.clamp(
          desiredZ,
          interiorBounds.centerZ - interiorBounds.halfD,
          interiorBounds.centerZ + interiorBounds.halfD
        );
      }
    }

    this.currentPos.x = THREE.MathUtils.damp(this.currentPos.x, desiredX, 14, dt);
    this.currentPos.y = THREE.MathUtils.damp(this.currentPos.y, desiredY, 14, dt);
    this.currentPos.z = THREE.MathUtils.damp(this.currentPos.z, desiredZ, 14, dt);

    camera.position.copy(this.currentPos);

    if (this.shakeIntensity > 0.005) {
      camera.position.x += (Math.random() - 0.5) * this.shakeIntensity * 0.7;
      camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.7;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 10, dt);
    }

    const targetFov = inVehicle ? 64 + speedRatio * 14 : 60 + speedRatio * 10;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
      camera.updateProjectionMatrix();
    }

    camera.lookAt(this.currentTarget);
  }
}
