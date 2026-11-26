import React, { useState } from 'react';
import { MISSION_REGISTRY } from '../game/missions/missionSystem';
import { PLAYER_SKINS, PLAYER_SKIN_LIST } from '../game/player/skinCatalog';
import { VEHICLE_CATALOG } from '../game/vehicles/vehicleCatalog';
import { INTERIOR_PORTALS } from '../game/world/worldLayout';
import {
  HudSnapshot,
  Language,
  MultiplayerSessionSummary,
  NetworkQualityMode,
  PlayerSkinId,
  QualityMode,
  ServerRegionId,
  VehicleClassId,
  WeaponId,
} from '../game/types';
import {
  CheckCircle2,
  Play,
  RotateCcw,
  Code2,
  Compass,
  Settings,
  Globe,
  Backpack,
  Car,
  Sparkles,
  Lock,
  X,
  Wifi,
  Signal,
  MapPin,
  Wallet,
  Navigation,
  Home,
  Users,
  Plus,
  RefreshCw,
  LogOut,
  Volume2,
  VolumeX,
  Save,
  Download,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getText } from '../i18n/translations';

interface PauseModalProps {
  hud: HudSnapshot;
  buttonScale: number;
  onSetButtonScale: (scale: number) => void;
  onDownloadHtml: () => void;
  onResume: () => void;
  onStartMission: (id: string) => void;
  onAbortMission: () => void;
  onCycleWeather: () => void;
  onAdvanceTime: () => void;
  onSetQualityMode: (mode: QualityMode) => void;
  onSetLanguage: (lang: Language) => void;
  onRedeemCode: (code: string) => { ok: boolean; message: string };
  onChangePlayerName: (name: string) => void;
  onSetMpSettings: (patch: {
    networkQuality?: NetworkQualityMode;
    region?: ServerRegionId;
    mpAudioEnabled?: boolean;
  }) => void;
  onOpenMultiplayerLobby: () => void;
  onLeaveMultiplayerSession: () => void;
  onSaveGame: () => boolean;
  onResetSave: () => void;
  onExitStory?: () => void;
}

const QUALITY_MODES: QualityMode[] = ['very_low', 'low', 'medium', 'high', 'ultra'];

