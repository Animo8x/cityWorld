import { ColliderBox, DistrictInfo, InteriorPortalDef } from '../types';

export const WORLD_HALF_SIZE = 600;
export const MAINLAND_BORDER = 532;
export const ISLAND_CENTER = { x: -180, z: 760 };
export const WATER_LEVEL = -0.35;

export const DISTRICTS: DistrictInfo[] = [
  {
    id: 'downtown',
    name: 'Downtown Core',
    nameAr: 'وسط المدينة',
    subtitle: 'Financial & Civic Center',
    subtitleAr: 'المركز المالي والتجاري',
    bounds: { minX: -140, maxX: 140, minZ: -140, maxZ: 140 },
    center: { x: 0, z: 0 },
    mapColor: '#334155',
  },
  {
    id: 'rich',
    name: 'Crestwood Hills',
    nameAr: 'حي الفلل الفاخرة',
    subtitle: 'Luxury Estates & Villas',
    subtitleAr: 'قصور وفلل فاخرة',
    bounds: { minX: -360, maxX: -140, minZ: -280, maxZ: -20 },
    center: { x: -245, z: -150 },
    mapColor: '#3f5e4d',
  },
  {
    id: 'residential',
    name: 'Maple Oaks',
    nameAr: 'الحي السكني',
    subtitle: 'Suburban Homes & Central Park',
    subtitleAr: 'منازل هادئة وحديقة عامة',
    bounds: { minX: -360, maxX: -140, minZ: -20, maxZ: 280 },
    center: { x: -245, z: 120 },
    mapColor: '#3a4d3f',
  },
  {
    id: 'poor',
    name: 'Brickyard District',
    nameAr: 'الحي الشعبي',
    subtitle: 'Old Tenements & Back Alleys',
    subtitleAr: 'مبانٍ قديمة وأزقة',
    bounds: { minX: -140, maxX: 140, minZ: 140, maxZ: 300 },
    center: { x: 0, z: 220 },
    mapColor: '#473d39',
  },
  {
    id: 'industrial',
    name: 'Ironworks Zone',
    nameAr: 'المنطقة الصناعية',
    subtitle: 'Factories, Rail Depot & Warehouses',
    subtitleAr: 'مصانع ومستودعات',
    bounds: { minX: 140, maxX: 380, minZ: -140, maxZ: 140 },
    center: { x: 255, z: 0 },
    mapColor: '#44403c',
  },
  {
    id: 'port',
    name: 'CityWorld Harbor',
    nameAr: 'الميناء البحري',
    subtitle: 'Cargo Piers, Cranes & Freighters',
    subtitleAr: 'سفن شحن وحاويات ورافعات',
    bounds: { minX: 140, maxX: 420, minZ: 140, maxZ: 420 },
    center: { x: 265, z: 260 },
    mapColor: '#1e3a5f',
  },
  {
    id: 'beach',
    name: 'Azure Coastline',
    nameAr: 'الشاطئ والكورنيش',
    subtitle: 'Boardwalk, Sands & Ocean',
    subtitleAr: 'رمال ذهبية وبحر وممشى',
    bounds: { minX: -420, maxX: 140, minZ: 300, maxZ: 540 },
    center: { x: -120, z: 345 },
    mapColor: '#a89060',
  },
  {
    id: 'airport',
    name: 'Skyline International',
    nameAr: 'المطار الدولي',
    subtitle: 'Runways, Terminal & Control Tower',
    subtitleAr: 'مدرجات وطائرات وبرج مراقبة',
    bounds: { minX: 150, maxX: 520, minZ: -440, maxZ: -150 },
    center: { x: 330, z: -290 },
    mapColor: '#293548',
  },
  {
    id: 'countryside',
    name: 'Pinecrest Valley',
    nameAr: 'الريف والجبال',
    subtitle: 'Farms, Rolling Hills & Mountain Pass',
    subtitleAr: 'مزارع وتلال خضراء',
    bounds: { minX: -580, maxX: 150, minZ: -580, maxZ: -280 },
    center: { x: -180, z: -410 },
    mapColor: '#2f4f32',
  },
  {
    id: 'highway',
    name: 'Metro Ring Expressway',
    nameAr: 'الطريق السريع الدائري',
    subtitle: 'Multi-Lane Loop & Overpasses',
    subtitleAr: 'طريق سريع وجسور',
    bounds: { minX: -390, maxX: 390, minZ: -290, maxZ: 305 },
    center: { x: 0, z: -265 },
    mapColor: '#1e293b',
  },
  {
    id: 'island',
    name: 'Palm Cove Island',
    nameAr: 'الجزيرة الاستوائية',
    subtitle: 'Tropical Island Airstrip & Beach',
    subtitleAr: 'جزيرة رملية هادئة ومدرج طائرات',
    bounds: { minX: -290, maxX: -70, minZ: 650, maxZ: 870 },
    center: { x: -180, z: 760 },
    mapColor: '#c2a66e',
  },
];

export interface RoadSegment {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  isHighway?: boolean;
  isBridge?: boolean;
}

