import {
  ConcessionItem,
  ExitLocation,
  GraphicsPresetId,
  GraphicsSettings,
  Language,
  LightingPresetId,
  LightingSettings,
  MovieItem,
  PanoramaPoint,
  SeatCategory,
  SeatData,
} from '../types/cinema';

// Generated asset paths (from generate_image batch)
export const POSTER_CHRONOS = '/src/assets/images/poster_chronos_horizon_1795518536679.jpg';
export const POSTER_MIRAGE = '/src/assets/images/poster_desert_mirage_1795518534965.jpg';
export const POSTER_SOLARIS = '/src/assets/images/poster_solaris_odyssey_1795518542684.jpg';
export const PHOTO_CONCESSION_COMBO = '/src/assets/images/concession_cinema_combo_1795518537267.jpg';

// Screen geometric reference (center of curved screen)
export const SCREEN_CENTER = { x: 0, y: 5.5, z: -19.2 };
export const SCREEN_WIDTH = 19.6;
export const SCREEN_HEIGHT = 8.4;

export const EXIT_LOCATIONS: ExitLocation[] = [
  {
    id: 'EXIT_AUD_FL',
    name: 'Front-Left Emergency Exit (Step-Free)',
    nameAr: 'مخرج الطوارئ الأمامي الأيسر (مناسب للكراسي المتحركة)',
    position: [-12.0, 0.0, -15.6],
    accessible: true,
    zone: 'auditorium',
  },
  {
    id: 'EXIT_AUD_FR',
    name: 'Front-Right Emergency Exit (Step-Free)',
    nameAr: 'مخرج الطوارئ الأمامي الأيمن (مناسب للكراسي المتحركة)',
    position: [12.0, 0.0, -15.6],
    accessible: true,
    zone: 'auditorium',
  },
  {
    id: 'EXIT_AUD_RL',
    name: 'Rear-Left Auditorium Exit',
    nameAr: 'مخرج القاعة الخلفي الأيسر',
    position: [-9.2, 5.78, 13.4],
    accessible: false,
    zone: 'auditorium',
  },
  {
    id: 'EXIT_AUD_RR',
    name: 'Rear-Right Auditorium Exit',
    nameAr: 'مخرج القاعة الخلفي الأيمن',
    position: [9.2, 5.78, 13.4],
    accessible: false,
    zone: 'auditorium',
  },
  {
    id: 'EXIT_LOBBY_MAIN',
    name: 'Main Glass Entrance / Plaza Exit',
    nameAr: 'المدخل الزجاجي الرئيسي / ساحة الخروج',
    position: [0.0, 0.0, 35.8],
    accessible: true,
    zone: 'lobby',
  },
];

