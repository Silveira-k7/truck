import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Eye, MapPin } from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';
import Card from '../components/ui/card';
import { StatusBadge } from '../components/ui/badge';
import { getTrips, getTrucks, getDrivers, createTrip, updateTrip } from '../lib/api';
import type { Trip, Truck, Driver } from '../lib/types';
import { TRIP_STATUSES, BRAZILIAN_STATES } from '../lib/types';
import Modal from '../components/ui/modal';
import Select from '../components/ui/select';

export default function TripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<(Trip & { truck?: Truck; driver?: Driver })[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      const [tripsData, trucksData, driversData] = await Promise.all([
        getTrips(statusFilter ? { status: statusFilter } : undefined),
        getTrucks(),
        getDrivers(),
      ]);
      setTrips(tripsData);
      setTrucks(trucksData);
      setDrivers(driversData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = trips.filter((trip) =>
    trip.origin_city.toLowerCase().includes(search.toLowerCase()) ||
    trip.destination_city.toLowerCase().includes(search.toLowerCase()) ||
    trip.truck?.plate.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Viagens</h1>
          <p className="text-gray-500">Controle de viagens da frota</p>
        </div>
        <Button onClick={() => { setEditingTrip(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Viagem
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por cidade ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'Todos os status' },
            ...TRIP_STATUSES.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {search || statusFilter ? 'Nenhuma viagem encontrada' : 'Nenhuma viagem cadastrada'}
          </p>
          {!search && !statusFilter && (
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              Cadastrar Viagem
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTrips.map((trip) => (
            <Card
              key={trip.id}
              hover
              className="cursor-pointer"
              onClick={() => navigate(`/trips/${trip.id}`)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-gray-900">
                      {trip.origin_city}/{trip.origin_state}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="font-bold text-lg text-gray-900">
                      {trip.destination_city}/{trip.destination_state}
                    </span>
                    <StatusBadge status={trip.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{trip.truck?.plate}</span>
                    <span>{trip.driver?.name}</span>
                    <span>{new Date(trip.start_date).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-lg text-gray-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(trip.freight_value)}
                    </p>
                    {trip.km_start && trip.km_end && (
                      <p className="text-sm text-gray-500">
                        {(trip.km_end - trip.km_start).toLocaleString('pt-BR')} km
                      </p>
                    )}
                  </div>
                  <Eye className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TripModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        trip={editingTrip}
        trucks={trucks}
        drivers={drivers}
        onSave={async (data) => {
          setSaving(true);
          try {
            if (editingTrip) {
              await updateTrip(editingTrip.id, data);
            } else {
              await createTrip(data as Omit<Trip, 'id' | 'created_at' | 'updated_at' | 'truck' | 'driver' | 'expenses' | 'fuel_records' | 'route_estimate'>);
            }
            setShowModal(false);
            loadData();
          } catch (error) {
            console.error('Error saving trip:', error);
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
      />
    </div>
  );
}

function TripModal({ isOpen, onClose, trip, trucks, drivers, onSave, saving }: {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  trucks: Truck[];
  drivers: Driver[];
  onSave: (data: Partial<Trip>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    truck_id: '',
    driver_id: '',
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    cargo_description: '',
    freight_value: 0,
    start_date: new Date().toISOString().split('T')[0],
    km_start: 0,
    km_end: 0,
    notes: '',
  });

  useEffect(() => {
    if (trip) {
      setForm({
        truck_id: trip.truck_id,
        driver_id: trip.driver_id,
        origin_city: trip.origin_city,
        origin_state: trip.origin_state,
        destination_city: trip.destination_city,
        destination_state: trip.destination_state,
        cargo_description: trip.cargo_description || '',
        freight_value: trip.freight_value,
        start_date: trip.start_date,
        km_start: trip.km_start || 0,
        km_end: trip.km_end || 0,
        notes: trip.notes || '',
      });
    } else {
      setForm({
        truck_id: trucks[0]?.id || '',
        driver_id: drivers[0]?.id || '',
        origin_city: '',
        origin_state: '',
        destination_city: '',
        destination_state: '',
        cargo_description: '',
        freight_value: 0,
        start_date: new Date().toISOString().split('T')[0],
        km_start: 0,
        km_end: 0,
        notes: '',
      });
    }
  }, [trip, isOpen, trucks, drivers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      km_start: form.km_start || undefined,
      km_end: form.km_end || undefined,
    });
  };

  const activeTrucks = trucks.filter(t => t.status === 'active');
  const activeDrivers = drivers.filter(d => d.is_active);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={trip ? 'Editar Viagem' : 'Nova Viagem'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Caminhao"
            value={form.truck_id}
            onChange={(e) => setForm({ ...form, truck_id: e.target.value })}
            options={activeTrucks.map((t) => ({ value: t.id, label: `${t.plate} - ${t.model}` }))}
            placeholder="Selecione o caminhao"
            required
          />
          <Select
            label="Motorista"
            value={form.driver_id}
            onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
            options={activeDrivers.map((d) => ({ value: d.id, label: d.name }))}
            placeholder="Selecione o motorista"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Cidade de origem"
              value={form.origin_city}
              onChange={(e) => setForm({ ...form, origin_city: e.target.value })}
              placeholder="Sao Paulo"
              required
            />
            <Select
              label="Estado"
              value={form.origin_state}
              onChange={(e) => setForm({ ...form, origin_state: e.target.value })}
              options={BRAZILIAN_STATES.map((s) => ({ value: s.value, label: s.value }))}
              className="mt-2"
            />
          </div>
          <div>
            <Input
              label="Cidade de destino"
              value={form.destination_city}
              onChange={(e) => setForm({ ...form, destination_city: e.target.value })}
              placeholder="Rio de Janeiro"
              required
            />
            <Select
              label="Estado"
              value={form.destination_state}
              onChange={(e) => setForm({ ...form, destination_state: e.target.value })}
              options={BRAZILIAN_STATES.map((s) => ({ value: s.value, label: s.value }))}
              className="mt-2"
            />
          </div>
        </div>

        <Input
          label="Descricao da carga"
          value={form.cargo_description}
          onChange={(e) => setForm({ ...form, cargo_description: e.target.value })}
          placeholder="Ex: Soja a granel, 28 toneladas"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Valor do frete"
            type="number"
            step="0.01"
            value={form.freight_value}
            onChange={(e) => setForm({ ...form, freight_value: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Data de saida"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="KM inicial"
            type="number"
            value={form.km_start}
            onChange={(e) => setForm({ ...form, km_start: parseInt(e.target.value) })}
          />
          <Input
            label="KM final"
            type="number"
            value={form.km_end}
            onChange={(e) => setForm({ ...form, km_end: parseInt(e.target.value) })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={2}
            placeholder="Notas sobre a viagem..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} fullWidth>
            {trip ? 'Salvar' : 'Cadastrar Viagem'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
