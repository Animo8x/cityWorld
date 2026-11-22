import React, { useState } from 'react';
import {
  Clock,
  CloudRain,
  Compass,
  Map as MapIcon,
  Pause,
  Shield,
  Sun,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Star,
  Gamepad2,
  Smartphone,
  Backpack,
} from 'lucide-react';
import { HudSnapshot } from '../game/types';
import { ROAD_SEGMENTS } from '../game/world/worldLayout';
import { getText } from '../i18n/translations';

interface GameHUDProps {
  hud: HudSnapshot;
  touchEnabled: boolean;
  onToggleTouch: () => void;
  onOpenMap: () => void;
  onOpenPause: () => void;
  onOpenPhone: () => void;
  onOpenBackpack: () => void;
  onCycleWeather: () => void;
  onAdvanceTime: () => void;
  onToggleMute: () => void;
  onCycleWeapon: () => void;
}

/** Smoothly interpolates vehicle health color from pure white (100%) -> orange (45%) -> crimson red (0%) */
function getVehicleHealthColor(hp: number): string {
  const clamped = Math.max(0, Math.min(100, hp));
  if (clamped >= 55) {
    // 100 -> 55: white (255,255,255) -> warm amber (251, 191, 36)
    const t = (100 - clamped) / 45;
    const r = Math.round(255 - t * 4);
    const g = Math.round(255 - t * 64);
    const b = Math.round(255 - t * 219);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // 55 -> 0: warm amber (251,191,36) -> deep crimson red (239, 35, 35)
  const t = (55 - clamped) / 55;
  const r = Math.round(251 - t * 12);
  const g = Math.round(191 - t * 156);
  const b = Math.round(36 - t * 1);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

const VehicleDamageIcon: React.FC<{ hp: number; size?: 'sm' | 'md' }> = ({ hp, size = 'md' }) => {
  const color = getVehicleHealthColor(hp);
  const dim = size === 'sm' ? 'w-7 h-5' : 'w-9 h-6';
  return (
    <div className="flex items-center gap-1.5" title={`Vehicle Integrity: ${hp}%`}>
      <svg viewBox="0 0 64 32" className={dim} aria-label="Vehicle Health">
        {/* Car silhouette body */}
        <path
          d="M8 22 L10 14 L20 8 L42 8 L52 14 L57 16 L58 22 Z"
          fill={color}
          stroke="#0f172a"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Windshield & side window cutout */}
        <path d="M22 10 L39 10 L46 14 L18 14 Z" fill="#0f172a" opacity="0.72" />
        {/* Wheels */}
        <circle cx="17" cy="23" r="4.5" fill="#0f172a" stroke={color} strokeWidth="1.6" />
        <circle cx="47" cy="23" r="4.5" fill="#0f172a" stroke={color} strokeWidth="1.6" />
      </svg>
      <span
        className="text-[10px] md:text-xs font-black tabular-nums"
        style={{ color }}
      >
        {hp}%
      </span>
    </div>
  );
};

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  touchEnabled,
  onToggleTouch,
  onOpenMap,
  onOpenPause,
  onOpenPhone,
  onOpenBackpack,
  onCycleWeather,
  onAdvanceTime,
  onToggleMute,
  onCycleWeapon,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const t = getText(hud.language);

  const mapRadius = 175;
  const px = hud.playerPos.x;
  const pz = hud.playerPos.z;
  const toMini = (wx: number, wz: number) => ({
    x: 72 + ((wx - px) / mapRadius) * 72,
    y: 72 + ((wz - pz) / mapRadius) * 72,
  });

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 md:p-5">
      {/* TOP PERIMETER ROW */}
      <div className="flex items-start justify-between gap-2 md:gap-4">
        {/* TOP-LEFT: Dynamic Mini-Map + District & Time */}
        <div className="flex flex-col gap-1.5">
          <div className="relative w-[108px] h-[108px] md:w-[144px] md:h-[144px] rounded-xl overflow-hidden bg-slate-950/90 border-2 border-slate-700/80 shadow-lg">
            <svg viewBox="0 0 144 144" className="w-full h-full">
              <rect
                x={0}
                y={toMini(px, 340).y}
                width={144}
                height={144}
                fill="#0c4a6e"
                opacity={0.7}
              />
              {ROAD_SEGMENTS.map((seg) => {
                const p1 = toMini(seg.x1, seg.z1);
                const p2 = toMini(seg.x2, seg.z2);
                return (
                  <line
                    key={seg.id}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={seg.isHighway ? '#f59e0b' : '#475569'}
                    strokeWidth={seg.isHighway ? 3.2 : 2.2}
                    strokeLinecap="round"
                  />
                );
              })}

              {hud.gpsPath.length >= 2 && (
                <polyline
                  points={hud.gpsPath
                    .map((pt) => {
                      const p = toMini(pt.x, pt.z);
                      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {hud.markers.map((m) => {
                if (m.type === 'player') return null;
                const pt = toMini(m.x, m.z);
                if (pt.x < -6 || pt.x > 150 || pt.y < -6 || pt.y > 150) return null;
                const color =
                  m.type === 'police'
                    ? '#ef4444'
                    : m.type === 'objective'
                      ? '#38bdf8'
                      : m.type === 'mission'
                        ? '#facc15'
                        : m.type === 'waypoint'
                          ? '#c084fc'
                          : m.type === 'interior'
                            ? m.interiorKind === 'dealership'
                              ? '#38bdf8'
                              : m.interiorKind === 'garage'
                                ? '#f59e0b'
                                : m.interiorKind === 'house'
                                  ? '#fb923c'
                                  : m.interiorKind === 'gunshop'
                                    ? '#ef4444'
                                    : m.interiorKind === 'skins'
                                      ? '#facc15'
                                      : '#34d399'
                            : '#94a3b8';
                const r =
                  m.type === 'vehicle'
                    ? 2.2
                    : m.interiorKind === 'dealership' || m.interiorKind === 'garage'
                      ? 4.6
                      : m.interiorKind === 'house'
                        ? 4.0
                        : 3.6;
                return <circle key={m.id} cx={pt.x} cy={pt.y} r={r} fill={color} />;
              })}

              <g
                transform={`translate(72, 72) rotate(${(-hud.playerPos.heading * 180) / Math.PI + 180})`}
              >
                <polygon points="0,-7 5,6 0,3 -5,6" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
              </g>
            </svg>
            <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[9px] md:text-[10px] font-bold text-slate-200 bg-slate-950/85 px-1.5 py-0.5 rounded">
              <span className="truncate">{hud.language === 'ar' ? hud.district.nameAr : hud.district.name}</span>
              <span className="tabular-nums text-amber-400">{hud.timeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold text-slate-200 bg-slate-950/85 border border-slate-800 px-2 py-0.5 rounded-md w-fit">
            <Compass className="w-3 h-3 text-sky-400" />
            <span>{t.timePhases[hud.timePhase]}</span>
            <span className="text-slate-500">·</span>
            <span>{t.weatherNames[hud.weather]}</span>
          </div>
        </div>

        {/* TOP-CENTER: Mission Objective / Event Banner */}
        <div className="flex flex-col items-center gap-1.5 max-w-[44vw] md:max-w-md text-center">
          {hud.activeMission && (
            <div className="bg-slate-950/90 border border-sky-500/60 px-3 py-1.5 rounded-lg shadow-lg">
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-sky-400">
                <span>{hud.activeMission.title}</span>
                {hud.activeMission.progressText && (
                  <span className="text-slate-300">· {hud.activeMission.progressText}</span>
                )}
                {hud.activeMission.timeRemaining !== null && (
                  <span className="tabular-nums text-amber-400">
                    · {Math.ceil(hud.activeMission.timeRemaining)}s
                  </span>
                )}
              </div>
              <div className="text-[11px] md:text-sm font-medium text-slate-100 mt-0.5 line-clamp-2">
                {hud.activeMission.stepDescription}
              </div>
            </div>
          )}

          {hud.missionBanner && (
            <div
              className={`px-3 py-1.5 rounded-lg border shadow-lg ${
                hud.missionBanner.kind === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
                  : hud.missionBanner.kind === 'fail'
                    ? 'bg-rose-950/95 border-rose-500 text-rose-100'
                    : 'bg-slate-950/90 border-amber-500/70 text-slate-100'
              }`}
            >
              <div className="text-[11px] md:text-xs font-extrabold uppercase tracking-wider">
                {hud.missionBanner.title}
              </div>
              <div className="text-[10px] md:text-xs opacity-90">{hud.missionBanner.subtitle}</div>
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Wanted Stars (+ 5-min Escape Timer), Money, Health / Armor / Stamina + Mobile Speedometer */}
        <div className="flex flex-col items-end gap-1.5 min-w-[130px] md:min-w-[180px]">
          <div className="flex items-center gap-1 bg-slate-950/85 border border-slate-800 px-2 py-0.5 md:px-2.5 md:py-1 rounded-md">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-3.5 h-3.5 md:w-4 md:h-4 ${
                  star <= hud.wantedStars
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-700'
                }`}
              />
            ))}
            {hud.wantedStars > 0 && hud.isPoliceSearching && (
              <span className="ml-1 text-[9px] md:text-[10px] font-bold uppercase text-sky-400 tabular-nums">
                {formatCountdown(hud.wantedRemainingSec)}
              </span>
            )}
          </div>

          <div className="text-base md:text-xl font-black tracking-tight text-emerald-400 tabular-nums bg-slate-950/85 border border-slate-800 px-2.5 py-0.5 md:px-3 md:py-1 rounded-md">
            ${hud.money.toLocaleString()}
          </div>

          <div className="w-32 md:w-44 bg-slate-950/85 border border-slate-800 p-1.5 md:p-2 rounded-lg flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] md:text-[10px] font-bold text-rose-400 w-7">{t.hp}</span>
              <div className="flex-1 h-1.5 md:h-2 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-[width] duration-100"
                  style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
                />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold tabular-nums text-slate-300 w-5 text-right">
                {hud.health}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Shield className="w-2.5 h-2.5 md:w-3 md:h-3 text-sky-400 shrink-0" />
              <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-[width] duration-100"
                  style={{ width: `${(hud.armor / hud.maxArmor) * 100}%` }}
                />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold tabular-nums text-slate-300 w-5 text-right">
                {hud.armor}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] md:text-[10px] font-bold text-amber-400 w-7">{t.stm}</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-[width] duration-100"
                  style={{ width: `${(hud.stamina / hud.maxStamina) * 100}%` }}
                />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold tabular-nums text-slate-300 w-5 text-right">
                {hud.stamina}
              </span>
            </div>
          </div>

          {/* Equipped Weapon Badge */}
          {!hud.inVehicle && (
            <button
              onClick={onCycleWeapon}
              className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-md text-[11px] font-bold text-slate-100 cursor-pointer"
              title="Switch Weapon (1-6 or Tab)"
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.weaponNames[hud.weaponId]}</span>
              {hud.weaponId !== 'fists' && (
                <span className="text-amber-300 tabular-nums">· {hud.ammo}</span>
              )}
            </button>
          )}

          {/* Mobile Vehicle Speedometer + White-to-Red Car Damage Icon */}
          {touchEnabled && hud.inVehicle && (
            <div
              className={`bg-slate-950/90 border px-2.5 py-1.5 rounded-lg text-right shadow-lg flex flex-col items-end gap-1 ${
                hud.vehicleHealth <= 20 ? 'border-rose-500' : 'border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <VehicleDamageIcon hp={hud.vehicleHealth} size="sm" />
                <div className="text-[9px] font-extrabold text-slate-300 truncate max-w-[120px]">
                  {hud.vehicleName} <span className="text-sky-400">({hud.vehicleMaxKmh})</span>
                </div>
              </div>
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-xl font-black tabular-nums text-white">{hud.speedKmh}</span>
                <span className="text-[10px] font-bold text-amber-400">KM/H</span>
                <span className="px-1 rounded bg-slate-800 text-[10px] font-black text-sky-400 tabular-nums">
                  {hud.gear}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM PERIMETER ROW */}
      <div className="flex items-end justify-between gap-2 md:gap-4">
        {/* Bottom-Left: Minimal Controls Reminder (desktop only) */}
        <div className="hidden lg:block text-[11px] font-medium text-slate-300 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-md">
          {hud.inVehicle
            ? 'W/S Drive · A/D Steer · Space Handbrake · L Lights · H Horn · F Exit'
            : hud.isSwimming
              ? 'WASD Swim · Mouse Orbit · F Board Nearby Vehicle'
              : 'WASD Move · V Punch · Click / G Shoot · 1-6 Weapon · F Steal / Drive · E Interact'}
        </div>

        {/* Bottom-Center: Contextual Prompt + Collapsible Compact Quick Dock */}
        <div className="flex flex-col items-center gap-1.5 mx-auto pointer-events-auto mb-1">
          {hud.interactionPrompt && !touchEnabled && (
            <div className="bg-amber-500 text-slate-950 font-extrabold text-xs md:text-sm px-4 py-1.5 rounded-md shadow-lg">
              {hud.interactionPrompt}
            </div>
          )}

          {/* Always-accessible Green Phone & Backpack quick buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenPhone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs shadow-lg border border-emerald-200 cursor-pointer"
              title={`${t.phone} (P)`}
            >
              <Smartphone className="w-4 h-4" />
              <span>{t.phone}</span>
              {hud.ownedVehicles.length > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-slate-950/20 text-[10px] font-black tabular-nums">
                  {hud.ownedVehicles.length}
                </span>
              )}
            </button>

            <button
              onClick={onOpenBackpack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs shadow-lg border border-amber-200 cursor-pointer"
              title={`${t.backpack} (B)`}
            >
              <Backpack className="w-4 h-4" />
              <span>{t.backpack}</span>
            </button>

            <button
              onClick={() => setDockCollapsed((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-slate-700 text-[10px] md:text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{dockCollapsed ? t.showBar : t.hideBar}</span>
            </button>
          </div>

          {!dockCollapsed && (
            <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-700/80 px-2 py-1 rounded-lg shadow-xl">
              <button
                onClick={onOpenMap}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-100 cursor-pointer"
                title={t.map}
              >
                <MapIcon className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">{t.map}</span>
              </button>
              <button
                onClick={onAdvanceTime}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-100 cursor-pointer"
                title={t.time}
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">{t.time}</span>
              </button>
              <button
                onClick={onCycleWeather}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-100 cursor-pointer"
                title={t.weatherNames[hud.weather]}
              >
                {hud.weather === 'rain' ? (
                  <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span className="hidden sm:inline">{t.weatherNames[hud.weather]}</span>
              </button>
              <button
                onClick={onToggleTouch}
                className={`p-1.5 rounded cursor-pointer ${
                  touchEnabled ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title="Touch Controls"
              >
                <Gamepad2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggleMute}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer"
                title="Audio"
              >
                {hud.muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
              <button
                onClick={onOpenPause}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-100 cursor-pointer"
                title={t.menu}
              >
                <Pause className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">{t.menu}</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom-Right: Desktop Digital Vehicle Speedometer + White-to-Red Car Damage Icon */}
        {!touchEnabled && (
          <div className="min-w-[155px] flex justify-end">
            {hud.inVehicle ? (
              <div
                className={`bg-slate-950/90 border px-3.5 py-2 rounded-lg text-right shadow-lg flex flex-col items-end gap-1 ${
                  hud.vehicleHealth <= 20 ? 'border-rose-500' : 'border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-3">
                  <VehicleDamageIcon hp={hud.vehicleHealth} size="md" />
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    {hud.vehicleName}{' '}
                    <span className="text-sky-400 font-black">({hud.vehicleMaxKmh} KM/H)</span>
                  </div>
                </div>
                <div className="flex items-baseline justify-end gap-2">
                  <span className="text-3xl font-black tabular-nums text-white">{hud.speedKmh}</span>
                  <span className="text-xs font-bold text-amber-400">KM/H</span>
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 text-xs font-black text-sky-400 tabular-nums">
                    {hud.gear}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 text-[10px] font-bold">
                  <span className={hud.turnSignal === -1 ? 'text-amber-400' : 'text-slate-600'}>◀ L</span>
                  <span className={hud.headlightsOn ? 'text-yellow-300' : 'text-slate-600'}>LIGHTS</span>
                  <span className={hud.turnSignal === 1 ? 'text-amber-400' : 'text-slate-600'}>R ▶</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] font-bold tabular-nums text-slate-400 bg-slate-950/75 border border-slate-800/80 px-2.5 py-1 rounded">
                {hud.fps} FPS
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