export const PauseModal: React.FC<PauseModalProps> = ({
  hud,
  buttonScale,
  onSetButtonScale,
  onDownloadHtml,
  onResume,
  onStartMission,
  onAbortMission,
  onCycleWeather,
  onAdvanceTime,
  onSetQualityMode,
  onSetLanguage,
  onRedeemCode,
  onChangePlayerName,
  onSetMpSettings,
  onOpenMultiplayerLobby,
  onLeaveMultiplayerSession,
  onSaveGame,
  onResetSave,
  onExitStory,
}) => {
  const [tab, setTab] = useState<'environment' | 'multiplayer' | 'missions' | 'unity'>('environment');
  const [codeInput, setCodeInput] = useState('');
  const [codeFeedback, setCodeFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [nameInput, setNameInput] = useState(hud.multiplayer.customName || hud.multiplayer.playerName);
  const [nameSavedNotice, setNameSavedNotice] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  const [confirmResetSave, setConfirmResetSave] = useState(false);
  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-30 bg-slate-950/90 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div>
            <h2 className="text-lg md:text-xl font-black tracking-wide text-white">{t.pauseTitle}</h2>
            <p className="text-xs text-slate-400">
              {isRtl ? hud.district.nameAr : hud.district.name} · {t.balance} ${hud.money.toLocaleString()} · {hud.completedMissionIds.length}/{MISSION_REGISTRY.length} {t.missionsDone}
            </p>
          </div>
          <button
            onClick={onResume}
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm cursor-pointer shrink-0"
          >
            {t.resume}
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-900/80 overflow-x-auto">
          <button
            onClick={() => setTab('environment')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 cursor-pointer shrink-0 ${
              tab === 'environment' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> {t.settingsTab}
          </button>
          {!hud.story.active && (
            <>
              <button
                onClick={() => setTab('multiplayer')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 cursor-pointer shrink-0 ${
                  tab === 'multiplayer' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> {t.mpTab}
                {hud.multiplayer.active && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                    {hud.multiplayer.playerCount}/{hud.multiplayer.maxPlayers}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('missions')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 cursor-pointer shrink-0 ${
                  tab === 'missions' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" /> {t.missionsTab} ({MISSION_REGISTRY.length})
              </button>
            </>
          )}
          <button
            onClick={() => setTab('unity')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 cursor-pointer shrink-0 ${
              tab === 'unity' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> {t.unityTab}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'multiplayer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-950/75 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white">{t.mpLobbyTitle}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {hud.multiplayer.active
                        ? `${hud.multiplayer.sessionName || ''} (#${hud.multiplayer.sessionCode || ''})`
                        : t.singlePlayerOffline}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-black ${
                      hud.multiplayer.active
                        ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {hud.multiplayer.active ? `${t.mpOnlineLabel} · ${hud.multiplayer.pingMs}ms` : 'OFFLINE'}
                  </span>
                </div>

                {/* Change Player Name */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-white block">{t.mpPlayerNameLabel}</label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onChangePlayerName(nameInput);
                      setNameSavedNotice(true);
                      setTimeout(() => setNameSavedNotice(false), 2500);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      maxLength={18}
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder={t.mpNamePlaceholder}
                      className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer shrink-0"
                    >
                      {t.mpChangeName}
                    </button>
                  </form>
                  {nameSavedNotice && (
                    <div className="text-[11px] font-bold text-emerald-400">{t.mpNameSaved}</div>
                  )}
                </div>

                {/* Session Actions */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                  {hud.multiplayer.active ? (
                    <>
                      <button
                        onClick={onOpenMultiplayerLobby}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-400" /> {t.multiplayerBtn}
                      </button>
                      <button
                        onClick={onLeaveMultiplayerSession}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> {t.mpLeaveSession}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={onOpenMultiplayerLobby}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      <Users className="w-4 h-4" /> {t.multiplayerBtn}
                    </button>
                  )}
                </div>
              </div>

              {/* Network Quality, Audio & Server Region */}
              <div className="p-4 rounded-lg bg-slate-950/75 border border-slate-800 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-white mb-2">{t.mpNetworkQualityLabel}</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as NetworkQualityMode[]).map((nq) => (
                      <button
                        key={nq}
                        onClick={() => onSetMpSettings({ networkQuality: nq })}
                        className={`px-2 py-2 rounded text-[11px] font-bold cursor-pointer ${
                          hud.multiplayer.networkQuality === nq
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {nq === 'low' ? t.mpQualityLow : nq === 'high' ? t.mpQualityHigh : t.mpQualityMed}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-white mb-2">{t.mpRegionLabel}</h4>
                  <select
                    value={hud.multiplayer.region}
                    onChange={(e) => onSetMpSettings({ region: e.target.value as ServerRegionId })}
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="auto">Auto (Lowest Ping)</option>
                    <option value="me_eu">Middle East & Europe</option>
                    <option value="us_east">North America</option>
                    <option value="asia">Asia-Pacific</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{t.mpAudioLabel}</span>
                  <button
                    onClick={() => onSetMpSettings({ mpAudioEnabled: !hud.multiplayer.mpAudioEnabled })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black cursor-pointer ${
                      hud.multiplayer.mpAudioEnabled
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {hud.multiplayer.mpAudioEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" /> ON
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" /> OFF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          {tab === 'missions' && (
            <div className="flex flex-col gap-3">
              {hud.activeMission && (
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-sky-950/60 border border-sky-600/60">
                  <div>
                    <div className="text-xs font-bold uppercase text-sky-400">{t.activeMission}</div>
                    <div className="text-sm font-bold text-white">{hud.activeMission.title}</div>
                    <div className="text-xs text-slate-300">{hud.activeMission.stepDescription}</div>
                  </div>
                  <button
                    onClick={onAbortMission}
                    className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
                  >
                    {t.abort}
                  </button>
                </div>
              )}

              {MISSION_REGISTRY.map((m) => {
                const completed = hud.completedMissionIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-950/70 border border-slate-800"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-white">
                          {isRtl ? m.titleAr : m.title}
                        </span>
                        <span className="text-xs font-bold text-emerald-400">+${m.rewardMoney}</span>
                        {completed && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {isRtl ? m.giverAr : m.giver}
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        {isRtl ? m.descriptionAr : m.description}
                      </div>
                    </div>
                    <button
                      onClick={() => onStartMission(m.id)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shrink-0 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> {t.start}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'environment' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-4">
                {hud.story.active && onExitStory && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/60 space-y-2">
                    <button
                      onClick={onExitStory}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-black cursor-pointer shadow-lg"
                    >
                      <LogOut className="w-4 h-4" /> {t.storyExitToMenu}
                    </button>
                    <p className="text-[11px] font-bold text-rose-200/90 leading-relaxed text-center">
                      {t.storyExitResetHint}
                    </p>
                  </div>
                )}

                {/* Language Switcher */}
                <div>
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-white mb-2">
                    <Globe className="w-3.5 h-3.5 text-amber-400" /> {t.languageLabel}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onSetLanguage('ar')}
                      className={`px-3 py-2 rounded text-xs font-extrabold cursor-pointer ${
                        hud.language === 'ar'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      العربية
                    </button>
                    <button
                      onClick={() => onSetLanguage('en')}
                      className={`px-3 py-2 rounded text-xs font-extrabold cursor-pointer ${
                        hud.language === 'en'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* 5 Graphics Quality Modes */}
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-white">{t.graphicsQuality}</h4>
                    <span className="text-[11px] font-bold text-emerald-400 tabular-nums">{hud.fps} FPS</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {QUALITY_MODES.map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onSetQualityMode(mode)}
                        className={`px-2.5 py-2 rounded text-xs font-bold cursor-pointer ${
                          hud.qualityMode === mode
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {t.qualityLabels[mode]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                    {t.qualityHints[hud.qualityMode]}
                  </p>
                </div>

                {/* Button Size (Enlarge / Shrink) */}
                <div className="pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">{t.buttonSizeLabel}</h4>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-black tabular-nums">
                      {Math.round(buttonScale * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSetButtonScale(buttonScale - 0.05)}
                      disabled={buttonScale <= 0.701}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-sky-300 cursor-pointer shrink-0"
                    >
                      <ZoomOut className="w-3.5 h-3.5" /> {t.buttonSizeSmall}
                    </button>
                    <input
                      type="range"
                      min={0.7}
                      max={1.4}
                      step={0.05}
                      value={buttonScale}
                      onChange={(e) => onSetButtonScale(Number(e.target.value))}
                      className="flex-1 accent-amber-400 cursor-pointer"
                    />
                    <button
                      onClick={() => onSetButtonScale(buttonScale + 0.05)}
                      disabled={buttonScale >= 1.399}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-emerald-300 cursor-pointer shrink-0"
                    >
                      <ZoomIn className="w-3.5 h-3.5" /> {t.buttonSizeLarge}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => onSetButtonScale(1)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 cursor-pointer"
                    >
                      {t.buttonSizeReset}
                    </button>
                  </div>
                </div>

                {/* Time & Weather */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <h3 className="text-xs font-bold text-white">{t.timeAndWeather}</h3>
                  <div className="text-xs text-slate-300">
                    <strong className="text-amber-400">
                      {hud.timeLabel} ({t.timePhases[hud.timePhase]})
                    </strong>{' '}
                    · <strong className="text-sky-400">{t.weatherNames[hud.weather]}</strong>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={onAdvanceTime}
                      className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                    >
                      {t.advanceTime}
                    </button>
                    <button
                      onClick={onCycleWeather}
                      className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                    >
                      {t.cycleWeather}
                    </button>
                  </div>
                </div>

                {/* Developer / Secret Code */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-400">{t.devCodeTitle}</h4>
                    {hud.devUnlocked && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                        OK
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{t.devCodeDesc}</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const res = onRedeemCode(codeInput);
                      setCodeFeedback(res);
                      if (res.ok) setCodeInput('');
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      placeholder={t.devCodePlaceholder}
                      dir="ltr"
                      className="flex-1 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer shrink-0"
                    >
                      {t.devCodeApply}
                    </button>
                  </form>
                  {codeFeedback && (
                    <div
                      className={`text-[11px] font-bold ${
                        codeFeedback.ok ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {codeFeedback.message}
                    </div>
                  )}
                  {hud.devUnlocked && !codeFeedback && (
                    <div className="text-[11px] font-bold text-emerald-400">{t.devCodeUnlocked}</div>
                  )}
                </div>

                {/* Single Player Save & Reset (Free Roam only — hidden in Story Mode) */}
                {!hud.story.active && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <Save className="w-3.5 h-3.5" /> {t.saveTitle}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">
                        {hud.lastSavedAt
                          ? `${t.lastSavedLabel}: ${new Date(hud.lastSavedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : t.notSavedYet}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {hud.multiplayer.active ? t.saveDisabledInMp : t.saveDesc}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={hud.multiplayer.active}
                        onClick={() => {
                          if (onSaveGame()) {
                            setSaveNotice(true);
                            setTimeout(() => setSaveNotice(false), 2500);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" /> {t.saveNowBtn}
                      </button>

                      {!confirmResetSave ? (
                        <button
                          disabled={hud.multiplayer.active}
                          onClick={() => setConfirmResetSave(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-500/70 disabled:opacity-40 text-slate-300 hover:text-rose-200 text-xs font-bold cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-400" /> {t.resetSaveBtn}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-rose-950/80 border border-rose-500/70">
                          <span className="text-[11px] font-bold text-rose-200">{t.confirmResetLabel}</span>
                          <button
                            onClick={() => {
                              setConfirmResetSave(false);
                              onResetSave();
                            }}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setConfirmResetSave(false)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                          >
                            {t.cancelLabel}
                          </button>
                        </div>
                      )}
                    </div>
                    {saveNotice && <div className="text-[11px] font-bold text-emerald-400">{t.saveSuccessMsg}</div>}
                  </div>
                )}

                {/* Download Latest Standalone HTML */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <button
                    onClick={onDownloadHtml}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-xs font-black cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-cyan-300" /> {t.downloadHtmlBtn} (v11.5)
                  </button>
                  <p className="text-[11px] text-slate-400">{t.downloadHtmlHint}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2 text-xs text-slate-300">
                <h3 className="text-sm font-bold text-white mb-2">{t.controlsTitle}</h3>
                {hud.language === 'ar' ? (
                  <>
                    <div><strong className="text-amber-400">عصا التحكم / WASD:</strong> المشي والسباحة والقيادة</div>
                    <div><strong className="text-cyan-400">منظور أول / C:</strong> تبديل الكاميرا (منظور أول داخل السيارات والدراجات والطائرات ومع الأسلحة)</div>
                    <div><strong className="text-sky-400">الطيران (طائرة):</strong> Space / صعود، Shift / نزول للسفر إلى الجزيرة والعودة</div>
                    <div><strong className="text-cyan-300">السيارات الآلية / X:</strong> تحويل لروبوت يمشي مع قاذف RPG لا نهائي (إطلاق: Click أو G)</div>
                    <div><strong className="text-amber-400">زر اليد / V:</strong> ضرب الأشخاص القريبين</div>
                    <div><strong className="text-amber-400">زر الإطلاق / G:</strong> إطلاق النار بالمسدس، الشوزن، البندقية، أو RPG</div>
                    <div><strong className="text-amber-400">تبديل السلاح / 1-6:</strong> يد، مسدس، رشاش، شوزن، بندقية، RPG</div>
                    <div><strong className="text-amber-400">سرقة / ركوب / F:</strong> سرقة سيارة، دراجة نارية، بسكليت أو طائرة</div>
                    <div><strong className="text-amber-400">تفاعل / E:</strong> دخول المتاجر والمعارض أو شراء البيوت للدخول</div>
                    <div><strong className="text-emerald-400">الهاتف / P:</strong> استدعاء سياراتك وطائراتك المشتراة إلى مكان آمن</div>
                    <div><strong className="text-amber-400">الحقيبة / B:</strong> تبديل وارتداء السكنات المملوكة</div>
                    <div><strong className="text-amber-400">سحب الشاشة:</strong> تحريك الكاميرا 360 درجة</div>
                  </>
                ) : (
                  <>
                    <div><strong className="text-amber-400">WASD / Arrows:</strong> Walk, Swim, Drive, Fly</div>
                    <div><strong className="text-cyan-400">C / Camera Button:</strong> Toggle 1st-Person & 3rd-Person View</div>
                    <div><strong className="text-sky-400">Airplane Controls:</strong> Space Climb · Shift Descend · Fly to Palm Cove Island</div>
                    <div><strong className="text-cyan-300">Robot Cars / X:</strong> Transform to Walking Mech with Infinite RPG (Click or G)</div>
                    <div><strong className="text-amber-400">V / Punch Button:</strong> Punch Nearby Pedestrian</div>
                    <div><strong className="text-amber-400">Click / G:</strong> Fire Weapon (Pistol, SMG, Shotgun, Rifle, RPG)</div>
                    <div><strong className="text-amber-400">1–6 / Tab:</strong> Switch Weapon</div>
                    <div><strong className="text-amber-400">F:</strong> Enter/Exit or Steal Vehicles & Airplanes</div>
                    <div><strong className="text-amber-400">E:</strong> Enter Shops or Buy Houses to Unlock</div>
                    <div><strong className="text-emerald-400">P / Green Phone:</strong> Summon Owned Vehicles Safely</div>
                    <div><strong className="text-amber-400">B / Backpack:</strong> Equip & Swap Owned Skins</div>
                    <div><strong className="text-amber-400">Mouse Drag & Wheel:</strong> 360° Orbit & Zoom</div>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'unity' && (
            <div className="space-y-3 text-xs text-slate-300" dir="ltr">
              <p className="text-slate-200 leading-relaxed">
                Alongside the playable 3D WebGL build, a complete modular <strong>Unity Engine + C#</strong> script architecture has been generated in <code className="text-amber-400">/unity/CityWorld/Assets/Scripts/</code>:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">Core/Interfaces.cs · CurrencyManager.cs · ObjectPool.cs</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">Player/PlayerController.cs · ThirdPersonCamera.cs</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">Vehicles/VehicleDataSO.cs · VehicleController.cs</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">AI/TrafficSystem.cs (Waypoints, Lights, Pooling)</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">NPC/PedestrianAI.cs (NavMesh Roaming & Flee)</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">Police/WantedSystem.cs (0–5 Stars & PoliceAI)</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">Missions/MissionManager.cs (MissionDataSO)</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">World/WorldStreamingManager.cs · InteriorPortal.cs</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">Environment/DayNightWeather.cs</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">Audio/AudioManager.cs · UI/CityWorldHUD.cs</div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 md:col-span-2 text-emerald-300">
                  Multiplayer/NetworkSessionManager.cs · NetworkPlayerSync.cs · NetworkVehicleSync.cs · PassengerSeatSystem.cs
                </div>
              </div>
              <p className="text-slate-400">
                See <code className="text-sky-400">/unity/CityWorld/README_UNITY_SETUP.md</code> for URP lighting, NavMesh baking, WheelCollider prefabs, and Additive Scene Streaming setup.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface InteriorShopModalProps {
  hud: HudSnapshot;
  onAction: (actionId: string) => void;
  onClose: () => void;
}

export const InteriorShopModal: React.FC<InteriorShopModalProps> = ({ hud, onAction, onClose }) => {
  if (!hud.activeInterior) return null;
  const interior = hud.activeInterior;
  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';
  const isOwnedHouse = interior.kind === 'house' && hud.ownedHouses.includes(interior.id);
  const visibleActions = isOwnedHouse
    ? interior.shopActions.filter((act) => act.id !== 'buy_house')
    : interior.shopActions;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-30 bg-slate-950/85 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-white">
              {isRtl ? interior.nameAr : interior.name}
            </h2>
            <p className="text-xs text-slate-400">
              {isOwnedHouse
                ? isRtl
                  ? 'منزل مملوك · تناول الطعام والنوم مجاناً في أي وقت'
                  : 'Owned Home · Eat & Sleep Free Anytime'
                : isRtl
                  ? interior.subtitleAr
                  : interior.subtitle}
            </p>
          </div>
          <div className="text-sm font-black text-emerald-400 tabular-nums">${hud.money.toLocaleString()}</div>
        </div>
        <div className="p-5 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          {visibleActions.map((act) => {
            let statusBadge: string | null = null;
            let isEquipped = false;
            if (act.id.startsWith('buy_skin_')) {
              const skinId = act.id.replace('buy_skin_', '') as PlayerSkinId;
              if (hud.activeSkin === skinId) {
                statusBadge = t.equipped;
                isEquipped = true;
              } else if (hud.ownedSkins.includes(skinId)) {
                statusBadge = t.owned;
              }
            } else if (act.id.startsWith('buy_weapon_') && act.id !== 'buy_weapon_ammo_crate') {
              const wId = act.id.replace('buy_weapon_', '') as WeaponId;
              if (hud.ownedWeapons.includes(wId)) {
                statusBadge = t.owned;
              }
            } else if (act.id.startsWith('buy_car_')) {
              const cId = act.id.replace('buy_car_', '') as VehicleClassId;
              if (hud.ownedVehicles.includes(cId)) {
                statusBadge = t.owned;
              }
            } else if (act.id === 'buy_house' && hud.ownedHouses.includes(interior.id)) {
              statusBadge = t.owned;
              isEquipped = true;
            }

            return (
              <button
                key={act.id}
                onClick={() => onAction(act.id)}
                className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-start cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">
                      {isRtl ? act.labelAr : act.label}
                    </span>
                    {statusBadge && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          isEquipped
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        }`}
                      >
                        {statusBadge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {isRtl ? act.descriptionAr : act.description}
                  </div>
                </div>
                <span className="text-xs font-black text-amber-400 tabular-nums shrink-0 ms-3">
                  {((act.id.startsWith('buy_skin_') || act.id === 'buy_house') && statusBadge) || act.cost === 0
                    ? t.free
                    : `$${act.cost.toLocaleString()}`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
          >
            {t.backToInterior}
          </button>
        </div>
      </div>
    </div>
  );
};

interface WastedModalProps {
  language: Language;
  isStoryActive: boolean;
  failedMissionName: string | null;
  onRespawn: () => void;
  onExitStory?: () => void;
}

export const WastedModal: React.FC<WastedModalProps> = ({
  language,
  isStoryActive,
  failedMissionName,
  onRespawn,
  onExitStory,
}) => {
  const t = getText(language);
  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="fixed inset-0 z-30 bg-rose-950/85 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-950 border border-rose-500/60 rounded-xl p-8 text-center shadow-2xl">
        <h2 className="text-2xl md:text-3xl font-black tracking-wide text-rose-500 uppercase">
          {isStoryActive ? t.wastedStoryTitle : t.wastedTitle}
        </h2>
        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
          {isStoryActive ? t.wastedStoryDesc : t.wastedDesc}
        </p>

        {!isStoryActive && failedMissionName && (
          <div className="mt-4 px-4 py-2.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs sm:text-sm font-black text-rose-300">
            {t.wastedMissionFailedLabel}: {failedMissionName}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={onRespawn}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm uppercase cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            {isStoryActive ? t.restartStoryBtn : t.respawnHospital}
          </button>

          {isStoryActive && onExitStory && (
            <button
              onClick={onExitStory}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs sm:text-sm border border-slate-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              {t.storyExitToMenu}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface PhoneModalProps {
  hud: HudSnapshot;
  onSummonVehicle: (classId: VehicleClassId) => void;
  onTeleportToHouse: (houseId: string) => void;
  onSetGpsTarget: (pt: { x: number; z: number }) => void;
  onClose: () => void;
}

export const PhoneModal: React.FC<PhoneModalProps> = ({
  hud,
  onSummonVehicle,
  onTeleportToHouse,
  onSetGpsTarget,
  onClose,
}) => {
  const [appTab, setAppTab] = useState<'cars' | 'houses' | 'maps' | 'bank'>('cars');
  const [carQuery, setCarQuery] = useState('');
  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';
  const allHouses = INTERIOR_PORTALS.filter((p) => p.kind === 'house');

  const quickDestinations = INTERIOR_PORTALS.filter(
    (p) =>
      p.kind === 'garage' ||
      p.kind === 'dealership' ||
      p.kind === 'house' ||
      p.kind === 'gunshop' ||
      p.kind === 'skins' ||
      p.id === 'market_downtown'
  );

  // Pick nearest car dealership (Apex Auto or Premier Motors)
  const apexPortal = INTERIOR_PORTALS.find((p) => p.id === 'auto_garage')!;
  const premierPortal = INTERIOR_PORTALS.find((p) => p.id === 'premier_motors')!;
  const dApex = Math.hypot(hud.playerPos.x - apexPortal.exteriorPos.x, hud.playerPos.z - apexPortal.exteriorPos.z);
  const dPremier = Math.hypot(
    hud.playerPos.x - premierPortal.exteriorPos.x,
    hud.playerPos.z - premierPortal.exteriorPos.z
  );
  const nearestDealer = dApex <= dPremier ? apexPortal : premierPortal;

  const routeToPortal = (x: number, z: number) => {
    onSetGpsTarget({ x, z });
    onClose();
  };

  const activeSkinDef = PLAYER_SKINS[hud.activeSkin];

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-30 bg-slate-950/82 flex items-center justify-center p-4">
      {/* Smartphone Hardware Outer Shell + Physical Side Buttons */}
      <div className="relative w-full max-w-[332px]">
        {/* Physical Volume Buttons (Left side) */}
        <div className="absolute -left-[4px] top-24 w-[4px] h-9 rounded-l bg-slate-500 border-l border-slate-300/60" />
        <div className="absolute -left-[4px] top-36 w-[4px] h-12 rounded-l bg-slate-500 border-l border-slate-300/60" />
        <div className="absolute -left-[4px] top-52 w-[4px] h-12 rounded-l bg-slate-500 border-l border-slate-300/60" />
        {/* Physical Power Button (Right side) */}
        <button
          onClick={onClose}
          title="Close Phone (P)"
          className="absolute -right-[5px] top-32 w-[5px] h-16 rounded-r bg-slate-400 hover:bg-rose-400 cursor-pointer border-r border-slate-200/70"
        />

        {/* Brushed Titanium Metallic Chassis */}
        <div className="rounded-[2.8rem] p-[5px] bg-gradient-to-b from-slate-400 via-slate-600 to-slate-500 shadow-[0_28px_70px_rgba(0,0,0,0.88)]">
          {/* Glossy Black OLED Glass Bezel */}
          <div className="rounded-[2.5rem] p-[8px] bg-black">
            {/* Actual AMOLED Display Screen */}
            <div className="rounded-[2.05rem] overflow-hidden flex flex-col h-[540px] max-h-[82vh] bg-gradient-to-b from-[#0b132b] via-[#0f1d38] to-[#070d1c] border border-white/10">
              {/* Realistic Top Status Bar + Dynamic Island */}
              <div dir="ltr" className="px-5 pt-2.5 pb-2 flex items-center justify-between text-[11px] font-bold text-white shrink-0">
                <span className="tabular-nums tracking-tight w-12">{hud.timeLabel}</span>

                {/* Dynamic Island Notch (Speaker + Camera Lens) */}
                <div className="w-24 h-6 rounded-full bg-black border border-slate-800 flex items-center justify-between px-2.5 shadow-inner">
                  <span className="w-8 h-1 rounded-full bg-slate-800" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0c1a38] border border-sky-500/40" />
                </div>

                {/* 5G Signal + WiFi + 94% Green Battery */}
                <div className="flex items-center gap-1.5 w-16 justify-end">
                  <Signal className="w-3 h-3 text-white" />
                  <Wifi className="w-3 h-3 text-white" />
                  <div className="flex items-center gap-0.5 border border-white/70 rounded-[3px] px-[2px] py-[1px]">
                    <div className="w-3.5 h-1.5 bg-emerald-400 rounded-[1px]" />
                  </div>
                </div>
              </div>

              {/* Active Smartphone App Screen Header */}
              <div className="px-4 pt-1 pb-2.5 border-b border-white/10 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-black text-white">
                    {appTab === 'cars'
                      ? t.phoneTitle
                      : appTab === 'houses'
                        ? t.phoneHousesTitle
                        : appTab === 'maps'
                          ? t.phoneMapsTitle
                          : t.phoneBankTitle}
                  </h2>
                  <p className="text-[10px] text-slate-300/80">
                    {appTab === 'cars'
                      ? t.phoneSub
                      : appTab === 'houses'
                        ? t.phoneHousesSub
                        : appTab === 'maps'
                          ? t.phoneMapsSub
                          : isRtl
                            ? hud.district.nameAr
                            : hud.district.name}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-black tabular-nums">
                    ${hud.money.toLocaleString()}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-md bg-white/10 hover:bg-rose-600 text-slate-200 cursor-pointer"
                    aria-label="Close Phone"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Main Scrollable App Content */}
              <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5">
                {appTab === 'cars' && (
                  <>
                    {hud.ownedVehicles.length > 4 && (
                      <input
                        type="text"
                        value={carQuery}
                        onChange={(e) => setCarQuery(e.target.value)}
                        placeholder={isRtl ? 'ابحث عن سيارة أو طائرة...' : 'Filter vehicles...'}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-900/95 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 shrink-0"
                      />
                    )}
                    {hud.ownedVehicles.length === 0 ? (
                      <div className="my-auto flex flex-col items-center text-center px-4 py-5 rounded-2xl bg-slate-900/85 border border-white/10 shadow-lg">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 mb-3">
                          <Car className="w-6 h-6" />
                        </div>
                        <div className="text-sm font-black text-white">{t.phoneEmptyTitle}</div>
                        <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">{t.phoneEmptyDesc}</p>
                        <button
                          onClick={() => routeToPortal(nearestDealer.exteriorPos.x, nearestDealer.exteriorPos.z)}
                          className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black cursor-pointer shadow"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>{t.goToDealership}</span>
                        </button>
                      </div>
                    ) : (
                      hud.ownedVehicles
                        .filter((classId) => {
                          if (!carQuery.trim()) return true;
                          const s = VEHICLE_CATALOG[classId];
                          const q = carQuery.trim().toLowerCase();
                          return (
                            s.name.toLowerCase().includes(q) ||
                            s.nameAr.toLowerCase().includes(q) ||
                            s.category.toLowerCase().includes(q)
                          );
                        })
                        .map((classId) => {
                          const spec = VEHICLE_CATALOG[classId];
                          const maxKmh = Math.round(spec.maxSpeed * 3.6);
                          return (
                            <div
                              key={classId}
                              className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/90 border border-white/10 hover:border-emerald-400/60"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                                  <Car className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-white truncate">
                                    {isRtl ? spec.nameAr : spec.name}{' '}
                                    <span className="text-amber-400">({maxKmh} {isRtl ? 'كم/س' : 'km/h'})</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {spec.category} · {maxKmh} KM/H
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => onSummonVehicle(classId)}
                                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-[11px] font-black shrink-0 cursor-pointer"
                              >
                                {t.summonCar}
                              </button>
                            </div>
                          );
                        })
                    )}
                  </>
                )}

                {appTab === 'houses' && (
                  <>
                    {hud.ownedHouses.length === 0 && (
                      <div className="p-3 rounded-2xl bg-orange-950/50 border border-orange-500/40 text-[11px] text-orange-100 leading-relaxed">
                        {t.phoneHousesEmpty}
                      </div>
                    )}
                    {[...allHouses]
                      .sort((a, b) => Number(hud.ownedHouses.includes(b.id)) - Number(hud.ownedHouses.includes(a.id)))
                      .map((h) => {
                        const isOwned = hud.ownedHouses.includes(h.id);
                        return (
                          <div
                            key={h.id}
                            className={`flex items-center justify-between gap-2.5 p-3 rounded-2xl border ${
                              isOwned
                                ? 'bg-slate-900/95 border-orange-400/50'
                                : 'bg-slate-900/60 border-white/10 opacity-85'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isOwned
                                    ? 'bg-orange-500 text-slate-950'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {isOwned ? <Home className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">
                                  {isRtl ? h.nameAr : h.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {isOwned
                                    ? t.owned
                                    : `$${(h.housePrice ?? 5500).toLocaleString()}`}
                                </div>
                              </div>
                            </div>

                            {isOwned ? (
                              <button
                                onClick={() => onTeleportToHouse(h.id)}
                                className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 active:scale-95 text-slate-950 text-[11px] font-black shrink-0 cursor-pointer"
                              >
                                {t.teleportHouse}
                              </button>
                            ) : (
                              <button
                                onClick={() => routeToPortal(h.exteriorPos.x, h.exteriorPos.z)}
                                className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-300 text-[10px] font-black shrink-0 cursor-pointer"
                              >
                                GPS
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </>
                )}

                {appTab === 'maps' &&
                  quickDestinations.map((p) => {
                    const dist = Math.round(
                      Math.hypot(hud.playerPos.x - p.exteriorPos.x, hud.playerPos.z - p.exteriorPos.z)
                    );
                    const isDealer = p.kind === 'dealership' || p.kind === 'garage';
                    const isHouse = p.kind === 'house';
                    return (
                      <button
                        key={p.id}
                        onClick={() => routeToPortal(p.exteriorPos.x, p.exteriorPos.z)}
                        className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 text-start cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isDealer
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-400/40'
                                : isHouse
                                  ? 'bg-orange-500/20 text-orange-400 border border-orange-400/40'
                                  : p.kind === 'gunshop'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-400/40'
                                    : p.kind === 'skins'
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-400/40'
                                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40'
                            }`}
                          >
                            {isDealer ? (
                              <Car className="w-4 h-4" />
                            ) : isHouse ? (
                              <Home className="w-4 h-4" />
                            ) : (
                              <MapPin className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-white truncate">
                              {isRtl ? p.nameAr : p.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {isRtl ? p.subtitleAr : p.subtitle}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-sky-500 text-slate-950 text-[10px] font-black shrink-0 tabular-nums">
                          {dist}m
                        </span>
                      </button>
                    );
                  })}

                {appTab === 'bank' && (
                  <div className="flex flex-col gap-2.5">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-900 border border-emerald-300/30 shadow-lg">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/80">
                        {t.balance}
                      </div>
                      <div className="text-2xl font-black text-white tabular-nums mt-0.5">
                        ${hud.money.toLocaleString()}
                      </div>
                      <div className="mt-3 pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-emerald-50">
                        <span>{isRtl ? activeSkinDef.nameAr : activeSkinDef.name}</span>
                        <span>{hud.completedMissionIds.length} {t.missionsDone}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-white/10">
                        <div className="text-[10px] text-slate-400">{t.phoneAppCars}</div>
                        <div className="text-lg font-black text-white tabular-nums">{hud.ownedVehicles.length}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-white/10">
                        <div className="text-[10px] text-slate-400">{t.housesLabel}</div>
                        <div className="text-lg font-black text-orange-400 tabular-nums">{hud.ownedHouses.length}</div>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-white/10">
                        <div className="text-[10px] text-slate-400">{t.backpack}</div>
                        <div className="text-lg font-black text-amber-400 tabular-nums">{hud.ownedSkins.length}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Realistic Smartphone Glass Dock (App Launcher Icons) + Home Gesture Bar */}
              <div className="px-3 pt-2 pb-2 bg-slate-950/90 border-t border-white/10 flex flex-col items-center gap-2 shrink-0">
                <div className="w-full grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setAppTab('cars')}
                    className={`flex flex-col items-center gap-1 py-1.5 rounded-xl cursor-pointer ${
                      appTab === 'cars' ? 'bg-white/12' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow">
                      <Car className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-200">{t.phoneAppCars}</span>
                  </button>

                  <button
                    onClick={() => setAppTab('houses')}
                    className={`flex flex-col items-center gap-1 py-1.5 rounded-xl cursor-pointer ${
                      appTab === 'houses' ? 'bg-white/12' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-slate-950 shadow">
                      <Home className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-200">{t.phoneAppHouses}</span>
                  </button>

                  <button
                    onClick={() => setAppTab('maps')}
                    className={`flex flex-col items-center gap-1 py-1.5 rounded-xl cursor-pointer ${
                      appTab === 'maps' ? 'bg-white/12' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center text-slate-950 shadow">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-200">{t.phoneAppMaps}</span>
                  </button>

                  <button
                    onClick={() => setAppTab('bank')}
                    className={`flex flex-col items-center gap-1 py-1.5 rounded-xl cursor-pointer ${
                      appTab === 'bank' ? 'bg-white/12' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-200">{t.phoneAppBank}</span>
                  </button>
                </div>

                {/* White Swipe Home Gesture Pill */}
                <button
                  onClick={onClose}
                  aria-label="Close Phone"
                  className="w-24 h-1 rounded-full bg-white/75 hover:bg-white cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BackpackModalProps {
  hud: HudSnapshot;
  onEquipSkin: (skinId: PlayerSkinId) => void;
  onClose: () => void;
}

export const BackpackModal: React.FC<BackpackModalProps> = ({ hud, onEquipSkin, onClose }) => {
  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-30 bg-slate-950/85 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950">
              <Backpack className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{t.backpackTitle}</h2>
              <p className="text-xs text-slate-400">{t.backpackSub}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-emerald-400 tabular-nums">${hud.money.toLocaleString()}</span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 cursor-pointer"
              title="Close Backpack (B)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLAYER_SKIN_LIST.map((skin) => {
            const isOwned = hud.ownedSkins.includes(skin.id);
            const isEquipped = hud.activeSkin === skin.id;
            const isGold = skin.id === 'pure_gold';
            const isMeme = Boolean(skin.isMeme);

            return (
              <div
                key={skin.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                  isEquipped
                    ? 'bg-amber-950/35 border-amber-400'
                    : isOwned
                      ? isMeme
                        ? 'bg-slate-950 border-pink-500/40'
                        : 'bg-slate-950 border-slate-700'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-lg border border-white/25 shrink-0 flex items-center justify-center shadow-inner"
                    style={{ backgroundColor: skin.swatchHex }}
                  >
                    {(isGold || isMeme) && <Sparkles className="w-5 h-5 text-slate-950" />}
                    {!isOwned && !isGold && !isMeme && <Lock className="w-4 h-4 text-white/80" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-white leading-snug">
                        {isRtl ? skin.nameAr : skin.name}
                      </span>
                      {isMeme && (
                        <span className="px-1.5 py-0.5 rounded bg-pink-500/20 border border-pink-400/40 text-pink-300 text-[9px] font-black">
                          {isRtl ? 'ميمز 3D' : '3D MEME'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {isRtl ? skin.descriptionAr : skin.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-xs font-black tabular-nums text-amber-400">
                    {skin.price === 0 ? t.free : `$${skin.price.toLocaleString()}`}
                  </span>
                  {isEquipped ? (
                    <span className="px-3 py-1 rounded-md bg-emerald-500 text-slate-950 text-xs font-black">
                      {t.equipped}
                    </span>
                  ) : isOwned ? (
                    <button
                      onClick={() => onEquipSkin(skin.id)}
                      className="px-3.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      {t.equipSkin}
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {t.lockedSkinHint}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface MultiplayerModalProps {
  hud: HudSnapshot;
  sessions: MultiplayerSessionSummary[];
  onRefreshSessions: () => void;
  onSetServerUrl: (url: string) => Promise<boolean>;
  onStartP2PHost: (name: string, maxPlayers: number) => Promise<{ ok: boolean; inviteCode: string }>;
  onCreateP2PExtraInvite: () => Promise<string>;
  onAcceptP2PReply: (replyCode: string) => Promise<{ ok: boolean; error?: string }>;
  onJoinP2PWithInvite: (inviteCode: string) => Promise<{ ok: boolean; replyCode: string; error?: string }>;
  onCreateSession: (name: string, maxPlayers: number) => void;
  onJoinSession: (options: { sessionId?: string; sessionCode?: string }) => void;
  onLeaveSession: () => void;
  onChangeName: (name: string) => void;
  onCloseToGame: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  hud,
  sessions,
  onRefreshSessions,
  onSetServerUrl,
  onStartP2PHost,
  onCreateP2PExtraInvite,
  onAcceptP2PReply,
  onJoinP2PWithInvite,
  onCreateSession,
  onJoinSession,
  onLeaveSession,
  onChangeName,
  onCloseToGame,
}) => {
  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';
  const [playerName, setPlayerName] = useState(hud.multiplayer.customName || '');
  const [nameSaved, setNameSaved] = useState(false);
  const [roomName, setRoomName] = useState(isRtl ? 'غرفة CityWorld' : 'CityWorld Room');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [joinCode, setJoinCode] = useState('');
  const [mpMode, setMpMode] = useState<'p2p' | 'server'>(() =>
    hud.multiplayer.p2p.active || hud.multiplayer.isStandaloneMode ? 'p2p' : 'server'
  );
  const [serverInput, setServerInput] = useState(hud.multiplayer.serverUrl || '');
  const [p2pInviteInput, setP2pInviteInput] = useState('');
  const [p2pReplyInput, setP2pReplyInput] = useState('');
  const [p2pFeedback, setP2pFeedback] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState<'invite' | 'reply' | null>(null);

  const copyText = (text: string, which: 'invite' | 'reply') => {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // ignore
      }
      ta.remove();
    }
    setCopiedFlag(which);
    setTimeout(() => setCopiedFlag(null), 2000);
  };

  const effectiveTab = hud.multiplayer.p2p.active ? 'p2p' : mpMode;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-30 bg-slate-950/92 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">{t.mpLobbyTitle}</h2>
              <p className="text-[11px] sm:text-xs text-slate-400">{t.mpLobbySub}</p>
            </div>
          </div>
          <button
            onClick={onCloseToGame}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 cursor-pointer shrink-0"
          >
            {hud.multiplayer.active ? t.resume : t.mpBackToSingle}
          </button>
        </div>

        {/* Transport Mode Tabs */}
        <div className="flex gap-2 px-5 pt-2.5 border-b border-slate-800 bg-slate-950/60 overflow-x-auto">
          <button
            onClick={() => setMpMode('p2p')}
            className={`px-3.5 py-2 text-xs font-black border-b-2 cursor-pointer shrink-0 ${
              effectiveTab === 'p2p'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.mpTabP2P}
          </button>
          <button
            onClick={() => setMpMode('server')}
            className={`px-3.5 py-2 text-xs font-black border-b-2 cursor-pointer shrink-0 ${
              effectiveTab === 'server'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t.mpTabServer}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {hud.multiplayer.status === 'connecting' && !hud.multiplayer.p2p.active && (
            <div className="p-3.5 rounded-xl bg-sky-950/80 border border-sky-500/60 text-xs font-bold text-sky-200 flex items-center gap-2">
              <Wifi className="w-4 h-4 animate-pulse text-sky-400" />
              <span>{t.mpConnecting}</span>
            </div>
          )}

          {hud.multiplayer.errorMessage && effectiveTab === 'server' && (
            <div className="p-3.5 rounded-xl bg-amber-950/75 border border-amber-500/70 text-xs font-bold text-amber-100 flex flex-wrap items-center justify-between gap-2">
              <span>{hud.multiplayer.errorMessage}</span>
              <button
                onClick={() => setMpMode('p2p')}
                className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-black cursor-pointer"
              >
                {t.mpTabP2P}
              </button>
            </div>
          )}

          {/* Player Name */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold text-slate-400">{t.mpPlayerNameLabel}</div>
              <div className="text-sm font-black text-emerald-400">
                {hud.multiplayer.active ? hud.multiplayer.playerName : playerName || 'Player #'}
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onChangeName(playerName);
                setNameSaved(true);
                setTimeout(() => setNameSaved(false), 2200);
              }}
              className="flex gap-2 flex-1 max-w-md"
            >
              <input
                type="text"
                maxLength={18}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t.mpNamePlaceholder}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer shrink-0"
              >
                {t.mpChangeName}
              </button>
            </form>
            {nameSaved && <span className="text-[11px] font-bold text-emerald-400">{t.mpNameSaved}</span>}
          </div>

          {hud.multiplayer.active && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/60 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-emerald-300">
                  {hud.multiplayer.sessionName} · #{hud.multiplayer.sessionCode}
                </div>
                <div className="text-[11px] text-slate-300">
                  {t.mpPlayersLabel}: {hud.multiplayer.playerCount}/{hud.multiplayer.maxPlayers} · {t.mpPingLabel}:{' '}
                  {hud.multiplayer.pingMs} ms
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCloseToGame}
                  className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  {t.mpP2pEnterWorldBtn}
                </button>
                <button
                  onClick={onLeaveSession}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> {t.mpLeaveSession}
                </button>
              </div>
            </div>
          )}

          {effectiveTab === 'p2p' ? (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-[11px] font-semibold text-cyan-100 leading-relaxed">
                {t.mpP2pInfo}
              </div>

              {(hud.multiplayer.p2p.error || p2pFeedback) && (
                <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs font-bold text-rose-200">
                  {hud.multiplayer.p2p.error || p2pFeedback}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* P2P Host Card */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-cyan-300">
                    <Plus className="w-4 h-4" />
                    <span>{t.mpP2pHostTitle}</span>
                  </div>

                  {hud.multiplayer.p2p.role !== 'host' ? (
                    <>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">{t.mpSessionNameLabel}</label>
                        <input
                          type="text"
                          maxLength={28}
                          value={roomName}
                          onChange={(e) => setRoomName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setP2pFeedback(null);
                          void onStartP2PHost(roomName, maxPlayers);
                        }}
                        className="w-full py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        {t.mpP2pHostBtn}
                      </button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      {hud.multiplayer.p2p.gathering ? (
                        <div className="text-xs font-bold text-sky-300 animate-pulse">{t.mpGenerating}</div>
                      ) : hud.multiplayer.p2p.inviteCode ? (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-amber-300 block">
                            {t.mpP2pInviteLabel}
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              readOnly
                              dir="ltr"
                              value={hud.multiplayer.p2p.inviteCode}
                              className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-200"
                            />
                            <button
                              onClick={() => copyText(hud.multiplayer.p2p.inviteCode, 'invite')}
                              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black cursor-pointer shrink-0"
                            >
                              {copiedFlag === 'invite' ? t.mpCopiedBtn : t.mpCopyBtn}
                            </button>
                          </div>

                          <label className="text-[11px] font-bold text-emerald-300 block pt-1">
                            {t.mpP2pReplyInputLabel}
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              dir="ltr"
                              value={p2pReplyInput}
                              onChange={(e) => setP2pReplyInput(e.target.value)}
                              placeholder="CW2:..."
                              className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono text-white"
                            />
                            <button
                              onClick={async () => {
                                if (!p2pReplyInput.trim()) return;
                                const res = await onAcceptP2PReply(p2pReplyInput.trim());
                                if (res.ok) {
                                  setP2pReplyInput('');
                                  setP2pFeedback(null);
                                } else {
                                  setP2pFeedback(res.error || 'Invalid reply code');
                                }
                              }}
                              className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black cursor-pointer shrink-0"
                            >
                              {t.mpP2pConnectPeerBtn}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => void onCreateP2PExtraInvite()}
                          className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 text-cyan-300 text-xs font-black cursor-pointer"
                        >
                          {t.mpP2pExtraInviteBtn}
                        </button>
                      )}

                      <button
                        onClick={onCloseToGame}
                        className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        {t.mpP2pEnterWorldBtn}
                      </button>
                    </div>
                  )}
                </div>

                {/* P2P Guest Join Card */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-sky-300">
                    <Wifi className="w-4 h-4" />
                    <span>{t.mpP2pJoinTitle}</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-300 block">{t.mpP2pJoinInputLabel}</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={p2pInviteInput}
                      onChange={(e) => setP2pInviteInput(e.target.value)}
                      placeholder="CW1:..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                    />
                    <button
                      onClick={async () => {
                        if (!p2pInviteInput.trim()) return;
                        setP2pFeedback(null);
                        const res = await onJoinP2PWithInvite(p2pInviteInput.trim());
                        if (!res.ok) {
                          setP2pFeedback(res.error || 'Invalid invite code');
                        }
                      }}
                      disabled={hud.multiplayer.p2p.gathering}
                      className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      {hud.multiplayer.p2p.gathering ? t.mpGenerating : t.mpP2pGenReplyBtn}
                    </button>
                  </div>

                  {hud.multiplayer.p2p.role === 'guest' && hud.multiplayer.p2p.replyCode && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <label className="text-[11px] font-bold text-emerald-300 block">
                        {t.mpP2pReplyOutputLabel}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          readOnly
                          dir="ltr"
                          value={hud.multiplayer.p2p.replyCode}
                          className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-200"
                        />
                        <button
                          onClick={() => copyText(hud.multiplayer.p2p.replyCode, 'reply')}
                          className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black cursor-pointer shrink-0"
                        >
                          {copiedFlag === 'reply' ? t.mpCopiedBtn : t.mpCopyBtn}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Custom Server URL (helps standalone HTML / APK connect to a hosted server) */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSetServerUrl(serverInput);
                }}
                className="p-3.5 rounded-xl bg-slate-950/75 border border-slate-800 space-y-2"
              >
                <label className="text-[11px] font-bold text-slate-300 block">{t.mpServerUrlLabel}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={serverInput}
                    onChange={(e) => setServerInput(e.target.value)}
                    placeholder={t.mpServerUrlPlaceholder}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer shrink-0"
                  >
                    {t.mpServerConnectBtn}
                  </button>
                </div>
              </form>

              {/* Create Session & Join by Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onCreateSession(roomName, maxPlayers);
                  }}
                  className="p-4 rounded-xl bg-slate-950/75 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-black text-white">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>{t.mpCreateSession}</span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">{t.mpSessionNameLabel}</label>
                    <input
                      type="text"
                      maxLength={28}
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">{t.mpMaxPlayersLabel}</label>
                    <select
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                    >
                      <option value={4}>4</option>
                      <option value={8}>8 (Default)</option>
                      <option value={12}>12</option>
                      <option value={16}>16</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    {t.mpCreateSession}
                  </button>
                </form>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (joinCode.trim()) {
                      onJoinSession({ sessionCode: joinCode.trim() });
                    }
                  }}
                  className="p-4 rounded-xl bg-slate-950/75 border border-slate-800 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black text-white">
                      <Wifi className="w-4 h-4 text-sky-400" />
                      <span>{t.mpJoinByCode}</span>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">{t.mpSessionCodeLabel}</label>
                      <input
                        type="text"
                        maxLength={8}
                        dir="ltr"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="CW1001"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono font-black text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    {t.mpJoinSession}
                  </button>
                </form>
              </div>

              {/* Open Sessions List */}
              <div className="p-4 rounded-xl bg-slate-950/75 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white">{t.mpJoinSession}</h3>
                  <button
                    onClick={onRefreshSessions}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> {t.mpRefreshSessions}
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3 text-center">{t.mpNoSessions}</div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-white">
                            {s.name}{' '}
                            <span className="font-mono text-[10px] text-sky-400 px-1.5 py-0.5 rounded bg-slate-800">
                              #{s.code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {t.mpPlayersLabel}: {s.playerCount}/{s.maxPlayers} · {s.region.toUpperCase()}
                          </div>
                        </div>
                        <button
                          onClick={() => onJoinSession({ sessionId: s.id })}
                          disabled={s.playerCount >= s.maxPlayers}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 text-xs font-black cursor-pointer shrink-0"
                        >
                          {t.mpJoinSession}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
