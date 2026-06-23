export type UserRole = 'admin' | 'driver';
export type TripStatus = 'planned' | 'in_progress' | 'completed' | 'approved' | 'cancelled';
export type TruckStatus = 'active' | 'stopped' | 'maintenance';
export type ExpenseCategory = 'diesel' | 'toll' | 'food' | 'overnight' | 'parking' | 'workshop' | 'tire' | 'arla' | 'fine' | 'wash' | 'other';
export type MaintenanceType = 'oil_change' | 'tire_change' | 'brake_service' | 'engine_service' | 'electrical' | 'suspension' | 'bodywork' | 'inspection' | 'other';

export interface Profile {
  id: string;
  name: string;
  phone?: string;
  cpf?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Truck {
  id: string;
  plate: string;
  model: string;
  year: number;
  truck_type: string;
  axles_count: number;
  fuel_efficiency_km_per_l: number;
  current_km: number;
  next_maintenance_km?: number;
  next_maintenance_date?: string;
  status: TruckStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id?: string;
  name: string;
  phone?: string;
  cpf?: string;
  truck_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  truck?: Truck;
}

export interface Trip {
  id: string;
  truck_id: string;
  driver_id: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  cargo_description?: string;
  freight_value: number;
  start_date: string;
  end_date?: string;
  km_start?: number;
  km_end?: number;
  distance_km?: number;
  status: TripStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  truck?: Truck;
  driver?: Driver;
  expenses?: Expense[];
  fuel_records?: FuelRecord[];
  route_estimate?: RouteEstimate;
}

export interface RouteEstimate {
  id: string;
  trip_id: string;
  estimated_distance_km: number;
  estimated_duration_hours: number;
  estimated_toll_cost: number;
  estimated_fuel_liters: number;
  estimated_fuel_cost: number;
  estimated_total_cost: number;
  estimated_profit: number;
  route_response?: Record<string, unknown>;
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  expense_date: string;
  location_city?: string;
  location_state?: string;
  receipt_url?: string;
  created_by?: string;
  created_at: string;
}

export interface FuelRecord {
  id: string;
  trip_id?: string;
  truck_id: string;
  fuel_date: string;
  station_name?: string;
  city?: string;
  state?: string;
  liters: number;
  price_per_liter: number;
  total_amount: number;
  km_at_refuel?: number;
  receipt_url?: string;
  created_by?: string;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  truck_id: string;
  maintenance_type: MaintenanceType;
  maintenance_date: string;
  km_at_maintenance?: number;
  workshop_name?: string;
  description?: string;
  cost: number;
  receipt_url?: string;
  next_maintenance_km?: number;
  next_maintenance_date?: string;
  created_by?: string;
  created_at: string;
  truck?: Truck;
}

export interface Attachment {
  id: string;
  file_url: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  related_type: string;
  related_id: string;
  uploaded_by?: string;
  created_at: string;
}

export interface TripApproval {
  id: string;
  trip_id: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  corrections?: Record<string, unknown>;
  approved_at?: string;
  created_at: string;
}

export interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  related_type?: string;
  related_id?: string;
  priority: 'low' | 'medium' | 'high';
  is_read: boolean;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  created_for?: string;
}

export interface TripSummary {
  freightValue: number;
  totalExpenses: number;
  dieselExpenses: number;
  tollExpenses: number;
  otherExpenses: number;
  grossProfit: number;
  kmDriven: number;
  fuelEfficiency: number;
  costPerKm: number;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'toll', label: 'Pedágio' },
  { value: 'food', label: 'Alimentação' },
  { value: 'overnight', label: 'Pernoite' },
  { value: 'parking', label: 'Estacionamento' },
  { value: 'workshop', label: 'Oficina' },
  { value: 'tire', label: 'Borracharia' },
  { value: 'arla', label: 'Arla' },
  { value: 'fine', label: 'Multa' },
  { value: 'wash', label: 'Lavagem' },
  { value: 'other', label: 'Outros' },
];

export const MAINTENANCE_TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'oil_change', label: 'Troca de Óleo' },
  { value: 'tire_change', label: 'Troca de Pneu' },
  { value: 'brake_service', label: 'Freios' },
  { value: 'engine_service', label: 'Motor' },
  { value: 'electrical', label: 'Elétrica' },
  { value: 'suspension', label: 'Suspensão' },
  { value: 'bodywork', label: 'Lataria' },
  { value: 'inspection', label: 'Vistoria' },
  { value: 'other', label: 'Outros' },
];

export const TRUCK_STATUSES: { value: TruckStatus; label: string }[] = [
  { value: 'active', label: 'Ativo' },
  { value: 'stopped', label: 'Parado' },
  { value: 'maintenance', label: 'Em Manutenção' },
];

export const TRIP_STATUSES: { value: TripStatus; label: string }[] = [
  { value: 'planned', label: 'Planejada' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'completed', label: 'Finalizada' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'cancelled', label: 'Cancelada' },
];

export const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];
