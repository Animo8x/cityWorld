import React, { useRef, useState } from 'react';
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
  inVehicle: boolean;
  isAirplane?: boolean;
  canDeployWings?: boolean;
  wingsDeployed?: boolean;
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
  onPressPunch: () => void;
  onFireChange: (firing: boolean) => void;
  onPressCycleWeapon: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  language,
  inVehicle,
  isAirplane = false,
  canDeployWings = false,
  wingsDeployed = false,
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
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);

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
            className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-slate-950/65 border-2 border-slate-500/70 flex items-center justify-center shadow-xl"
            style={{ touchAction: 'none' }}
          >
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border border-slate-600/60" />
            <div
              className="absolute w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-400/90 border-2 border-white shadow-lg pointer-events-none"
              style={{
                transform: `translate(${knob.x}px, ${knob.y}px)`,
              }}
            />
          </div>
        ) : (
          /* Vehicle Left / Right Steering Buttons */
          <div className="flex items-center gap-2 sm:gap-3">
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
              className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-slate-950/80 active:bg-amber-500 active:text-slate-950 border-2 border-slate-500/80 text-white flex items-center justify-center shadow-lg"
              aria-label="Steer Left"
            >
              <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" />
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
              className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-slate-950/80 active:bg-amber-500 active:text-slate-950 border-2 border-slate-500/80 text-white flex items-center justify-center shadow-lg"
              aria-label="Steer Right"
            >
              <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT CONTROL CLUSTER */}
      <div className="pointer-events-auto flex flex-col items-end gap-1.5 sm:gap-2.5 max-w-[66vw]" style={{ touchAction: 'none' }}>
        {/* Secondary Quick Action Row */}
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {inVehicle ? (
            <>
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPressHorn();
                }}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-slate-950/80 active:bg-slate-700 border border-slate-600 text-slate-200 flex items-center justify-center shadow"
                aria-label="Horn"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPressHeadlights();
                }}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-slate-950/80 active:bg-yellow-500 active:text-slate-950 border border-slate-600 text-yellow-300 flex items-center justify-center shadow"
                aria-label="Headlights"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
              {canDeployWings && onPressToggleWings && (
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onPressToggleWings();
                  }}
                  className={`px-2.5 sm:px-3 h-9 sm:h-11 rounded-full font-black text-[10px] sm:text-xs flex items-center gap-1 shadow-lg border ${
                    wingsDeployed
                      ? 'bg-yellow-400 text-slate-950 border-yellow-200'
                      : 'bg-slate-950/85 text-amber-300 border-amber-500/70'
                  }`}
                  aria-label="Toggle Wings"
                >
                  <Plane className="w-3.5 h-3.5" />
                  <span>{wingsDeployed ? t.wingsFlying : t.wingsDeploy}</span>
                </button>
              )}
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPressEnterExitVehicle();
                }}
                className="px-2.5 sm:px-3.5 h-9 sm:h-11 rounded-full bg-amber-500 active:bg-amber-400 text-slate-950 font-extrabold text-[11px] sm:text-xs flex items-center gap-1 shadow-lg"
              >
                <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {t.exitCar}
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
                  className="px-3 sm:px-4 h-10 sm:h-12 rounded-full bg-amber-500 active:bg-amber-400 text-slate-950 font-black text-[11px] sm:text-xs flex items-center gap-1 shadow-lg border border-amber-200"
                >
                  {canEnterVehicle ? <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Hand className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  <span>{canEnterVehicle ? (isStealing ? t.steal : t.drive) : t.interact}</span>
                </button>
              )}
              {!isSwimming && (
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onPressCycleWeapon();
                  }}
                  className="px-2.5 sm:px-3 h-10 sm:h-12 max-w-[140px] rounded-full bg-slate-950/85 active:bg-slate-800 border-2 border-slate-500 text-slate-100 text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shadow"
                  aria-label="Switch Weapon"
                >
                  <Repeat className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{t.weaponNames[weaponId]}</span>
                  {weaponId !== 'fists' && (
                    <span className="text-[9px] sm:text-[10px] text-amber-300 tabular-nums shrink-0">{ammo}</span>
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
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center shadow ${
                    sprintLocked
                      ? 'bg-sky-500 border-white text-slate-950'
                      : 'bg-slate-950/80 border-slate-600 text-slate-200'
                  }`}
                  aria-label="Sprint"
                >
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Primary Action Row */}
        {inVehicle ? (
          <div className="flex items-end gap-1.5 sm:gap-2.5">
            {isAirplane || wingsDeployed ? (
              <div className="flex flex-col gap-1 sm:gap-1.5">
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
                  className="w-12 h-9 sm:w-14 sm:h-11 rounded-xl bg-sky-600/90 active:bg-sky-400 active:text-slate-950 border-2 border-sky-300 text-white font-black text-[9px] sm:text-[10px] flex items-center justify-center shadow-lg"
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
                  className="w-12 h-9 sm:w-14 sm:h-11 rounded-xl bg-slate-950/85 active:bg-amber-500 active:text-slate-950 border-2 border-slate-500 text-amber-300 font-black text-[9px] sm:text-[10px] flex items-center justify-center shadow-lg"
                >
                  ▼ {t.descendDown}
                </button>
              </div>
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
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-950/85 active:bg-amber-500 active:text-slate-950 border-2 border-slate-600 text-amber-400 font-black text-[10px] sm:text-[11px] flex items-center justify-center shadow-lg"
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
              className="w-12 h-14 sm:w-15 sm:h-16 rounded-2xl bg-rose-950/85 active:bg-rose-500 border-2 border-rose-500/80 text-white font-black text-[11px] sm:text-xs flex items-center justify-center shadow-lg"
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
              className="w-14 h-16 sm:w-16 sm:h-20 rounded-2xl bg-emerald-600/90 active:bg-emerald-400 active:text-slate-950 border-2 border-emerald-300 text-white font-black text-[11px] sm:text-xs flex flex-col items-center justify-center shadow-lg"
            >
              <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>{t.gas}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 sm:gap-2.5">
            {!isSwimming && (nearPedestrian || weaponId === 'fists') && (
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPressPunch();
                }}
                className={`w-13 h-13 sm:w-16 sm:h-16 rounded-full active:scale-95 border-2 font-black text-[10px] sm:text-[11px] flex flex-col items-center justify-center shadow-xl ${
                  nearPedestrian
                    ? 'bg-amber-500 border-amber-200 text-slate-950'
                    : 'bg-orange-600/90 border-orange-300 text-white'
                }`}
                aria-label="Punch"
              >
                <Hand className="w-4 h-4 sm:w-5 sm:h-5" />
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
                className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-rose-600/90 active:bg-rose-400 active:text-slate-950 border-2 border-rose-200 text-white font-black text-[10px] sm:text-[11px] flex flex-col items-center justify-center shadow-xl"
                aria-label="Fire Weapon"
              >
                <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
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
              className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-slate-950/85 active:bg-amber-500 active:text-slate-950 border-2 border-slate-500 text-white font-black text-[10px] sm:text-xs flex flex-col items-center justify-center shadow-xl"
            >
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{isSwimming ? t.swim : t.jump}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