// Deterministic pseudo-random helper for realistic pre-reserved occupancy
function seededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// Generate 352 architecturally accurate cinema seats across 18 rows (A-R)
export function generateAuditoriumSeats(): SeatData[] {
  const rows = 'ABCDEFGHIJKLMNOPQR'.split('');
  const seats: SeatData[] = [];

  for (let r = 0; r < rows.length; r++) {
    const rowLetter = rows[r];
    const isAccessibleRow = r === 0;
    const isStandard = r >= 1 && r <= 5;
    const isPremium = r >= 6 && r <= 12;
    const isCouple = r === 13;
    const isVip = r >= 14;

    const baseZ = r <= 13 ? -13.6 + r * 1.32 : 4.88 + (r - 13) * 1.56;
    const floorY = r === 0 ? 0.0 : r * 0.34;
    const eyeY = floorY + (isVip ? 1.16 : 1.12);

    // Define seat column counts for Left / Center / Right sections
    let leftCount = 5;
    let centerCount = 10;
    let rightCount = 5;
    let seatPitch = 0.78;

    if (isAccessibleRow) {
      leftCount = 4;
      centerCount = 8;
      rightCount = 4;
      seatPitch = 0.92;
    } else if (isPremium) {
      leftCount = 5;
      centerCount = 12;
      rightCount = 5;
      seatPitch = 0.76;
    } else if (isCouple) {
      leftCount = 4;
      centerCount = 10;
      rightCount = 4;
      seatPitch = 0.88;
    } else if (isVip) {
      leftCount = 4;
      centerCount = 8;
      rightCount = 4;
      seatPitch = 1.04;
    }

    const aisleGap = 1.45;
    const centerHalfWidth = ((centerCount - 1) * seatPitch) / 2;

    const buildSection = (
      section: 'left' | 'center' | 'right',
      count: number,
      startNumber: number,
    ) => {
      for (let i = 0; i < count; i++) {
        const seatNum = startNumber + i;
        let x = 0;
        if (section === 'center') {
          x = -centerHalfWidth + i * seatPitch;
        } else if (section === 'left') {
          const rightMost = -centerHalfWidth - aisleGap - seatPitch * 0.5;
          x = rightMost - (count - 1 - i) * seatPitch;
        } else {
          const leftMost = centerHalfWidth + aisleGap + seatPitch * 0.5;
          x = leftMost + i * seatPitch;
        }

        // Subtle acoustic amphitheater arc curving outer wings toward screen
        const arcZOffset = (x * x) * 0.0085;
        const z = baseZ - arcZOffset;

        let category: SeatCategory = 'standard';
        let price = 14;
        let isAccessible = false;
        let isCompanion = false;

        if (isAccessibleRow) {
          if (section === 'center') {
            isAccessible = i % 2 === 0;
            isCompanion = i % 2 === 1;
            category = 'accessible';
            price = 12;
          } else {
            category = 'standard';
            price = 14;
          }
        } else if (isStandard) {
          category = 'standard';
          price = 14;
        } else if (isPremium) {
          category = 'premium';
          price = 19;
        } else if (isCouple) {
          category = 'couple';
          price = 26;
        } else if (isVip) {
          category = 'vip';
          price = 32;
        }

        // Calculate exact viewing geometry from eye position to screen center
        const dx = SCREEN_CENTER.x - x;
        const dy = SCREEN_CENTER.y - eyeY;
        const dz = SCREEN_CENTER.z - z;
        const horizontalDist = Math.hypot(dx, dz);
        const distanceToScreen = Math.hypot(dx, dy, dz);
        const horizontalAngleDeg = Math.abs((Math.atan2(dx, Math.abs(dz)) * 180) / Math.PI);
        const verticalAngleDeg = (Math.atan2(dy, horizontalDist) * 180) / Math.PI;

        // Compute realistic THX / SMPTE sightline comfort score (0-100)
        const idealDist = 18.5;
        const distPenalty = Math.abs(distanceToScreen - idealDist) * 1.4;
        const hAnglePenalty = horizontalAngleDeg * 1.1;
        const vAnglePenalty = Math.abs(verticalAngleDeg - 4) * 1.6;
        const sightlineScore = Math.max(
          54,
          Math.min(99, Math.round(99 - distPenalty - hAnglePenalty - vAnglePenalty)),
        );

        // Nearest auditorium exit
        let nearestExitId = EXIT_LOCATIONS[0].id;
        let nearestExitDistance = Infinity;
        for (const ex of EXIT_LOCATIONS.slice(0, 4)) {
          const d = Math.hypot(x - ex.position[0], floorY - ex.position[1], z - ex.position[2]);
          if (d < nearestExitDistance) {
            nearestExitDistance = d;
            nearestExitId = ex.id;
          }
        }

        // Realistic availability pattern (keep center sweet-spot Row J seats 10-11 always free for instant preview!)
        const rand = seededRand(r * 37 + seatNum * 13);
        const id = `${rowLetter}${seatNum}`;
        let status: SeatData['status'] = 'available';
        if (id !== 'J10' && id !== 'J11' && id !== 'I10' && id !== 'I11' && id !== 'P6' && id !== 'P7') {
          if (rand < 0.22 && section === 'center' && r >= 4 && r <= 12) {
            status = 'reserved';
          } else if (rand < 0.1) {
            status = 'reserved';
          } else if (rand > 0.985) {
            status = 'unavailable';
          }
        }

        seats.push({
          id,
          row: rowLetter,
          rowIndex: r,
          number: seatNum,
          section,
          category,
          price,
          status,
          x,
          y: floorY,
          z,
          eyeY,
          distanceToScreen: Number(distanceToScreen.toFixed(1)),
          horizontalAngleDeg: Number(horizontalAngleDeg.toFixed(1)),
          verticalAngleDeg: Number(verticalAngleDeg.toFixed(1)),
          sightlineScore,
          nearestExitId,
          nearestExitDistance: Number(nearestExitDistance.toFixed(1)),
          isAccessible,
          isCompanion,
        });
      }
    };

    buildSection('left', leftCount, 1);
    buildSection('center', centerCount, leftCount + 1);
    buildSection('right', rightCount, leftCount + centerCount + 1);
  }

  return seats;
}

