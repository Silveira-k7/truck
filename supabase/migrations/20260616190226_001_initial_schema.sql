-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'driver');

-- Trip status enum
CREATE TYPE trip_status AS ENUM ('planned', 'in_progress', 'completed', 'approved', 'cancelled');

-- Truck status enum
CREATE TYPE truck_status AS ENUM ('active', 'stopped', 'maintenance');

-- Expense category enum
CREATE TYPE expense_category AS ENUM ('diesel', 'toll', 'food', 'overnight', 'parking', 'workshop', 'tire', 'arla', 'fine', 'wash', 'other');

-- Maintenance type enum
CREATE TYPE maintenance_type AS ENUM ('oil_change', 'tire_change', 'brake_service', 'engine_service', 'electrical', 'suspension', 'bodywork', 'inspection', 'other');

-- USERS table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  role user_role NOT NULL DEFAULT 'driver',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TRUCKS table
CREATE TABLE trucks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plate TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  truck_type TEXT NOT NULL,
  axles_count INTEGER NOT NULL DEFAULT 2,
  fuel_efficiency_km_per_l DECIMAL(6,2) DEFAULT 0,
  current_km INTEGER DEFAULT 0,
  next_maintenance_km INTEGER,
  next_maintenance_date DATE,
  status truck_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- DRIVERS table (links user to truck)
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TRIPS table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
  origin_city TEXT NOT NULL,
  origin_state TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_state TEXT NOT NULL,
  cargo_description TEXT,
  freight_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  km_start INTEGER,
  km_end INTEGER,
  distance_km INTEGER,
  status trip_status NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ROUTE ESTIMATES table (pre-trip estimates)
CREATE TABLE route_estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  estimated_distance_km DECIMAL(10,2),
  estimated_duration_hours DECIMAL(6,2),
  estimated_toll_cost DECIMAL(12,2),
  estimated_fuel_liters DECIMAL(10,2),
  estimated_fuel_cost DECIMAL(12,2),
  estimated_total_cost DECIMAL(12,2),
  estimated_profit DECIMAL(12,2),
  route_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EXPENSES table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category expense_category NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location_city TEXT,
  location_state TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FUEL RECORDS table (detailed fuel tracking)
CREATE TABLE fuel_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
  fuel_date DATE NOT NULL DEFAULT CURRENT_DATE,
  station_name TEXT,
  city TEXT,
  state TEXT,
  liters DECIMAL(10,3) NOT NULL,
  price_per_liter DECIMAL(8,3) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  km_at_refuel INTEGER,
  receipt_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MAINTENANCE RECORDS table
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
  maintenance_type maintenance_type NOT NULL,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  km_at_maintenance INTEGER,
  workshop_name TEXT,
  description TEXT,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  receipt_url TEXT,
  next_maintenance_km INTEGER,
  next_maintenance_date DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ATTACHMENTS table (for receipt photos)
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  related_type TEXT NOT NULL, -- 'expense', 'fuel', 'maintenance'
  related_id UUID NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TRIP APPROVALS table
CREATE TABLE trip_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  notes TEXT,
  corrections JSONB,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ALERTS table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_type TEXT, -- 'truck', 'trip', 'maintenance'
  related_id UUID,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_for UUID REFERENCES profiles(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_trips_truck ON trips(truck_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_dates ON trips(start_date, end_date);
CREATE INDEX idx_expenses_trip ON expenses(trip_id);
CREATE INDEX idx_fuel_records_truck ON fuel_records(truck_id);
CREATE INDEX idx_fuel_records_trip ON fuel_records(trip_id);
CREATE INDEX idx_maintenance_truck ON maintenance_records(truck_id);
CREATE INDEX idx_alerts_user ON alerts(created_for);
CREATE INDEX idx_alerts_read ON alerts(is_read);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLS Policies for trucks (all authenticated users can see, only admins can modify)
CREATE POLICY "trucks_select" ON trucks FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "trucks_insert" ON trucks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "trucks_update" ON trucks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "trucks_delete" ON trucks FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for drivers
CREATE POLICY "drivers_select" ON drivers FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "drivers_insert" ON drivers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "drivers_update" ON drivers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "drivers_delete" ON drivers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for trips
CREATE POLICY "trips_select" ON trips FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM drivers d 
      JOIN profiles p ON d.user_id = p.id 
      WHERE d.id = trips.driver_id AND p.id = auth.uid()
    )
  );
CREATE POLICY "trips_insert" ON trips FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "trips_update" ON trips FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "trips_delete" ON trips FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for route_estimates
CREATE POLICY "route_estimates_select" ON route_estimates FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = route_estimates.trip_id)
  );
CREATE POLICY "route_estimates_insert" ON route_estimates FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "route_estimates_update" ON route_estimates FOR UPDATE
  TO authenticated USING (true);

-- RLS Policies for expenses
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM trips t
      JOIN drivers d ON t.driver_id = d.id
      JOIN profiles p ON d.user_id = p.id
      WHERE t.id = expenses.trip_id AND p.id = auth.uid()
    )
  );
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  TO authenticated USING (true);

-- RLS Policies for fuel_records
CREATE POLICY "fuel_records_select" ON fuel_records FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "fuel_records_insert" ON fuel_records FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "fuel_records_update" ON fuel_records FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "fuel_records_delete" ON fuel_records FOR DELETE
  TO authenticated USING (true);

-- RLS Policies for maintenance_records
CREATE POLICY "maintenance_select" ON maintenance_records FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "maintenance_insert" ON maintenance_records FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "maintenance_update" ON maintenance_records FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "maintenance_delete" ON maintenance_records FOR DELETE
  TO authenticated USING (true);

-- RLS Policies for attachments
CREATE POLICY "attachments_select" ON attachments FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "attachments_insert" ON attachments FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "attachments_delete" ON attachments FOR DELETE
  TO authenticated USING (true);

-- RLS Policies for trip_approvals
CREATE POLICY "approvals_select" ON trip_approvals FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "approvals_insert" ON trip_approvals FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "approvals_update" ON trip_approvals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for alerts
CREATE POLICY "alerts_select" ON alerts FOR SELECT
  TO authenticated USING (
    created_for = auth.uid() 
    OR created_for IS NULL 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "alerts_insert" ON alerts FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "alerts_update" ON alerts FOR UPDATE
  TO authenticated USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'driver')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();