import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve(process.env.SQLITE_DB_PATH || resolve(process.cwd(), 'data/frota.sqlite'));
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

const now = () => new Date().toISOString();
let ocrWorkerPromise;

const tables = {
  profiles: {
    columns: ['name', 'phone', 'cpf', 'role', 'is_active'],
    booleans: ['is_active'],
    timestamps: 'both',
    order: 'created_at DESC',
  },
  trucks: {
    columns: ['plate', 'model', 'year', 'truck_type', 'axles_count', 'fuel_efficiency_km_per_l', 'current_km', 'next_maintenance_km', 'next_maintenance_date', 'status', 'notes'],
    timestamps: 'both',
    order: 'created_at DESC',
  },
  drivers: {
    columns: ['user_id', 'name', 'phone', 'cpf', 'truck_id', 'is_active'],
    booleans: ['is_active'],
    timestamps: 'both',
    order: 'created_at DESC',
  },
  trips: {
    columns: ['truck_id', 'driver_id', 'origin_city', 'origin_state', 'destination_city', 'destination_state', 'cargo_description', 'freight_value', 'start_date', 'end_date', 'km_start', 'km_end', 'distance_km', 'status', 'notes'],
    timestamps: 'both',
    order: 'start_date DESC',
  },
  expenses: {
    columns: ['trip_id', 'category', 'amount', 'description', 'expense_date', 'location_city', 'location_state', 'receipt_url', 'created_by'],
    timestamps: 'created',
    order: 'expense_date DESC',
  },
  fuel_records: {
    columns: ['trip_id', 'truck_id', 'fuel_date', 'station_name', 'city', 'state', 'liters', 'price_per_liter', 'total_amount', 'km_at_refuel', 'receipt_url', 'created_by'],
    timestamps: 'created',
    order: 'fuel_date DESC',
  },
  maintenance_records: {
    columns: ['truck_id', 'maintenance_type', 'maintenance_date', 'km_at_maintenance', 'workshop_name', 'description', 'cost', 'receipt_url', 'next_maintenance_km', 'next_maintenance_date', 'created_by'],
    timestamps: 'created',
    order: 'maintenance_date DESC',
  },
  route_estimates: {
    columns: ['trip_id', 'estimated_distance_km', 'estimated_duration_hours', 'estimated_toll_cost', 'estimated_fuel_liters', 'estimated_fuel_cost', 'estimated_total_cost', 'estimated_profit', 'route_response'],
    timestamps: 'created',
    order: 'created_at DESC',
  },
  alerts: {
    columns: ['alert_type', 'title', 'message', 'related_type', 'related_id', 'priority', 'is_read', 'is_resolved', 'resolved_by', 'resolved_at', 'created_for'],
    booleans: ['is_read', 'is_resolved'],
    timestamps: 'created',
    order: 'created_at DESC',
  },
};

initSchema();

export function localSqliteApiPlugin() {
  return {
    name: 'local-sqlite-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          next();
          return;
        }

        try {
          const url = new URL(req.url, 'http://localhost');
          const path = url.pathname.replace(/^\/api/, '') || '/';
          const result = await handleApi(req, path, url.searchParams);
          sendJson(res, result.status, result.body);
        } catch (error) {
          console.error('[local-sqlite-api]', error);
          sendJson(res, 500, { error: error instanceof Error ? error.message : 'Erro interno' });
        }
      });
    },
  };
}

export async function handleApi(req, path, searchParams) {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1];
  const method = req.method || 'GET';

  if (resource === 'auth') {
    return handleAuth(method, id, req, searchParams);
  }

  if (resource === 'receipt-ocr') {
    return handleReceiptOcr(method, req);
  }

  if (resource === 'dashboard') {
    return ok(getDashboardSummary(searchParams));
  }

  if (resource === 'profiles') {
    return handleCrud('profiles', method, id, req);
  }

  if (resource === 'trucks') {
    return handleCrud('trucks', method, id, req);
  }

  if (resource === 'drivers') {
    return handleDrivers(method, id, req);
  }

  if (resource === 'trips') {
    return handleTrips(method, id, req, searchParams);
  }

  if (resource === 'expenses') {
    return handleCrud('expenses', method, id, req, { trip_id: searchParams.get('trip_id') });
  }

  if (resource === 'fuel-records') {
    return handleCrud('fuel_records', method, id, req, {
      truck_id: searchParams.get('truck_id'),
      trip_id: searchParams.get('trip_id'),
    });
  }

  if (resource === 'maintenance-records') {
    return handleMaintenance(method, id, req, searchParams);
  }

  if (resource === 'route-estimates') {
    return handleRouteEstimates(method, id, req, searchParams);
  }

  if (resource === 'alerts') {
    return handleAlerts(method, id, req, searchParams);
  }

  return { status: 404, body: { error: 'Rota nao encontrada' } };
}

