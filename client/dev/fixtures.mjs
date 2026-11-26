// Fixture data for the mock server. Exact values are relied on by dev/tests.
// Shapes follow server/server.js, server/broadcast.js and server/mqtt.js.

const brands = () => [
  { id: 1, name: 'Bambu Lab', default_empty_weight: 250 },
  { id: 2, name: 'Polymaker', default_empty_weight: 140 },
];

const materials = () => [
  { id: 1, name: 'PLA' },
  { id: 2, name: 'PETG' },
];

const spool = (o) => ({
  brand_id: 1, brand_name: 'Bambu Lab', material_id: 1, material_name: 'PLA',
  subtype: 'Basic', color: '#888888', color_name: null, cost: 20,
  total_weight: 1000, empty_weight: 250, used_weight: 0, location: null,
  shopify_variant_id: null, rfid: null, rfid_aliases: null, archived: 0,
  created_at: '2026-10-01 10:00:00', last_used_at: null, last_print_name: null,
  ...o,
});

const spools = () => [
  spool({ id: 1, color: '#9d2235', color_name: 'Dark Red', total_weight: 1000, used_weight: 309, cost: 20,
    shopify_variant_id: '123', location: 'Shelf A', last_used_at: '2026-11-25 18:00:00', last_print_name: 'Benchy' }),
  spool({ id: 2, color: '#000000', color_name: 'Black', total_weight: 500, used_weight: 100, cost: 30 }),
  spool({ id: 3, color: '#ffffff', color_name: 'White', total_weight: 1000, used_weight: 950 }),
  spool({ id: 4, color: '#ff8800', color_name: 'Orange', total_weight: 1000, used_weight: 1000 }),
  spool({ id: 5, color: '#00aa00', color_name: 'Green', total_weight: 1000, used_weight: 200, archived: 1 }),
  spool({ id: 6, color: '#008080', color_name: null, total_weight: 1000, used_weight: 940 }),
];

const printers = () => [{ id: 1, name: 'X2D', ip: '192.168.1.50', serial: 'SERIAL1', access_code: '********' }];

const tray = (type, color) => ({ tray_type: type, tray_color: color, tray_sub_brands: '' });

const ams = () => ({
  1: [
    { id: '0', humidity: '4', temp: '24.5', tray: [
      tray('PLA', '000000FF'), tray('PLA', 'FFFFFFFF'), tray('PETG', '3366CCFF'), tray('PLA', '9D2235FF')] },
    { id: '128', tray: [tray('', '')] },
    { id: '254', tray: [tray('', '')] },
    { id: '255', tray: [tray('', '')] },
  ],
});

const assignments = () => ({ 1: { '0-0': 2, '0-1': 3, '0-2': 999, '0-3': 1 } });

const printingState = () => ({
  status: 'RUNNING', stage: 'Printing',
  name: 'Articulated_dragon_with_a_very_long_name_that_has_no_spaces_v12_final',
  progress: 64, remainingTime: 125, layerNum: 142, totalLayerNum: 222,
  totalGramsDeducted: 31.4, slicerFilaments: [{ used_g: 49.1 }],
  currentTrayId: '0-3', activeTrays: ['0-3'],
  bedTemp: 55, bedTarget: 55, chamberTemp: 38, nozzleTemp: 215, nozzleTarget: 220,
  light: true, startTime: '2026-11-26T10:00:00.000Z', takeovers: [],
  raw: {
    device: { extruder: { info: [{ id: 0, temp: (220 << 16) | 215 }, { id: 1, temp: 35 }] } },
    cooling_fan_speed: '15', heatbreak_fan_speed: '0', big_fan1_speed: '0', big_fan2_speed: '0',
  },
});

const idleState = () => ({
  status: 'IDLE', stage: 'Idle', name: 'Benchy', progress: 0, remainingTime: 0,
  bedTemp: 24, bedTarget: 0, chamberTemp: 22, nozzleTemp: 26, nozzleTarget: 0, light: false,
  raw: { cooling_fan_speed: '0', heatbreak_fan_speed: '0', big_fan1_speed: '0', big_fan2_speed: '0' },
});

const settings = () => ({
  calc_wear_rate: '0.5', calc_labor_rate: '12', calc_markup: '50', calc_avg_wattage: '150',
  calc_energy_rate: '0.25', energy_rate_source: 'manual', low_stock_threshold: '200', currency: 'GBP',
  ams_name_1_0: 'AMS 2 Pro',
});

