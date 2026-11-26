import React from 'react';
import { ArrowRight, CheckCircle2, Lock, MessageSquare, PhoneCall, Trophy } from 'lucide-react';
import { HudSnapshot } from '../game/types';
import { getText } from '../i18n/translations';

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
}

export const StoryVictoryModal: React.FC<StoryVictoryModalProps> = ({
  hud,
  onGoFreeRoam,
  onBackToMenu,
}) => {
  if (!hud.story.active || !hud.story.justFinishedModal) return null;

  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 bg-slate-950/88 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border-2 border-emerald-400/70 p-6 sm:p-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-emerald-400 mb-4">
          <Trophy className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-[11px] font-black mb-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.storyHeaderTag}</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white">{t.storyVictoryTitle}</h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">{t.storyVictoryDesc}</p>

        <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-emerald-500/50">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {t.storyRewardLabel}
          </div>
          <div className="mt-1 text-3xl font-black text-emerald-400 tabular-nums">
            +${hud.story.rewardAmount.toLocaleString()}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>{t.storyLockedNotice}</span>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={onGoFreeRoam}
            className="flex-1 py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-lg"
          >
            {t.storyGoFreeRoam}
          </button>
          <button
            onClick={onBackToMenu}
            className="flex-1 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs sm:text-sm border border-slate-700 cursor-pointer"
          >
            {t.storyBackToMenu}
          </button>
        </div>
      </div>
    </div>
  );
};
