import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve(process.cwd(), 'data/frota.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const now = () => new Date().toISOString();

main();
db.close();

function main() {
  const admin = upsertLocalUser({
    email: 'admin@local.test',
    password: '123456',
    name: 'Administrador Local',
    role: 'admin',
  });

  const scania = upsertTruck({
    plate: 'ABC1D23',
    model: 'Scania R450',
    year: 2021,
    truck_type: 'Cavalo mecanico',
    axles_count: 6,
    fuel_efficiency_km_per_l: 2.8,
    current_km: 145420,
    next_maintenance_km: 150000,
    status: 'active',
    notes: 'Caminhao ficticio para demonstracao',
  });

  const volvo = upsertTruck({
    plate: 'DEF4G56',
    model: 'Volvo FH 540',
    year: 2020,
    truck_type: 'Cavalo mecanico',
    axles_count: 6,
    fuel_efficiency_km_per_l: 2.6,
    current_km: 98420,
    next_maintenance_km: 100000,
    status: 'active',
    notes: 'Caminhao ficticio para demonstracao',
  });

  const mercedes = upsertTruck({
    plate: 'GHI7J89',
    model: 'Mercedes-Benz Actros',
    year: 2019,
    truck_type: 'Truck bau',
    axles_count: 4,
    fuel_efficiency_km_per_l: 3.1,
    current_km: 212610,
    next_maintenance_km: 215000,
    status: 'maintenance',
    notes: 'Caminhao ficticio para demonstracao',
  });

  const carlos = upsertDriver({
    name: 'Carlos Andrade',
    phone: '(11) 98888-1010',
    cpf: '111.222.333-44',
    truck_id: scania.id,
    is_active: 1,
  });

  const mariana = upsertDriver({
    name: 'Mariana Costa',
    phone: '(21) 97777-2020',
    cpf: '222.333.444-55',
    truck_id: volvo.id,
    is_active: 1,
  });

  const roberto = upsertDriver({
    name: 'Roberto Lima',
    phone: '(31) 96666-3030',
    cpf: '333.444.555-66',
    truck_id: mercedes.id,
    is_active: 1,
  });

  const tripApproved = upsertTrip({
    truck_id: scania.id,
    driver_id: carlos.id,
    origin_city: 'Sao Paulo',
    origin_state: 'SP',
    destination_city: 'Curitiba',
    destination_state: 'PR',
    cargo_description: 'Carga seca paletizada',
    freight_value: 6800,
    start_date: '2026-06-03',
    end_date: '2026-06-05',
    km_start: 145000,
    km_end: 145408,
    distance_km: 408,
    status: 'approved',
    notes: '[seed] Viagem aprovada de exemplo',
  });

  const tripProgress = upsertTrip({
    truck_id: volvo.id,
    driver_id: mariana.id,
    origin_city: 'Rio de Janeiro',
    origin_state: 'RJ',
    destination_city: 'Belo Horizonte',
    destination_state: 'MG',
    cargo_description: 'Bebidas e alimentos',
    freight_value: 4200,
    start_date: '2026-06-20',
    km_start: 98200,
    distance_km: 440,
    status: 'in_progress',
    notes: '[seed] Viagem em andamento de exemplo',
  });

  const tripCompleted = upsertTrip({
    truck_id: mercedes.id,
    driver_id: roberto.id,
    origin_city: 'Campinas',
    origin_state: 'SP',
    destination_city: 'Santos',
    destination_state: 'SP',
    cargo_description: 'Material industrial',
    freight_value: 2600,
    start_date: '2026-06-15',
    end_date: '2026-06-16',
    km_start: 212400,
    km_end: 212580,
    distance_km: 180,
    status: 'completed',
    notes: '[seed] Viagem aguardando aprovacao',
  });

  upsertExpense(tripApproved.id, 'diesel', 1180.8, 'Abastecimento - Posto Rota Sul', '2026-06-03', 'Registro ficticio');
  upsertExpense(tripApproved.id, 'toll', 420, 'Pedagios BR-116', '2026-06-03', 'Registro ficticio');
  upsertExpense(tripApproved.id, 'food', 95.5, 'Refeicao motorista', '2026-06-04', 'Registro ficticio');
  upsertExpense(tripProgress.id, 'diesel', 820.2, 'Abastecimento - Posto Carolina Machado', '2026-06-20', 'Registro ficticio');
  upsertExpense(tripCompleted.id, 'toll', 138.9, 'Pedagio Anchieta', '2026-06-15', 'Registro ficticio');

  upsertFuelRecord({
    trip_id: tripApproved.id,
    truck_id: scania.id,
    fuel_date: '2026-06-03',
    station_name: 'Posto Rota Sul',
    city: 'Registro',
    state: 'SP',
    liters: 320,
    price_per_liter: 3.69,
    total_amount: 1180.8,
    km_at_refuel: 145020,
  });

  upsertFuelRecord({
    trip_id: tripProgress.id,
    truck_id: volvo.id,
    fuel_date: '2026-06-20',
    station_name: 'Posto Carolina Machado',
    city: 'Rio de Janeiro',
    state: 'RJ',
    liters: 210,
    price_per_liter: 3.91,
    total_amount: 821.1,
    km_at_refuel: 98220,
  });

  upsertMaintenance({
    truck_id: mercedes.id,
    maintenance_type: 'brake_service',
    maintenance_date: '2026-06-18',
    km_at_maintenance: 212600,
    workshop_name: 'Oficina Central Diesel',
    description: 'Revisao de freios e troca de pastilhas',
    cost: 1850,
    next_maintenance_km: 215000,
  });

  upsertMaintenance({
    truck_id: volvo.id,
    maintenance_type: 'oil_change',
    maintenance_date: '2026-06-10',
    km_at_maintenance: 97850,
    workshop_name: 'Auto Center Horizonte',
    description: 'Troca de oleo e filtros',
    cost: 980,
    next_maintenance_km: 100000,
  });

  upsertAlert({
    alert_type: 'maintenance',
    title: 'Manutencao proxima',
    message: `${volvo.plate} esta perto da proxima manutencao.`,
    related_type: 'truck',
    related_id: volvo.id,
    priority: 'medium',
    created_for: admin.profile.id,
  });

  upsertAlert({
    alert_type: 'trip',
    title: 'Viagem aguardando aprovacao',
    message: 'Ha uma viagem finalizada aguardando aprovacao.',
    related_type: 'trip',
    related_id: tripCompleted.id,
    priority: 'high',
    created_for: admin.profile.id,
  });

  console.log('Dados ficticios adicionados.');
  console.log('Login demo: admin@local.test / 123456');
}

function upsertLocalUser({ email, password, name, role }) {
  const existingUser = get('SELECT id, profile_id FROM local_users WHERE email = ?', [email]);
  if (existingUser) {
    return {
      id: existingUser.id,
      profile: get('SELECT * FROM profiles WHERE id = ?', [existingUser.profile_id]),
    };
  }

  const profile = insert('profiles', {
    name,
    role,
    is_active: 1,
    created_at: now(),
    updated_at: now(),
  });

  const password_salt = randomBytes(16).toString('hex');
  const password_hash = createHash('sha256').update(`${password_salt}:${password}`).digest('hex');
  const userId = randomUUID();

  db.prepare(`
    INSERT INTO local_users (id, email, password_hash, password_salt, profile_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, email, password_hash, password_salt, profile.id, now());

  return { id: userId, profile };
}

function upsertTruck(data) {
  return get('SELECT * FROM trucks WHERE plate = ?', [data.plate]) || insert('trucks', withTimestamps(data));
}

function upsertDriver(data) {
  return get('SELECT * FROM drivers WHERE cpf = ?', [data.cpf]) || insert('drivers', withTimestamps(data));
}

function upsertTrip(data) {
  return get('SELECT * FROM trips WHERE notes = ?', [data.notes]) || insert('trips', withTimestamps(data));
}

function upsertExpense(tripId, category, amount, description, expenseDate, city) {
  return get('SELECT * FROM expenses WHERE trip_id = ? AND description = ? AND amount = ?', [tripId, description, amount]) || insert('expenses', {
    trip_id: tripId,
    category,
    amount,
    description,
    expense_date: expenseDate,
    location_city: city,
    created_at: now(),
  });
}

function upsertFuelRecord(data) {
  return get('SELECT * FROM fuel_records WHERE truck_id = ? AND fuel_date = ? AND station_name = ?', [data.truck_id, data.fuel_date, data.station_name]) || insert('fuel_records', {
    ...data,
    created_at: now(),
  });
}

function upsertMaintenance(data) {
  return get('SELECT * FROM maintenance_records WHERE truck_id = ? AND maintenance_date = ? AND workshop_name = ?', [data.truck_id, data.maintenance_date, data.workshop_name]) || insert('maintenance_records', {
    ...data,
    created_at: now(),
  });
}

function upsertAlert(data) {
  return get('SELECT * FROM alerts WHERE title = ? AND related_id = ?', [data.title, data.related_id]) || insert('alerts', {
    ...data,
    is_read: 0,
    is_resolved: 0,
    created_at: now(),
  });
}

function withTimestamps(data) {
  const created_at = now();
  return { ...data, created_at, updated_at: created_at };
}

function insert(table, data) {
  const id = randomUUID();
  const row = { id, ...data };
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...keys.map((key) => row[key]));
  return get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}

function get(sql, params) {
  return db.prepare(sql).get(...params);
}
