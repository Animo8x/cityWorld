import { useEffect, useRef, useState } from 'react';
import { CityWorldEngine } from './game/CityWorldEngine';
import { HudSnapshot } from './game/types';
import { GameHUD } from './components/GameHUD';
import { MobileControls } from './components/MobileControls';
import { BackpackModal, InteriorShopModal, PauseModal, PhoneModal, WastedModal } from './components/Modals';
import { TitleScreen } from './components/TitleScreen';
import { WorldMapModal } from './components/WorldMapModal';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CityWorldEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  // Auto-enable touch controls on phones/tablets, toggleable anytime in HUD
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  });

  useEffect(() => {
    const el = canvasMountRef.current;
    if (!el) return;

    const engine = new CityWorldEngine(el, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Isolated WebGL canvas container — React HUD updates never tear down this node */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {hud?.phase === 'title' && (
        <TitleScreen
          language={hud.language}
          onSetLanguage={(lang) => engineRef.current?.setLanguage(lang)}
          onStart={() => engineRef.current?.startGame()}
        />
      )}

      {hud && hud.phase !== 'title' && (
        <GameHUD
          hud={hud}
          touchEnabled={touchEnabled}
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
        />
      )}

      {hud?.phase === 'playing' && touchEnabled && (
        <MobileControls
          language={hud.language}
          inVehicle={hud.inVehicle}
          isAirplane={hud.isAirplane}
          canDeployWings={hud.canDeployWings}
          wingsDeployed={hud.wingsDeployed}
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
          onRespawn={() => engineRef.current?.respawnAfterWasted()}
        />
      )}
    </div>
  );
}
