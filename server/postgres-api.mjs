import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
const SESSION_COOKIE_NAME = 'frota_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const tables = {
  profiles: {
    columns: ['name', 'phone', 'cpf', 'role', 'is_active'],
    booleans: ['is_active'],
    numericColumns: [],
    jsonColumns: [],
    timestamps: 'both',
    order: 'created_at DESC',
  },
  trucks: {
    columns: ['plate', 'model', 'year', 'truck_type', 'axles_count', 'fuel_efficiency_km_per_l', 'current_km', 'next_maintenance_km', 'next_maintenance_date', 'status', 'notes'],
    booleans: [],
    numericColumns: ['year', 'axles_count', 'fuel_efficiency_km_per_l', 'current_km', 'next_maintenance_km'],
    jsonColumns: [],
    timestamps: 'both',
    order: 'created_at DESC',
  },
  drivers: {
    columns: ['user_id', 'name', 'phone', 'cpf', 'truck_id', 'is_active'],
    booleans: ['is_active'],
    numericColumns: [],
    jsonColumns: [],
    timestamps: 'both',
    order: 'created_at DESC',
  },
  trips: {
    columns: ['truck_id', 'driver_id', 'origin_city', 'origin_state', 'destination_city', 'destination_state', 'cargo_description', 'freight_value', 'start_date', 'end_date', 'km_start', 'km_end', 'distance_km', 'status', 'notes'],
    booleans: [],
    numericColumns: ['freight_value', 'km_start', 'km_end', 'distance_km'],
    jsonColumns: [],
    timestamps: 'both',
    order: 'start_date DESC',
  },
  expenses: {
    columns: ['trip_id', 'category', 'amount', 'description', 'expense_date', 'location_city', 'location_state', 'receipt_url', 'created_by'],
    booleans: [],
    numericColumns: ['amount'],
    jsonColumns: [],
    timestamps: 'created',
    order: 'expense_date DESC',
  },
  fuel_records: {
    columns: ['trip_id', 'truck_id', 'fuel_date', 'station_name', 'city', 'state', 'liters', 'price_per_liter', 'total_amount', 'km_at_refuel', 'receipt_url', 'created_by'],
    booleans: [],
    numericColumns: ['liters', 'price_per_liter', 'total_amount', 'km_at_refuel'],
    jsonColumns: [],
    timestamps: 'created',
    order: 'fuel_date DESC',
  },
  maintenance_records: {
    columns: ['truck_id', 'maintenance_type', 'maintenance_date', 'km_at_maintenance', 'workshop_name', 'description', 'cost', 'receipt_url', 'next_maintenance_km', 'next_maintenance_date', 'created_by'],
    booleans: [],
    numericColumns: ['km_at_maintenance', 'cost', 'next_maintenance_km'],
    jsonColumns: [],
    timestamps: 'created',
    order: 'maintenance_date DESC',
  },
  route_estimates: {
    columns: ['trip_id', 'estimated_distance_km', 'estimated_duration_hours', 'estimated_toll_cost', 'estimated_fuel_liters', 'estimated_fuel_cost', 'estimated_total_cost', 'estimated_profit', 'route_response'],
    booleans: [],
    numericColumns: ['estimated_distance_km', 'estimated_duration_hours', 'estimated_toll_cost', 'estimated_fuel_liters', 'estimated_fuel_cost', 'estimated_total_cost', 'estimated_profit'],
    jsonColumns: ['route_response'],
    timestamps: 'created',
    order: 'created_at DESC',
  },
  alerts: {
    columns: ['alert_type', 'title', 'message', 'related_type', 'related_id', 'priority', 'is_read', 'is_resolved', 'resolved_by', 'resolved_at', 'created_for'],
    booleans: ['is_read', 'is_resolved'],
    numericColumns: [],
    jsonColumns: [],
    timestamps: 'created',
    order: 'created_at DESC',
  },
  sessions: {
    columns: ['id', 'token_hash', 'user_id', 'expires_at', 'revoked_at'],
    booleans: [],
    numericColumns: [],
    jsonColumns: [],
    timestamps: 'created',
    order: 'created_at DESC',
  },
};

let pool;
let schemaReadyPromise;
let ocrWorkerPromise;

function now() {
  return new Date().toISOString();
}

