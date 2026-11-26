import React, { useEffect, useState } from 'react';
import { Download, Globe, RotateCcw, Save, Users } from 'lucide-react';
import { Language } from '../game/types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getText } from '../i18n/translations';

interface TitleScreenProps {
  language: Language;
  hasSavedGame: boolean;
  savedMoney: number;
  savedMissions: number;
  totalMissions: number;
  onSetLanguage: (lang: Language) => void;
  onStart: () => void;
  onNewGame: () => void;
  onOpenMultiplayer: () => void;
  onDownloadHtml: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  language,
  hasSavedGame,
  savedMoney,
  savedMissions,
  totalMissions,
  onSetLanguage,
  onStart,
  onNewGame,
  onOpenMultiplayer,
  onDownloadHtml,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const t = getText(language);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-14 pointer-events-none bg-gradient-to-b from-slate-950/65 via-transparent to-slate-950/85"
    >
      {/* Top Row: Bespoke CityWorld SVG Lockup + Language Switcher */}
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-xl pointer-events-auto">
          <svg
            viewBox="0 0 460 110"
            className="w-64 md:w-[420px] h-auto drop-shadow-[0_6px_24px_rgba(0,0,0,0.65)]"
            aria-label="CityWorld"
          >
            <defs>
              <linearGradient id="cwTitleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="65%" stopColor="#bae6fd" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <path
              d="M14 78 V44 H26 V26 H38 V48 H48 V18 H64 V54 H74 V34 H88 V78 Z"
              fill="#38bdf8"
              fillOpacity="0.9"
            />
            <rect x="10" y="78" width="84" height="4" rx="2" fill="#f59e0b" />
            <text
              x="108"
              y="62"
              fill="url(#cwTitleGrad)"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="900"
              fontSize="52"
              letterSpacing="-1.5"
            >
              CITYWORLD
            </text>
            <text
              x="110"
              y="84"
              fill="#cbd5e1"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
              fontSize="13"
              letterSpacing="2.8"
            >
              {t.titleSubtitle}
            </text>
          </svg>
          <p className="mt-3 text-xs md:text-base text-slate-200/90 max-w-md leading-relaxed">
            {t.titleDesc}
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/85 border border-cyan-400/40 text-[11px] font-bold text-cyan-300">
            <span>v7.2</span>
            <span className="text-slate-400">·</span>
            <span>
              {language === 'ar'
                ? 'سينتيناريو 419 + شرطة وطائرات حربية + 5 روبوتات + أونلاين'
                : 'Centenario 419 + Fighter Jets & Wanted + 5 Robots + Online'}
            </span>
          </div>
        </div>

        <button
          onClick={() => onSetLanguage(language === 'ar' ? 'en' : 'ar')}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-600 text-slate-100 text-xs md:text-sm font-bold shadow-lg cursor-pointer shrink-0"
        >
          <Globe className="w-4 h-4 text-amber-400" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      {/* Bottom CTA & Flat Control Hint Line */}
      <div className="flex flex-col items-start gap-3 pointer-events-auto">
        {hasSavedGame && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900/90 border border-emerald-400/50 text-xs font-bold text-emerald-300 shadow-lg">
            <Save className="w-3.5 h-3.5" />
            <span>
              {t.savedSummaryPrefix}: ${savedMoney.toLocaleString()} · {savedMissions}/{totalMissions} {t.missionsDone}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onStart}
            className="px-7 py-3.5 md:px-8 md:py-4 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-extrabold text-base md:text-lg tracking-wide uppercase shadow-xl transition-transform cursor-pointer"
          >
            {hasSavedGame ? t.continueWorld : t.enterWorld}
          </button>

          <button
            onClick={onOpenMultiplayer}
            className="flex items-center gap-2 px-6 py-3.5 md:px-7 md:py-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-extrabold text-base md:text-lg tracking-wide shadow-xl border border-emerald-200 transition-transform cursor-pointer"
          >
            <Users className="w-5 h-5" />
            <span>{t.multiplayerBtn}</span>
          </button>

          {hasSavedGame && !confirmReset && (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 px-4 py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-600 text-slate-200 font-bold text-xs md:text-sm shadow-lg cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-rose-400" />
              <span>{t.startNewGame}</span>
            </button>
          )}

          {hasSavedGame && confirmReset && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-950/90 border border-rose-500/70 shadow-lg">
              <span className="text-xs font-bold text-rose-200">{t.confirmResetLabel}</span>
              <button
                onClick={() => {
                  setConfirmReset(false);
                  onNewGame();
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
              >
                {t.startNewGame}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                {t.cancelLabel}
              </button>
            </div>
          )}

          <button
            onClick={onDownloadHtml}
            className="flex items-center gap-2 px-4 py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-cyan-400/60 text-cyan-300 font-bold text-xs md:text-sm shadow-lg cursor-pointer"
            title={t.downloadHtmlHint}
          >
            <Download className="w-4 h-4" />
            <span>{t.downloadHtmlBtn}</span>
          </button>

          {!isInstalled && isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-2 px-5 py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-sky-400/70 text-sky-300 font-bold text-sm shadow-lg cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t.installApp}</span>
            </button>
          )}

          {!isInstalled && !isInstallable && isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="flex items-center gap-2 px-4 py-3.5 rounded-lg bg-slate-900/90 border border-sky-400/70 text-sky-300 font-bold text-sm shadow-lg cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{t.addToHome}</span>
            </button>
          )}
        </div>

        <div className="text-[11px] md:text-sm font-medium text-slate-200/90 tracking-wide bg-slate-950/80 px-3.5 py-2 rounded-md border border-slate-700/70">
          {t.titleHint}
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-5 pointer-events-auto">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-xl p-6 text-slate-100 shadow-2xl">
            <h3 className="text-base font-extrabold text-white">{t.iosTitle}</h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {t.iosStep1}
              <br />
              {t.iosStep2}
              <br />
              {t.iosStep3}
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full py-2.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-xs uppercase cursor-pointer"
            >
              {t.gotIt}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