export const AUDITORIUM_SEATS: SeatData[] = generateAuditoriumSeats();

export const DEMO_MOVIES: MovieItem[] = [
  {
    id: 'chronos-horizon',
    title: 'Chronos Horizon',
    titleAr: 'أفق كرونوس',
    tagline: 'Beyond the orbital silence lies the edge of time.',
    taglineAr: 'خلف الصمت المداري تكمن حافة الزمن.',
    description:
      'Demonstration film: When an orbital telemetry station detects an impossible gravitational echo around a ringed exoplanet, a lone flight architect undertakes a journey across warped space.',
    descriptionAr:
      'فيلم تجريبي: عندما ترصد محطة قياس مدارية صدى جاذبية مستحيلاً حول كوكب حلقي، ينطلق مهندس فضاء في رحلة عبر الزمن المنحني.',
    genre: 'Sci-Fi Epic',
    genreAr: 'خيال علمي ملحمي',
    durationMin: 158,
    ageRating: 'PG-13',
    language: 'English (Dolby Atmos)',
    subtitles: ['Arabic', 'English', 'French'],
    posterUrl: POSTER_CHRONOS,
    accentColor: '#e5b869',
    showtimes: [
      { id: 'st-1', date: 'Fri 24 Nov', time: '18:30', hall: 'Grand Hall 1 · IMAX Laser', format: 'IMAX 4K' },
      { id: 'st-2', date: 'Fri 24 Nov', time: '21:15', hall: 'Grand Hall 1 · Dolby Atmos', format: 'Dolby Cinema' },
      { id: 'st-3', date: 'Sat 25 Nov', time: '19:45', hall: 'Grand Hall 1 · IMAX Laser', format: 'IMAX 4K' },
    ],
  },
  {
    id: 'mirage-nocturne',
    title: 'Mirage Nocturne',
    titleAr: 'سراب الليل',
    tagline: 'Every reflection conceals a second witness.',
    taglineAr: 'كل انعكاس يخفي شاهداً آخر.',
    description:
      'Demonstration film: Set inside a rain-drenched architectural metropolis, an acoustics investigator unravels a high-stakes conspiracy hidden inside a symphony hall recording.',
    descriptionAr:
      'فيلم تجريبي: في مدينة معمارية غارقة بالمطر، يكشف محقق صوتيات مؤامرة معقدة مخفية داخل تسجيل لحفل موسيقي.',
    genre: 'Neo-Noir Thriller',
    genreAr: 'إثارة وغموض',
    durationMin: 132,
    ageRating: 'R / 15+',
    language: 'English · Arabic',
    subtitles: ['Arabic', 'English'],
    posterUrl: POSTER_MIRAGE,
    accentColor: '#60a5fa',
    showtimes: [
      { id: 'st-4', date: 'Fri 24 Nov', time: '17:00', hall: 'Grand Hall 1 · Dolby Atmos', format: '4K Laser' },
      { id: 'st-5', date: 'Fri 24 Nov', time: '20:30', hall: 'Grand Hall 1 · Dolby Atmos', format: 'Dolby Cinema' },
      { id: 'st-6', date: 'Sat 25 Nov', time: '22:00', hall: 'Grand Hall 1 · VIP Premier', format: 'VIP 4K' },
    ],
  },
  {
    id: 'solaris-odyssey',
    title: 'Citadel of Solaris',
    titleAr: 'قلعة سولاريس',
    tagline: 'Light endures where empires turn to sand.',
    taglineAr: 'يبقى النور حيث تتحول الإمبراطوريات إلى رمال.',
    description:
      'Demonstration film: An expedition traverses towering desert canyons to awaken the lantern aqueducts of an ancient sandstone citadel before the century eclipse.',
    descriptionAr:
      'فيلم تجريبي: تعبر بعثة استكشافية وديان الصحراء الشاهقة لإعادة إحياء قناديل قلعة حجرية قديمة قبل الكسوف الكبير.',
    genre: 'Adventure Fantasy',
    genreAr: 'مغامرة وفانتازيا',
    durationMin: 144,
    ageRating: 'PG',
    language: 'Arabic · English',
    subtitles: ['English', 'Arabic', 'Spanish'],
    posterUrl: POSTER_SOLARIS,
    accentColor: '#f59e0b',
    showtimes: [
      { id: 'st-7', date: 'Fri 24 Nov', time: '16:15', hall: 'Grand Hall 1 · IMAX Laser', format: 'IMAX 4K' },
      { id: 'st-8', date: 'Fri 24 Nov', time: '19:30', hall: 'Grand Hall 1 · Dolby Atmos', format: 'Dolby Cinema' },
      { id: 'st-9', date: 'Sat 25 Nov', time: '18:00', hall: 'Grand Hall 1 · IMAX Laser', format: 'IMAX 4K' },
    ],
  },
];

