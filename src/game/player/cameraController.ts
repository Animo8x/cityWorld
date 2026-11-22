import * as THREE from 'three';
import { getBridgeDeckHeight, groundHeightAt } from '../world/worldLayout';

export class ThirdPersonCameraController {
  public yaw = 0;
  public pitch = 0.28;
  public distance = 6.5;
  private currentTarget = new THREE.Vector3(0, 1.5, -20);
  private currentPos = new THREE.Vector3(0, 4, -13);
  private shakeIntensity = 0;

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(1.0, this.shakeIntensity + amount);
  }

  public rotate(dx: number, dy: number): void {
    this.yaw -= dx * 0.0042;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0036, -0.18, 1.15);
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
    inInterior: boolean
  ): void {
    // Gently auto-align camera behind moving vehicle unless user recently orbited
    if (inVehicle && autoAlign && speedRatio > 0.12) {
      const desiredYaw = targetHeading + Math.PI;
      let diff = desiredYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, 2.1 * dt);
    }

    const baseDist = inInterior ? 4.4 : inVehicle ? Math.max(7.2, this.distance * 1.28) : this.distance;
    const desiredDist = baseDist + speedRatio * (inVehicle ? 2.8 : 0.8);
    const lookHeight = inVehicle ? 1.5 : 1.55;

    this.currentTarget.x = THREE.MathUtils.damp(this.currentTarget.x, targetX, 16, dt);
    this.currentTarget.y = THREE.MathUtils.damp(this.currentTarget.y, targetY + lookHeight, 16, dt);
    this.currentTarget.z = THREE.MathUtils.damp(this.currentTarget.z, targetZ, 16, dt);

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const desiredX = this.currentTarget.x + Math.sin(this.yaw) * cosP * desiredDist;
    let desiredY = this.currentTarget.y + sinP * desiredDist;
    const desiredZ = this.currentTarget.z + Math.cos(this.yaw) * cosP * desiredDist;

    // Terrain / ground collision clamp so camera never sinks below ground
    if (!inInterior) {
      const groundY = groundHeightAt(desiredX, desiredZ);
      const bridgeY = getBridgeDeckHeight(desiredX, desiredZ);
      const minY = Math.max(groundY, bridgeY ?? -999) + 0.8;
      if (desiredY < minY) desiredY = minY;
    } else {
      desiredY = Math.min(desiredY, targetY + 4.4);
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

    const targetFov = inVehicle ? 64 + speedRatio * 14 : 60;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
      camera.updateProjectionMatrix();
    }

    camera.lookAt(this.currentTarget);
  }
}
