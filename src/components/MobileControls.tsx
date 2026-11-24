import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Car,
  ChevronUp,
  Crosshair,
  Hand,
  Lightbulb,
  Repeat,
  Volume2,
  Zap,
  Plane,
  Bot,
} from 'lucide-react';
import { Language, WeaponId } from '../game/types';
import { getText } from '../i18n/translations';

export interface VirtualInputState {
  moveX: number; // -1..1
  moveZ: number; // -1..1 (forward positive)
  sprint: boolean;
  jump: boolean;
  throttle: number; // -1..1
  steer: number; // -1 (right) .. 1 (left) matching KeyA=+1, KeyD=-1
  handbrake: boolean;
  climb: number;
}

interface MobileControlsProps {
  language: Language;
  buttonScale?: number;
  inVehicle: boolean;
  inVehicleRole?: 'none' | 'driver' | 'passenger';
  isAirplane?: boolean;
  canDeployWings?: boolean;
  wingsDeployed?: boolean;
  canTransformRobot?: boolean;
  isRobotTransformed?: boolean;
  isSwimming: boolean;
  nearPedestrian: boolean;
  hasInteractionPrompt: boolean;
  interactionLabel: string | null;
  weaponId: WeaponId;
  ammo: number;
  onVirtualInput: (state: VirtualInputState) => void;
  onPressEnterExitVehicle: () => void;
  onPressInteract: () => void;
  onPressHorn: () => void;
  onPressHeadlights: () => void;
  onPressToggleWings?: () => void;
  onPressToggleRobot?: () => void;
  onPressPunch: () => void;
  onFireChange: (firing: boolean) => void;
  onPressCycleWeapon: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  language,
  buttonScale = 1,
  inVehicle,
  inVehicleRole = 'none',
  isAirplane = false,
  canDeployWings = false,
  wingsDeployed = false,
  canTransformRobot = false,
  isRobotTransformed = false,
  isSwimming,
  nearPedestrian,
  hasInteractionPrompt,
  interactionLabel,
  weaponId,
  ammo,
  onVirtualInput,
  onPressEnterExitVehicle,
  onPressInteract,
  onPressHorn,
  onPressHeadlights,
  onPressToggleWings,
  onPressToggleRobot,
  onPressPunch,
  onFireChange,
  onPressCycleWeapon,
}) => {
  const t = getText(language);
  const inputRef = useRef<VirtualInputState>({
    moveX: 0,
    moveZ: 0,
    sprint: false,
    jump: false,
    throttle: 0,
    steer: 0,
    handbrake: false,
    climb: 0,
  });

  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [sprintLocked, setSprintLocked] = useState(false);
  const [isSm, setIsSm] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false
  );
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 640px)');
    const onChange = () => setIsSm(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const scale = Math.max(0.7, Math.min(1.4, buttonScale));
  const sz = (mobilePx: number, smPx?: number) =>
    Math.round((isSm && smPx !== undefined ? smPx : mobilePx) * scale);
  const fs = (mobilePx: number, smPx?: number) =>
    Math.max(8, Math.round((isSm && smPx !== undefined ? smPx : mobilePx) * scale));

  const emit = (patch: Partial<VirtualInputState>) => {
    inputRef.current = { ...inputRef.current, ...patch };
    onVirtualInput(inputRef.current);
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.4;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });

    const nx = dx / maxR;
    const ny = -dy / maxR; // up is positive forward
    const dead = 0.14;
    const moveX = Math.abs(nx) < dead ? 0 : nx;
    const moveZ = Math.abs(ny) < dead ? 0 : ny;
    const autoSprint = dist > maxR * 0.88;
    emit({ moveX, moveZ, sprint: sprintLocked || autoSprint });
  };

  const resetJoystick = () => {
    joyPointerId.current = null;
    setKnob({ x: 0, y: 0 });
    emit({ moveX: 0, moveZ: 0, sprint: sprintLocked });
  };

  const canEnterVehicle =
    !inVehicle && interactionLabel !== null && interactionLabel.includes('[F]');
  const isStealing =
    interactionLabel !== null &&
    (interactionLabel.includes('Steal') ||
      interactionLabel.includes('Hijack') ||
      interactionLabel.includes('سرقة'));

  const joyOuter = sz(96, 128);
  const joyInner = sz(36, 48);
  const joyKnob = sz(40, 48);
  const steerSize = sz(52, 64);
  const steerIcon = sz(24, 28);
  const secBtnSize = sz(36, 44);
  const secBtnHeight = sz(36, 44);
  const secIcon = sz(15, 17);
  const footSecSize = sz(40, 48);
  const priRoundSize = sz(52, 64);
  const priSquareSize = sz(48, 56);
  const priIcon = sz(16, 20);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 pointer-events-none flex items-end justify-between gap-2 px-2.5 pb-2.5 sm:px-4 sm:pb-5 pt-1 select-none"
      style={{ touchAction: 'none' }}
    >
      {/* LEFT CONTROL CLUSTER */}
      <div className="pointer-events-auto shrink-0" style={{ touchAction: 'none' }}>
        {!inVehicle ? (
          /* On-foot / Swim Virtual Analog Joystick */
          <div
            ref={joyBaseRef}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              joyPointerId.current = e.pointerId;
              updateJoystick(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (joyPointerId.current !== e.pointerId) return;
              e.stopPropagation();
              updateJoystick(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (joyPointerId.current !== e.pointerId) return;
              e.stopPropagation();
              resetJoystick();
            }}
            onPointerCancel={resetJoystick}
            className="relative rounded-full bg-slate-950/65 border-2 border-slate-500/70 flex items-center justify-center shadow-xl"
            style={{ width: joyOuter, height: joyOuter, touchAction: 'none' }}
          >
            <div
              className="rounded-full border border-slate-600/60"
              style={{ width: joyInner, height: joyInner }}
            />
            <div
              className="absolute rounded-full bg-amber-400/90 border-2 border-white shadow-lg pointer-events-none"
              style={{
                width: joyKnob,
                height: joyKnob,
                transform: `translate(${knob.x}px, ${knob.y}px)`,
              }}
            />
          </div>
        ) : inVehicleRole === 'passenger' ? (
          <div />
        ) : (
          /* Vehicle Left / Right Steering Buttons */
          <div className="flex items-center" style={{ gap: sz(8, 12) }}>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                emit({ steer: 1 });
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                emit({ steer: 0 });
              }}
              onPointerCancel={() => emit({ steer: 0 })}
              style={{ width: steerSize, height: steerSize }}
              className="rounded-2xl bg-slate-950/80 active:bg-amber-500 active:text-slate-950 border-2 border-slate-500/80 text-white flex items-center justify-center shadow-lg"
              aria-label="Steer Left"
            >
              <ArrowLeft style={{ width: steerIcon, height: steerIcon }} />
            </button>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                emit({ steer: -1 });
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                emit({ steer: 0 });
              }}
              onPointerCancel={() => emit({ steer: 0 })}
              style={{ width: steerSize, height: steerSize }}
              className="rounded-2xl bg-slate-950/80 active:bg-amber-500 active:text-slate-950 border-2 border-slate-500/80 text-white flex items-center justify-center shadow-lg"
              aria-label="Steer Right"
            >
              <ArrowRight style={{ width: steerIcon, height: steerIcon }} />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT CONTROL CLUSTER */}
      <div
        className="pointer-events-auto flex flex-col items-end max-w-[66vw]"
        style={{ gap: sz(6, 10), touchAction: 'none' }}
      >
        {/* Secondary Quick Action Row */}
        <div className="flex flex-wrap items-center justify-end" style={{ gap: sz(6, 8) }}>
          {inVehicle ? (
            <>
              {inVehicleRole !== 'passenger' && (
                <>
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onPressHorn();
                    }}
                    style={{ width: secBtnSize, height: secBtnSize }}
                    className="rounded-full bg-slate-950/80 active:bg-slate-700 border border-slate-600 text-slate-200 flex items-center justify-center shadow"
                    aria-label="Horn"
                  >
                    <Volume2 style={{ width: secIcon, height: secIcon }} />
                  </button>
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onPressHeadlights();
                    }}
                    style={{ width: secBtnSize, height: secBtnSize }}
                    className="rounded-full bg-slate-950/80 active:bg-yellow-500 active:text-slate-950 border border-slate-600 text-yellow-300 flex items-center justify-center shadow"
                    aria-label="Headlights"
                  >
                    <Lightbulb style={{ width: secIcon, height: secIcon }} />
                  </button>
                  {canDeployWings && onPressToggleWings && (
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onPressToggleWings();
                      }}
                      style={{
                        height: secBtnHeight,
                        paddingInline: sz(10, 12),
                        fontSize: fs(10, 12),
                      }}
                      className={`rounded-full font-black flex items-center gap-1 shadow-lg border ${
                        wingsDeployed
                          ? 'bg-yellow-400 text-slate-950 border-yellow-200'
                          : 'bg-slate-950/85 text-amber-300 border-amber-500/70'
                      }`}
                      aria-label="Toggle Wings"
                    >
                      <Plane style={{ width: secIcon, height: secIcon }} />
                      <span>{wingsDeployed ? t.wingsFlying : t.wingsDeploy}</span>
                    </button>
                  )}
                  {canTransformRobot && onPressToggleRobot && (
                    <button
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onPressToggleRobot();
                      }}
                      style={{
                        height: secBtnHeight,
                        paddingInline: sz(10, 12),
                        fontSize: fs(10, 12),
                      }}
                      className={`rounded-full font-black flex items-center gap-1 shadow-lg border ${
                        isRobotTransformed
                          ? 'bg-cyan-400 text-slate-950 border-cyan-100'
                          : 'bg-slate-950/85 text-cyan-300 border-cyan-500/70'
                      }`}
                      aria-label="Toggle Robot"
                    >
                      <Bot style={{ width: secIcon, height: secIcon }} />
                      <span>{isRobotTransformed ? t.transformToCar : t.transformToRobot}</span>
                    </button>
                  )}
                </>
              )}
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPressEnterExitVehicle();
                }}
                style={{
                  height: secBtnHeight,
                  paddingInline: sz(10, 14),
                  fontSize: fs(11, 12),
                }}
                className="rounded-full bg-amber-500 active:bg-amber-400 text-slate-950 font-extrabold flex items-center gap-1 shadow-lg"
              >
                <Car style={{ width: secIcon, height: secIcon }} /> {t.exitCar}
              </button>
            </>
          ) : (
            <>
              {(canEnterVehicle || hasInteractionPrompt) && (
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (canEnterVehicle) onPressEnterExitVehicle();
                    else onPressInteract();
                  }}
                  style={{
                    height: footSecSize,
                    paddingInline: sz(12, 16),
                    fontSize: fs(11, 12),
                  }}
                  className="rounded-full bg-amber-500 active:bg-amber-400 text-slate-950 font-black flex items-center gap-1 shadow-lg border border-amber-200"
                >
                  {canEnterVehicle ? (
                    <Car style={{ width: secIcon, height: secIcon }} />
                  ) : (
                    <Hand style={{ width: secIcon, height: secIcon }} />
                  )}
                  <span>{canEnterVehicle ? (isStealing ? t.steal : t.drive) : t.interact}</span>
                </button>
              )}
              {!isSwimming && (
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onPressCycleWeapon();
                  }}
                  style={{
                    height: footSecSize,
                    paddingInline: sz(10, 12),
                    maxWidth: sz(140, 175),
                    fontSize: fs(10, 11),
                  }}
                  className="rounded-full bg-slate-950/85 active:bg-slate-800 border-2 border-slate-500 text-slate-100 font-bold flex items-center gap-1 shadow"
                  aria-label="Switch Weapon"
                >
                  <Repeat
                    className="text-amber-400 shrink-0"
                    style={{ width: sz(12, 14), height: sz(12, 14) }}
                  />
                  <span className="truncate">{t.weaponNames[weaponId]}</span>
                  {weaponId !== 'fists' && (
                    <span className="text-amber-300 tabular-nums shrink-0" style={{ fontSize: fs(9, 10) }}>
                      {ammo}
                    </span>
                  )}
                </button>
              )}
              {!isSwimming && (
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const next = !sprintLocked;
                    setSprintLocked(next);
                    emit({ sprint: next });
                  }}
                  style={{ width: footSecSize, height: footSecSize }}
                  className={`rounded-full border-2 flex items-center justify-center shadow ${
                    sprintLocked
                      ? 'bg-sky-500 border-white text-slate-950'
                      : 'bg-slate-950/80 border-slate-600 text-slate-200'
                  }`}
                  aria-label="Sprint"
                >
                  <Zap style={{ width: sz(16, 20), height: sz(16, 20) }} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Primary Action Row */}
        {inVehicle && inVehicleRole === 'passenger' ? null : inVehicle ? (
          <div className="flex items-end" style={{ gap: sz(6, 10) }}>
            {isAirplane || wingsDeployed ? (
              <div className="flex flex-col" style={{ gap: sz(4, 6) }}>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    emit({ climb: 1 });
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    emit({ climb: 0 });
                  }}
                  onPointerCancel={() => emit({ climb: 0 })}
                  style={{ width: sz(48, 56), height: sz(36, 44), fontSize: fs(9, 10) }}
                  className="rounded-xl bg-sky-600/90 active:bg-sky-400 active:text-slate-950 border-2 border-sky-300 text-white font-black flex items-center justify-center shadow-lg"
                >
                  ▲ {t.climbUp}
                </button>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    emit({ climb: -1 });
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    emit({ climb: 0 });
                  }}
                  onPointerCancel={() => emit({ climb: 0 })}
                  style={{ width: sz(48, 56), height: sz(36, 44), fontSize: fs(9, 10) }}
                  className="rounded-xl bg-slate-950/85 active:bg-amber-500 active:text-slate-950 border-2 border-slate-500 text-amber-300 font-black flex items-center justify-center shadow-lg"
                >
                  ▼ {t.descendDown}
                </button>
              </div>
            ) : isRobotTransformed ? (
              <>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    onFireChange(true);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    onFireChange(false);
                  }}
                  onPointerCancel={() => onFireChange(false)}
                  style={{ width: priRoundSize, height: priRoundSize, fontSize: fs(9, 10) }}
                  className="rounded-full bg-rose-600/95 active:bg-rose-400 active:text-slate-950 border-2 border-rose-200 text-white font-black flex flex-col items-center justify-center shadow-xl"
                  aria-label="Fire Infinite RPG"
                >
                  <Crosshair style={{ width: priIcon, height: priIcon }} />
                  <span>RPG ∞</span>
                </button>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    emit({ handbrake: true });
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    emit({ handbrake: false });
                  }}
                  onPointerCancel={() => emit({ handbrake: false })}
                  style={{ width: priSquareSize, height: priSquareSize, fontSize: fs(10, 11) }}
                  className="rounded-2xl bg-slate-950/85 active:bg-cyan-400 active:text-slate-950 border-2 border-cyan-500/70 text-cyan-300 font-black flex items-center justify-center shadow-lg"
                >
                  {t.jump}
                </button>
              </>
            ) : (
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  emit({ handbrake: true });
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  emit({ handbrake: false });
                }}
                onPointerCancel={() => emit({ handbrake: false })}
                style={{ width: priSquareSize, height: priSquareSize, fontSize: fs(10, 11) }}
                className="rounded-2xl bg-slate-950/85 active:bg-amber-500 active:text-slate-950 border-2 border-slate-600 text-amber-400 font-black flex items-center justify-center shadow-lg"
              >
                {t.drift}
              </button>
            )}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                emit({ throttle: -1 });
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                emit({ throttle: 0 });
              }}
              onPointerCancel={() => emit({ throttle: 0 })}
              style={{ width: sz(48, 60), height: sz(56, 64), fontSize: fs(11, 12) }}
              className="rounded-2xl bg-rose-950/85 active:bg-rose-500 border-2 border-rose-500/80 text-white font-black flex items-center justify-center shadow-lg"
            >
              {t.brake}
            </button>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                emit({ throttle: 1 });
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                emit({ throttle: 0 });
              }}
              onPointerCancel={() => emit({ throttle: 0 })}
              style={{ width: sz(56, 64), height: sz(64, 80), fontSize: fs(11, 12) }}
              className="rounded-2xl bg-emerald-600/90 active:bg-emerald-400 active:text-slate-950 border-2 border-emerald-300 text-white font-black flex flex-col items-center justify-center shadow-lg"
            >
              <ChevronUp style={{ width: sz(20, 24), height: sz(20, 24) }} />
              <span>{t.gas}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-end" style={{ gap: sz(6, 10) }}>
            {!isSwimming && (nearPedestrian || weaponId === 'fists') && (
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPressPunch();
                }}
                style={{ width: priRoundSize, height: priRoundSize, fontSize: fs(10, 11) }}
                className={`rounded-full active:scale-95 border-2 font-black flex flex-col items-center justify-center shadow-xl ${
                  nearPedestrian
                    ? 'bg-amber-500 border-amber-200 text-slate-950'
                    : 'bg-orange-600/90 border-orange-300 text-white'
                }`}
                aria-label="Punch"
              >
                <Hand style={{ width: priIcon, height: priIcon }} />
                <span>{t.punch}</span>
              </button>
            )}
            {!isSwimming && weaponId !== 'fists' && (
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onFireChange(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onFireChange(false);
                }}
                onPointerCancel={() => onFireChange(false)}
                style={{ width: priRoundSize, height: priRoundSize, fontSize: fs(10, 11) }}
                className="rounded-full bg-rose-600/90 active:bg-rose-400 active:text-slate-950 border-2 border-rose-200 text-white font-black flex flex-col items-center justify-center shadow-xl"
                aria-label="Fire Weapon"
              >
                <Crosshair style={{ width: priIcon, height: priIcon }} />
                <span>{t.fire}</span>
              </button>
            )}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                emit({ jump: true });
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                emit({ jump: false });
              }}
              onPointerCancel={() => emit({ jump: false })}
              style={{ width: priRoundSize, height: priRoundSize, fontSize: fs(10, 12) }}
              className="rounded-full bg-slate-950/85 active:bg-amber-500 active:text-slate-950 border-2 border-slate-500 text-white font-black flex flex-col items-center justify-center shadow-xl"
            >
              <ChevronUp style={{ width: priIcon, height: priIcon }} />
              <span>{isSwimming ? t.swim : t.jump}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