export const ROAD_SEGMENTS: RoadSegment[] = [
  { id: 'dt_ew_1', x1: -340, z1: -120, x2: 340, z2: -120, width: 14 },
  { id: 'dt_ew_2', x1: -340, z1: -40, x2: 340, z2: -40, width: 14 },
  { id: 'dt_ew_3', x1: -340, z1: 40, x2: 340, z2: 40, width: 14 },
  { id: 'dt_ew_4', x1: -340, z1: 120, x2: 340, z2: 120, width: 14 },
  { id: 'dt_ns_1', x1: -120, z1: -265, x2: -120, z2: 290, width: 14 },
  { id: 'dt_ns_2', x1: -40, z1: -265, x2: -40, z2: 290, width: 14 },
  { id: 'dt_ns_3', x1: 40, z1: -265, x2: 40, z2: 290, width: 14 },
  { id: 'dt_ns_4', x1: 120, z1: -265, x2: 120, z2: 290, width: 14 },
  { id: 'west_ns_1', x1: -240, z1: -265, x2: -240, z2: 290, width: 12 },
  { id: 'west_ns_2', x1: -340, z1: -265, x2: -340, z2: 290, width: 14, isHighway: true },
  { id: 'east_ns_1', x1: 240, z1: -265, x2: 240, z2: 290, width: 14 },
  { id: 'east_ns_2', x1: 350, z1: -265, x2: 350, z2: 290, width: 16, isHighway: true },
  { id: 'south_ew_1', x1: -340, z1: 210, x2: 350, z2: 210, width: 12 },
  { id: 'waterfront_ew', x1: -360, z1: 290, x2: 350, z2: 290, width: 16, isHighway: true },
  { id: 'north_hwy', x1: -340, z1: -265, x2: 350, z2: -265, width: 18, isHighway: true },
  { id: 'rich_ew', x1: -340, z1: -195, x2: 140, z2: -195, width: 12 },
  { id: 'country_1', x1: -240, z1: -265, x2: -240, z2: -460, width: 10 },
  { id: 'country_2', x1: -240, z1: -460, x2: 40, z2: -460, width: 10 },
  { id: 'country_3', x1: 40, z1: -460, x2: 40, z2: -265, width: 10 },
  { id: 'airport_link', x1: 240, z1: -265, x2: 240, z2: -165, width: 14 },
];

export interface TrafficIntersection {
  x: number;
  z: number;
  phaseOffset: number;
}

export const TRAFFIC_INTERSECTIONS: TrafficIntersection[] = [
  { x: -120, z: -120, phaseOffset: 0 },
  { x: -40, z: -120, phaseOffset: 6 },
  { x: 40, z: -120, phaseOffset: 0 },
  { x: 120, z: -120, phaseOffset: 6 },
  { x: -120, z: -40, phaseOffset: 6 },
  { x: -40, z: -40, phaseOffset: 0 },
  { x: 40, z: -40, phaseOffset: 6 },
  { x: 120, z: -40, phaseOffset: 0 },
  { x: -120, z: 40, phaseOffset: 0 },
  { x: -40, z: 40, phaseOffset: 6 },
  { x: 40, z: 40, phaseOffset: 0 },
  { x: 120, z: 40, phaseOffset: 6 },
  { x: -120, z: 120, phaseOffset: 6 },
  { x: -40, z: 120, phaseOffset: 0 },
  { x: 40, z: 120, phaseOffset: 6 },
  { x: 120, z: 120, phaseOffset: 0 },
  { x: -240, z: 40, phaseOffset: 3 },
  { x: 240, z: 40, phaseOffset: 3 },
  { x: 0, z: 210, phaseOffset: 4 },
];

const SUPERMARKET_ACTIONS = [
  {
    id: 'buy_energy_drink',
    label: 'Energy Drink (100% Stamina)',
    labelAr: 'مشروب طاقة (شحن الطاقة 100%)',
    cost: 15,
    description: 'Restores full stamina immediately.',
    descriptionAr: 'يعيد تعبئة شريط الطاقة فوراً.',
  },
  {
    id: 'buy_hot_meal',
    label: 'Fresh Supermarket Meal (+45 HP)',
    labelAr: 'وجبة طازجة (+45 صحة)',
    cost: 35,
    description: 'Heals 45 Health points.',
    descriptionAr: 'يعيد 45 نقطة من صحتك.',
  },
  {
    id: 'buy_medkit',
    label: 'First Aid Kit (Full Health)',
    labelAr: 'حقيبة إسعاف أولي (صحة كاملة)',
    cost: 90,
    description: 'Restores 100% Health immediately.',
    descriptionAr: 'يعالج صحتك بالكامل فوراً.',
  },
  {
    id: 'buy_light_vest',
    label: 'Protective Vest (+60 Armor)',
    labelAr: 'درع حماية (+60 درع)',
    cost: 140,
    description: 'Adds 60 ballistic armor.',
    descriptionAr: 'يضيف 60 نقطة درع للحماية.',
  },
  {
    id: 'buy_ammo_rpg',
    label: 'Ammo & RPG Rocket Pack',
    labelAr: 'صندوق ذخيرة وصواريخ RPG',
    cost: 220,
    description: 'Refills Pistol, SMG, Shotgun, Rifle & +3 RPG Rockets.',
    descriptionAr: 'يعبئ جميع الأسلحة ويضيف 3 صواريخ RPG.',
  },
];

