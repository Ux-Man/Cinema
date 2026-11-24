import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Film,
  Minus,
  Navigation,
  Plus,
  Popcorn,
  ShoppingBag,
  Ticket,
  X,
} from 'lucide-react';
import {
  AUDITORIUM_SEATS,
  CONCESSION_ITEMS,
  DEMO_MOVIES,
  TRANSLATIONS,
} from '../data/cinemaData';
import {
  BookingConfirmation,
  CartItem,
  Language,
  MovieItem,
} from '../types/cinema';

interface BookingFlowModalProps {
  lang: Language;
  initialTab: 'movies' | 'concessions' | 'booking';
  selectedMovie: MovieItem;
  selectedShowtimeId: string;
  selectedSeatIds: string[];
  cart: CartItem[];
  onSelectMovie: (movie: MovieItem, showtimeId: string) => void;
  onUpdateCart: (itemId: string, sizeIndex: number, delta: number) => void;
  onOpenSeatMap: () => void;
  onConfirmBooking: (confirmation: BookingConfirmation) => void;
  onGuideToSeat: () => void;
  onClose: () => void;
}

// Deterministic crisp SVG QR code matrix for demonstration digital ticket
const DemoQrSvg: React.FC<{ code: string }> = ({ code }) => {
  const size = 21;
  const cells: boolean[][] = useMemo(() => {
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const drawFinder = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const border = x === 0 || x === 6 || y === 0 || y === 6;
          const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          grid[oy + y][ox + x] = border || inner;
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);

    let seed = 0;
    for (let i = 0; i < code.length; i++) seed = (seed * 31 + code.charCodeAt(i)) % 99991;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inFinder =
          (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8);
        if (!inFinder) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          grid[y][x] = seed % 2 === 0;
        }
      }
    }
    return grid;
  }, [code]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-28 h-28 bg-white p-2 rounded-lg">
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#090a0d" /> : null,
        ),
      )}
    </svg>
  );
};

