import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
const pool = createPool();

main()
  .then(() => {
    console.log('Dados ficticios adicionados.');
    console.log('Login demo: admin@local.test / 123456');
  })
  .finally(async () => {
    await pool.end();
  });

async function main() {
  await resetTables();

  const admin = await upsertLocalUser({
    email: 'admin@local.test',
    password: '123456',
    name: 'Administrador Local',
    role: 'admin',
  });

  const scania = await insert('trucks', {
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

  const volvo = await insert('trucks', {
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

  const mercedes = await insert('trucks', {
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

  const carlos = await insert('drivers', {
    name: 'Carlos Andrade',
    phone: '(11) 98888-1010',
    cpf: '111.222.333-44',
    truck_id: scania.id,
    is_active: true,
  });

  const mariana = await insert('drivers', {
    name: 'Mariana Costa',
    phone: '(21) 97777-2020',
    cpf: '222.333.444-55',
    truck_id: volvo.id,
    is_active: true,
  });

  const roberto = await insert('drivers', {
    name: 'Roberto Lima',
    phone: '(31) 96666-3030',
    cpf: '333.444.555-66',
    truck_id: mercedes.id,
    is_active: true,
  });

  const tripApproved = await insert('trips', {
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

  const tripProgress = await insert('trips', {
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

  const tripCompleted = await insert('trips', {
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

  await insert('expenses', {
    trip_id: tripApproved.id,
    category: 'diesel',
    amount: 1180.8,
    description: 'Abastecimento - Posto Rota Sul',
    expense_date: '2026-06-03',
    location_city: 'Registro',
    location_state: 'SP',
  });

  await insert('expenses', {
    trip_id: tripApproved.id,
    category: 'toll',
    amount: 420,
    description: 'Pedagios BR-116',
    expense_date: '2026-06-03',
    location_city: 'Registro',
    location_state: 'SP',
  });

  await insert('expenses', {
    trip_id: tripApproved.id,
    category: 'food',
    amount: 95.5,
    description: 'Refeicao motorista',
    expense_date: '2026-06-04',
    location_city: 'Registro',
    location_state: 'SP',
  });

  await insert('expenses', {
    trip_id: tripProgress.id,
    category: 'diesel',
    amount: 820.2,
    description: 'Abastecimento - Posto Carolina Machado',
    expense_date: '2026-06-20',
    location_city: 'Rio de Janeiro',
    location_state: 'RJ',
  });

  await insert('expenses', {
    trip_id: tripCompleted.id,
    category: 'toll',
    amount: 138.9,
    description: 'Pedagio Anchieta',
    expense_date: '2026-06-15',
    location_city: 'Santos',
    location_state: 'SP',
  });

  await insert('fuel_records', {
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

  await insert('fuel_records', {
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

  await insert('maintenance_records', {
    truck_id: mercedes.id,
    maintenance_type: 'brake_service',
    maintenance_date: '2026-06-18',
    km_at_maintenance: 212600,
    workshop_name: 'Oficina Central Diesel',
    description: 'Revisao de freios e troca de pastilhas',
    cost: 1850,
    next_maintenance_km: 215000,
  });

  await insert('maintenance_records', {
    truck_id: volvo.id,
    maintenance_type: 'oil_change',
    maintenance_date: '2026-06-10',
    km_at_maintenance: 97850,
    workshop_name: 'Auto Center Horizonte',
    description: 'Troca de oleo e filtros',
    cost: 980,
    next_maintenance_km: 100000,
  });

  await insert('alerts', {
    alert_type: 'maintenance',
    title: 'Manutencao proxima',
    message: `${volvo.plate} esta perto da proxima manutencao.`,
    related_type: 'truck',
    related_id: volvo.id,
    priority: 'medium',
    is_read: false,
    is_resolved: false,
    created_for: admin.profile.id,
  });

  await insert('alerts', {
    alert_type: 'trip',
    title: 'Viagem aguardando aprovacao',
    message: 'Ha uma viagem finalizada aguardando aprovacao.',
    related_type: 'trip',
    related_id: tripCompleted.id,
    priority: 'high',
    is_read: false,
    is_resolved: false,
    created_for: admin.profile.id,
  });
}

async function upsertLocalUser({ email, password, name, role }) {
  const existingUser = await get('SELECT id, profile_id FROM local_users WHERE email = $1', [email]);
  if (existingUser) {
    return {
      id: existingUser.id,
      profile: await get('SELECT * FROM profiles WHERE id = $1', [existingUser.profile_id]),
    };
  }

  const profile = await insert('profiles', {
    id: randomUUID(),
    name,
    role,
    is_active: true,
  });

  const password_salt = randomBytes(16).toString('hex');
  const password_hash = hashPassword(password, password_salt);
  const userId = randomUUID();

  await insert('local_users', {
    id: userId,
    email,
    password_hash,
    password_salt,
    profile_id: profile.id,
  });

  return { id: userId, profile };
}

async function insert(table, data) {
  const columns = Object.keys(data);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  await run(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, columns.map((column) => data[column]));
  return get(`SELECT * FROM ${table} WHERE id = $1`, [data.id]);
}

async function get(queryText, params = []) {
  const { rows } = await run(queryText, params);
  return rows[0] || null;
}

async function run(queryText, params = []) {
  return pool.query(queryText, params);
}

async function resetTables() {
  await pool.query(`
    TRUNCATE TABLE
      alerts,
      maintenance_records,
      fuel_records,
      expenses,
      route_estimates,
      sessions,
      trips,
      drivers,
      local_users,
      trucks,
      profiles
    RESTART IDENTITY CASCADE
  `);
}

function hashPassword(password, salt) {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function createPool() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL nao configurada. Defina a string de conexao do Neon.');
  }

  const isLocalhost = /localhost|127\.0\.0\.1|::1/i.test(DATABASE_URL);
  return new Pool({
    connectionString: DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });
}