export const INTERIOR_PORTALS: InteriorPortalDef[] = [
  {
    id: 'market_downtown',
    name: 'CityWorld Mart 24/7 (Downtown)',
    nameAr: 'سوبر ماركت وسط المدينة 24/7',
    subtitle: 'Groceries, Energy Drinks, Medkits & Supplies',
    subtitleAr: 'بقالة، مشروبات، إسعافات وذخيرة',
    kind: 'supermarket',
    exteriorPos: { x: 26, y: 0, z: -26 },
    interiorCenter: { x: 360, y: -120, z: 0 },
    accentColor: 0x10b981,
    shopActions: SUPERMARKET_ACTIONS,
  },
  {
    id: 'market_suburb',
    name: 'Maple Oaks Supermarket',
    nameAr: 'سوبر ماركت الحي السكني',
    subtitle: 'Neighborhood Grocery & Supplies',
    subtitleAr: 'بقالة ومستلزمات طبية وذخيرة',
    kind: 'supermarket',
    exteriorPos: { x: -222, y: 0, z: 54 },
    interiorCenter: { x: 480, y: -120, z: 0 },
    accentColor: 0x22d3ee,
    shopActions: SUPERMARKET_ACTIONS,
  },
  {
    id: 'market_beach',
    name: 'Azure Boardwalk Mini-Mart',
    nameAr: 'سوبر ماركت الشاطئ',
    subtitle: 'Beach Drinks, Snacks & Gear',
    subtitleAr: 'مشروبات ووجبات ومستلزمات الشاطئ',
    kind: 'supermarket',
    exteriorPos: { x: -48, y: 0, z: 274 },
    interiorCenter: { x: 600, y: -120, z: 0 },
    accentColor: 0x34d399,
    shopActions: SUPERMARKET_ACTIONS,
  },
  {
    id: 'auto_garage',
    name: 'Apex Auto & Tuning',
    nameAr: 'معرض سيارات Apex الأول',
    subtitle: 'Dealership, Repairs, Bikes & Supercars',
    subtitleAr: 'معرض سيارات سريعة وبسكليتات ودرع',
    kind: 'garage',
    exteriorPos: { x: -22, y: 0, z: 31 },
    interiorCenter: { x: 0, y: -120, z: 0 },
    accentColor: 0xf59e0b,
    shopActions: [
      {
        id: 'repair_armor',
        label: 'Full Health & Ballistic Vest',
        labelAr: 'علاج كامل + درع واقي 100%',
        cost: 200,
        description: 'Restore 100% HP and equip 100 Armor.',
        descriptionAr: 'يعيد صحتك ودرعك إلى 100%.',
      },
      {
        id: 'spawn_supercar',
        label: 'Deliver Apex Hyper GT (223 km/h)',
        labelAr: 'شراء سوبركار أبيكس GT (223 كم/س)',
        cost: 850,
        description: 'Spawn an ultra-fast 223 km/h Hypercar outside.',
        descriptionAr: 'تظهر سيارة سوبركار بسرعة 223 كم/س أمام المعرض.',
      },
      {
        id: 'spawn_sports',
        label: 'Deliver Veloce GT Sports (176 km/h)',
        labelAr: 'شراء سيارة فيلوسي الرياضية (176 كم/س)',
        cost: 450,
        description: 'Spawn a 176 km/h Veloce GT outside the dealership.',
        descriptionAr: 'تظهر سيارة رياضية بسرعة 176 كم/س أمام المعرض.',
      },
      {
        id: 'spawn_speed_bike',
        label: 'Buy Aero Pro Speed Bike (40 km/h)',
        labelAr: 'شراء بسكليت سباق سريع (40 كم/س)',
        cost: 110,
        description: 'Spawn a fast 40 km/h Aero racing bicycle outside.',
        descriptionAr: 'يظهر بسكليت سريع 40 كم/س أمامك.',
      },
      {
        id: 'spawn_moto',
        label: 'Deliver Apex Superbike (166 km/h)',
        labelAr: 'شراء دراجة نارية سريعة (166 كم/س)',
        cost: 300,
        description: 'Spawn a nimble 166 km/h Apex Superbike outside.',
        descriptionAr: 'تظهر دراجة نارية بسرعة 166 كم/س أمامك.',
      },
    ],
  },
  {
    id: 'city_bank',
    name: 'CityWorld Reserve Hub',
    nameAr: 'بنك ومركز CityWorld',
    subtitle: 'Civic Center & Vault Lobby',
    subtitleAr: 'المركز المالي ورفع الملاحقة',
    kind: 'bank',
    exteriorPos: { x: 64, y: 0, z: -18 },
    interiorCenter: { x: 120, y: -120, z: 0 },
    accentColor: 0x38bdf8,
    shopActions: [
      {
        id: 'collect_dividend',
        label: 'Claim Civic Stipend (+$350)',
        labelAr: 'استلام المنحة اليومية (+$350)',
        cost: 0,
        description: 'Collect daily CityWorld resident stipend.',
        descriptionAr: 'تحصل على 350$ مجاناً.',
      },
      {
        id: 'clear_wanted',
        label: 'Legal Bail Settlement',
        labelAr: 'دفع كفالة وإزالة نجوم الشرطة',
        cost: 400,
        description: 'Clear active Wanted Level immediately.',
        descriptionAr: 'يزيل نجوم المطاردة فوراً.',
      },
      {
        id: 'buy_armor',
        label: 'Executive Armor Kit',
        labelAr: 'درع تنفيذي 100%',
        cost: 180,
        description: 'Equip 100 Armor plating.',
        descriptionAr: 'يجهزك بدرع كامل.',
      },
    ],
  },
  {
    id: 'safehouse',
    name: 'Pinecrest Safe House',
    nameAr: 'البيت الآمن في الريف',
    subtitle: 'Countryside Hideout & Rest',
    subtitleAr: 'مخبأ للراحة وإزالة الشرطة',
    kind: 'safehouse',
    exteriorPos: { x: -165, y: 0, z: -380 },
    interiorCenter: { x: 240, y: -120, z: 0 },
    accentColor: 0x34d399,
    shopActions: [
      {
        id: 'rest_heal',
        label: 'Rest & Full Recovery',
        labelAr: 'نوم واستشفاء كامل (مجاني)',
        cost: 0,
        description: 'Restore Health, Stamina, and cool off heat.',
        descriptionAr: 'يعالجك بالكامل ويزيل مطاردة الشرطة.',
      },
      {
        id: 'spawn_suv',
        label: 'Prep Ridge Runner SUV (122 km/h)',
        labelAr: 'تجهيز سيارة دفع رباعي (122 كم/س)',
        cost: 250,
        description: 'Stage an all-terrain 122 km/h SUV outside the cabin.',
        descriptionAr: 'تظهر سيارة SUV بسرعة 122 كم/س خارج الكوخ.',
      },
    ],
  },
  {
    id: 'gun_shop',
    name: 'CW Tactical Armory',
    nameAr: 'متجر أسلحة CityWorld',
    subtitle: 'Firearms, Shotguns, Rifles & RPG Launchers',
    subtitleAr: 'أسلحة نارية وبنادق وشوزن وقاذف RPG',
    kind: 'gunshop',
    exteriorPos: { x: -80, y: 0, z: 131 },
    interiorCenter: { x: 720, y: -120, z: 0 },
    accentColor: 0xef4444,
    shopActions: [
      {
        id: 'buy_weapon_pistol',
        label: 'CW-9 Pistol + 90 Rounds',
        labelAr: 'مسدس CW-9 + 90 طلقة',
        cost: 140,
        description: 'Reliable sidearm with full magazine reserve.',
        descriptionAr: 'مسدس سريع وموثوق مع ذخيرة كاملة.',
      },
      {
        id: 'buy_weapon_smg',
        label: 'Vortex SMG + 180 Rounds',
        labelAr: 'رشاش Vortex SMG + 180 طلقة',
        cost: 260,
        description: 'Unlock rapid-fire submachine gun.',
        descriptionAr: 'فتح وشراء الرشاش السريع.',
      },
      {
        id: 'buy_weapon_shotgun',
        label: 'Striker 12G Shotgun + 36 Shells',
        labelAr: 'شوزن Striker 12G + 36 طلقة',
        cost: 390,
        description: 'Heavy close-quarters buckshot blaster.',
        descriptionAr: 'سلاح قوي للمسافات القريبة.',
      },
      {
        id: 'buy_weapon_rifle',
        label: 'Titan AR-15 Rifle + 150 Rounds',
        labelAr: 'بندقية Titan AR-15 + 150 طلقة',
        cost: 540,
        description: 'Long-range high-velocity assault rifle.',
        descriptionAr: 'بندقية هجومية دقيقة وبعيدة المدى.',
      },
      {
        id: 'buy_weapon_rpg',
        label: 'HX-7 RPG Launcher + 6 Rockets',
        labelAr: 'قاذف صواريخ HX-7 RPG + 6 صواريخ',
        cost: 980,
        description: 'Destroys vehicles in a single direct hit.',
        descriptionAr: 'يفجر السيارات من ضربة واحدة.',
      },
      {
        id: 'buy_weapon_ammo_crate',
        label: 'Heavy Tactical Ammo & Rockets Crate',
        labelAr: 'صندوق ذخيرة ثقيلة وصواريخ',
        cost: 180,
        description: 'Refills all owned firearms & adds +4 RPG rockets.',
        descriptionAr: 'تعبئة جميع الأسلحة وإضافة 4 صواريخ.',
      },
    ],
  },
  {
    id: 'skin_boutique',
    name: 'Luxe Couture & Skins',
    nameAr: 'محل الأزياء والسكنات الفاخر',
    subtitle: 'Designer Outfits & 24K Pure Gold Skin',
    subtitleAr: 'ملابس وأزياء متعددة وسكن الذهب الخالص',
    kind: 'skins',
    exteriorPos: { x: 0, y: 0, z: 131 },
    interiorCenter: { x: 840, y: -120, z: 0 },
    accentColor: 0xfacc15,
    shopActions: [
      {
        id: 'buy_skin_crimson_racer',
        label: 'Crimson Street Racer Skin',
        labelAr: 'سكن متسابق الشوارع الأحمر',
        cost: 280,
        description: 'Ruby leather jacket & dark track pants.',
        descriptionAr: 'جاكيت جلد أحمر أنيق.',
      },
      {
        id: 'buy_skin_tactical_stealth',
        label: 'Shadow Tactical Ops Skin',
        labelAr: 'سكن البدلة التكتيكية السوداء',
        cost: 540,
        description: 'Stealth obsidian combat outfit.',
        descriptionAr: 'زي قتالي أسود داكن.',
      },
      {
        id: 'buy_skin_emerald_vip',
        label: 'Emerald Executive Suit Skin',
        labelAr: 'سكن بدلة الزمرد الفاخرة',
        cost: 820,
        description: 'Tailored emerald suit & ivory shirt.',
        descriptionAr: 'بدلة زمردية راقية.',
      },
      {
        id: 'buy_skin_royal_cyber',
        label: 'Neon Midnight Cyber Skin',
        labelAr: 'سكن سايبر النيون البنفسجي',
        cost: 1150,
        description: 'Metallic violet armor with neon accents.',
        descriptionAr: 'سكن مستقبلي معدني لامع.',
      },
      {
        id: 'buy_skin_pure_gold',
        label: '24K Pure Gold Legend Skin',
        labelAr: 'سكن الذهب الخالص 24 قيراط (الأفخم)',
        cost: 1650,
        description: 'Solid gleaming 24-karat gold outfit.',
        descriptionAr: 'أغلى وأفخم سكن مصنوع من الذهب الخالص اللامع!',
      },
    ],
  },
  {
    id: 'premier_motors',
    name: 'Premier Auto Showroom',
    nameAr: 'معرض السيارات الشامل (Premier Motors)',
    subtitle: 'Own & Deliver Vehicles Tiered Weak to 342 km/h Hypercars',
    subtitleAr: 'شراء وامتلاك السيارات من الاقتصادية إلى الخارقة +340 كم/س',
    kind: 'dealership',
    exteriorPos: { x: 80, y: 0, z: 131 },
    interiorCenter: { x: 960, y: -120, z: 0 },
    accentColor: 0x3b82f6,
    shopActions: [
      {
        id: 'buy_car_compact',
        label: 'Tier 1 · Pico Hatch Compact (112 km/h)',
        labelAr: 'فئة 1 · بيكو هاتش الاقتصادية (112 كم/س)',
        cost: 1100,
        description: 'Entry-level 112 km/h compact city car. Added to Phone.',
        descriptionAr: 'سيارة خفيفة بسرعة 112 كم/س تضاف لهاتفك.',
      },
      {
        id: 'buy_car_sedan',
        label: 'Tier 2 · Metro Cruiser Sedan (130 km/h)',
        labelAr: 'فئة 2 · سيدان مترو كروزر (130 كم/س)',
        cost: 1450,
        description: 'Balanced 130 km/h everyday sedan. Added to Phone.',
        descriptionAr: 'سيارة متوازنة بسرعة 130 كم/س تضاف لهاتفك.',
      },
      {
        id: 'buy_car_suv',
        label: 'Tier 3 · Ridge Runner SUV (122 km/h)',
        labelAr: 'فئة 3 · دفع رباعي ريدج رانر (122 كم/س)',
        cost: 1850,
        description: 'Heavy all-terrain 122 km/h 4x4. Added to Phone.',
        descriptionAr: 'سيارة قوية 122 كم/س للطرق الوعرة تضاف لهاتفك.',
      },
      {
        id: 'buy_car_motorcycle',
        label: 'Tier 4 · Apex Superbike (166 km/h)',
        labelAr: 'فئة 4 · دراجة أبيكس النارية (166 كم/س)',
        cost: 2200,
        description: 'Agile 166 km/h street superbike. Added to Phone.',
        descriptionAr: 'دراجة نارية سريعة 166 كم/س تضاف لهاتفك.',
      },
      {
        id: 'buy_car_muscle',
        label: 'Tier 5 · V8 Stallion Muscle (169 km/h)',
        labelAr: 'فئة 5 · عضلات V8 ستاليون (169 كم/س)',
        cost: 2650,
        description: 'High-torque 169 km/h V8 coupe. Added to Phone.',
        descriptionAr: 'سيارة عضلات قوية 169 كم/س تضاف لهاتفك.',
      },
      {
        id: 'buy_car_sports',
        label: 'Tier 6 · Veloce GT Sports (176 km/h)',
        labelAr: 'فئة 6 · فيلوسي GT الرياضية (176 كم/س)',
        cost: 3200,
        description: 'Precision 176 km/h street racer. Added to Phone.',
        descriptionAr: 'سيارة رياضية 176 كم/س تضاف لهاتفك.',
      },
      {
        id: 'buy_car_luxury',
        label: 'Tier 7 · Sovereign V12 Luxury (155 km/h)',
        labelAr: 'فئة 7 · سوفرين V12 الفاخرة (155 كم/س)',
        cost: 3850,
        description: 'Armored-feel 155 km/h flagship saloon. Added to Phone.',
        descriptionAr: 'سيارة فخمة ومتينة 155 كم/س تضاف لهاتفك.',
      },
      {
        id: 'buy_car_supercar',
        label: 'Tier 8 · Apex Hyper GT (223 km/h)',
        labelAr: 'فئة 8 · أبيكس هايبر GT الخارقة (223 كم/س)',
        cost: 4800,
        description: '223 km/h turbocharged hypercar. Added to Phone.',
        descriptionAr: 'سوبركار خارقة بسرعة 223 كم/س تضاف لهاتفك!',
      },
      {
        id: 'buy_car_hyper_viper',
        label: 'Tier 9 · Viper V10 Venom (252 km/h)',
        labelAr: 'فئة 9 · فايبر V10 فينوم (252 كم/س)',
        cost: 5800,
        description: '252 km/h V10 extreme street hypercar. Added to Phone.',
        descriptionAr: 'سيارة فائقة السرعة 252 كم/س تضاف لهاتفك!',
      },
      {
        id: 'buy_car_track_phantom',
        label: 'Tier 10 · Phantom GTR-X (292 km/h)',
        labelAr: 'فئة 10 · فانتوم GTR-X الصاروخية (292 كم/س)',
        cost: 7200,
        description: '292 km/h aerodynamic track monster. Added to Phone.',
        descriptionAr: 'وحش حلبات بسرعة 292 كم/س تضاف لهاتفك!',
      },
      {
        id: 'buy_car_nova_x',
        label: 'Tier 11 · Zenith Nova X12 (342 km/h)',
        labelAr: 'فئة 11 · زينيث نوفا X12 الأسطورية (342 كم/س)',
        cost: 9500,
        description: 'Fastest 342 km/h supersonic hypercar in CityWorld!',
        descriptionAr: 'أقوى وأسرع سيارة في اللعبة بسرعة 342 كم/س!',
      },
      {
        id: 'buy_car_airplane',
        label: 'Tier 12 · SkyHopper Prop Plane (302 km/h)',
        labelAr: 'فئة 12 · طائرة سيتي وورلد للطيران إلى الجزيرة (302 كم/س)',
        cost: 12000,
        description: 'Fly across the ocean to Palm Cove Island! Also parked at Airport.',
        descriptionAr: 'تسمح لك بالطيران عبر البحر إلى الجزيرة (تتوفر أيضاً في المطار مجاناً).',
      },
    ],
  },
  // 4 Purchasable Live-In Houses (Priced > $5,000 progressively by size, with Food & Bed inside)
  {
    id: 'house_maple_small',
    name: 'Maple Cozy Cottage (Small Home)',
    nameAr: 'بيت مابل الدافئ (منزل صغير)',
    subtitle: 'Cozy 1-Story Home · Kitchen Food & Bed · $5,500',
    subtitleAr: 'منزل طابق واحد مع طاولة أكل وسرير نوم ($5,500)',
    kind: 'house',
    houseSizeTier: 1,
    housePrice: 5500,
    exteriorPos: { x: -205, y: 0, z: 29 },
    interiorCenter: { x: 1080, y: -120, z: 0 },
    accentColor: 0xfb923c,
    shopActions: [
      {
        id: 'buy_house',
        label: 'Buy Cozy Cottage Property',
        labelAr: 'شراء وامتلاك هذا المنزل الصغير',
        cost: 5500,
        description: 'Own this Maple Oaks home to eat and sleep anytime.',
        descriptionAr: 'تملك المنزل لتتمكن من الأكل والنوم بداخله في أي وقت.',
      },
      {
        id: 'house_eat',
        label: 'Eat Home Cooked Meal (+60 HP & Full Stamina)',
        labelAr: 'تناول وجبة في البيت (+60 صحة وطاقة كاملة)',
        cost: 0,
        description: 'Enjoy a warm meal from your kitchen table (Owners only).',
        descriptionAr: 'تناول طعاماً منزلياً مجاناً عند امتلاك البيت.',
      },
      {
        id: 'house_sleep',
        label: 'Sleep in Bed (+7h · Full Recovery & Clear Police)',
        labelAr: 'النوم على السرير (+7 ساعات · شفاء كامل وإزالة الشرطة)',
        cost: 0,
        description: 'Sleep to heal 100%, advance time, and clear wanted stars.',
        descriptionAr: 'نم في سريرك لاستعادة صحتك وتقديم الوقت وإزالة الملاحقة.',
      },
    ],
  },
  {
    id: 'house_suburb_medium',
    name: 'Cedar 2-Story Residence (Medium Home)',
    nameAr: 'منزل سيدار ذو الطابقين (منزل متوسط)',
    subtitle: 'Spacious 2-Story Home · Kitchen & Bedroom · $9,500',
    subtitleAr: 'منزل واسع من طابقين مع مطبخ وغرفة نوم ($9,500)',
    kind: 'house',
    houseSizeTier: 2,
    housePrice: 9500,
    exteriorPos: { x: -205, y: 0, z: -51 },
    interiorCenter: { x: 1200, y: -120, z: 0 },
    accentColor: 0xf59e0b,
    shopActions: [
      {
        id: 'buy_house',
        label: 'Buy 2-Story Residence Property',
        labelAr: 'شراء وامتلاك المنزل المتوسط',
        cost: 9500,
        description: 'Own this 2-story residence to eat & sleep anytime.',
        descriptionAr: 'تملك المنزل ذو الطابقين للأكل والنوم مجاناً.',
      },
      {
        id: 'house_eat',
        label: 'Eat Home Cooked Meal (+60 HP & Full Stamina)',
        labelAr: 'تناول وجبة في البيت (+60 صحة وطاقة كاملة)',
        cost: 0,
        description: 'Dine at your dining table (Owners only).',
        descriptionAr: 'تناول الطعام من مطبخ منزلك.',
      },
      {
        id: 'house_sleep',
        label: 'Sleep in Bed (+7h · Full Recovery & Clear Police)',
        labelAr: 'النوم على السرير (+7 ساعات · شفاء كامل وإزالة الشرطة)',
        cost: 0,
        description: 'Rest in your master bedroom and advance time.',
        descriptionAr: 'نم في غرفتك لاستعادة كامل طاقتك وصحتك.',
      },
    ],
  },
  {
    id: 'house_beach_villa',
    name: 'Azure Coast Beach Villa (Large Home)',
    nameAr: 'فيلا الشاطئ الفاخرة (منزل كبير)',
    subtitle: 'Oceanfront Villa with Pool, Dining & Suite · $16,500',
    subtitleAr: 'فيلا كبيرة على الشاطئ مع مسبح ومطبخ وسرير فاخر ($16,500)',
    kind: 'house',
    houseSizeTier: 3,
    housePrice: 16500,
    exteriorPos: { x: -135, y: 0, z: 277 },
    interiorCenter: { x: 1320, y: -120, z: 0 },
    accentColor: 0x06b6d4,
    shopActions: [
      {
        id: 'buy_house',
        label: 'Buy Oceanfront Beach Villa',
        labelAr: 'شراء وامتلاك فيلا الشاطئ الكبيرة',
        cost: 16500,
        description: 'Own this large beachfront villa with full amenities.',
        descriptionAr: 'تملك هذه الفيلا الكبيرة المطلة على الشاطئ.',
      },
      {
        id: 'house_eat',
        label: 'Eat Gourmet Villa Feast (+60 HP & Full Stamina)',
        labelAr: 'تناول وليمة الفيلا (+60 صحة وطاقة كاملة)',
        cost: 0,
        description: 'Enjoy seafood dinner in your dining hall (Owners only).',
        descriptionAr: 'وجبة فاخرة مجانية لأصحاب الفيلا.',
      },
      {
        id: 'house_sleep',
        label: 'Sleep in Ocean Suite (+7h · Full Recovery & Clear Police)',
        labelAr: 'النوم في الجناح الملكي (+7 ساعات · شفاء وإزالة الشرطة)',
        cost: 0,
        description: 'Sleep in the king suite, restore 100% & clear stars.',
        descriptionAr: 'نوم مريح يعيد الصحة 100% ويزيل الملاحقة.',
      },
    ],
  },
  {
    id: 'house_royal_mansion',
    name: 'Crestwood Royal Mansion (Mega Estate)',
    nameAr: 'قصر كريستوود الملكي (أكبر قصر بالمدينة)',
    subtitle: 'Grand Crestwood Estate · Banquet Hall & Royal Bed · $28,000',
    subtitleAr: 'أكبر وأفخم قصر سكني في حي الأثرياء مع طعام وغرفة ملكية ($28,000)',
    kind: 'house',
    houseSizeTier: 4,
    housePrice: 28000,
    exteriorPos: { x: -190, y: 0, z: -130 },
    interiorCenter: { x: 1440, y: -120, z: 0 },
    accentColor: 0xfacc15,
    shopActions: [
      {
        id: 'buy_house',
        label: 'Buy Crestwood Royal Mansion',
        labelAr: 'شراء وامتلاك القصر الملكي الكبير',
        cost: 28000,
        description: 'Own the largest luxury mansion in CityWorld.',
        descriptionAr: 'امتلك أفخم وأكبر قصر في CityWorld.',
      },
      {
        id: 'house_eat',
        label: 'Eat Royal Banquet (+60 HP & Full Stamina)',
        labelAr: 'تناول مأدبة القصر الملكي (+60 صحة وطاقة كاملة)',
        cost: 0,
        description: 'Eat a full banquet in your mansion dining room.',
        descriptionAr: 'مأدبة فاخرة في قاعة الطعام الخاصة بك.',
      },
      {
        id: 'house_sleep',
        label: 'Sleep in Royal Master Bed (+7h · Full Recovery)',
        labelAr: 'النوم في السرير الملكي (+7 ساعات · شفاء وإزالة الشرطة)',
        cost: 0,
        description: 'Sleep like royalty: 100% heal, time +7h & clear stars.',
        descriptionAr: 'نوم ملكي يعالجك 100% ويقدم الوقت ويزيل الشرطة.',
      },
    ],
  },
];