export function postgresApiPlugin() {
  return {
    name: 'postgres-api',
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
          sendJson(res, result.status, result.body, result.headers);
        } catch (error) {
          console.error('[postgres-api]', error);
          sendJson(res, error?.status || 500, { error: error instanceof Error ? error.message : 'Erro interno' });
        }
      });
    },
  };
}

export async function handleApi(req, path, searchParams) {
  await ensureSchema();

  const parts = path.split('/').filter(Boolean);
  const resource = parts[0];
  const id = parts[1];
  const method = req.method || 'GET';

  if (resource === 'auth') {
    return handleAuth(method, id, req, searchParams);
  }

  await requireAuth(req);

  if (resource === 'receipt-ocr') {
    return handleReceiptOcr(method, req);
  }

  if (resource === 'dashboard') {
    return ok(await getDashboardSummary(searchParams));
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
    ocrWorkerPromise = import('tesseract.js').then(async ({ createWorker }) => createWorker('por+eng'));
  }

  return ocrWorkerPromise;
}

async function handleAuth(method, action, req, searchParams) {
  if (method === 'GET' && action === 'session') {
    const session = await getSessionFromRequest(req);
    if (!session) return ok({ user: null, profile: null });

    return ok({ user: toAuthUser(session.user), profile: session.profile });
  }

  if (action === 'users') {
    await requireAdmin(req);

    if (method === 'GET') {
      return ok(await listManagedUsers());
    }

    if (method === 'POST') {
      return ok(await createManagedUser(await readJson(req)));
    }

    return methodNotAllowed();
  }

  if (method === 'POST' && action === 'signup') {
    const userCount = await queryOne('SELECT COUNT(*)::int AS count FROM local_users');
    if (Number(userCount?.count || 0) > 0) {
      await requireAdmin(req);
    }

    const managedUser = await createManagedUser(await readJson(req), { forceAdmin: Number(userCount?.count || 0) === 0 });
    return ok(managedUser);
  }

  if (method === 'POST' && action === 'signin') {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = await queryOne('SELECT * FROM local_users WHERE email = $1', [email]);

    if (!user || !verifyPassword(password, user)) {
      return { status: 401, body: { error: 'Email ou senha invalidos.' } };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = sessionExpiry();

    await query(
      `INSERT INTO sessions (id, token_hash, user_id, expires_at, revoked_at, created_at)
       VALUES ($1, $2, $3, $4, NULL, $5)`,
      [randomUUID(), tokenHash, user.id, expiresAt, now()],
    );

    const profile = await getById('profiles', user.profile_id);
    return { status: 200, body: { user: toAuthUser(user), profile }, headers: { 'Set-Cookie': buildSessionCookie(token) } };
  }

  if (method === 'POST' && action === 'signout') {
    const token = getSessionToken(req);
    if (token) {
      await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(token)]);
    }

    return { status: 200, body: { ok: true }, headers: { 'Set-Cookie': buildClearSessionCookie() } };
  }

  return { status: 404, body: { error: 'Rota de autenticacao nao encontrada' } };
}

async function listManagedUsers() {
  const { rows } = await query(`
    SELECT
      u.id,
      u.email,
      u.profile_id,
      u.created_at,
      p.name,
      p.phone,
      p.cpf,
      p.role,
      p.is_active
    FROM local_users u
    JOIN profiles p ON p.id = u.profile_id
    ORDER BY u.created_at DESC
  `);

  return rows.map((row) => ({
    ...row,
    is_active: Boolean(row.is_active),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }));
}