async function handleReceiptOcr(method, req) {
  if (method !== 'POST') return methodNotAllowed();

  const body = await readJson(req);
  const image = String(body.image || '');
  const match = image.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);

  if (!match) {
    return badRequest('Envie uma imagem PNG, JPG ou WEBP.');
  }

  const extension = match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg';
  const filePath = resolve(tmpdir(), `frota-ocr-${randomUUID()}.${extension}`);

  try {
    writeFileSync(filePath, Buffer.from(match[2], 'base64'));
    const worker = await getOcrWorker();
    const result = await worker.recognize(filePath);
    return ok({ text: result.data.text || '' });
  } finally {
    try {
      unlinkSync(filePath);
    } catch {
      // Temp cleanup best effort.
    }
  }
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = import('tesseract.js').then(async ({ createWorker }) => {
      return createWorker('por+eng');
    });
  }

  return ocrWorkerPromise;
}

async function handleAuth(method, action, req, searchParams) {
  if (method === 'GET' && action === 'session') {
    const userId = searchParams.get('userId');
    if (!userId) return ok({ user: null, profile: null });

    const user = normalizeRow(db.prepare('SELECT id, email, profile_id, created_at FROM local_users WHERE id = ?').get(userId));
    if (!user) return ok({ user: null, profile: null });

    const profile = getById('profiles', user.profile_id);
    return ok({ user: toAuthUser(user), profile });
  }

  if (method === 'POST' && action === 'signup') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const role = body.role === 'admin' ? 'admin' : 'driver';

    if (!email || !password || !name) {
      return badRequest('Preencha nome, email e senha.');
    }

    const existing = db.prepare('SELECT id FROM local_users WHERE email = ?').get(email);
    if (existing) return badRequest('Email ja cadastrado.');

    const profile = insertRow('profiles', { name, role, is_active: true });
    const userId = randomUUID();
    const password_salt = randomBytes(16).toString('hex');
    const password_hash = hashPassword(password, password_salt);

    db.prepare(`
      INSERT INTO local_users (id, email, password_hash, password_salt, profile_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, password_hash, password_salt, profile.id, now());

    return ok({ user: toAuthUser({ id: userId, email, profile_id: profile.id }), profile });
  }

  if (method === 'POST' && action === 'signin') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = normalizeRow(db.prepare('SELECT * FROM local_users WHERE email = ?').get(email));

    if (!user || hashPassword(password, user.password_salt) !== user.password_hash) {
      return { status: 401, body: { error: 'Email ou senha invalidos.' } };
    }

    const profile = getById('profiles', user.profile_id);
    return ok({ user: toAuthUser(user), profile });
  }

  return { status: 404, body: { error: 'Rota de autenticacao nao encontrada' } };
}

async function handleCrud(table, method, id, req, filters = {}) {
  if (method === 'GET' && id) return ok(getById(table, id));
  if (method === 'GET') return ok(listRows(table, filters));
  if (method === 'POST') return ok(insertRow(table, await readJson(req)));
  if (method === 'PATCH' && id) return ok(updateRow(table, id, await readJson(req)));
  if (method === 'DELETE' && id) {
    deleteRow(table, id);
    return ok({ ok: true });
  }

  return methodNotAllowed();
}

async function handleDrivers(method, id, req) {
  if (method === 'GET' && id) return ok(hydrateDriver(getById('drivers', id)));
  if (method === 'GET') return ok(listRows('drivers').map(hydrateDriver));
  return handleCrud('drivers', method, id, req);
}

async function handleTrips(method, id, req, searchParams) {
  if (method === 'GET' && id) return ok(hydrateTrip(getById('trips', id)));
  if (method === 'GET') {
    return ok(listRows('trips', {
      status: searchParams.get('status'),
      truck_id: searchParams.get('truck_id'),
      driver_id: searchParams.get('driver_id'),
    }).map(hydrateTrip));
  }

  return handleCrud('trips', method, id, req);
}

async function handleMaintenance(method, id, req, searchParams) {
  if (method === 'GET' && id) return ok(hydrateMaintenance(getById('maintenance_records', id)));
  if (method === 'GET') return ok(listRows('maintenance_records', { truck_id: searchParams.get('truck_id') }).map(hydrateMaintenance));
  return handleCrud('maintenance_records', method, id, req);
}

async function handleRouteEstimates(method, id, req, searchParams) {
  if (method === 'GET') {
    const tripId = searchParams.get('trip_id');
    const rows = listRows('route_estimates', { trip_id: tripId });
    return ok(rows[0] || null);
  }

  return handleCrud('route_estimates', method, id, req);
}

async function handleAlerts(method, id, req, searchParams) {
  if (method === 'GET') {
    return ok(listRows('alerts', {
      created_for: searchParams.get('created_for'),
      is_read: searchParams.has('unread') ? false : null,
    }));
  }

  return handleCrud('alerts', method, id, req);
}

function listRows(table, filters = {}) {
  const config = tables[table];
  const where = [];
  const params = [];

  for (const [key, rawValue] of Object.entries(filters)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    where.push(`${key} = ?`);
    params.push(encodeValue(table, key, rawValue));
  }

  const sql = `SELECT * FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${config.order}`;
  return db.prepare(sql).all(...params).map((row) => normalizeRow(row, table));
}

function getById(table, id) {
  if (!id) return null;
  return normalizeRow(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id), table);
}

function insertRow(table, input) {
  const config = tables[table];
  const data = cleanInput(table, input);
  data.id = randomUUID();

  if (config.timestamps === 'created' || config.timestamps === 'both') data.created_at = now();
  if (config.timestamps === 'both') data.updated_at = data.created_at;

  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...keys.map((key) => data[key]));
  return getById(table, data.id);
}

function updateRow(table, id, input) {
  const config = tables[table];
  const data = cleanInput(table, input);

  if (config.timestamps === 'both') data.updated_at = now();

  const keys = Object.keys(data);
  if (keys.length > 0) {
    db.prepare(`UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((key) => data[key]), id);
  }

  return getById(table, id);
}