export const CONCESSION_ITEMS: ConcessionItem[] = [
  {
    id: 'vip-cinema-combo',
    name: 'Signature Cinema Duo Combo',
    nameAr: 'كومبو السينما الفاخر لشخصين',
    category: 'combos',
    description: 'Artisanal half-caramel & buttered popcorn tub, two chilled craft colas, and warm cheddar nachos.',
    descriptionAr: 'فشار كراميل وزبدة فاخر، مشروبان باردان، وناتشوز ساخن بصلصة الشيدر.',
    basePrice: 18.5,
    sizes: [
      { label: 'Classic Duo', labelAr: 'كلاسيك لشخصين', priceDelta: 0 },
      { label: 'VIP Grand', labelAr: 'كبير VIP', priceDelta: 5.5 },
    ],
    imageUrl: PHOTO_CONCESSION_COMBO,
    accentTone: '#e5b869',
  },
  {
    id: 'truffle-butter-popcorn',
    name: 'Gourmet Butter & Caramel Popcorn',
    nameAr: 'فشار بالزبدة والكراميل الفاخر',
    category: 'popcorn',
    description: 'Freshly popped mushroom kernels glazed with sea-salt caramel or clarified French butter.',
    descriptionAr: 'فشار طازج بالكراميل المملح أو الزبدة الفرنسية الصافية.',
    basePrice: 7.5,
    sizes: [
      { label: 'Regular', labelAr: 'وسط', priceDelta: 0 },
      { label: 'Large', labelAr: 'كبير', priceDelta: 2.5 },
      { label: 'Collector Tub', labelAr: 'عبوة كبيرة', priceDelta: 4.5 },
    ],
    imageUrl: PHOTO_CONCESSION_COMBO,
    accentTone: '#f59e0b',
  },
  {
    id: 'artisanal-nachos',
    name: 'Crisp Stone-Ground Nachos',
    nameAr: 'ناتشوز مقرمش بالجبن والهالبينو',
    category: 'snacks',
    description: 'Warm salted corn tortilla chips served with aged cheddar cheese dip, jalapeños, and salsa.',
    descriptionAr: 'رقائق ذرة دافئة مع صلصة جبن الشيدر المعتق والهالبينو والصلصة.',
    basePrice: 8.0,
    sizes: [
      { label: 'Single Dip', labelAr: 'صلصة واحدة', priceDelta: 0 },
      { label: 'Double Cheese', labelAr: 'جبن مضاعف', priceDelta: 2.0 },
    ],
    accentTone: '#d97706',
  },
  {
    id: 'craft-citrus-cola',
    name: 'Chilled Artisanal Soft Drink',
    nameAr: 'مشروب غازي بارد بالحمضيات',
    category: 'drinks',
    description: 'Served over crystal ice with fresh citrus zest. Cola, Sparkling Yuzu, or Botanical Ginger.',
    descriptionAr: 'يُقدم مع الثلج وقشر الحمضيات الطازج. كولا أو يوزو فوار أو زنجبيل.',
    basePrice: 5.0,
    sizes: [
      { label: 'Medium 500ml', labelAr: 'وسط 500 مل', priceDelta: 0 },
      { label: 'Large 750ml', labelAr: 'كبير 750 مل', priceDelta: 1.5 },
    ],
    accentTone: '#38bdf8',
  },
  {
    id: 'single-origin-latte',
    name: 'Lounge Espresso & Iced Latte',
    nameAr: 'إسبريسو ولايتيه بارد من الصالة',
    category: 'coffee',
    description: 'Roasted specialty beans brewed fresh at our VIP Lounge barista counter.',
    descriptionAr: 'حبوب قهوة مختصة محمصة طازجاً في ركن الباريستا بصالة كبار الشخصيات.',
    basePrice: 6.0,
    sizes: [
      { label: 'Hot 12oz', labelAr: 'ساخن', priceDelta: 0 },
      { label: 'Iced 16oz', labelAr: 'مثلج', priceDelta: 1.0 },
    ],
    accentTone: '#a78bfa',
  },
  {
    id: 'belgian-dark-truffles',
    name: 'Belgian Dark Chocolate Box',
    nameAr: 'علبة شوكولاتة بلجيكية داكنة',
    category: 'snacks',
    description: 'Assorted 70% dark cacao pralines and roasted hazelnut bites for the screening.',
    descriptionAr: 'تشكيلة برالين الشوكولاتة الداكنة 70% مع البندق المحمص.',
    basePrice: 9.5,
    sizes: [
      { label: '6 Pieces', labelAr: '6 قطع', priceDelta: 0 },
      { label: '12 Pieces', labelAr: '12 قطعة', priceDelta: 6.0 },
    ],
    accentTone: '#b45309',
  },
  {
    id: 'family-premiere-pack',
    name: 'Family Premiere Package (4 Guests)',
    nameAr: 'باقة العائلة للعرض الأول (4 أشخاص)',
    category: 'combos',
    description: 'Two large popcorn tubs, four soft drinks, loaded nachos, and dark chocolate bites.',
    descriptionAr: 'عبوتا فشار كبيرتان، 4 مشروبات، ناتشوز، وشوكولاتة بلجيكية.',
    basePrice: 36.0,
    sizes: [
      { label: 'Standard 4x', labelAr: 'قياسي 4 أشخاص', priceDelta: 0 },
      { label: 'Deluxe + Coffee', labelAr: 'ديلوكس + قهوة', priceDelta: 8.0 },
    ],
    imageUrl: PHOTO_CONCESSION_COMBO,
    accentTone: '#e5b869',
  },
];

