import React, { useMemo } from 'react';
import { Columns2, Eye, Grid2X2, MoveHorizontal } from 'lucide-react';
import { AUDITORIUM_SEATS, EXIT_LOCATIONS, TRANSLATIONS } from '../data/cinemaData';
import { CameraMode, Language, SeatData } from '../types/cinema';

interface MiniSeatBarProps {
  lang: Language;
  mode: CameraMode;
  primarySeatId: string;
  selectedSeatIds: string[];
  compareSeatIds: [string, string];
  onFocusSeat: (seatId: string) => void;
  onChangeCompareSeat: (slot: 0 | 1, seatId: string) => void;
  onOpenSeatMap: () => void;
  onToggleCompare: () => void;
}

const COMPARE_PRESETS = [
  { id: 'D10', label: 'D10 · Standard Front' },
  { id: 'J10', label: 'J10 · Premium Center' },
  { id: 'J3', label: 'J3 · Premium Left Wing' },
  { id: 'N9', label: 'N9 · Couple Loveseat' },
  { id: 'P6', label: 'P6 · VIP Recliner' },
  { id: 'R8', label: 'R8 · VIP Back Row' },
  { id: 'A7', label: 'A7 · Accessible Bay' },
];

export const MiniSeatBar: React.FC<MiniSeatBarProps> = ({
  lang,
  mode,
  primarySeatId,
  selectedSeatIds,
  compareSeatIds,
  onFocusSeat,
  onChangeCompareSeat,
  onOpenSeatMap,
  onToggleCompare,
}) => {
  const t = TRANSLATIONS[lang];
  const primarySeat = useMemo(
    () => AUDITORIUM_SEATS.find((s) => s.id === primarySeatId) || AUDITORIUM_SEATS[160],
    [primarySeatId],
  );

  const sameRowSeats = useMemo(
    () => AUDITORIUM_SEATS.filter((s) => s.row === primarySeat.row),
    [primarySeat.row],
  );

  const selectedSet = useMemo(() => new Set(selectedSeatIds), [selectedSeatIds]);

  const nearestExit = useMemo(
    () => EXIT_LOCATIONS.find((e) => e.id === primarySeat.nearestExitId),
    [primarySeat.nearestExitId],
  );

  // Quick tier switcher samples (Standard / Premium / VIP)
  const quickCategorySeats = [
    { id: 'D10', label: t.standard },
    { id: 'J10', label: t.premium },
    { id: 'N9', label: t.couple },
    { id: 'P6', label: t.vip },
    { id: 'A7', label: t.accessible },
  ];

  if (mode === 'compare-seats') {
    const seatA = AUDITORIUM_SEATS.find((s) => s.id === compareSeatIds[0]) || AUDITORIUM_SEATS[160];
    const seatB = AUDITORIUM_SEATS.find((s) => s.id === compareSeatIds[1]) || AUDITORIUM_SEATS[308];

    const renderSideCard = (seat: SeatData, slot: 0 | 1) => (
      <div className="flex-1 min-w-0 px-4 py-2.5 bg-white/95 dark:bg-[#0b0c10]/90 border border-neutral-200 dark:border-white/15 rounded-xl text-neutral-900 dark:text-neutral-100">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
              {slot === 0 ? (lang === 'ar' ? 'المقعد أ' : 'View A') : lang === 'ar' ? 'المقعد ب' : 'View B'}
            </span>
            <select
              value={seat.id}
              onChange={(e) => onChangeCompareSeat(slot, e.target.value)}
              className="text-xs font-medium bg-neutral-100 dark:bg-white/10 border border-neutral-300 dark:border-white/15 rounded-md px-2 py-1 focus:outline-none"
            >
              {COMPARE_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-neutral-900 text-white">
                  {p.label}
                </option>
              ))}
              {selectedSeatIds
                .filter((id) => !COMPARE_PRESETS.some((p) => p.id === id))
                .map((id) => (
                  <option key={id} value={id} className="bg-neutral-900 text-white">
                    {id} · Selected
                  </option>
                ))}
            </select>
          </div>
          <span className="text-xs font-mono-tabular font-semibold text-amber-600 dark:text-amber-300">
            €{seat.price}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-600 dark:text-neutral-400 tabular-nums">
          <span>
            {t.distanceToScreen}: <strong className="text-neutral-900 dark:text-white">{seat.distanceToScreen}m</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            H {seat.horizontalAngleDeg}° / V {seat.verticalAngleDeg}°
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t.sightline}: <strong className="text-emerald-600 dark:text-emerald-400">{seat.sightlineScore}%</strong>
          </span>
        </div>
      </div>
    );

    return (
      <>
        {/* Vertical Split Divider Line */}
        <div className="fixed inset-y-0 left-1/2 w-[1px] bg-white/30 pointer-events-none z-10" />
        {/* Side-by-Side Comparison Telemetry Strip */}
        <div className="fixed top-16 inset-x-4 z-20 flex flex-col sm:flex-row gap-3 pointer-events-none max-w-[1100px] mx-auto">
          <div className="pointer-events-auto flex-1">{renderSideCard(seatA, 0)}</div>
          <div className="pointer-events-auto flex-1">{renderSideCard(seatB, 1)}</div>
        </div>
      </>
    );
  }

  if (mode !== 'seat-preview') return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20 w-[min(780px,94vw)] pointer-events-auto">
      <div className="rounded-xl border border-neutral-200 dark:border-white/12 bg-white/95 dark:bg-[#0b0c10]/90 text-neutral-900 dark:text-neutral-100 px-4 py-2.5 shadow-xl">
        {/* Seated Telemetry Line (Zero-Pill Clean Typography) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-neutral-200/80 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {lang === 'ar' ? `الصف ${primarySeat.row} · مقعد ${primarySeat.number}` : `Row ${primarySeat.row} · Seat ${primarySeat.number}`}
            </span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span>{t[primarySeat.category]} (€{primarySeat.price})</span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span>{primarySeat.distanceToScreen}m</span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span>H {primarySeat.horizontalAngleDeg}° / V {primarySeat.verticalAngleDeg}°</span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {primarySeat.sightlineScore}% {t.sightline}
            </span>
            {nearestExit && (
              <>
                <span aria-hidden="true" className="text-neutral-400 hidden md:inline">·</span>
                <span className="hidden md:inline text-neutral-500 dark:text-neutral-400">
                  {t.nearestExit}: {primarySeat.nearestExitDistance}m
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggleCompare}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-neutral-300 dark:border-white/15 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <Columns2 className="w-3.5 h-3.5" />
              {t.compareSeats}
            </button>
            <button
              onClick={onOpenSeatMap}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Grid2X2 className="w-3.5 h-3.5" />
              {t.seats}
            </button>
          </div>
        </div>

        {/* Mini Interactive Row Switcher (Homage to reference video 00:11-00:20) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <span className="text-[10px] font-mono-tabular text-neutral-400 me-1">
              {primarySeat.row}
            </span>
            {sameRowSeats.map((s) => {
              const isCurrent = s.id === primarySeat.id;
              const isSel = selectedSet.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => onFocusSeat(s.id)}
                  title={`${s.id} · €${s.price}`}
                  className={`w-5 h-5 rounded-[4px] text-[9px] font-mono-tabular transition-colors shrink-0 ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-2 ring-amber-400'
                      : isSel
                        ? 'bg-blue-500/70 text-white'
                        : 'bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-amber-500/30'
                  }`}
                >
                  {s.number}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            {quickCategorySeats.map((q) => (
              <button
                key={q.id}
                onClick={() => onFocusSeat(q.id)}
                className={`px-2 py-1 rounded-md border transition-colors whitespace-nowrap ${
                  primarySeat.id === q.id
                    ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'border-neutral-300 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1">
            <MoveHorizontal className="w-3 h-3" />
            {t.dragToLook}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {lang === 'ar' ? 'انقر على أي مقعد في المشهد ثلاثي الأبعاد للانتقال إليه' : 'Click any 3D seat directly to jump there'}
          </span>
        </div>
      </div>
    </div>
  );
};
