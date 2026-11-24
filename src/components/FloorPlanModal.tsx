import React, { useState } from 'react';
import { Compass, Layers, MapPin, Navigation, X } from 'lucide-react';
import { EXIT_LOCATIONS, TRANSLATIONS } from '../data/cinemaData';
import { Language, WayfindingState } from '../types/cinema';

interface FloorPlanModalProps {
  lang: Language;
  userPose: { x: number; y: number; z: number; yaw: number; zone: 'exterior' | 'lobby' | 'auditorium' };
  wayfinding: WayfindingState;
  onTeleport: (x: number, z: number) => void;
  onTriggerExitRoute: (accessibleOnly: boolean) => void;
  onClose: () => void;
}

// Map world coordinates (X: -26..26, Z: -22..62) into SVG space (0..520, 0..420)
const toSvgX = (wx: number) => ((wx + 26) / 52) * 480 + 20;
const toSvgY = (wz: number) => ((wz + 22) / 84) * 380 + 20;

export const FloorPlanModal: React.FC<FloorPlanModalProps> = ({
  lang,
  userPose,
  wayfinding,
  onTeleport,
  onTriggerExitRoute,
  onClose,
}) => {
  const t = TRANSLATIONS[lang];
  const [viewMode, setViewMode] = useState<'topdown' | 'isometric'>('topdown');
  const [zoom, setZoom] = useState(1);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 520;
    const sy = ((e.clientY - rect.top) / rect.height) * 420;
    const wx = ((sx - 20) / 480) * 52 - 26;
    const wz = ((sy - 20) / 380) * 84 - 22;
    onTeleport(wx, wz);
  };

  const ux = toSvgX(userPose.x);
  const uy = toSvgY(userPose.z);

  const wayPointsStr = wayfinding.active
    ? wayfinding.points.map((p) => `${toSvgX(p[0])},${toSvgY(p[2])}`).join(' ')
    : '';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/55 pointer-events-auto">
      <div className="w-full max-w-[820px] rounded-2xl border border-neutral-200 dark:border-white/12 bg-white dark:bg-[#0d0e13] text-neutral-900 dark:text-neutral-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 dark:border-white/10">
          <div>
            <h3 className="text-base font-semibold">{t.floorPlan}</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {lang === 'ar'
                ? 'انقر على أي منطقة للانتقال الفوري داخل المبنى ثلاثي الأبعاد'
                : 'Click any accessible area on the blueprint to glide directly to that location'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-white/10">
              <button
                onClick={() => setViewMode('topdown')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  viewMode === 'topdown'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {lang === 'ar' ? 'مسقط أفقي' : 'Top-Down'}
              </button>
              <button
                onClick={() => setViewMode('isometric')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  viewMode === 'isometric'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {lang === 'ar' ? 'منظور أيزومتري 3D' : '3D Isometric'}
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label="Close floor plan"
              className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Blueprint Canvas */}
        <div className="flex-1 overflow-hidden bg-neutral-950 relative flex items-center justify-center p-4 min-h-[380px]">
          <div
            className="transition-transform duration-300"
            style={{
              transform:
                viewMode === 'isometric'
                  ? `scale(${zoom * 0.92}) perspective(900px) rotateX(46deg) rotateZ(-28deg)`
                  : `scale(${zoom})`,
            }}
          >
            <svg
              viewBox="0 0 520 420"
              onClick={handleSvgClick}
              className="w-[min(560px,84vw)] h-auto cursor-crosshair select-none"
            >
              {/* Architectural Grid */}
              <defs>
                <pattern id="fpGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.7" />
                </pattern>
              </defs>
              <rect x="0" y="0" width="520" height="420" fill="#0b0d12" />
              <rect x="0" y="0" width="520" height="420" fill="url(#fpGrid)" />

              {/* Main Auditorium Footprint */}
              <rect
                x={toSvgX(-13)}
                y={toSvgY(-20)}
                width={toSvgX(13) - toSvgX(-13)}
                height={toSvgY(14) - toSvgY(-20)}
                fill="#141720"
                stroke="#475569"
                strokeWidth="1.5"
              />
              {/* Giant Curved Screen */}
              <path
                d={`M ${toSvgX(-10)} ${toSvgY(-19)} Q ${toSvgX(0)} ${toSvgY(-17.8)} ${toSvgX(10)} ${toSvgY(-19)}`}
                fill="none"
                stroke="#e5b869"
                strokeWidth="3.5"
              />
              <text x={toSvgX(0)} y={toSvgY(-16.6)} fill="#e5b869" fontSize="8" textAnchor="middle" fontWeight="600">
                IMAX LASER SCREEN
              </text>

              {/* Seating Tier Bands */}
              <rect x={toSvgX(-11)} y={toSvgY(-13.6)} width={toSvgX(11) - toSvgX(-11)} height={toSvgY(-5.6) - toSvgY(-13.6)} fill="#1e293b" opacity="0.65" />
              <rect x={toSvgX(-11)} y={toSvgY(-5.2)} width={toSvgX(11) - toSvgX(-11)} height={toSvgY(4.4) - toSvgY(-5.2)} fill="#1d4ed8" opacity="0.28" />
              <rect x={toSvgX(-11)} y={toSvgY(4.8)} width={toSvgX(11) - toSvgX(-11)} height={toSvgY(11.4) - toSvgY(4.8)} fill="#92400e" opacity="0.45" />
              <text x={toSvgX(0)} y={toSvgY(-9.4)} fill="#94a3b8" fontSize="8" textAnchor="middle">STANDARD (A–F)</text>
              <text x={toSvgX(0)} y={toSvgY(0.2)} fill="#93c5fd" fontSize="8" textAnchor="middle">PREMIUM &amp; COUPLE (G–N)</text>
              <text x={toSvgX(0)} y={toSvgY(8.4)} fill="#fcd34d" fontSize="8" textAnchor="middle">VIP RECLINERS (O–R)</text>

              {/* Twin Acoustic Corridors (Accessible Step-Free Routes) */}
              <rect
                x={toSvgX(-16)}
                y={toSvgY(-16.5)}
                width={toSvgX(-13) - toSvgX(-16)}
                height={toSvgY(16) - toSvgY(-16.5)}
                fill="#182230"
                stroke="#38bdf8"
                strokeDasharray="3 2"
                strokeWidth="1"
              />
              <rect
                x={toSvgX(13)}
                y={toSvgY(-16.5)}
                width={toSvgX(16) - toSvgX(13)}
                height={toSvgY(16) - toSvgY(-16.5)}
                fill="#182230"
                stroke="#38bdf8"
                strokeDasharray="3 2"
                strokeWidth="1"
              />

              {/* Grand Lobby */}
              <rect
                x={toSvgX(-18)}
                y={toSvgY(16)}
                width={toSvgX(18) - toSvgX(-18)}
                height={toSvgY(36) - toSvgY(16)}
                fill="#171922"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <text x={toSvgX(0)} y={toSvgY(26.5)} fill="#cbd5e1" fontSize="9" textAnchor="middle" fontWeight="600">
                GRAND LOBBY &amp; LOUNGE
              </text>

              {/* Ticket Counters, Concessions, VIP Lounge, Restrooms */}
              <rect x={toSvgX(-16.5)} y={toSvgY(23.5)} width="38" height="32" fill="#272c38" stroke="#94a3b8" strokeWidth="0.8" />
              <text x={toSvgX(-14.2)} y={toSvgY(27.5)} fill="#cbd5e1" fontSize="7" textAnchor="middle">TICKETS</text>

              <rect x={toSvgX(11.5)} y={toSvgY(22.0)} width="42" height="36" fill="#2f271b" stroke="#f59e0b" strokeWidth="0.8" />
              <text x={toSvgX(14.0)} y={toSvgY(26.0)} fill="#fcd34d" fontSize="7" textAnchor="middle">SNACKS</text>

              <rect x={toSvgX(9.5)} y={toSvgY(16.6)} width="62" height="22" fill="#311f2c" stroke="#f472b6" strokeWidth="0.8" />
              <text x={toSvgX(13.2)} y={toSvgY(19.2)} fill="#fbcfe8" fontSize="7" textAnchor="middle">VIP LOUNGE</text>

              <rect x={toSvgX(-16.5)} y={toSvgY(16.6)} width="52" height="22" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.8" />
              <text x={toSvgX(-13.4)} y={toSvgY(19.2)} fill="#7dd3fc" fontSize="7" textAnchor="middle">WC / ACCESS</text>

              {/* Exterior Arrival Plaza & Parking */}
              <rect
                x={toSvgX(-24)}
                y={toSvgY(36)}
                width={toSvgX(24) - toSvgX(-24)}
                height={toSvgY(60) - toSvgY(36)}
                fill="#111319"
                stroke="#334155"
                strokeDasharray="4 3"
              />
              <text x={toSvgX(0)} y={toSvgY(47.5)} fill="#94a3b8" fontSize="8.5" textAnchor="middle">
                EXTERIOR PLAZA · DROP-OFF · ACCESSIBLE PARKING
              </text>

              {/* Emergency Exits */}
              {EXIT_LOCATIONS.map((ex) => (
                <g key={ex.id}>
                  <circle cx={toSvgX(ex.position[0])} cy={toSvgY(ex.position[2])} r="5" fill="#10b981" />
                  <text
                    x={toSvgX(ex.position[0])}
                    y={toSvgY(ex.position[2]) - 7}
                    fill="#34d399"
                    fontSize="6.5"
                    textAnchor="middle"
                  >
                    EXIT
                  </text>
                </g>
              ))}

              {/* Active Wayfinding Path */}
              {wayfinding.active && wayPointsStr && (
                <polyline
                  points={wayPointsStr}
                  fill="none"
                  stroke={wayfinding.mode === 'exit' ? '#34d399' : '#60a5fa'}
                  strokeWidth="3"
                  strokeDasharray="6 3"
                />
              )}

              {/* Live User Position Marker & View Direction */}
              <g transform={`translate(${ux}, ${uy})`}>
                <circle r="7" fill="rgba(59,130,246,0.28)" />
                <circle r="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            </svg>
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-3 end-3 flex items-center gap-1.5 bg-neutral-900/90 border border-white/15 rounded-lg p-1 text-white text-xs">
            <button onClick={() => setZoom((z) => Math.max(0.75, z - 0.15))} className="px-2 py-1 hover:bg-white/10 rounded">
              −
            </button>
            <span className="font-mono-tabular px-1">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))} className="px-2 py-1 hover:bg-white/10 rounded">
              +
            </button>
          </div>
        </div>

        {/* Quick Teleport & Accessible Routing Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: lang === 'ar' ? 'الساحة الخارجية' : 'Exterior', x: 0, z: 48 },
              { label: lang === 'ar' ? 'البهو الرئيسي' : 'Grand Lobby', x: 0, z: 28 },
              { label: lang === 'ar' ? 'ركن الفشار' : 'Concessions', x: 8, z: 25 },
              { label: lang === 'ar' ? 'صالة VIP' : 'VIP Lounge', x: 12, z: 19 },
              { label: lang === 'ar' ? 'وسط القاعة' : 'Auditorium Center', x: 0, z: -2 },
            ].map((loc) => (
              <button
                key={loc.label}
                onClick={() => {
                  onTeleport(loc.x, loc.z);
                  onClose();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
              >
                <MapPin className="w-3 h-3 text-amber-500" />
                {loc.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onTriggerExitRoute(true);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              {t.accessibleRoute}
            </button>
            <span className="hidden sm:flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
              <Compass className="w-3.5 h-3.5" />
              <Layers className="w-3.5 h-3.5" />
              {userPose.zone}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
