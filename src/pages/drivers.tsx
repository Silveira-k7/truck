import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, User, Phone } from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';
import { getDrivers, getTrucks, createDriver, updateDriver, deleteDriver } from '../lib/api';
import type { Driver, Truck } from '../lib/types';
import Modal from '../components/ui/modal';
import Select from '../components/ui/select';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [driversData, trucksData] = await Promise.all([getDrivers(), getTrucks()]);
      setDrivers(driversData);
      setTrucks(trucksData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDrivers = drivers.filter((driver) =>
    driver.name.toLowerCase().includes(search.toLowerCase()) ||
    driver.phone?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Motoristas</h1>
          <p className="text-gray-500">Gerencie os motoristas da frota</p>
        </div>
        <Button onClick={() => { setEditingDriver(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Motorista
        </Button>
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {search ? 'Nenhum motorista encontrado' : 'Nenhum motorista cadastrado'}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              Cadastrar Motorista
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDrivers.map((driver) => (
            <Card key={driver.id} hover>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{driver.name}</h3>
                    {driver.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Phone className="w-3 h-3" />
                        {driver.phone}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={driver.is_active ? 'success' : 'gray'}>
                  {driver.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {driver.truck && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Caminhao vinculado</p>
                  <p className="font-medium text-gray-900">{driver.truck.plate} - {driver.truck.model}</p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingDriver(driver);
                    setShowModal(true);
                  }}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (confirm('Tem certeza que deseja excluir este motorista?')) {
                      await deleteDriver(driver.id);
                      loadData();
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1 text-danger-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <DriverModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        driver={editingDriver}
        trucks={trucks}
        onSave={async (data) => {
          setSaving(true);
          try {
            if (editingDriver) {
              await updateDriver(editingDriver.id, data);
            } else {
              await createDriver(data as Omit<Driver, 'id' | 'created_at' | 'updated_at' | 'truck'>);
            }
            setShowModal(false);
            loadData();
          } catch (error) {
            console.error('Error saving driver:', error);
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
      />
    </div>
  );
}

function DriverModal({ isOpen, onClose, driver, trucks, onSave, saving }: {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
  trucks: Truck[];
  onSave: (data: Partial<Driver>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    cpf: '',
    truck_id: '',
    is_active: true,
  });

  useEffect(() => {
    if (driver) {
      setForm({
        name: driver.name,
        phone: driver.phone || '',
        cpf: driver.cpf || '',
        truck_id: driver.truck_id || '',
        is_active: driver.is_active,
      });
    } else {
      setForm({
        name: '',
        phone: '',
        cpf: '',
        truck_id: '',
        is_active: true,
      });
    }
  }, [driver, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      truck_id: form.truck_id || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={driver ? 'Editar Motorista' : 'Novo Motorista'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome completo"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nome do motorista"
          required
        />

        <Input
          label="Telefone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="(00) 00000-0000"
          type="tel"
        />

        <Input
          label="CPF (opcional)"
          value={form.cpf}
          onChange={(e) => setForm({ ...form, cpf: e.target.value })}
          placeholder="000.000.000-00"
        />

        <Select
          label="Caminhao vinculado"
          value={form.truck_id}
          onChange={(e) => setForm({ ...form, truck_id: e.target.value })}
          options={[
            { value: '', label: 'Nenhum' },
            ...trucks.map((t) => ({ value: t.id, label: `${t.plate} - ${t.model}` })),
          ]}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="w-4 h-4 text-primary-600 rounded"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">
            Motorista ativo
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} fullWidth>
            {driver ? 'Salvar' : 'Cadastrar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