function deleteRow(table, id) {
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

function cleanInput(table, input) {
  const config = tables[table];
  const data = {};

  for (const key of config.columns) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
      data[key] = encodeValue(table, key, input[key]);
    }
  }

  return data;
}

function encodeValue(table, key, value) {
  if (tables[table]?.booleans?.includes(key)) return value ? 1 : 0;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value === '' ? null : value;
}

function normalizeRow(row, table) {
  if (!row) return null;

  const output = { ...row };
  for (const key of tables[table]?.booleans || []) {
    if (key in output) output[key] = Boolean(output[key]);
  }

  if (table === 'route_estimates' && typeof output.route_response === 'string') {
    output.route_response = JSON.parse(output.route_response || '{}');
  }

  return output;
}

function hydrateDriver(driver) {
  if (!driver) return null;
  return { ...driver, truck: driver.truck_id ? getById('trucks', driver.truck_id) : undefined };
}

function hydrateMaintenance(record) {
  if (!record) return null;
  return { ...record, truck: getById('trucks', record.truck_id) };
}

function hydrateTrip(trip) {
  if (!trip) return null;
  const routeEstimate = listRows('route_estimates', { trip_id: trip.id })[0];

  return {
    ...trip,
    truck: getById('trucks', trip.truck_id),
    driver: hydrateDriver(getById('drivers', trip.driver_id)),
    expenses: listRows('expenses', { trip_id: trip.id }),
    fuel_records: listRows('fuel_records', { trip_id: trip.id }),
    route_estimate: routeEstimate || undefined,
  };
}

