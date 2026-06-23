import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Truck as TruckIcon } from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';
import Card from '../components/ui/card';
import { StatusBadge } from '../components/ui/badge';
import { getTrucks, createTruck, updateTruck, deleteTruck } from '../lib/api';
import type { Truck } from '../lib/types';
import { TRUCK_STATUSES } from '../lib/types';
import Modal from '../components/ui/modal';
import Select from '../components/ui/select';

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTrucks();
  }, []);

  const loadTrucks = async () => {
    try {
      const data = await getTrucks();
      setTrucks(data);
    } catch (error) {
      console.error('Error loading trucks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrucks = trucks.filter((truck) =>
    truck.plate.toLowerCase().includes(search.toLowerCase()) ||
    truck.model.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caminhoes</h1>
          <p className="text-gray-500">Gerencie sua frota</p>
        </div>
        <Button onClick={() => { setEditingTruck(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Caminhao
        </Button>
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Buscar por placa ou modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredTrucks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {search ? 'Nenhum caminhao encontrado' : 'Nenhum caminhao cadastrado'}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              Cadastrar Caminhao
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrucks.map((truck) => (
            <TruckCard
              key={truck.id}
              truck={truck}
              onEdit={() => {
                setEditingTruck(truck);
                setShowModal(true);
              }}
              onDelete={async () => {
                if (confirm('Tem certeza que deseja excluir este caminhao?')) {
                  await deleteTruck(truck.id);
                  loadTrucks();
                }
              }}
            />
          ))}
        </div>
      )}

      <TruckModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        truck={editingTruck}
        onSave={async (data) => {
          setSaving(true);
          try {
            if (editingTruck) {
              await updateTruck(editingTruck.id, data);
            } else {
              await createTruck(data as Omit<Truck, 'id' | 'created_at' | 'updated_at'>);
            }
            setShowModal(false);
            loadTrucks();
          } catch (error) {
            console.error('Error saving truck:', error);
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
      />
    </div>
  );
}

function TruckCard({ truck, onEdit, onDelete }: {
  truck: Truck;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card hover padding="none" className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{truck.plate}</h3>
            <p className="text-gray-500">{truck.model} - {truck.year}</p>
          </div>
          <StatusBadge status={truck.status} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-gray-500">Tipo</p>
            <p className="font-medium">{truck.truck_type}</p>
          </div>
          <div>
            <p className="text-gray-500">Eixos</p>
            <p className="font-medium">{truck.axles_count}</p>
          </div>
          <div>
            <p className="text-gray-500">KM Atual</p>
            <p className="font-medium">{truck.current_km.toLocaleString('pt-BR')} km</p>
          </div>
          <div>
            <p className="text-gray-500">Media</p>
            <p className="font-medium">{truck.fuel_efficiency_km_per_l} km/L</p>
          </div>
        </div>

        {truck.next_maintenance_km && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Proxima manutencao: {truck.next_maintenance_km.toLocaleString('pt-BR')} km
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="w-4 h-4 mr-1" />
          Editar
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-1 text-danger-500" />
        </Button>
      </div>
    </Card>
  );
}

function TruckModal({ isOpen, onClose, truck, onSave, saving }: {
  isOpen: boolean;
  onClose: () => void;
  truck: Truck | null;
  onSave: (data: Partial<Truck>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    plate: '',
    model: '',
    year: new Date().getFullYear(),
    truck_type: '',
    axles_count: 2,
    fuel_efficiency_km_per_l: 0,
    current_km: 0,
    next_maintenance_km: 0,
    status: 'active' as 'active' | 'stopped' | 'maintenance',
    notes: '',
  });

  useEffect(() => {
    if (truck) {
      setForm({
        plate: truck.plate,
        model: truck.model,
        year: truck.year,
        truck_type: truck.truck_type,
        axles_count: truck.axles_count,
        fuel_efficiency_km_per_l: truck.fuel_efficiency_km_per_l,
        current_km: truck.current_km,
        next_maintenance_km: truck.next_maintenance_km || 0,
        status: truck.status,
        notes: truck.notes || '',
      });
    } else {
      setForm({
        plate: '',
        model: '',
        year: new Date().getFullYear(),
        truck_type: '',
        axles_count: 2,
        fuel_efficiency_km_per_l: 0,
        current_km: 0,
        next_maintenance_km: 0,
        status: 'active',
        notes: '',
      });
    }
  }, [truck, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      next_maintenance_km: form.next_maintenance_km || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={truck ? 'Editar Caminhao' : 'Novo Caminhao'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Placa"
            value={form.plate}
            onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })}
            placeholder="ABC-1234"
            required
          />
          <Input
            label="Modelo"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="Scania R450"
            required
          />
          <Input
            label="Ano"
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
            min={1990}
            max={new Date().getFullYear() + 1}
            required
          />
          <Input
            label="Tipo"
            value={form.truck_type}
            onChange={(e) => setForm({ ...form, truck_type: e.target.value })}
            placeholder="Cavalo Mecanico, Truck, etc."
            required
          />
          <Input
            label="Quantidade de Eixos"
            type="number"
            value={form.axles_count}
            onChange={(e) => setForm({ ...form, axles_count: parseInt(e.target.value) })}
            min={2}
            max={10}
            required
          />
          <Input
            label="Media de Consumo (km/L)"
            type="number"
            step="0.1"
            value={form.fuel_efficiency_km_per_l}
            onChange={(e) => setForm({ ...form, fuel_efficiency_km_per_l: parseFloat(e.target.value) })}
            placeholder="3.5"
          />
          <Input
            label="KM Atual"
            type="number"
            value={form.current_km}
            onChange={(e) => setForm({ ...form, current_km: parseInt(e.target.value) })}
            placeholder="100000"
          />
          <Input
            label="Proxima Manutencao (KM)"
            type="number"
            value={form.next_maintenance_km}
            onChange={(e) => setForm({ ...form, next_maintenance_km: parseInt(e.target.value) })}
            placeholder="120000"
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'stopped' | 'maintenance' })}
            options={TRUCK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={3}
            placeholder="Observacoes sobre o caminhao..."
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} fullWidth>
            {truck ? 'Salvar' : 'Cadastrar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
