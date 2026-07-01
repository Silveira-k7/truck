import type { Truck, Driver, Trip, Expense, FuelRecord, MaintenanceRecord, RouteEstimate, TripSummary, Profile, Alert } from './types';

type DashboardSummary = {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalKm: number;
  totalDiesel: number;
  totalTolls: number;
  totalMaintenance: number;
  topTruck: { id: string; plate: string; profit: number } | null;
  mostExpensiveTruck: { id: string; plate: string; expenses: number } | null;
  topDriver: { id: string; name: string; trips: number } | null;
  pendingApprovals: number;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || 'Erro ao acessar a API');
  }

  return data as T;
}

const jsonBody = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
});

const patchBody = (body: unknown): RequestInit => ({
  method: 'PATCH',
  body: JSON.stringify(body),
});

const deleteInit: RequestInit = { method: 'DELETE' };

function queryString(filters?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

// Trucks API
export async function getTrucks(): Promise<Truck[]> {
  return apiRequest<Truck[]>('/trucks');
}

export async function getTruck(id: string): Promise<Truck | null> {
  return apiRequest<Truck | null>(`/trucks/${id}`);
}

export async function createTruck(truck: Omit<Truck, 'id' | 'created_at' | 'updated_at'>): Promise<Truck> {
  return apiRequest<Truck>('/trucks', jsonBody(truck));
}

export async function updateTruck(id: string, truck: Partial<Truck>): Promise<Truck> {
  return apiRequest<Truck>(`/trucks/${id}`, patchBody(truck));
}

export async function deleteTruck(id: string): Promise<void> {
  await apiRequest(`/trucks/${id}`, deleteInit);
}

// Drivers API
export async function getDrivers(): Promise<Driver[]> {
  return apiRequest<Driver[]>('/drivers');
}

export async function getDriver(id: string): Promise<Driver | null> {
  return apiRequest<Driver | null>(`/drivers/${id}`);
}

export async function createDriver(driver: Omit<Driver, 'id' | 'created_at' | 'updated_at' | 'truck'>): Promise<Driver> {
  return apiRequest<Driver>('/drivers', jsonBody(driver));
}

export async function updateDriver(id: string, driver: Partial<Driver>): Promise<Driver> {
  return apiRequest<Driver>(`/drivers/${id}`, patchBody(driver));
}

export async function deleteDriver(id: string): Promise<void> {
  await apiRequest(`/drivers/${id}`, deleteInit);
}

// Trips API
export async function getTrips(filters?: { status?: string; truck_id?: string; driver_id?: string }): Promise<Trip[]> {
  return apiRequest<Trip[]>(`/trips${queryString(filters)}`);
}

export async function getTrip(id: string): Promise<Trip | null> {
  return apiRequest<Trip | null>(`/trips/${id}`);
}

export async function createTrip(trip: Omit<Trip, 'id' | 'created_at' | 'updated_at' | 'truck' | 'driver' | 'expenses' | 'fuel_records' | 'route_estimate'>): Promise<Trip> {
  return apiRequest<Trip>('/trips', jsonBody(trip));
}

export async function updateTrip(id: string, trip: Partial<Trip>): Promise<Trip> {
  return apiRequest<Trip>(`/trips/${id}`, patchBody(trip));
}

export async function deleteTrip(id: string): Promise<void> {
  await apiRequest(`/trips/${id}`, deleteInit);
}

// Expenses API
export async function getExpenses(tripId: string): Promise<Expense[]> {
  return apiRequest<Expense[]>(`/expenses${queryString({ trip_id: tripId })}`);
}

export async function createExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
  return apiRequest<Expense>('/expenses', jsonBody(expense));
}

export async function deleteExpense(id: string): Promise<void> {
  await apiRequest(`/expenses/${id}`, deleteInit);
}

