import React, { useMemo, useState } from 'react';
import { Columns2, Eye, Minus, Plus, Sparkles, Ticket, Accessibility } from 'lucide-react';
import { AUDITORIUM_SEATS, TRANSLATIONS } from '../data/cinemaData';
import { Language, MovieItem, SeatCategory, SeatData } from '../types/cinema';

interface SeatMapOverlayProps {
  lang: Language;
  movie: MovieItem;
  showtime: MovieItem['showtimes'][number];
  selectedSeatIds: string[];
  ticketCount: number;
  onTicketCountChange: (count: number) => void;
  onSelectSeat: (seat: SeatData) => void;
  onRecommendBest: () => void;
  onPreviewSeat: () => void;
  onCompareSeats: () => void;
  onProceedBooking: () => void;
}

const ROWS = 'ABCDEFGHIJKLMNOPQR'.split('');

export const SeatMapOverlay: React.FC<SeatMapOverlayProps> = ({
  lang,
  movie,
  showtime,
  selectedSeatIds,
  ticketCount,
  onTicketCountChange,
  onSelectSeat,
  onRecommendBest,
  onPreviewSeat,
  onCompareSeats,
  onProceedBooking,
}) => {
  const t = TRANSLATIONS[lang];
  const [hoveredSeat, setHoveredSeat] = useState<SeatData | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<SeatCategory | 'all'>('all');

  const selectedSet = useMemo(() => new Set(selectedSeatIds), [selectedSeatIds]);

  const rowsData = useMemo(() => {
    return ROWS.map((rowLetter) => {
      const rowSeats = AUDITORIUM_SEATS.filter((s) => s.row === rowLetter);
      return {
        rowLetter,
        left: rowSeats.filter((s) => s.section === 'left'),
        center: rowSeats.filter((s) => s.section === 'center'),
        right: rowSeats.filter((s) => s.section === 'right'),
        category: rowSeats[Math.floor(rowSeats.length / 2)]?.category || 'standard',
      };
    });
  }, []);

  const selectedSeats = useMemo(
    () => AUDITORIUM_SEATS.filter((s) => selectedSet.has(s.id)),
    [selectedSet],
  );

  const totalPrice = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + s.price, 0),
    [selectedSeats],
  );

  const summaryLabel = useMemo(() => {
    if (selectedSeats.length === 0) return lang === 'ar' ? 'اختر مقاعدك من المخطط' : 'Select seats from the map';
    const rows = Array.from(new Set(selectedSeats.map((s) => s.row))).join(', ');
    const nums = selectedSeats.map((s) => s.id).join(', ');
    return lang === 'ar' ? `الصف ${rows} · المقاعد ${nums}` : `Row ${rows} · ${nums}`;
  }, [selectedSeats, lang]);

  const getSeatColor = (s: SeatData) => {
    const isSel = selectedSet.has(s.id);
    if (isSel) return 'bg-blue-600 border-blue-400 text-white shadow-[0_0_12px_rgba(37,99,235,0.65)]';
    if (s.status === 'reserved') return 'bg-neutral-800/70 dark:bg-neutral-800/60 border-neutral-700/40 text-neutral-600 cursor-not-allowed';
    if (s.status === 'unavailable') return 'bg-red-950/50 border-red-900/40 text-red-900 cursor-not-allowed';
    if (categoryFilter !== 'all' && s.category !== categoryFilter) {
      return 'bg-neutral-900/40 border-neutral-800/40 opacity-30';
    }
    switch (s.category) {
      case 'vip':
        return 'bg-amber-950/75 border-amber-500/60 hover:bg-amber-700/80 text-amber-200';
      case 'couple':
        return 'bg-rose-950/75 border-rose-500/55 hover:bg-rose-700/80 text-rose-200';
      case 'premium':
        return 'bg-slate-800/85 border-slate-500/60 hover:bg-blue-500/40 text-slate-200';
      case 'accessible':
        return 'bg-sky-950/80 border-sky-400/70 hover:bg-sky-700/80 text-sky-200';
      default:
        return 'bg-neutral-900/85 border-neutral-600/50 hover:border-amber-400/80 text-neutral-300';
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-3 pt-16 pb-24">
      <div className="pointer-events-auto w-full max-w-[940px] max-h-full flex flex-col rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-[#0b0c10]/90 text-neutral-900 dark:text-neutral-100 shadow-2xl overflow-hidden">
        {/* Top Movie & Ticket Quantity Header (Homage to reference video) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate">
              {lang === 'ar' ? movie.titleAr : movie.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              <span>{showtime.date}</span>
              <span aria-hidden="true">·</span>
              <span>{showtime.time}</span>
              <span aria-hidden="true">·</span>
              <span>{showtime.hall}</span>
              <span aria-hidden="true">·</span>
              <span>352 {lang === 'ar' ? 'مقعد' : 'seats'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onRecommendBest}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t.suggestBestSeats}
            </button>

            <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-neutral-300 dark:border-white/15 bg-neutral-100 dark:bg-white/5">
              <button
                onClick={() => onTicketCountChange(Math.max(1, ticketCount - 1))}
                aria-label="Decrease tickets"
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-medium tabular-nums min-w-[64px] text-center">
                {ticketCount} {t.tickets}
              </span>
              <button
                onClick={() => onTicketCountChange(Math.min(8, ticketCount + 1))}
                aria-label="Increase tickets"
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center justify-between gap-3 px-5 py-2 border-b border-neutral-200/70 dark:border-white/5 bg-neutral-50/70 dark:bg-black/25 overflow-x-auto">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-200/70 dark:bg-white/5">
            {(['all', 'standard', 'premium', 'couple', 'vip', 'accessible'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {cat === 'all' ? (lang === 'ar' ? 'الكل (352)' : 'All (352)') : t[cat]}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0 tabular-nums">
            {hoveredSeat ? (
              <span>
                <strong className="text-neutral-900 dark:text-white">{hoveredSeat.id}</strong>
                {' · '}
                {t[hoveredSeat.category]}
                {' · '}€{hoveredSeat.price}
                {' · '}
                {hoveredSeat.distanceToScreen}m
                {' · '}
                {hoveredSeat.sightlineScore}% {t.sightline}
              </span>
            ) : (
              <span>{t.demoNotice}</span>
            )}
          </div>
        </div>

        {/* Curved Screen & 18-Row Synchronized 352-Seat Grid */}
        <div className="flex-1 overflow-auto cinema-scroll px-4 py-3 flex flex-col items-center">
          {/* Illuminated Curved Screen Graphic */}
          <div className="w-full max-w-[680px] mb-3 flex flex-col items-center">
            <div className="w-[82%] h-2 rounded-t-full bg-gradient-to-r from-transparent via-amber-300/80 to-transparent shadow-[0_6px_22px_rgba(229,184,105,0.45)]" />
            <span className="mt-1 text-[10px] tracking-[0.22em] text-neutral-500 dark:text-neutral-400 font-medium">
              {t.screenLabel}
            </span>
          </div>

          <div className="flex flex-col gap-[5px] min-w-[620px]">
            {rowsData.map((row) => (
              <div key={row.rowLetter} className="flex items-center justify-center gap-3">
                <span className="w-4 text-[10px] font-mono-tabular text-neutral-400 text-center shrink-0">
                  {row.rowLetter}
                </span>

                {/* Left Wing */}
                <div className="flex items-center gap-[3px] justify-end w-[112px]">
                  {row.left.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.status !== 'available'}
                      onClick={() => onSelectSeat(s)}
                      onMouseEnter={() => setHoveredSeat(s)}
                      onMouseLeave={() => setHoveredSeat(null)}
                      title={`${s.id} · ${t[s.category]} · €${s.price}`}
                      className={`h-[18px] ${
                        s.category === 'vip' ? 'w-[22px]' : 'w-[18px]'
                      } rounded-[4px] border text-[8px] font-mono-tabular flex items-center justify-center transition-transform active:scale-90 ${getSeatColor(s)}`}
                    >
                      {selectedSet.has(s.id) ? s.number : ''}
                    </button>
                  ))}
                </div>

                {/* Center Section */}
                <div className="flex items-center gap-[3px] justify-center w-[280px]">
                  {row.center.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.status !== 'available'}
                      onClick={() => onSelectSeat(s)}
                      onMouseEnter={() => setHoveredSeat(s)}
                      onMouseLeave={() => setHoveredSeat(null)}
                      title={`${s.id} · ${t[s.category]} · €${s.price}`}
                      className={`h-[18px] ${
                        s.category === 'vip'
                          ? 'w-[26px]'
                          : s.category === 'couple'
                            ? 'w-[21px]'
                            : 'w-[19px]'
                      } rounded-[4px] border text-[8px] font-mono-tabular flex items-center justify-center transition-transform active:scale-90 ${getSeatColor(s)}`}
                    >
                      {s.isAccessible ? (
                        <Accessibility className="w-2.5 h-2.5" />
                      ) : selectedSet.has(s.id) ? (
                        s.number
                      ) : (
                        ''
                      )}
                    </button>
                  ))}
                </div>

                {/* Right Wing */}
                <div className="flex items-center gap-[3px] justify-start w-[112px]">
                  {row.right.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.status !== 'available'}
                      onClick={() => onSelectSeat(s)}
                      onMouseEnter={() => setHoveredSeat(s)}
                      onMouseLeave={() => setHoveredSeat(null)}
                      title={`${s.id} · ${t[s.category]} · €${s.price}`}
                      className={`h-[18px] ${
                        s.category === 'vip' ? 'w-[22px]' : 'w-[18px]'
                      } rounded-[4px] border text-[8px] font-mono-tabular flex items-center justify-center transition-transform active:scale-90 ${getSeatColor(s)}`}
                    >
                      {selectedSet.has(s.id) ? s.number : ''}
                    </button>
                  ))}
                </div>

                <span className="w-4 text-[10px] font-mono-tabular text-neutral-400 text-center shrink-0">
                  {row.rowLetter}
                </span>
              </div>
            ))}
          </div>

          {/* Clean Legend */}
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-neutral-900 border border-neutral-500" />
              {t.standard} (€14)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-slate-800 border border-slate-500" />
              {t.premium} (€19)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-rose-950 border border-rose-500" />
              {t.couple} (€26)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-amber-950 border border-amber-500" />
              {t.vip} (€32)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-sky-950 border border-sky-400" />
              {t.accessible} (€12)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-blue-600 border border-blue-400" />
              {t.selected}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-neutral-800/70 border border-neutral-700/40" />
              {t.reserved}
            </span>
          </div>
        </div>

        {/* Bottom Reference-Video Action Bar */}
        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-black/35 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{summaryLabel}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {selectedSeats.length > 0
                ? `${selectedSeats.length} ${t.tickets} · €${totalPrice.toFixed(2)}`
                : lang === 'ar'
                  ? 'انقر على أي مقعد متاح للمعاينة'
                  : 'Click any available seat to preview perspective'}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onCompareSeats}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium rounded-xl border border-neutral-300 dark:border-white/15 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <Columns2 className="w-4 h-4" />
              {t.compareSeats}
            </button>

            <button
              onClick={onPreviewSeat}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-white/20 bg-neutral-900/10 dark:bg-white/10 hover:bg-neutral-900/20 dark:hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              <Eye className="w-4 h-4" />
              {t.previewMySeat}
            </button>

            <button
              onClick={onProceedBooking}
              disabled={selectedSeats.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap tabular-nums"
            >
              <Ticket className="w-4 h-4" />
              {t.bookTickets} · €{totalPrice.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