export function getBridgeDeckHeight(x: number, z: number): number | null {
  if (Math.abs(z - -265) <= 9.5 && x >= -100 && x <= 100) {
    const absX = Math.abs(x);
    if (absX <= 50) return 5.5;
    const t = 1 - (absX - 50) / 50;
    return Math.max(0, t * 5.5);
  }
  return null;
}

export function groundHeightAt(x: number, z: number): number {
  // Tropical Island out in the southern ocean (reachable by Airplane)
  const islDx = (x - ISLAND_CENTER.x) / 1.05;
  const islDz = (z - ISLAND_CENTER.z) / 1.15;
  const rIsl = Math.hypot(islDx, islDz);
  if (rIsl < 112) {
    // Flat landing airstrip strip along the center of the Island
    if (Math.abs(x - ISLAND_CENTER.x) <= 24 && z >= 682 && z <= 828) {
      return 0.85;
    }
    const coastBlend = Math.max(0, 1 - rIsl / 106);
    const dome = Math.pow(coastBlend, 0.72) * 3.8;
    const hillExtra =
      rIsl < 72
        ? Math.max(0, Math.sin(x * 0.04) * Math.cos(z * 0.04) * 1.6 + (x < -210 ? 1.8 : 0))
        : 0;
    const islHeight = -3.4 + dome * 1.45 + hillExtra;
    if (islHeight > -3.2) return islHeight;
  }

  if (x >= 140 && x <= 390 && z >= 140 && z <= 355) {
    return 0.4;
  }
  if (x >= 140 && z > 355) {
    return -3.2;
  }

  if (z > 300 && x < 140) {
    const distPastBoardwalk = z - 300;
    if (distPastBoardwalk < 55) {
      return -0.015 * distPastBoardwalk;
    }
    const seaDepth = Math.min(4.2, 0.825 + (distPastBoardwalk - 55) * 0.055);
    return -seaDepth;
  }

  if (x >= -360 && x <= 530 && z >= -285 && z <= 300) {
    if (x < -145 && x > -330 && z < -45 && z > -255) {
      const nearRoad =
        Math.abs(x - -240) < 12 ||
        Math.abs(z - -120) < 12 ||
        Math.abs(z - -195) < 12 ||
        Math.abs(z - -40) < 12;
      if (!nearRoad) {
        return 0.15;
      }
    }
    return 0;
  }

  let hill = 0;
  if (z < -285 && x < 145) {
    const blend = Math.min(1, (-285 - z) / 60);
    const onLoop =
      (Math.abs(x - -240) < 11 && z > -472) ||
      (Math.abs(x - 40) < 11 && z > -472) ||
      (Math.abs(z - -460) < 11 && x >= -252 && x <= 52);

    const wave =
      Math.sin(x * 0.015) * Math.cos(z * 0.014) * 5.5 +
      Math.sin(x * 0.032 + 1.2) * Math.sin(z * 0.028) * 2.2 +
      4.5;
    hill = blend * (onLoop ? Math.min(2.2, Math.max(0, wave * 0.25)) : Math.max(0, wave));
  }

  const edgeDist = Math.max(Math.abs(x) - 520, -z - 500);
  if (edgeDist > 0 && z < 300) {
    hill += Math.min(45, edgeDist * 0.22 + Math.sin(x * 0.04) * Math.cos(z * 0.04) * 4);
  }

  return hill;
}