export const PANORAMA_POINTS: PanoramaPoint[] = [
  { id: 'ext-plaza', name: 'Building Exterior', nameAr: 'الواجهة الخارجية للمبنى', zone: 'exterior', position: [0, 3.2, 52], lookAt: [0, 5.0, 34] },
  { id: 'main-entrance', name: 'Main Glass Entrance', nameAr: 'المدخل الزجاجي الرئيسي', zone: 'exterior', position: [0, 1.8, 39.5], lookAt: [0, 2.8, 28] },
  { id: 'lobby-reception', name: 'Grand Lobby & Reception', nameAr: 'البهو الرئيسي والاستقبال', zone: 'lobby', position: [0, 1.8, 31], lookAt: [-7, 2.0, 26] },
  { id: 'ticket-counters', name: 'Ticket Counters & Kiosks', nameAr: 'شبابيك التذاكر والأكشاك الذاتية', zone: 'lobby', position: [-6.5, 1.75, 29.5], lookAt: [-11.5, 2.0, 26] },
  { id: 'concessions', name: 'Popcorn & Concession Bar', nameAr: 'ركن الفشار والمشروبات', zone: 'lobby', position: [5.5, 1.75, 27], lookAt: [11.5, 2.2, 24] },
  { id: 'waiting-lounge', name: 'Central Waiting Lounge', nameAr: 'صالة الانتظار المركزية', zone: 'lobby', position: [0, 1.65, 23], lookAt: [0, 2.5, 34] },
  { id: 'vip-lounge', name: 'VIP Reception & Lounge', nameAr: 'صالة كبار الشخصيات VIP', zone: 'lobby', position: [12.5, 1.7, 19.5], lookAt: [14.5, 1.8, 17.5] },
  { id: 'aud-entrance', name: 'Auditorium Acoustic Portal', nameAr: 'مدخل القاعة الرئيسية', zone: 'auditorium', position: [-11.0, 1.75, -15.5], lookAt: [0, 4.2, -18] },
  { id: 'front-section', name: 'Front Seating Section', nameAr: 'قسم المقاعد الأمامي', zone: 'auditorium', position: [0, 1.6, -11.5], lookAt: [0, 5.4, -19.2] },
  { id: 'mid-section', name: 'Middle Sweet-Spot (Row J)', nameAr: 'المنتصف المثالي (الصف J)', zone: 'auditorium', position: [0, 4.18, -1.7], lookAt: [0, 5.5, -19.2] },
  { id: 'rear-section', name: 'Rear Elevated Panorama', nameAr: 'الإطلالة الخلفية المرتفعة', zone: 'auditorium', position: [0, 6.8, 12.2], lookAt: [0, 4.5, -19.2] },
  { id: 'vip-section', name: 'VIP Recliner Deck (Row P)', nameAr: 'منصة كبار الشخصيات VIP', zone: 'auditorium', position: [0, 6.3, 8.0], lookAt: [0, 5.5, -19.2] },
  { id: 'screen-apron', name: 'Cinema Screen Stage', nameAr: 'منصة شاشة العرض العملاقة', zone: 'auditorium', position: [0, 2.2, -16.2], lookAt: [0, 3.8, 4] },
  { id: 'emergency-exits', name: 'Emergency Exit Corridor', nameAr: 'ممر مخارج الطوارئ', zone: 'auditorium', position: [10.8, 1.7, -14.8], lookAt: [12.6, 2.2, -15.6] },
];