export const BookingFlowModal: React.FC<BookingFlowModalProps> = ({
  lang,
  initialTab,
  selectedMovie,
  selectedShowtimeId,
  selectedSeatIds,
  cart,
  onSelectMovie,
  onUpdateCart,
  onOpenSeatMap,
  onConfirmBooking,
  onGuideToSeat,
  onClose,
}) => {
  const t = TRANSLATIONS[lang];
  const [tab, setTab] = useState<'movies' | 'concessions' | 'booking' | 'ticket'>(initialTab);
  const [foodCategory, setFoodCategory] = useState<'all' | 'combos' | 'popcorn' | 'snacks' | 'drinks' | 'coffee'>('all');
  const [selectedSizes, setSelectedSizes] = useState<Record<string, number>>({});
  const [guestName, setGuestName] = useState('Alex Mercer');
  const [guestEmail, setGuestEmail] = useState('guest@immersivecinema.demo');
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  const selectedShowtime =
    selectedMovie.showtimes.find((s) => s.id === selectedShowtimeId) || selectedMovie.showtimes[0];

  const selectedSeats = useMemo(
    () => AUDITORIUM_SEATS.filter((s) => selectedSeatIds.includes(s.id)),
    [selectedSeatIds],
  );

  const seatsSubtotal = useMemo(
    () => selectedSeats.reduce((acc, s) => acc + s.price, 0),
    [selectedSeats],
  );

  const foodSubtotal = useMemo(() => {
    return cart.reduce((acc, c) => {
      const item = CONCESSION_ITEMS.find((i) => i.id === c.itemId);
      if (!item) return acc;
      const size = item.sizes[c.sizeIndex] || item.sizes[0];
      return acc + (item.basePrice + size.priceDelta) * c.quantity;
    }, 0);
  }, [cart]);

  const grandTotal = seatsSubtotal + foodSubtotal;

  const filteredFood = useMemo(
    () =>
      foodCategory === 'all'
        ? CONCESSION_ITEMS
        : CONCESSION_ITEMS.filter((i) => i.category === foodCategory),
    [foodCategory],
  );

  const handleSimulatedPayment = () => {
    const code = `IC5-${Math.floor(100000 + Math.random() * 900000)}`;
    const conf: BookingConfirmation = {
      bookingCode: code,
      movieTitle: lang === 'ar' ? selectedMovie.titleAr : selectedMovie.title,
      date: selectedShowtime.date,
      time: selectedShowtime.time,
      hall: selectedShowtime.hall,
      seatIds: selectedSeatIds,
      concessionsCount: cart.reduce((n, c) => n + c.quantity, 0),
      totalPrice: grandTotal,
      createdAt: new Date().toLocaleTimeString(),
    };
    setConfirmation(conf);
    onConfirmBooking(conf);
    setTab('ticket');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/60 pointer-events-auto">
      <div className="w-full max-w-[920px] max-h-[88vh] flex flex-col rounded-2xl border border-neutral-200 dark:border-white/12 bg-white dark:bg-[#0d0e13] text-neutral-900 dark:text-neutral-100 shadow-2xl overflow-hidden">
        {/* Top Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 dark:border-white/10">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-white/5 overflow-x-auto">
            <button
              onClick={() => setTab('movies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                tab === 'movies'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              {t.movies}
            </button>
            <button
              onClick={() => setTab('concessions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                tab === 'concessions'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Popcorn className="w-3.5 h-3.5" />
              {t.foodDrinks}
              {cart.length > 0 && ` (${cart.reduce((s, i) => s + i.quantity, 0)})`}
            </button>
            <button
              onClick={() => setTab('booking')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                tab === 'booking'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'ملخص الحجز والدفع' : 'Review & Checkout'}
            </button>
            {confirmation && (
              <button
                onClick={() => setTab('ticket')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  tab === 'ticket'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'التذكرة الرقمية' : 'Digital Ticket'}
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close booking modal"
            className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto cinema-scroll p-5">
          {tab === 'movies' && (
            <div className="space-y-5">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{t.demoNotice}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {DEMO_MOVIES.map((m) => {
                  const isCurrent = m.id === selectedMovie.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
                        isCurrent
                          ? 'border-amber-500 bg-amber-500/5'
                          : 'border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03]'
                      }`}
                    >
                      <div className="aspect-[3/4] w-full bg-neutral-900 relative overflow-hidden">
                        <img
                          src={m.posterUrl}
                          alt={m.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white">
                          <h4 className="font-semibold text-base leading-tight">
                            {lang === 'ar' ? m.titleAr : m.title}
                          </h4>
                          <div className="text-[11px] text-neutral-300 mt-0.5 tabular-nums">
                            {lang === 'ar' ? m.genreAr : m.genre} · {m.durationMin} min · {m.ageRating}
                          </div>
                        </div>
                      </div>

                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                            {lang === 'ar' ? m.descriptionAr : m.description}
                          </p>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {m.language} · Sub: {m.subtitles.join(', ')}
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-white/10">
                          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {lang === 'ar' ? 'مواعيد العرض المتاحة' : 'Available Showtimes'}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {m.showtimes.map((st) => {
                              const active = isCurrent && st.id === selectedShowtimeId;
                              return (
                                <button
                                  key={st.id}
                                  onClick={() => onSelectMovie(m, st.id)}
                                  className={`px-2.5 py-1.5 text-[11px] font-mono-tabular rounded-lg border transition-colors ${
                                    active
                                      ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-amber-400 dark:text-neutral-950 dark:border-amber-400 font-semibold'
                                      : 'border-neutral-300 dark:border-white/15 hover:border-amber-400'
                                  }`}
                                >
                                  {st.time} · {st.format}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'concessions' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-white/5 overflow-x-auto">
                  {(['all', 'combos', 'popcorn', 'snacks', 'drinks', 'coffee'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFoodCategory(cat)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize ${
                        foodCategory === cat
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                  {lang === 'ar' ? 'مجموع الضيافة:' : 'Concessions Total:'}{' '}
                  <strong className="text-neutral-900 dark:text-white">€{foodSubtotal.toFixed(2)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredFood.map((item) => {
                  const sIdx = selectedSizes[item.id] ?? 0;
                  const sizeObj = item.sizes[sIdx] || item.sizes[0];
                  const unitPrice = item.basePrice + sizeObj.priceDelta;
                  const inCart = cart.find((c) => c.itemId === item.id && c.sizeIndex === sIdx);
                  const qty = inCart?.quantity || 0;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] overflow-hidden"
                    >
                      {item.imageUrl && (
                        <div className="h-36 w-full bg-neutral-900 overflow-hidden">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm">
                              {lang === 'ar' ? item.nameAr : item.name}
                            </h4>
                            <span className="text-sm font-mono-tabular font-semibold text-amber-600 dark:text-amber-300 shrink-0">
                              €{unitPrice.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                            {lang === 'ar' ? item.descriptionAr : item.description}
                          </p>
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {item.sizes.map((sz, idx) => (
                              <button
                                key={sz.label}
                                onClick={() => setSelectedSizes((prev) => ({ ...prev, [item.id]: idx }))}
                                className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                                  sIdx === idx
                                    ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium'
                                    : 'border-neutral-300 dark:border-white/15 text-neutral-600 dark:text-neutral-400'
                                }`}
                              >
                                {lang === 'ar' ? sz.labelAr : sz.label}
                                {sz.priceDelta > 0 ? ` (+€${sz.priceDelta.toFixed(2)})` : ''}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-white/10">
                            <span className="text-[11px] text-neutral-500">
                              {lang === 'ar' ? 'التسليم إلى مقعد VIP أو ركن الضيافة' : 'Pickup or VIP Seat Delivery'}
                            </span>
                            <div className="flex items-center gap-2">
                              {qty > 0 && (
                                <button
                                  onClick={() => onUpdateCart(item.id, sIdx, -1)}
                                  className="w-7 h-7 rounded-lg border border-neutral-300 dark:border-white/15 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-white/10"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {qty > 0 && (
                                <span className="text-xs font-mono-tabular font-semibold min-w-[18px] text-center">
                                  {qty}
                                </span>
                              )}
                              <button
                                onClick={() => onUpdateCart(item.id, sIdx, 1)}
                                className="flex items-center gap-1 px-2.5 h-7 text-xs font-medium rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:opacity-90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                {qty === 0 ? (lang === 'ar' ? 'إضافة' : 'Add') : ''}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'booking' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Order Summary */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">
                  {lang === 'ar' ? 'تفاصيل التذاكر والمقاعد' : 'Screening & Seats'}
                </h4>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{lang === 'ar' ? 'الفيلم' : 'Movie'}</span>
                    <span className="font-semibold">{lang === 'ar' ? selectedMovie.titleAr : selectedMovie.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">{lang === 'ar' ? 'الموعد والقاعة' : 'Showtime'}</span>
                    <span className="tabular-nums">{selectedShowtime.date} · {selectedShowtime.time} · {selectedShowtime.hall}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">{lang === 'ar' ? 'المقاعد المختارة' : 'Selected Seats'}</span>
                    <span className="font-mono-tabular font-semibold text-blue-600 dark:text-blue-400">
                      {selectedSeatIds.length > 0 ? selectedSeatIds.join(', ') : 'None'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-neutral-200 dark:border-white/10 flex justify-between font-medium tabular-nums">
                    <span>{lang === 'ar' ? 'مجموع التذاكر' : 'Seats Subtotal'}</span>
                    <span>€{seatsSubtotal.toFixed(2)}</span>
                  </div>
                </div>

                {cart.length > 0 && (
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] space-y-2 text-xs">
                    <div className="font-semibold mb-1">{t.foodDrinks}</div>
                    {cart.map((c) => {
                      const item = CONCESSION_ITEMS.find((i) => i.id === c.itemId);
                      if (!item) return null;
                      const sz = item.sizes[c.sizeIndex] || item.sizes[0];
                      return (
                        <div key={`${c.itemId}-${c.sizeIndex}`} className="flex justify-between tabular-nums">
                          <span>
                            {c.quantity}× {lang === 'ar' ? item.nameAr : item.name} ({lang === 'ar' ? sz.labelAr : sz.label})
                          </span>
                          <span>€{((item.basePrice + sz.priceDelta) * c.quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-neutral-200 dark:border-white/10 flex justify-between font-medium tabular-nums">
                      <span>{lang === 'ar' ? 'مجموع الضيافة' : 'Concessions Subtotal'}</span>
                      <span>€{foodSubtotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm font-semibold tabular-nums">
                  <span>{lang === 'ar' ? 'الإجمالي التجريبي' : 'Demonstration Total'}</span>
                  <span className="text-amber-700 dark:text-amber-300">€{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Right: Simulated Checkout Form */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">
                  {lang === 'ar' ? 'محاكاة الدفع وإصدار التذكرة' : 'Simulated Payment'}
                </h4>
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.03] space-y-3 text-xs">
                  <p className="text-neutral-500 dark:text-neutral-400">{t.demoNotice}</p>

                  <label className="block space-y-1">
                    <span className="text-neutral-600 dark:text-neutral-300">{lang === 'ar' ? 'الاسم الكامل' : 'Guest Name'}</span>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-black/40 focus:outline-none focus:border-amber-400"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-neutral-600 dark:text-neutral-300">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email for Digital Ticket'}</span>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-white/15 bg-white dark:bg-black/40 focus:outline-none focus:border-amber-400"
                    />
                  </label>

                  <div className="p-3 rounded-lg border border-neutral-300 dark:border-white/15 bg-white/70 dark:bg-black/25 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      <CreditCard className="w-4 h-4 text-amber-500" />
                      Demo Card · •••• 4242
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">No real charge</span>
                  </div>

                  {selectedSeatIds.length === 0 ? (
                    <button
                      onClick={() => {
                        onOpenSeatMap();
                        onClose();
                      }}
                      className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                    >
                      {lang === 'ar' ? 'اختر المقاعد أولاً' : 'Choose Seats First'}
                    </button>
                  ) : (
                    <button
                      onClick={handleSimulatedPayment}
                      className="w-full py-2.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold hover:opacity-90 transition-opacity tabular-nums"
                    >
                      {lang === 'ar' ? `تأكيد الحجز التجريبي · €${grandTotal.toFixed(2)}` : `Confirm Demo Booking · €${grandTotal.toFixed(2)}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'ticket' && confirmation && (
            <div className="max-w-lg mx-auto py-4 space-y-5">
              <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
                <div>
                  <h4 className="text-base font-semibold">
                    {lang === 'ar' ? 'تم إصدار تذكرتك الرقمية التجريبية!' : 'Digital Demonstration Ticket Ready'}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.demoNotice}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/40 bg-neutral-950 text-white p-5 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xl">
                <div className="space-y-2 text-xs flex-1">
                  <div className="text-amber-400 font-mono-tabular text-sm font-semibold">
                    {confirmation.bookingCode}
                  </div>
                  <div className="text-lg font-bold tracking-tight">{confirmation.movieTitle}</div>
                  <div className="text-neutral-400 tabular-nums">
                    {confirmation.date} · {confirmation.time} · {confirmation.hall}
                  </div>
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <div>
                      <span className="text-neutral-400">{lang === 'ar' ? 'الضيف:' : 'Guest:'}</span> {guestName}
                    </div>
                    <div>
                      <span className="text-neutral-400">{lang === 'ar' ? 'المقاعد:' : 'Seats:'}</span>{' '}
                      <strong className="text-blue-400 font-mono-tabular">{confirmation.seatIds.join(', ')}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400">{lang === 'ar' ? 'الإجمالي:' : 'Total:'}</span>{' '}
                      <strong className="tabular-nums">€{confirmation.totalPrice.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <DemoQrSvg code={confirmation.bookingCode} />
                  <span className="text-[10px] text-neutral-400">Demo QR Code</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => {
                    onGuideToSeat();
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  {t.guideToSeat}
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-white/15 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-white/10"
                >
                  {lang === 'ar' ? 'العودة إلى السينما' : 'Return to Cinema'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Persistent Summary Strip */}
        {tab !== 'ticket' && (
          <div className="px-5 py-3 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-black/35 flex items-center justify-between gap-3 text-xs">
            <div className="text-neutral-600 dark:text-neutral-300 tabular-nums">
              {selectedSeatIds.length} {t.tickets} (€{seatsSubtotal.toFixed(2)})
              {foodSubtotal > 0 ? ` + Food (€${foodSubtotal.toFixed(2)})` : ''}
            </div>
            <div className="flex items-center gap-2">
              {tab === 'movies' && (
                <button
                  onClick={() => {
                    onOpenSeatMap();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold"
                >
                  {t.seats}
                </button>
              )}
              {tab === 'concessions' && (
                <button
                  onClick={() => setTab('booking')}
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-semibold tabular-nums"
                >
                  {lang === 'ar' ? 'متابعة للدفع' : 'Continue to Checkout'} · €{grandTotal.toFixed(2)}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