function getDashboardSummary(searchParams) {
  const { start, end } = getMonthRange(searchParams);
  const trips = listRows('trips').filter((trip) => trip.status === 'approved' && trip.start_date >= start && trip.start_date <= end);
  const tripIds = new Set(trips.map((trip) => trip.id));
  const expenses = listRows('expenses').filter((expense) => tripIds.has(expense.trip_id));
  const maintenance = listRows('maintenance_records').filter((record) => record.maintenance_date >= start && record.maintenance_date <= end);

  const totalRevenue = trips.reduce((sum, trip) => sum + Number(trip.freight_value || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalKm = trips.reduce((sum, trip) => sum + (trip.km_start && trip.km_end ? Number(trip.km_end) - Number(trip.km_start) : 0), 0);
  const totalDiesel = expenses.filter((expense) => expense.category === 'diesel').reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalTolls = expenses.filter((expense) => expense.category === 'toll').reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalMaintenance = maintenance.reduce((sum, record) => sum + Number(record.cost || 0), 0);
  const truckStats = {};
  const driverStats = {};

  for (const trip of trips) {
    const truck = getById('trucks', trip.truck_id);
    const driver = getById('drivers', trip.driver_id);
    truckStats[trip.truck_id] ||= { id: trip.truck_id, plate: truck?.plate || '', profit: 0, expenses: 0 };
    driverStats[trip.driver_id] ||= { id: trip.driver_id, name: driver?.name || '', trips: 0 };
    truckStats[trip.truck_id].profit += Number(trip.freight_value || 0);
    driverStats[trip.driver_id].trips += 1;
  }

  for (const expense of expenses) {
    const trip = trips.find((item) => item.id === expense.trip_id);
    if (trip && truckStats[trip.truck_id]) {
      truckStats[trip.truck_id].expenses += Number(expense.amount || 0);
      truckStats[trip.truck_id].profit -= Number(expense.amount || 0);
    }
  }

  const trucks = Object.values(truckStats);
  const drivers = Object.values(driverStats);
  const pendingApprovals = listRows('trips').filter((trip) => trip.status === 'completed' && trip.start_date >= start && trip.start_date <= end).length;

  return {
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses - totalMaintenance,
    totalKm,
    totalDiesel,
    totalTolls,
    totalMaintenance,
    topTruck: trucks.sort((a, b) => b.profit - a.profit)[0] || null,
    mostExpensiveTruck: trucks.sort((a, b) => b.expenses - a.expenses)[0] || null,
    topDriver: drivers.sort((a, b) => b.trips - a.trips)[0] || null,
    pendingApprovals,
  };
}

function getMonthRange(searchParams) {
  const rawMonth = searchParams?.get('month') || '';
  const match = rawMonth.match(/^(\d{4})-(\d{2})$/);
  const selectedDate = match && Number(match[2]) >= 1 && Number(match[2]) <= 12
    ? new Date(Number(match[1]), Number(match[2]) - 1, 1)
    : new Date();

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  return {
    start: formatDateOnly(year, month, 1),
    end: formatDateOnly(year, month, new Date(year, month + 1, 0).getDate()),
  };
}

function formatDateOnly(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function hashPassword(password, salt) {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function toAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    profile_id: user.profile_id,
  };
}

function ok(body) {
  return { status: 200, body };
}

function badRequest(message) {
  return { status: 400, body: { error: message } };
}

function methodNotAllowed() {
  return { status: 405, body: { error: 'Metodo nao permitido' } };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      cpf TEXT,
      role TEXT NOT NULL DEFAULT 'driver',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trucks (
      id TEXT PRIMARY KEY,
      plate TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      truck_type TEXT NOT NULL,
      axles_count INTEGER NOT NULL DEFAULT 2,
      fuel_efficiency_km_per_l REAL NOT NULL DEFAULT 0,
      current_km INTEGER NOT NULL DEFAULT 0,
      next_maintenance_km INTEGER,
      next_maintenance_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      cpf TEXT,
      truck_id TEXT REFERENCES trucks(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      truck_id TEXT NOT NULL REFERENCES trucks(id),
      driver_id TEXT NOT NULL REFERENCES drivers(id),
      origin_city TEXT NOT NULL,
      origin_state TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      destination_state TEXT NOT NULL,
      cargo_description TEXT,
      freight_value REAL NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT,
      km_start INTEGER,
      km_end INTEGER,
      distance_km INTEGER,
      status TEXT NOT NULL DEFAULT 'planned',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      description TEXT,
      expense_date TEXT NOT NULL,
      location_city TEXT,
      location_state TEXT,
      receipt_url TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fuel_records (
      id TEXT PRIMARY KEY,
      trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
      truck_id TEXT NOT NULL REFERENCES trucks(id),
      fuel_date TEXT NOT NULL,
      station_name TEXT,
      city TEXT,
      state TEXT,
      liters REAL NOT NULL DEFAULT 0,
      price_per_liter REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      km_at_refuel INTEGER,
      receipt_url TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id TEXT PRIMARY KEY,
      truck_id TEXT NOT NULL REFERENCES trucks(id),
      maintenance_type TEXT NOT NULL,
      maintenance_date TEXT NOT NULL,
      km_at_maintenance INTEGER,
      workshop_name TEXT,
      description TEXT,
      cost REAL NOT NULL DEFAULT 0,
      receipt_url TEXT,
      next_maintenance_km INTEGER,
      next_maintenance_date TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS route_estimates (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      estimated_distance_km REAL NOT NULL DEFAULT 0,
      estimated_duration_hours REAL NOT NULL DEFAULT 0,
      estimated_toll_cost REAL NOT NULL DEFAULT 0,
      estimated_fuel_liters REAL NOT NULL DEFAULT 0,
      estimated_fuel_cost REAL NOT NULL DEFAULT 0,
      estimated_total_cost REAL NOT NULL DEFAULT 0,
      estimated_profit REAL NOT NULL DEFAULT 0,
      route_response TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      alert_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_type TEXT,
      related_id TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_read INTEGER NOT NULL DEFAULT 0,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      created_for TEXT
    );
  `);
}
