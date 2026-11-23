import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Navigation, Car, Crosshair, Sparkles, ShoppingBag, Home } from 'lucide-react';
import { HudSnapshot } from '../game/types';
import { DISTRICTS, INTERIOR_PORTALS, ROAD_SEGMENTS } from '../game/world/worldLayout';
import { getText } from '../i18n/translations';

interface WorldMapModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onSetWaypoint: (pt: { x: number; z: number } | null) => void;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({ hud, onClose, onSetWaypoint }) => {
  const [zoom, setZoom] = useState(1);
  const t = getText(hud.language);
  const isRtl = hud.language === 'ar';

  // World coordinate space covering mainland + southern Palm Cove Island:
  // x: [-740..740] (span 1480), z: [-580..900] (span 1480) -> SVG [0..800]
  const toSvg = (wx: number, wz: number) => ({
    x: ((wx + 740) / 1480) * 800,
    y: ((wz + 580) / 1480) * 800,
  });

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const wx = Math.round(nx * 1480 - 740);
    const wz = Math.round(ny * 1480 - 580);
    onSetWaypoint({ x: wx, z: wz });
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-0 z-30 bg-slate-950/92 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 className="text-lg font-extrabold tracking-wide text-white">{t.atlasTitle}</h2>
            <p className="text-xs text-slate-400">
              {t.atlasSub} · {isRtl ? hud.district.nameAr : hud.district.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.25).toFixed(2)))}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold tabular-nums text-slate-300 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.25).toFixed(2)))}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {hud.customWaypoint && (
              <button
                onClick={() => onSetWaypoint(null)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" /> {t.clearWaypoint}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded bg-slate-800 hover:bg-rose-600 text-slate-200 cursor-pointer"
              title="Close Map (M)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick GPS Destinations Strip */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-400 shrink-0">{t.quickGps}</span>
          {INTERIOR_PORTALS.filter(
            (p) =>
              p.kind === 'dealership' ||
              p.kind === 'garage' ||
              p.kind === 'house' ||
              p.kind === 'gunshop' ||
              p.kind === 'skins' ||
              p.id === 'market_downtown'
          ).map((p) => {
            const isDealer = p.kind === 'dealership' || p.kind === 'garage';
            const isHouse = p.kind === 'house';
            return (
              <button
                key={p.id}
                onClick={() => onSetWaypoint({ x: p.exteriorPos.x, z: p.exteriorPos.z })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold shrink-0 cursor-pointer border ${
                  p.kind === 'dealership'
                    ? 'bg-sky-500/20 border-sky-400/70 text-sky-200 hover:bg-sky-500/35'
                    : p.kind === 'garage'
                      ? 'bg-amber-500/20 border-amber-400/70 text-amber-200 hover:bg-amber-500/35'
                      : isHouse
                        ? 'bg-orange-500/20 border-orange-400/70 text-orange-200 hover:bg-orange-500/35'
                        : p.kind === 'gunshop'
                          ? 'bg-rose-500/20 border-rose-400/70 text-rose-200 hover:bg-rose-500/35'
                          : p.kind === 'skins'
                            ? 'bg-yellow-500/20 border-yellow-400/70 text-yellow-200 hover:bg-yellow-500/35'
                            : 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200 hover:bg-emerald-500/35'
                }`}
              >
                {isDealer ? (
                  <Car className="w-3.5 h-3.5" />
                ) : isHouse ? (
                  <Home className="w-3.5 h-3.5" />
                ) : p.kind === 'gunshop' ? (
                  <Crosshair className="w-3.5 h-3.5" />
                ) : p.kind === 'skins' ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : (
                  <ShoppingBag className="w-3.5 h-3.5" />
                )}
                <span>{isRtl ? p.nameAr : p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Map Canvas */}
        <div className="flex-1 overflow-auto bg-[#1b2b1e] flex items-center justify-center p-4">
          <div
            style={{ width: `${zoom * 640}px`, height: `${zoom * 640}px` }}
            className="relative shrink-0 transition-[width,height] duration-150 border border-slate-700 rounded-lg overflow-hidden shadow-inner"
          >
            <svg
              viewBox="0 0 800 800"
              onClick={handleSvgClick}
              className="w-full h-full cursor-crosshair bg-[#29432d]"
            >
              {/* Ocean South + World Sea Border */}
              <rect x={0} y={toSvg(0, 345).y} width={800} height={500} fill="#0c4a6e" opacity={0.92} />

              {/* Districts (Mainland & Island) */}
              {DISTRICTS.filter((d) => d.id !== 'highway' && d.id !== 'island').map((d) => {
                const tl = toSvg(d.bounds.minX, d.bounds.minZ);
                const br = toSvg(d.bounds.maxX, d.bounds.maxZ);
                return (
                  <g key={d.id}>
                    <rect
                      x={tl.x}
                      y={tl.y}
                      width={br.x - tl.x}
                      height={br.y - tl.y}
                      fill={d.mapColor}
                      opacity={0.75}
                      stroke="#1e293b"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {/* Palm Cove Island sandy landmass & Airstrip */}
              <ellipse
                cx={toSvg(-180, 760).x}
                cy={toSvg(-180, 760).y}
                rx={64}
                ry={52}
                fill="#eab308"
                opacity={0.85}
                stroke="#fde047"
                strokeWidth={2}
              />
              <ellipse
                cx={toSvg(-180, 760).x}
                cy={toSvg(-180, 760).y}
                rx={46}
                ry={36}
                fill="#22c55e"
                opacity={0.45}
              />
              <rect
                x={toSvg(-180, 686).x - 8}
                y={toSvg(-180, 686).y}
                width={16}
                height={toSvg(-180, 822).y - toSvg(-180, 686).y}
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth={1.5}
              />

              {/* Mainland World Border Perimeter */}
              <rect
                x={toSvg(-532, -532).x}
                y={toSvg(-532, -532).y}
                width={toSvg(532, 532).x - toSvg(-532, -532).x}
                height={toSvg(532, 532).y - toSvg(-532, -532).y}
                fill="none"
                stroke="#f87171"
                strokeWidth={2}
                strokeDasharray="8 6"
                opacity={0.85}
              />

              {/* Airport Runway */}
              <rect
                x={toSvg(235, -330).x}
                y={toSvg(235, -330).y}
                width={130}
                height={22}
                fill="#1e293b"
                stroke="#e2e8f0"
                strokeDasharray="6 4"
              />

              {/* Roads & Highways */}
              {ROAD_SEGMENTS.map((seg) => {
                const p1 = toSvg(seg.x1, seg.z1);
                const p2 = toSvg(seg.x2, seg.z2);
                return (
                  <line
                    key={seg.id}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={seg.isHighway ? '#f59e0b' : '#64748b'}
                    strokeWidth={seg.isHighway ? 6 : 4}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Road-Only GPS Navigation Route */}
              {hud.gpsPath.length >= 2 && (
                <polyline
                  points={hud.gpsPath
                    .map((pt) => {
                      const p = toSvg(pt.x, pt.z);
                      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="10 6"
                />
              )}

              {/* District Labels */}
              {DISTRICTS.filter((d) => d.id !== 'highway').map((d) => {
                const c = toSvg(d.center.x, d.center.z);
                return (
                  <text
                    key={`lbl_${d.id}`}
                    x={c.x}
                    y={c.y}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fillOpacity={0.75}
                    fontSize="13"
                    fontWeight="800"
                    letterSpacing="0.8"
                  >
                    {isRtl ? d.nameAr : d.name.toUpperCase()}
                  </text>
                );
              })}

              {/* World Markers */}
              {hud.markers.map((m) => {
                const pt = toSvg(m.x, m.z);
                if (m.type === 'player') {
                  return (
                    <g
                      key="player"
                      transform={`translate(${pt.x}, ${pt.y}) rotate(${(-hud.playerPos.heading * 180) / Math.PI + 180})`}
                    >
                      <polygon points="0,-10 7,8 0,4 -7,8" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
                    </g>
                  );
                }
                const isDealer =
                  m.type === 'interior' && (m.interiorKind === 'dealership' || m.interiorKind === 'garage');
                const color =
                  m.type === 'police'
                    ? '#ef4444'
                    : m.type === 'objective'
                      ? '#38bdf8'
                      : m.type === 'mission'
                        ? '#facc15'
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
                          : m.type === 'waypoint'
                            ? '#c084fc'
                            : '#94a3b8';
                return (
                  <g key={m.id}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={m.type === 'vehicle' ? 4 : isDealer ? 9 : 6}
                      fill={color}
                      stroke={isDealer ? '#ffffff' : '#0f172a'}
                      strokeWidth={isDealer ? 2 : 1.2}
                    />
                    {m.label && m.type !== 'vehicle' && (
                      <text
                        x={pt.x}
                        y={pt.y - (isDealer ? 12 : 9)}
                        textAnchor="middle"
                        fill={isDealer ? '#7dd3fc' : '#f8fafc'}
                        fontSize={isDealer ? '11' : '10'}
                        fontWeight={isDealer ? '900' : '700'}
                      >
                        {m.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-300">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-white inline-block" /> {t.legend.player}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-400 border border-white inline-block" /> {t.legend.dealer}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> {t.legend.house}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> {t.legend.interior}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> {t.legend.mission}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> {t.legend.objective}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> {t.legend.police}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" /> {t.legend.waypoint}</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded bg-cyan-400 inline-block" /> {t.legend.gpsRoute}</span>
        </div>
      </div>
    </div>
  );
};