export const LIGHTING_PRESETS: Record<LightingPresetId, LightingSettings> = {
  full: {
    preset: 'full',
    ceilingLights: 0.95,
    wallSlats: 0.95,
    ledStrips: 0.85,
    stairLights: 0.9,
    aisleLights: 0.9,
    seatLights: 0.75,
    emergencyLights: 0.2,
    exitSigns: 1.0,
    screenBrightness: 0.85,
    ambientLight: 0.72,
    exposure: 1.18,
    colorTemperature: 3800,
    accentColor: '#f5d298',
    exteriorLights: 0.9,
    lobbyLights: 1.0,
    exteriorDaytime: false,
  },
  preshow: {
    preset: 'preshow',
    ceilingLights: 0.42,
    wallSlats: 0.82,
    ledStrips: 0.72,
    stairLights: 0.85,
    aisleLights: 0.85,
    seatLights: 0.65,
    emergencyLights: 0.1,
    exitSigns: 0.9,
    screenBrightness: 1.1,
    ambientLight: 0.36,
    exposure: 1.06,
    colorTemperature: 3000,
    accentColor: '#f2c179',
    exteriorLights: 0.85,
    lobbyLights: 0.9,
    exteriorDaytime: false,
  },
  movie: {
    preset: 'movie',
    ceilingLights: 0.05,
    wallSlats: 0.24,
    ledStrips: 0.22,
    stairLights: 0.65,
    aisleLights: 0.55,
    seatLights: 0.22,
    emergencyLights: 0.05,
    exitSigns: 0.75,
    screenBrightness: 1.35,
    ambientLight: 0.14,
    exposure: 0.98,
    colorTemperature: 2700,
    accentColor: '#e5b26b',
    exteriorLights: 0.8,
    lobbyLights: 0.85,
    exteriorDaytime: false,
  },
  intermission: {
    preset: 'intermission',
    ceilingLights: 0.58,
    wallSlats: 0.75,
    ledStrips: 0.65,
    stairLights: 0.95,
    aisleLights: 0.9,
    seatLights: 0.55,
    emergencyLights: 0.1,
    exitSigns: 1.0,
    screenBrightness: 0.75,
    ambientLight: 0.48,
    exposure: 1.1,
    colorTemperature: 3400,
    accentColor: '#f7d9a8',
    exteriorLights: 0.85,
    lobbyLights: 0.95,
    exteriorDaytime: false,
  },
  cleaning: {
    preset: 'cleaning',
    ceilingLights: 1.0,
    wallSlats: 0.6,
    ledStrips: 0.4,
    stairLights: 1.0,
    aisleLights: 1.0,
    seatLights: 0.8,
    emergencyLights: 0.35,
    exitSigns: 1.0,
    screenBrightness: 0.25,
    ambientLight: 0.95,
    exposure: 1.28,
    colorTemperature: 5600,
    accentColor: '#e2ecff',
    exteriorLights: 1.0,
    lobbyLights: 1.0,
    exteriorDaytime: true,
  },
  emergency: {
    preset: 'emergency',
    ceilingLights: 0.12,
    wallSlats: 0.1,
    ledStrips: 0.15,
    stairLights: 1.0,
    aisleLights: 1.0,
    seatLights: 0.1,
    emergencyLights: 1.0,
    exitSigns: 1.0,
    screenBrightness: 0.2,
    ambientLight: 0.28,
    exposure: 1.05,
    colorTemperature: 4800,
    accentColor: '#ef4444',
    exteriorLights: 0.95,
    lobbyLights: 0.7,
    exteriorDaytime: false,
  },
  custom: {
    preset: 'custom',
    ceilingLights: 0.45,
    wallSlats: 0.85,
    ledStrips: 0.75,
    stairLights: 0.85,
    aisleLights: 0.8,
    seatLights: 0.6,
    emergencyLights: 0.1,
    exitSigns: 0.9,
    screenBrightness: 1.15,
    ambientLight: 0.38,
    exposure: 1.08,
    colorTemperature: 3100,
    accentColor: '#f2c179',
    exteriorLights: 0.85,
    lobbyLights: 0.9,
    exteriorDaytime: false,
  },
};