export function getDistrictAt(x: number, z: number): DistrictInfo {
  if (z > 620 && Math.hypot(x - ISLAND_CENTER.x, z - ISLAND_CENTER.z) < 135) {
    return DISTRICTS.find((d) => d.id === 'island')!;
  }

  if (
    Math.abs(z - -265) < 11 ||
    Math.abs(z - 290) < 10 ||
    Math.abs(x - -340) < 10 ||
    Math.abs(x - 350) < 10
  ) {
    return DISTRICTS.find((d) => d.id === 'highway')!;
  }

  for (const d of DISTRICTS) {
    if (d.id === 'highway' || d.id === 'island') continue;
    if (x >= d.bounds.minX && x <= d.bounds.maxX && z >= d.bounds.minZ && z <= d.bounds.maxZ) {
      return d;
    }
  }

  if (z > 300) return DISTRICTS.find((d) => d.id === 'beach')!;
  return DISTRICTS.find((d) => d.id === 'countryside')!;
}

const COLLIDER_GRID_CELL = 44;
interface ColliderGrid {
  cells: Map<number, ColliderBox[]>;
  seenStamp: WeakMap<ColliderBox, number>;
  stamp: number;
}
const colliderGridCache = new WeakMap<ColliderBox[], ColliderGrid>();

