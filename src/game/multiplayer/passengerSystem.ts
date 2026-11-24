import type { Language } from '../types';
import { getVehicleSeatOffsets, type SharedVehicleState } from './protocol';
import type { RemoteVehicleVisual } from './vehicleNetwork';

export interface NearbySharedVehicleCandidate {
  vehicle: RemoteVehicleVisual;
  hasOpenSeat: boolean;
  openSeatIndex: number;
  prompt: string;
}

export function computeSeatWorldPose(
  veh: { x: number; y: number; z: number; heading: number; pitch: number; roll: number },
  classId: SharedVehicleState['classId'],
  seatIndex: number
): { x: number; y: number; z: number; heading: number } {
  const offsets = getVehicleSeatOffsets(classId);
  const idx = Math.max(0, Math.min(offsets.length - 1, seatIndex));
  const local = offsets[idx];
  const sinH = Math.sin(veh.heading);
  const cosH = Math.cos(veh.heading);

  // Rotate local XZ seat offset around Y heading; forward in CityWorld is +Z local -> (+sinH, +cosH)
  const worldX = veh.x + local.x * cosH + local.z * sinH;
  const worldZ = veh.z - local.x * sinH + local.z * cosH;
  const worldY = veh.y + local.y - local.z * Math.sin(veh.pitch);
  return { x: worldX, y: worldY, z: worldZ, heading: veh.heading };
}

export class PassengerSystem {
  public role: 'none' | 'driver' | 'passenger' = 'none';
  public vehicleId: string | null = null;
  public seatIndex = -1;
  public driverName: string | null = null;

  public reset(): void {
    this.role = 'none';
    this.vehicleId = null;
    this.seatIndex = -1;
    this.driverName = null;
  }

  public setSeated(
    role: 'driver' | 'passenger',
    vehicleId: string,
    seatIndex: number,
    driverName: string | null
  ): void {
    this.role = role;
    this.vehicleId = vehicleId;
    this.seatIndex = seatIndex;
    this.driverName = driverName;
  }

  public findNearestJoinableVehicle(
    px: number,
    py: number,
    pz: number,
    remoteVehicles: RemoteVehicleVisual[],
    localPlayerId: string | null,
    language: Language
  ): NearbySharedVehicleCandidate | null {
    let best: RemoteVehicleVisual | null = null;
    let bestDist = 5.2;

    for (const v of remoteVehicles) {
      if (!v.rig.root.visible) continue;
      if (Math.abs(v.y - py) > 4.2) continue;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    if (!best) return null;

    const seats = best.state.seats;
    const openSeatIndex = seats.findIndex((occ) => !occ || occ === localPlayerId);
    const hasOpenSeat = openSeatIndex !== -1;
    const vName = language === 'ar' ? best.rig.spec.nameAr : best.rig.spec.name;
    const prompt = hasOpenSeat
      ? language === 'ar'
        ? `ركوب ${vName} [F]`
        : `Ride in ${vName} [F]`
      : language === 'ar'
        ? 'السيارة ممتلئة'
        : 'Vehicle Full';

    return {
      vehicle: best,
      hasOpenSeat,
      openSeatIndex,
      prompt,
    };
  }
}