// Fuel Records API
export async function getFuelRecords(filters?: { truck_id?: string; trip_id?: string }): Promise<FuelRecord[]> {
  return apiRequest<FuelRecord[]>(`/fuel-records${queryString(filters)}`);
}

export async function createFuelRecord(record: Omit<FuelRecord, 'id' | 'created_at'>): Promise<FuelRecord> {
  return apiRequest<FuelRecord>('/fuel-records', jsonBody(record));
}

export async function deleteFuelRecord(id: string): Promise<void> {
  await apiRequest(`/fuel-records/${id}`, deleteInit);
}

// Maintenance API
export async function getMaintenanceRecords(filters?: { truck_id?: string }): Promise<MaintenanceRecord[]> {
  return apiRequest<MaintenanceRecord[]>(`/maintenance-records${queryString(filters)}`);
}

export async function createMaintenanceRecord(record: Omit<MaintenanceRecord, 'id' | 'created_at' | 'truck'>): Promise<MaintenanceRecord> {
  return apiRequest<MaintenanceRecord>('/maintenance-records', jsonBody(record));
}

export async function deleteMaintenanceRecord(id: string): Promise<void> {
  await apiRequest(`/maintenance-records/${id}`, deleteInit);
}

// Route Estimates API
export async function getRouteEstimate(tripId: string): Promise<RouteEstimate | null> {
  return apiRequest<RouteEstimate | null>(`/route-estimates${queryString({ trip_id: tripId })}`);
}

export async function createRouteEstimate(estimate: Omit<RouteEstimate, 'id' | 'created_at'>): Promise<RouteEstimate> {
  return apiRequest<RouteEstimate>('/route-estimates', jsonBody(estimate));
}

// Alerts API
export async function getAlerts(userId?: string): Promise<Alert[]> {
  return apiRequest<Alert[]>(`/alerts${queryString({ created_for: userId, unread: 'true' })}`);
}

export async function markAlertRead(id: string): Promise<void> {
  await apiRequest(`/alerts/${id}`, patchBody({ is_read: true }));
}

export async function resolveAlert(id: string, resolvedBy: string): Promise<void> {
  await apiRequest(`/alerts/${id}`, patchBody({ is_resolved: true, resolved_by: resolvedBy, resolved_at: new Date().toISOString() }));
}

// Dashboard API
export async function getDashboardSummary(month?: string): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>(`/dashboard${queryString({ month })}`);
}

// Trip Summary helper
export function calculateTripSummary(trip: Trip): TripSummary {
  const expenses = trip.expenses || [];
  const fuelRecords = trip.fuel_records || [];

  const freightValue = Number(trip.freight_value) || 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const dieselExpenses = expenses.filter(e => e.category === 'diesel').reduce((sum, e) => sum + Number(e.amount), 0);
  const tollExpenses = expenses.filter(e => e.category === 'toll').reduce((sum, e) => sum + Number(e.amount), 0);
  const otherExpenses = totalExpenses - dieselExpenses - tollExpenses;

  const kmStart = trip.km_start || 0;
  const kmEnd = trip.km_end || 0;
  const kmDriven = kmEnd - kmStart;

  const totalLiters = fuelRecords.reduce((sum, f) => sum + Number(f.liters), 0);
  const fuelEfficiency = totalLiters > 0 && kmDriven > 0 ? kmDriven / totalLiters : 0;
  const costPerKm = kmDriven > 0 ? totalExpenses / kmDriven : 0;

  return {
    freightValue,
    totalExpenses,
    dieselExpenses,
    tollExpenses,
    otherExpenses,
    grossProfit: freightValue - totalExpenses,
    kmDriven,
    fuelEfficiency,
    costPerKm,
  };
}

// Profile API
export async function getProfile(id: string): Promise<Profile | null> {
  return apiRequest<Profile | null>(`/profiles/${id}`);
}

export async function updateProfile(id: string, profile: Partial<Profile>): Promise<Profile> {
  return apiRequest<Profile>(`/profiles/${id}`, patchBody(profile));
}