const archives = () => [
  { id: 1, printer_id: 1, spool_id: 1, print_name: 'Benchy', status: 'FINISH', duration_seconds: 3725,
    energy_kwh: 0.12, energy_cost: 0.03, filament_used_g: 30, filament_cost: 0.6, total_cost: 0.63,
    created_at: '2026-11-25 18:00:00', photo_path: '/media/1_photo.jpg', timelapse_path: '/media/1_timelapse.mp4',
    thumbnail_path: '/media/1_thumb.png', ai_analysis: '{"status":"SUCCESS","reason":"Looks good"}',
    spools_used: [{ brand: 'Bambu Lab', material: 'PLA', color: '#9d2235', color_name: 'Dark Red', weight_used_g: 30 }] },
  { id: 2, printer_id: 1, spool_id: 2, print_name: 'Bracket', status: 'FAILED', duration_seconds: 900,
    energy_kwh: 0.05, energy_cost: 0.01, filament_used_g: 12, filament_cost: 0.72, total_cost: 0.73,
    created_at: '2026-11-24 12:00:00', photo_path: null, timelapse_path: null, thumbnail_path: null,
    ai_analysis: '{"status":"SPAGHETTI","reason":"Detached from bed"}',
    spools_used: [{ brand: 'Bambu Lab', material: 'PETG', color: '#000000', color_name: 'Black', weight_used_g: 12 }] },
];

const analytics = () => [
  { id: 1, created_at: '2026-11-25 18:00:00', total_cost: 0.63, energy_cost: 0.03, filament_cost: 0.6,
    filament_used_g: 30, spool_weight_used_g: 30, ai_analysis: '{"status":"SUCCESS","reason":"Looks good"}',
    material: 'PLA', brand: 'Bambu Lab', color: '#9d2235' },
  { id: 2, created_at: '2026-11-24 12:00:00', total_cost: 0.73, energy_cost: 0.01, filament_cost: 0.72,
    filament_used_g: 12, spool_weight_used_g: 12, ai_analysis: '{"status":"SPAGHETTI","reason":"Detached from bed"}',
    material: 'PETG', brand: 'Bambu Lab', color: '#000000' },
];

const jobs = () => [
  { id: 1, project_name: 'Desk tidy', customer_name: 'Alice', notes: 'Blue please', status: 'Quote',
    filament_cost: 2.2, electricity_cost: 0.08, wear_cost: 1, labor_cost: 3, total_cost: 6.28,
    markup_amount: 3.14, final_price: 9.42, print_time_hours: 2,
    spool_data: [{ slot: 1, weight: 50, spool_id: 1, spool_name: 'Bambu Lab PLA', cost: 1 }],
    created_at: '2026-11-20 09:00:00', updated_at: '2026-11-20 09:00:00' },
  { id: 2, project_name: 'Lamp shade', customer_name: 'Bob', notes: '', status: 'Completed',
    filament_cost: 5, electricity_cost: 0.2, wear_cost: 2, labor_cost: 3, total_cost: 10.2,
    markup_amount: 5.1, final_price: 15.3, print_time_hours: 4, spool_data: [],
    created_at: '2026-11-10 09:00:00', updated_at: '2026-11-12 09:00:00' },
];

const scrapModels = () => [
  { id: 1, name: 'Keychain', weight_g: 10, url: 'https://example.com/keychain', description: 'Small tag' },
  { id: 2, name: 'Coaster', weight_g: 80, url: '', description: 'Round coaster' },
];

const backups = () => [{ name: 'backup-2026-11-25.zip', size: 204800, time: Date.UTC(2026, 10, 25, 3, 0) }];

const knowledge = () => [
  { brand: 'Bambu Lab', weight: 250, confidence: 'high', note: 'Reusable spool' },
  { brand: 'Polymaker', weight: 140, confidence: 'medium', note: 'Cardboard spool' },
];

export function buildScenario(name = 'default') {
  const data = {
    name,
    brands: brands(), materials: materials(), spools: spools(), printers: printers(),
    ams: ams(), assignments: assignments(), states: { 1: printingState() },
    settings: settings(), archives: archives(), analytics: analytics(), jobs: jobs(),
    scrapModels: scrapModels(), backups: backups(), knowledge: knowledge(),
    setupRequired: false, ssoConfigured: false, fail: false,
  };
  switch (name) {
    case 'default': break;
    case 'runout':
      Object.assign(data.states[1], {
        status: 'PAUSE', stage: 'Paused (Filament Runout)',
        takeovers: [{ fromTray: '0-0', toTray: '0-3', progress: 40, timestamp: '2026-11-26T11:00:00.000Z' }],
      });
      break;
    case 'idle': data.states = { 1: idleState() }; break;
    case 'two-printers':
      data.printers.push({ id: 2, name: 'P1S', ip: '192.168.1.51', serial: 'SERIAL2', access_code: '********' });
      data.states[2] = idleState();
      data.ams[2] = [];
      break;
    case 'no-state': data.states = {}; break;
    case 'sparse': data.states = { 1: { status: 'RUNNING' } }; break;
    case 'empty':
      Object.assign(data, { spools: [], printers: [], ams: {}, assignments: {}, states: {}, archives: [],
        analytics: [], jobs: [], scrapModels: [], backups: [] });
      break;
    case 'fail': data.fail = true; break;
    case 'sso': data.ssoConfigured = true; break;
    case 'setup': data.setupRequired = true; break;
    default: throw new Error(`Unknown scenario ${name}`);
  }
  return data;
}

export const SCENARIOS = ['default', 'runout', 'idle', 'two-printers', 'no-state', 'sparse', 'empty', 'fail', 'sso', 'setup'];