async function createManagedUser(input, options = {}) {
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const name = String(input.name || '').trim();
  const role = options.forceAdmin ? 'admin' : input.role === 'admin' ? 'admin' : 'driver';
  const phone = String(input.phone || '').trim() || null;
  const cpf = String(input.cpf || '').trim() || null;

  if (!email || !password || !name) {
    throwBadRequest('Preencha nome, email e senha.');
  }

  if (password.length < 6) {
    throwBadRequest('A senha deve ter pelo menos 6 caracteres.');
  }

  const existing = await queryOne('SELECT id FROM local_users WHERE email = $1', [email]);
  if (existing) throwBadRequest('Email ja cadastrado.');

  const profileId = randomUUID();
  const userId = randomUUID();
  const passwordSalt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, passwordSalt);
  const createdAt = now();

  await withTransaction(async (client) => {
    await client.query(`
      INSERT INTO profiles (id, name, phone, cpf, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [profileId, name, phone, cpf, role, true, createdAt, createdAt]);

    await client.query(`
      INSERT INTO local_users (id, email, password_hash, password_salt, profile_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, email, passwordHash, passwordSalt, profileId, createdAt]);

    if (role === 'driver') {
      await client.query(`
        INSERT INTO drivers (id, user_id, name, phone, cpf, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [randomUUID(), profileId, name, phone, cpf, true, createdAt, createdAt]);
    }
  });

  return {
    id: userId,
    email,
    profile_id: profileId,
    name,
    phone,
    cpf,
    role,
    is_active: true,
    created_at: createdAt,
  };
}

async function handleCrud(table, method, id, req, filters = {}) {
  if (method === 'GET' && id) return ok(await getById(table, id));
  if (method === 'GET') return ok(await listRows(table, filters));
  if (method === 'POST') return ok(await insertRow(table, await readJson(req)));
  if (method === 'PATCH' && id) return ok(await updateRow(table, id, await readJson(req)));
  if (method === 'DELETE' && id) {
    await deleteRow(table, id);
    return ok({ ok: true });
  }

  return methodNotAllowed();
}

async function handleDrivers(method, id, req) {
  if (method === 'GET' && id) return ok(await hydrateDriver(await getById('drivers', id)));
  if (method === 'GET') return ok(await Promise.all((await listRows('drivers')).map(hydrateDriver)));
  return handleCrud('drivers', method, id, req);
}

async function handleTrips(method, id, req, searchParams) {
  if (method === 'GET' && id) return ok(await hydrateTrip(await getById('trips', id)));
  if (method === 'GET') {
    const rows = await listRows('trips', {
      status: searchParams.get('status'),
      truck_id: searchParams.get('truck_id'),
      driver_id: searchParams.get('driver_id'),
    });

    return ok(await Promise.all(rows.map(hydrateTrip)));
  }

  return handleCrud('trips', method, id, req);
}

async function handleMaintenance(method, id, req, searchParams) {
  if (method === 'GET' && id) return ok(await hydrateMaintenance(await getById('maintenance_records', id)));
  if (method === 'GET') return ok(await Promise.all((await listRows('maintenance_records', { truck_id: searchParams.get('truck_id') })).map(hydrateMaintenance)));
  return handleCrud('maintenance_records', method, id, req);
}

async function handleRouteEstimates(method, id, req, searchParams) {
  if (method === 'GET') {
    const tripId = searchParams.get('trip_id');
    const rows = await listRows('route_estimates', { trip_id: tripId });
    return ok(rows[0] || null);
  }

  return handleCrud('route_estimates', method, id, req);
}

async function handleAlerts(method, id, req, searchParams) {
  if (method === 'GET') {
    return ok(await listRows('alerts', {
      created_for: searchParams.get('created_for'),
      is_read: searchParams.has('unread') ? false : null,
    }));
  }

  return handleCrud('alerts', method, id, req);
}

async function listRows(table, filters = {}) {
  const config = tables[table];
  const where = [];
  const params = [];

  for (const [key, rawValue] of Object.entries(filters)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    where.push(`${key} = $${params.length + 1}`);
    params.push(encodeValue(table, key, rawValue));
  }

  const sql = `SELECT * FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${config.order}`;
  const { rows } = await query(sql, params);
  return rows.map((row) => normalizeRow(row, table));
}

async function getById(table, id) {
  if (!id) return null;
  const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return normalizeRow(rows[0], table);
}

async function insertRow(table, input) {
  const config = tables[table];
  const data = cleanInput(table, input);
  const createdAt = now();

  if (!data.id) data.id = randomUUID();
  if (config.timestamps === 'created' || config.timestamps === 'both') data.created_at = createdAt;
  if (config.timestamps === 'both') data.updated_at = createdAt;

  const keys = Object.keys(data);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
  const values = keys.map((key) => data[key]);

  await query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
  return getById(table, data.id);
}

async function updateRow(table, id, input) {
  const config = tables[table];
  const data = cleanInput(table, input);

  if (config.timestamps === 'both') data.updated_at = now();

  const keys = Object.keys(data);
  if (keys.length > 0) {
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    await query(`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`, [...keys.map((key) => data[key]), id]);
  }

  return getById(table, id);
}

async function deleteRow(table, id) {
  await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
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
  if (tables[table]?.booleans?.includes(key)) return Boolean(value);
  if (tables[table]?.jsonColumns?.includes(key) && value !== null && value !== undefined && value !== '') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return value === '' ? null : value;
}

function normalizeRow(row, table) {
  if (!row) return null;

  const output = { ...row };

  for (const key of tables[table]?.booleans || []) {
    if (key in output) output[key] = Boolean(output[key]);
  }

  for (const key of tables[table]?.numericColumns || []) {
    if (key in output && output[key] !== null && output[key] !== undefined && output[key] !== '') {
      output[key] = Number(output[key]);
    }
  }

  for (const [key, value] of Object.entries(output)) {
    if (value instanceof Date) {
      output[key] = value.toISOString();
    }
  }

  for (const key of tables[table]?.jsonColumns || []) {
    if (typeof output[key] === 'string') {
      try {
        output[key] = JSON.parse(output[key] || '{}');
      } catch {
        output[key] = null;
      }
    }
  }

  return output;
}

async function hydrateDriver(driver) {
  if (!driver) return null;
  return { ...driver, truck: driver.truck_id ? await getById('trucks', driver.truck_id) : undefined };
}

async function hydrateMaintenance(record) {
  if (!record) return null;
  return { ...record, truck: await getById('trucks', record.truck_id) };
}

async function hydrateTrip(trip) {
  if (!trip) return null;

  const [truck, driver, expenses, fuelRecords, routeEstimate] = await Promise.all([
    getById('trucks', trip.truck_id),
    getById('drivers', trip.driver_id),
    listRows('expenses', { trip_id: trip.id }),
    listRows('fuel_records', { trip_id: trip.id }),
    listRows('route_estimates', { trip_id: trip.id }).then((rows) => rows[0] || null),
  ]);

  return {
    ...trip,
    truck,
    driver: driver ? await hydrateDriver(driver) : null,
    expenses,
    fuel_records: fuelRecords,
    route_estimate: routeEstimate || undefined,
  };
}

async function getDashboardSummary(searchParams) {
  const { start, end } = getMonthRange(searchParams);
  const trips = (await listRows('trips')).filter((trip) => trip.status === 'approved' && trip.start_date >= start && trip.start_date <= end);
  const tripIds = new Set(trips.map((trip) => trip.id));
  const expenses = (await listRows('expenses')).filter((expense) => tripIds.has(expense.trip_id));
  const maintenance = (await listRows('maintenance_records')).filter((record) => record.maintenance_date >= start && record.maintenance_date <= end);

  const totalRevenue = trips.reduce((sum, trip) => sum + Number(trip.freight_value || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalKm = trips.reduce((sum, trip) => sum + (trip.km_start && trip.km_end ? Number(trip.km_end) - Number(trip.km_start) : 0), 0);
  const totalDiesel = expenses.filter((expense) => expense.category === 'diesel').reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalTolls = expenses.filter((expense) => expense.category === 'toll').reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalMaintenance = maintenance.reduce((sum, record) => sum + Number(record.cost || 0), 0);
  const truckStats = {};
  const driverStats = {};

  for (const trip of trips) {
    const truck = await getById('trucks', trip.truck_id);
    const driver = await getById('drivers', trip.driver_id);
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
  const pendingApprovals = (await listRows('trips')).filter((trip) => trip.status === 'completed' && trip.start_date >= start && trip.start_date <= end).length;

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

async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = initSchema();
  }

  await schemaReadyPromise;
}

async function initSchema() {
  const db = getPool();
  await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      cpf TEXT,
      role TEXT NOT NULL DEFAULT 'driver',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS local_users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS trucks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plate TEXT NOT NULL UNIQUE,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      truck_type TEXT NOT NULL,
      axles_count INTEGER NOT NULL DEFAULT 2,
      fuel_efficiency_km_per_l NUMERIC(6, 2) NOT NULL DEFAULT 0,
      current_km INTEGER NOT NULL DEFAULT 0,
      next_maintenance_km INTEGER,
      next_maintenance_date DATE,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      name TEXT NOT NULL,
      phone TEXT,
      cpf TEXT,
      truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS trips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
      driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
      origin_city TEXT NOT NULL,
      origin_state TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      destination_state TEXT NOT NULL,
      cargo_description TEXT,
      freight_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
      start_date DATE NOT NULL,
      end_date DATE,
      km_start INTEGER,
      km_end INTEGER,
      distance_km INTEGER,
      status TEXT NOT NULL DEFAULT 'planned',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS route_estimates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      estimated_distance_km NUMERIC(10, 2),
      estimated_duration_hours NUMERIC(6, 2),
      estimated_toll_cost NUMERIC(12, 2),
      estimated_fuel_liters NUMERIC(10, 2),
      estimated_fuel_cost NUMERIC(12, 2),
      estimated_total_cost NUMERIC(12, 2),
      estimated_profit NUMERIC(12, 2),
      route_response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      description TEXT,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      location_city TEXT,
      location_state TEXT,
      receipt_url TEXT,
      created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS fuel_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
      truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
      fuel_date DATE NOT NULL DEFAULT CURRENT_DATE,
      station_name TEXT,
      city TEXT,
      state TEXT,
      liters NUMERIC(10, 3) NOT NULL,
      price_per_liter NUMERIC(8, 3) NOT NULL,
      total_amount NUMERIC(12, 2) NOT NULL,
      km_at_refuel INTEGER,
      receipt_url TEXT,
      created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS maintenance_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
      maintenance_type TEXT NOT NULL,
      maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
      km_at_maintenance INTEGER,
      workshop_name TEXT,
      description TEXT,
      cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
      receipt_url TEXT,
      next_maintenance_km INTEGER,
      next_maintenance_date DATE,
      created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_url TEXT NOT NULL,
      file_name TEXT,
      file_type TEXT,
      file_size INTEGER,
      related_type TEXT NOT NULL,
      related_id UUID NOT NULL,
      uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS trip_approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      corrections JSONB,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_type TEXT,
      related_id UUID,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_read BOOLEAN NOT NULL DEFAULT false,
      is_resolved BOOLEAN NOT NULL DEFAULT false,
      resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_for UUID REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  await db.query('CREATE INDEX IF NOT EXISTS idx_trips_truck ON trips(truck_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_trips_dates ON trips(start_date, end_date)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_expenses_trip ON expenses(trip_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_fuel_records_truck ON fuel_records(truck_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_fuel_records_trip ON fuel_records(trip_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_maintenance_truck ON maintenance_records(truck_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(created_for)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
}

function getPool() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL nao configurada. Defina a string de conexao do Neon.');
  }

  if (!pool) {
    const isLocalhost = /localhost|127\.0\.0\.1|::1/i.test(DATABASE_URL);
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
    });

    pool.on('error', (error) => {
      console.error('[postgres-api] pool error', error);
    });
  }

  return pool;
}

async function query(text, values = []) {
  return getPool().query(text, values);
}

async function queryOne(text, values = []) {
  const { rows } = await query(text, values);
  return rows[0] || null;
}

async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, user) {
  if (!user?.password_hash || !user?.password_salt) return false;

  const storedHash = String(user.password_hash);
  const computedHash = storedHash.length === 64
    ? createHash('sha256').update(`${user.password_salt}:${password}`).digest('hex')
    : hashPassword(password, user.password_salt);

  return safeEqualHex(storedHash, computedHash);
}

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function sessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

function buildSessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${IS_PRODUCTION ? '; Secure' : ''}`;
}

function buildClearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${IS_PRODUCTION ? '; Secure' : ''}`;
}

function getSessionToken(req) {
  const cookieHeader = req.headers?.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf('=');
        if (index === -1) return [pair, ''];
        return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
      }),
  );

  return cookies[SESSION_COOKIE_NAME] || null;
}

async function getSessionFromRequest(req) {
  const token = getSessionToken(req);
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await queryOne(
    `SELECT s.user_id, s.expires_at, s.revoked_at, u.id AS local_user_id, u.email, u.profile_id
     FROM sessions s
     JOIN local_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [tokenHash],
  );

  if (!session) return null;

  const profile = await getById('profiles', session.profile_id);
  if (!profile) return null;

  return {
    user: { id: session.local_user_id, email: session.email, profile_id: session.profile_id },
    profile,
  };
}

async function requireAuth(req) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    const error = new Error('Nao autenticado');
    error.status = 401;
    throw error;
  }

  return session;
}

async function requireAdmin(req) {
  const session = await requireAuth(req);
  if (session.profile?.role !== 'admin') {
    const error = new Error('Apenas administradores podem executar esta acao');
    error.status = 403;
    throw error;
  }

  return session;
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

function throwBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function methodNotAllowed() {
  return { status: 405, body: { error: 'Metodo nao permitido' } };
}

function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
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