export const GRAPHICS_PRESETS: Record<GraphicsPresetId, GraphicsSettings> = {
  low: {
    preset: 'low',
    resolutionScale: 0.75,
    shadows: false,
    dynamicScreenGlow: false,
    reflectionsIntensity: 0.35,
    antiAliasing: false,
    characterDetail: 'low',
    maxFps: 30,
    streamingBitrateMbps: 6,
  },
  medium: {
    preset: 'medium',
    resolutionScale: 1.0,
    shadows: true,
    dynamicScreenGlow: true,
    reflectionsIntensity: 0.65,
    antiAliasing: true,
    characterDetail: 'medium',
    maxFps: 60,
    streamingBitrateMbps: 14,
  },
  high: {
    preset: 'high',
    resolutionScale: 1.35,
    shadows: true,
    dynamicScreenGlow: true,
    reflectionsIntensity: 0.95,
    antiAliasing: true,
    characterDetail: 'high',
    maxFps: 60,
    streamingBitrateMbps: 24,
  },
  ultra: {
    preset: 'ultra',
    resolutionScale: 1.75,
    shadows: true,
    dynamicScreenGlow: true,
    reflectionsIntensity: 1.25,
    antiAliasing: true,
    characterDetail: 'high',
    maxFps: 120,
    streamingBitrateMbps: 40,
  },
  cinematic: {
    preset: 'cinematic',
    resolutionScale: 2.0,
    shadows: true,
    dynamicScreenGlow: true,
    reflectionsIntensity: 1.45,
    antiAliasing: true,
    characterDetail: 'high',
    maxFps: 60,
    streamingBitrateMbps: 60,
  },
};

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    brand: 'Immersive Cinema 5',
    previewNotice: 'WebGL Real-Time Preview · UE5 Pixel Streaming Ready',
    seats: 'Select Seats',
    previewMySeat: 'Preview My Seat',
    compareSeats: 'Compare Seats',
    exploreCinema: 'Explore Cinema',
    cinematicTour: 'Cinematic Tour',
    freeWalk: 'Free Walk',
    droneView: 'Drone View',
    view360: '360° View',
    floorPlan: 'Floor Plan',
    vrMode: 'VR Mode',
    screenMedia: 'YouTube & Screen',
    movies: 'Movies',
    lighting: 'Lighting',
    audience: 'Audience',
    findNearestExit: 'Find Nearest Exit',
    foodDrinks: 'Food & Drinks',
    bookTickets: 'Book Tickets',
    graphics: 'Graphics',
    audio: 'Audio',
    fullscreen: 'Fullscreen',
    resetCamera: 'Reset Camera',
    ue5Hub: 'UE5 & Stream',
    hideControls: 'Hide Controls',
    showControls: 'Show Controls',
    available: 'Available',
    reserved: 'Taken',
    selected: 'Selected',
    unavailable: 'Unavailable',
    standard: 'Standard',
    premium: 'Premium',
    vip: 'VIP Recliner',
    couple: 'Couple',
    accessible: 'Accessible',
    screenLabel: 'IMAX LASER SCREEN',
    tickets: 'tickets',
    suggestBestSeats: 'Recommend Best Seats',
    distanceToScreen: 'Distance to Screen',
    hAngle: 'Horizontal Angle',
    vAngle: 'Vertical Angle',
    sightline: 'Sightline Score',
    nearestExit: 'Nearest Exit',
    dragToLook: 'Drag to look 360° around your seat',
    walkHint: 'WASD / Arrows to walk · Drag to look · Shift to sprint',
    standing: 'Standing',
    seated: 'Seated',
    accessibleRoute: 'Step-Free Accessible Route',
    clearRoute: 'Clear Route',
    evacDisclaimer: 'Conceptual wayfinding simulation only — not a certified life-safety evacuation system.',
    demoNotice: 'Demonstration prices, showtimes & simulated checkout',
    guideToSeat: 'Navigate Entrance → My Seat',
    pauseTour: 'Pause',
    resumeTour: 'Resume',
    skipChapter: 'Next Stop',
    exitTour: 'Exit Tour',
  },
  ar: {
    brand: 'سينما غامرة 5',
    previewNotice: 'معاينة WebGL فورية · جاهز للبث السحابي UE5 Pixel Streaming',
    seats: 'اختيار المقاعد',
    previewMySeat: 'معاينة مقعدي',
    compareSeats: 'مقارنة المقاعد',
    exploreCinema: 'استكشاف السينما',
    cinematicTour: 'جولة سينمائية',
    freeWalk: 'تجول حر',
    droneView: 'منظور الدرون',
    view360: 'عرض 360°',
    floorPlan: 'المخطط المعماري',
    vrMode: 'الواقع الافتراضي',
    screenMedia: 'يوتيوب والشاشة',
    movies: 'الأفلام',
    lighting: 'الإضاءة',
    audience: 'الجمهور',
    findNearestExit: 'أقرب مخرج',
    foodDrinks: 'الطعام والمشروبات',
    bookTickets: 'حجز التذاكر',
    graphics: 'الجودة الرسومية',
    audio: 'الصوتيات',
    fullscreen: 'ملء الشاشة',
    resetCamera: 'إعادة الكاميرا',
    ue5Hub: 'محرك UE5 والبث',
    hideControls: 'إخفاء الأدوات',
    showControls: 'إظهار الأدوات',
    available: 'متاح',
    reserved: 'محجوز',
    selected: 'مختار',
    unavailable: 'غير متاح',
    standard: 'قياسي',
    premium: 'مميز',
    vip: 'كبار الشخصيات VIP',
    couple: 'مقاعد ثنائية',
    accessible: 'ذوي الهمم',
    screenLabel: 'شاشة IMAX ليزر العملاقة',
    tickets: 'تذاكر',
    suggestBestSeats: 'اقتراح أفضل المقاعد',
    distanceToScreen: 'المسافة إلى الشاشة',
    hAngle: 'الزاوية الأفقية',
    vAngle: 'الزاوية الرأسية',
    sightline: 'جودة الرؤية',
    nearestExit: 'أقرب مخرج',
    dragToLook: 'اسحب للالتفات 360° حول مقعدك',
    walkHint: 'مفاتيح WASD أو الأسهم للمشي · اسحب للالتفات',
    standing: 'وقوف',
    seated: 'جلوس',
    accessibleRoute: 'مسار خالٍ من الدرج (ذوي الهمم)',
    clearRoute: 'إخفاء المسار',
    evacDisclaimer: 'محاكاة إرشادية توضيحية فقط وليست نظام إخلاء طوارئ معتمداً.',
    demoNotice: 'أسعار وعروض ودفع تجريبي لأغراض العرض',
    guideToSeat: 'إرشادي من المدخل إلى مقعدي',
    pauseTour: 'إيقاف مؤقت',
    resumeTour: 'استئناف',
    skipChapter: 'المحطة التالية',
    exitTour: 'إنهاء الجولة',
  },
};
