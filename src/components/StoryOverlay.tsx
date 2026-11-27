import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  MessageSquare,
  PhoneCall,
  Skull,
  Smartphone,
  Trophy,
  WifiOff,
  X,
} from 'lucide-react';
import { HudSnapshot, Language, StoryId } from '../game/types';
import { getText } from '../i18n/translations';

function formatCooldownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface StorySelectModalProps {
  open: boolean;
  language: Language;
  story1Completed: boolean;
  zombieCooldownUntil: number;
  onSelectStory: (storyId: StoryId) => void;
  onClose: () => void;
}

export const StorySelectModal: React.FC<StorySelectModalProps> = ({
  open,
  language,
  story1Completed,
  zombieCooldownUntil,
  onSelectStory,
  onClose,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  const t = getText(language);
  const isRtl = language === 'ar';
  const zombieRemainingMs = Math.max(0, zombieCooldownUntil - nowMs);
  const zombieLocked = zombieRemainingMs > 0;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 bg-slate-950/88 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border-2 border-cyan-500/60 shadow-[0_24px_70px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                {t.storySelectTitle}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">{t.storySelectSub}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* STORY 1: BANK HEIST */}
          <div
            className={`rounded-xl border p-4 sm:p-5 transition-colors ${
              story1Completed
                ? 'bg-slate-950/60 border-slate-800 opacity-85'
                : 'bg-slate-950/90 border-cyan-500/50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm sm:text-base font-black text-white">{t.story1Title}</h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black border ${
                  story1Completed
                    ? 'bg-slate-800 border-slate-700 text-emerald-300'
                    : 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                }`}
              >
                {story1Completed ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.story1BadgeDone}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t.story1BadgeOpen}</span>
                  </>
                )}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">{t.story1Desc}</p>

            <button
              onClick={() => onSelectStory('bank_heist')}
              disabled={story1Completed}
              className={`w-full py-2.5 px-4 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-transform ${
                story1Completed
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                  : 'bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 cursor-pointer shadow-lg'
              }`}
            >
              {story1Completed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{t.storyCompletedBtn}</span>
                  <Lock className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  <span>{t.story1PlayBtn}</span>
                </>
              )}
            </button>
          </div>

          {/* STORY 2: YEAR 8095 ZOMBIE HORDE */}
          <div
            className={`rounded-xl border p-4 sm:p-5 transition-colors ${
              zombieLocked
                ? 'bg-slate-950/65 border-rose-500/40'
                : 'bg-slate-950/90 border-lime-500/55'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Skull className="w-4 h-4 text-lime-400 shrink-0" />
                <h3 className="text-sm sm:text-base font-black text-white">{t.story2Title}</h3>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black border tabular-nums ${
                  zombieLocked
                    ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                    : 'bg-lime-500/15 border-lime-400/50 text-lime-300'
                }`}
              >
                {zombieLocked ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    <span>
                      {t.story2BadgeCooldown} · {formatCooldownMs(zombieRemainingMs)}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-lime-400" />
                    <span>{t.story2BadgeEndless}</span>
                  </>
                )}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">{t.story2Desc}</p>

            <button
              onClick={() => onSelectStory('zombie_8095')}
              disabled={zombieLocked}
              className={`w-full py-2.5 px-4 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-transform ${
                zombieLocked
                  ? 'bg-slate-800 text-rose-300 border border-rose-500/40 cursor-not-allowed tabular-nums'
                  : 'bg-lime-500 hover:bg-lime-400 active:scale-[0.99] text-slate-950 cursor-pointer shadow-lg'
              }`}
            >
              {zombieLocked ? (
                <>
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>
                    {t.story2WaitLabel}: {formatCooldownMs(zombieRemainingMs)}
                  </span>
                </>
              ) : (
                <>
                  <Skull className="w-4 h-4" />
                  <span>{t.story2PlayBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StoryPhone8095ModalProps {
  hud: HudSnapshot;
  onOpenCalendar: () => void;
  onContinueToTable: () => void;
}

export const StoryPhone8095Modal: React.FC<StoryPhone8095ModalProps> = ({
  hud,
  onOpenCalendar,
  onContinueToTable,
}) => {
  if (!hud.story.active || hud.story.storyId !== 'zombie_8095' || !hud.story.zombiePhoneModalOpen) {
    return null;
  }

  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';
  const calendarChecked = hud.story.zombiePhoneCalendarChecked;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 bg-slate-950/88 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border-4 border-slate-700 shadow-[0_24px_80px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Top Phone Status Bar */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px] font-bold text-rose-400">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-slate-300" />
            <span>{t.phone8095Title}</span>
          </div>
          <div className="flex items-center gap-1 text-rose-400 font-black">
            <WifiOff className="w-3.5 h-3.5" />
            <span>0%</span>
          </div>
        </div>

        {/* Phone Screen Body */}
        <div className="p-5 space-y-4">
          {/* Dead Internet Alert Card */}
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/60 text-center space-y-1.5">
            <div className="mx-auto w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-400">
              <WifiOff className="w-6 h-6" />
            </div>
            <div className="text-xs sm:text-sm font-black text-rose-300">{t.phone8095NoNetTitle}</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{t.phone8095NoNetDesc}</p>
          </div>

          {/* Calendar App / Year 8095 Reveal */}
          {!calendarChecked ? (
            <button
              onClick={onOpenCalendar}
              className="w-full p-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-lg cursor-pointer transition-transform"
            >
              <Calendar className="w-5 h-5" />
              <span>{t.phone8095CalendarBtn}</span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-slate-950 border-2 border-amber-400/80 text-center shadow-inner">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-300 uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t.phone8095CalendarTitle}</span>
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-black text-rose-400 tracking-wider tabular-nums">
                  {t.phone8095YearValue}
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">{t.phone8095CalendarShock}</p>
              </div>

              <button
                onClick={onContinueToTable}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <span>{t.phone8095GoTableBtn}</span>
                <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface StoryDialogueBoxProps {
  hud: HudSnapshot;
  onAdvanceDialogue: () => void;
}

export const StoryDialogueBox: React.FC<StoryDialogueBoxProps> = ({ hud, onAdvanceDialogue }) => {
  const dialogue = hud.story.dialogue;
  if (!hud.story.active || !dialogue || hud.phase !== 'playing') return null;

  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';
  const isPhoneCall =
    dialogue.speaker.toLowerCase().includes('phone') || dialogue.speaker.includes('الهاتف');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-x-0 bottom-0 z-30 p-3 sm:p-5 pointer-events-none flex justify-center"
    >
      <div className="pointer-events-auto w-full max-w-3xl rounded-2xl bg-slate-950/95 border-2 border-cyan-400/75 shadow-[0_14px_50px_rgba(0,0,0,0.88)] p-4 sm:p-5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-xs sm:text-sm font-black">
            {isPhoneCall ? (
              <PhoneCall className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : (
              <MessageSquare className="w-4 h-4 text-cyan-300" />
            )}
            <span>{dialogue.speaker}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 tabular-nums">
              {dialogue.index} / {dialogue.total}
            </span>
          </div>
        </div>

        <p className="text-sm sm:text-base md:text-lg font-bold text-white leading-relaxed">
          {dialogue.text}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-slate-400">{t.storyTapEnterHint}</span>
          <button
            onClick={onAdvanceDialogue}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-black text-xs sm:text-sm shadow-lg cursor-pointer transition-transform"
          >
            <span>{t.storyOkEnter}</span>
            <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

interface StoryVictoryModalProps {
  hud: HudSnapshot;
  onGoFreeRoam: () => void;
  onBackToMenu: () => void;
  onZombieGoFreeRoam: () => void;
  onZombieBackToMenu: () => void;
}

export const StoryVictoryModal: React.FC<StoryVictoryModalProps> = ({
  hud,
  onGoFreeRoam,
  onBackToMenu,
  onZombieGoFreeRoam,
  onZombieBackToMenu,
}) => {
  if (!hud.story.active) return null;

  const isZombieExtract = hud.story.storyId === 'zombie_8095' && hud.story.zombieExtractedModal;
  const isBankWin = hud.story.storyId !== 'zombie_8095' && hud.story.justFinishedModal;
  if (!isZombieExtract && !isBankWin) return null;

  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 bg-slate-950/88 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border-2 border-emerald-400/70 p-6 sm:p-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-emerald-400 mb-4">
          {isZombieExtract ? <Skull className="w-8 h-8" /> : <Trophy className="w-8 h-8" />}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-[11px] font-black mb-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isZombieExtract ? t.story2HeaderTag : t.storyHeaderTag}</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white">
          {isZombieExtract ? t.zombieVictoryTitle : t.storyVictoryTitle}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {isZombieExtract ? t.zombieVictoryDesc : t.storyVictoryDesc}
        </p>

        <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50">
          {isZombieExtract && (
            <div className="mb-2 text-xs font-bold text-lime-300">
              {t.zombieKillsLabel}: {hud.story.zombieKills.toLocaleString()}
            </div>
          )}
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {isZombieExtract ? t.zombieLootLabel : t.storyRewardLabel}
          </div>
          <div className="mt-1 text-3xl font-black text-emerald-400 tabular-nums">
            +${(isZombieExtract ? hud.story.zombieLootCash : hud.story.rewardAmount).toLocaleString()}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {isZombieExtract ? (
            <Clock className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Lock className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{isZombieExtract ? t.zombieCooldownNotice : t.storyLockedNotice}</span>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={isZombieExtract ? onZombieGoFreeRoam : onGoFreeRoam}
            className="flex-1 py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-lg"
          >
            {t.storyGoFreeRoam}
          </button>
          <button
            onClick={isZombieExtract ? onZombieBackToMenu : onBackToMenu}
            className="flex-1 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs sm:text-sm border border-slate-700 cursor-pointer"
          >
            {t.storyBackToMenu}
          </button>
        </div>
      </div>
    </div>
  );
};