function cellHash(cx: number, cz: number): number {
  return ((cx + 512) << 12) | (cz + 512);
}

function getColliderGrid(colliders: ColliderBox[]): ColliderGrid {
  let grid = colliderGridCache.get(colliders);
  if (grid) return grid;

  const cells = new Map<number, ColliderBox[]>();
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const minCx = Math.floor(c.minX / COLLIDER_GRID_CELL);
    const maxCx = Math.floor(c.maxX / COLLIDER_GRID_CELL);
    const minCz = Math.floor(c.minZ / COLLIDER_GRID_CELL);
    const maxCz = Math.floor(c.maxZ / COLLIDER_GRID_CELL);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = cellHash(cx, cz);
        let bucket = cells.get(key);
        if (!bucket) {
          bucket = [];
          cells.set(key, bucket);
        }
        bucket.push(c);
      }
    }
  }
  grid = { cells, seenStamp: new WeakMap<ColliderBox, number>(), stamp: 1 };
  colliderGridCache.set(colliders, grid);
  return grid;
}

export function resolveCircleColliders(
  x: number,
  z: number,
  y: number,
  radius: number,
  colliders: ColliderBox[]
): { x: number; z: number; hit: boolean } {
  let outX = x;
  let outZ = z;
  let hit = false;
  const radiusSq = radius * radius;

  const grid = getColliderGrid(colliders);
  grid.stamp++;
  const stamp = grid.stamp;

  const minCx = Math.floor((x - radius - 2) / COLLIDER_GRID_CELL);
  const maxCx = Math.floor((x + radius + 2) / COLLIDER_GRID_CELL);
  const minCz = Math.floor((z - radius - 2) / COLLIDER_GRID_CELL);
  const maxCz = Math.floor((z + radius + 2) / COLLIDER_GRID_CELL);

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const bucket = grid.cells.get(cellHash(cx, cz));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const c = bucket[i];
        if (grid.seenStamp.get(c) === stamp) continue;
        grid.seenStamp.set(c, stamp);

        if (y > c.maxY) continue;
        if (c.minY !== undefined && y + 1.8 < c.minY) continue;

        const closestX = outX < c.minX ? c.minX : outX > c.maxX ? c.maxX : outX;
        const closestZ = outZ < c.minZ ? c.minZ : outZ > c.maxZ ? c.maxZ : outZ;
        const dx = outX - closestX;
        const dz = outZ - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radiusSq) {
          hit = true;
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const push = radius - dist;
            outX += (dx / dist) * push;
            outZ += (dz / dist) * push;
          } else {
            const left = Math.abs(outX - c.minX);
            const right = Math.abs(c.maxX - outX);
            const top = Math.abs(outZ - c.minZ);
            const bottom = Math.abs(c.maxZ - outZ);
            const m = Math.min(left, right, top, bottom);
            if (m === left) outX = c.minX - radius;
            else if (m === right) outX = c.maxX + radius;
            else if (m === top) outZ = c.minZ - radius;
            else outZ = c.maxZ + radius;
          }
        }
      }
    }
  }

  return { x: outX, z: outZ, hit };
}
