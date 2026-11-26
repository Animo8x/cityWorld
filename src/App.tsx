import { useEffect, useRef, useState } from 'react';
import { CityWorldEngine } from './game/CityWorldEngine';
import { MISSION_REGISTRY } from './game/missions/missionSystem';
import { HudSnapshot } from './game/types';
import { GameHUD } from './components/GameHUD';
import { MobileControls } from './components/MobileControls';
import {
  BackpackModal,
  InteriorShopModal,
  MultiplayerModal,
  PauseModal,
  PhoneModal,
  WastedModal,
} from './components/Modals';
import { StoryDialogueBox, StoryVictoryModal } from './components/StoryOverlay';
import { TitleScreen } from './components/TitleScreen';
import { WorldMapModal } from './components/WorldMapModal';

const BUTTON_SCALE_STORAGE_KEY = 'cityworld_button_scale_v1';
const MIN_BUTTON_SCALE = 0.7;
const MAX_BUTTON_SCALE = 1.4;

function clampButtonScale(value: number): number {
  const clamped = Math.max(MIN_BUTTON_SCALE, Math.min(MAX_BUTTON_SCALE, value));
  return Math.round(clamped * 20) / 20;
}

function loadSavedButtonScale(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = window.localStorage.getItem(BUTTON_SCALE_STORAGE_KEY);
    if (!raw) return 1;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampButtonScale(parsed) : 1;
  } catch {
    return 1;
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CityWorldEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Auto-enable touch controls on phones/tablets, toggleable anytime in HUD
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });

  const [buttonScale, setButtonScaleState] = useState<number>(loadSavedButtonScale);

  const setButtonScale = (next: number) => {
    const clamped = clampButtonScale(next);
    setButtonScaleState(clamped);
    try {
      window.localStorage.setItem(BUTTON_SCALE_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore storage errors in restricted viewers
    }
  };

  const adjustButtonScale = (delta: number) => {
    setButtonScaleState((prev) => {
      const next = clampButtonScale(prev + delta);
      try {
        window.localStorage.setItem(BUTTON_SCALE_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleDownloadStandaloneHtml = async () => {
    if (typeof window === 'undefined') return;
    if (window.location.protocol === 'file:') {
      try {
        const blob = new Blob(['<!doctype html>\n' + document.documentElement.outerHTML], {
          type: 'text/html;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CityWorld-v9.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        // Ignore
      }
      return;
    }

    const downloadUrl = `/api/download-html?v=${Date.now()}`;
    try {
      const res = await fetch(downloadUrl, { cache: 'no-store' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CityWorld-v9.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        return;
      }
    } catch {
      // Fallback to direct link download below
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'CityWorld-v9.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  useEffect(() => {
    const el = canvasMountRef.current;
    if (!el) return;

    let engine: CityWorldEngine | null = null;
    try {
      engine = new CityWorldEngine(el, (snapshot) => {
        setHud(snapshot);
      });
      engineRef.current = engine;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setInitError(msg || 'WebGL initialization failed');
    }

    return () => {
      if (engine) {
        engine.dispose();
      }
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Isolated WebGL canvas container — React HUD updates never tear down this node */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {initError && !hud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-6 text-center" dir="rtl">
          <div className="max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-black text-amber-400 mb-2">تعذّر تشغيل الرسوميات ثلاثية الأبعاد (WebGL)</h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              يبدو أن هذا المتصفح أو العارض لا يدعم تسريع WebGL المطلوب للعبة. افتح اللعبة عبر متصفح Chrome أو Safari الحديث.
            </p>
            <div className="rounded-lg bg-slate-950/90 border border-slate-700 p-2 text-[11px] font-mono text-rose-300 text-left break-words" dir="ltr">
              {initError}
            </div>
          </div>
        </div>
      )}

      {hud?.phase === 'title' && (
        <TitleScreen
          language={hud.language}
          hasSavedGame={hud.hasSavedGame}
          savedMoney={hud.money}
          savedMissions={hud.completedMissionIds.length}
          totalMissions={MISSION_REGISTRY.length}
          storyCompleted={hud.story.completed}
          onSetLanguage={(lang) => engineRef.current?.setLanguage(lang)}
          onStart={() => engineRef.current?.startGame()}
          onStartStory={() => engineRef.current?.startStoryMode()}
          onNewGame={() => engineRef.current?.startNewSinglePlayerGame()}
          onOpenMultiplayer={() => engineRef.current?.openMultiplayerLobby()}
          onDownloadHtml={handleDownloadStandaloneHtml}
        />
      )}

      {hud && hud.phase !== 'title' && (
        <GameHUD
          hud={hud}
          touchEnabled={touchEnabled}
          buttonScale={buttonScale}
          onAdjustButtonScale={adjustButtonScale}
          onToggleTouch={() => setTouchEnabled((v) => !v)}
          onOpenMap={() => engineRef.current?.toggleMap()}
          onOpenPause={() => engineRef.current?.togglePause()}
          onOpenPhone={() => engineRef.current?.togglePhone()}
          onOpenBackpack={() => engineRef.current?.toggleBackpack()}
          onCycleWeather={() => engineRef.current?.cycleWeather()}
          onAdvanceTime={() => engineRef.current?.advanceTimePreset()}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onCycleWeapon={() => engineRef.current?.cycleWeapon()}
          onToggleCamera={() => engineRef.current?.toggleFirstPerson()}
          onToggleWings={() => engineRef.current?.toggleVehicleWings()}
          onToggleRobot={() => engineRef.current?.toggleRobotTransform()}
        />
      )}

      {hud?.phase === 'playing' &&
        touchEnabled &&
        !hud.story.dialogue &&
        !hud.story.justFinishedModal && (
        <MobileControls
          language={hud.language}
          buttonScale={buttonScale}
          inVehicle={hud.inVehicle}
          inVehicleRole={hud.multiplayer.inVehicleRole}
          isAirplane={hud.isAirplane}
          canDeployWings={hud.canDeployWings}
          wingsDeployed={hud.wingsDeployed}
          canTransformRobot={hud.canTransformRobot}
          isRobotTransformed={hud.isRobotTransformed}
          isSwimming={hud.isSwimming}
          nearPedestrian={hud.nearPedestrian}
          hasInteractionPrompt={Boolean(hud.interactionPrompt)}
          interactionLabel={hud.interactionPrompt}
          weaponId={hud.weaponId}
          ammo={hud.ammo}
          onVirtualInput={(state) => engineRef.current?.setVirtualInput(state)}
          onPressEnterExitVehicle={() => engineRef.current?.triggerEnterExitVehicle()}
          onPressInteract={() => engineRef.current?.triggerInteract()}
          onPressHorn={() => engineRef.current?.triggerHorn()}
          onPressHeadlights={() => engineRef.current?.triggerHeadlights()}
          onPressToggleWings={() => engineRef.current?.toggleVehicleWings()}
          onPressToggleRobot={() => engineRef.current?.toggleRobotTransform()}
          onPressPunch={() => engineRef.current?.triggerPunch()}
          onFireChange={(firing) => engineRef.current?.setFiring(firing)}
          onPressCycleWeapon={() => engineRef.current?.cycleWeapon()}
        />
      )}

      {hud?.phase === 'map' && (
        <WorldMapModal
          hud={hud}
          onClose={() => engineRef.current?.setPhase('playing')}
          onSetWaypoint={(pt) => engineRef.current?.setCustomWaypoint(pt)}
        />
      )}

      {hud?.phase === 'paused' && (
        <PauseModal
          hud={hud}
          buttonScale={buttonScale}
          onSetButtonScale={setButtonScale}
          onDownloadHtml={handleDownloadStandaloneHtml}
          onResume={() => engineRef.current?.setPhase('playing')}
          onStartMission={(id) => engineRef.current?.startMissionById(id)}
          onAbortMission={() => engineRef.current?.abortActiveMission()}
          onCycleWeather={() => engineRef.current?.cycleWeather()}
          onAdvanceTime={() => engineRef.current?.advanceTimePreset()}
          onSetQualityMode={(mode) => engineRef.current?.setQualityMode(mode)}
          onSetLanguage={(lang) => engineRef.current?.setLanguage(lang)}
          onRedeemCode={(code) =>
            engineRef.current?.redeemSecretCode(code) ?? { ok: false, message: 'Game loading...' }
          }
          onChangePlayerName={(name) => engineRef.current?.changeMultiplayerName(name)}
          onSetMpSettings={(patch) => engineRef.current?.setMultiplayerSettings(patch)}
          onOpenMultiplayerLobby={() => engineRef.current?.openMultiplayerLobby()}
          onLeaveMultiplayerSession={() => engineRef.current?.leaveMultiplayerSession()}
          onSaveGame={() => engineRef.current?.saveSinglePlayerProgress(true) ?? false}
          onResetSave={() => engineRef.current?.resetSinglePlayerProgress()}
          onExitStory={() => engineRef.current?.exitStoryToMenu()}
        />
      )}

      {hud?.phase === 'multiplayer_lobby' && (
        <MultiplayerModal
          hud={hud}
          sessions={engineRef.current?.multiplayer.getSessionList() ?? []}
          onRefreshSessions={() => {
            void engineRef.current?.refreshMultiplayerSessions();
          }}
          onSetServerUrl={(url) =>
            engineRef.current?.setMultiplayerServerUrl(url) ?? Promise.resolve(false)
          }
          onStartP2PHost={(name, maxP) =>
            engineRef.current?.startP2PHost(name, maxP) ?? Promise.resolve({ ok: false, inviteCode: '' })
          }
          onCreateP2PExtraInvite={() =>
            engineRef.current?.createP2PExtraInvite() ?? Promise.resolve('')
          }
          onAcceptP2PReply={(replyCode) =>
            engineRef.current?.acceptP2PReply(replyCode) ?? Promise.resolve({ ok: false })
          }
          onJoinP2PWithInvite={(inviteCode) =>
            engineRef.current?.joinP2PWithInvite(inviteCode) ??
            Promise.resolve({ ok: false, replyCode: '' })
          }
          onCreateSession={(name, maxP) => {
            void engineRef.current?.createMultiplayerSession(name, maxP);
          }}
          onJoinSession={(opts) => {
            void engineRef.current?.joinMultiplayerSession(opts);
          }}
          onLeaveSession={() => engineRef.current?.leaveMultiplayerSession()}
          onChangeName={(name) => engineRef.current?.changeMultiplayerName(name)}
          onCloseToGame={() => engineRef.current?.setPhase('playing')}
        />
      )}

      {hud?.phase === 'interior_shop' && (
        <InteriorShopModal
          hud={hud}
          onAction={(actId) => engineRef.current?.executeInteriorAction(actId)}
          onClose={() => engineRef.current?.setPhase('playing')}
        />
      )}

      {hud?.phase === 'phone' && (
        <PhoneModal
          hud={hud}
          onSummonVehicle={(classId) => engineRef.current?.summonOwnedVehicle(classId)}
          onTeleportToHouse={(houseId) => engineRef.current?.teleportToHouse(houseId)}
          onSetGpsTarget={(pt) => engineRef.current?.setCustomWaypoint(pt)}
          onClose={() => engineRef.current?.setPhase('playing')}
        />
      )}

      {hud?.phase === 'backpack' && (
        <BackpackModal
          hud={hud}
          onEquipSkin={(skinId) => engineRef.current?.equipSkin(skinId)}
          onClose={() => engineRef.current?.setPhase('playing')}
        />
      )}

      {hud?.phase === 'wasted' && (
        <WastedModal
          language={hud.language}
          isStoryActive={hud.story.active}
          failedMissionName={hud.wastedFailedMission}
          onRespawn={() => engineRef.current?.respawnAfterWasted()}
          onExitStory={() => engineRef.current?.exitStoryToMenu()}
        />
      )}

      {hud && (
        <>
          <StoryDialogueBox
            hud={hud}
            onAdvanceDialogue={() => engineRef.current?.advanceStoryDialogue()}
          />
          <StoryVictoryModal
            hud={hud}
            onGoFreeRoam={() => engineRef.current?.finishStoryToFreeRoam()}
            onBackToMenu={() => engineRef.current?.finishStoryToMenu()}
          />
        </>
      )}
    </div>
  );
}
