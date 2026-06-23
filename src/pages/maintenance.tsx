import { useState, useEffect } from 'react';
import { FileText, Wrench, Plus, Calendar, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';
import Card from '../components/ui/card';
import { getMaintenanceRecords, getTrucks, createMaintenanceRecord } from '../lib/api';
import type { MaintenanceRecord, Truck } from '../lib/types';
import { MAINTENANCE_TYPES } from '../lib/types';
import Modal from '../components/ui/modal';
import Select from '../components/ui/select';
import Badge from '../components/ui/badge';
import ReceiptExtractor from '../components/receipt-extractor';

export default function MaintenancePage() {
  const [records, setRecords] = useState<(MaintenanceRecord & { truck?: Truck })[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [mData, tData] = await Promise.all([getMaintenanceRecords(), getTrucks()]);
      setRecords(mData);
      setTrucks(tData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const filteredRecords = records.filter((record) => {
    const typeLabel = MAINTENANCE_TYPES.find(t => t.value === record.maintenance_type)?.label || record.maintenance_type;
    const searchText = `${record.truck?.plate || ''} ${record.workshop_name || ''} ${record.description || ''} ${typeLabel}`.toLowerCase();
    return searchText.includes(search.toLowerCase());
  });

  const needsAttention = (truck: Truck) => {
    if (!truck.next_maintenance_km) return false;
    const remaining = truck.next_maintenance_km - truck.current_km;
    return remaining <= 5000;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manutencoes</h1>
          <p className="text-gray-500">Controle de manutencoes da frota</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Manutencao
        </Button>
      </div>

      {/* Alerts for upcoming maintenance */}
      {trucks.filter(needsAttention).length > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-warning-600" />
            <h3 className="font-semibold text-warning-800">Manutencoes Proximas</h3>
          </div>
          <div className="space-y-2">
            {trucks.filter(needsAttention).map((truck) => {
              const remaining = truck.next_maintenance_km! - truck.current_km;
              return (
                <div key={truck.id} className="flex items-center justify-between text-sm">
                  <span className="text-warning-700">
                    {truck.plate} - {truck.model}
                  </span>
                  <Badge variant="warning">
                    {remaining.toLocaleString('pt-BR')} km restantes
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-md">
        <Input
          placeholder="Buscar por placa ou oficina..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{search ? 'Nenhuma manutenção encontrada' : 'Nenhuma manutenção registrada'}</p>
          {!search && (
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              Registrar Manutenção
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const typeLabel = MAINTENANCE_TYPES.find(t => t.value === record.maintenance_type)?.label || record.maintenance_type;
            return (
              <Card key={record.id}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900 break-words">{typeLabel}</p>
                        {record.truck && (
                          <Badge variant="gray">{record.truck.plate}</Badge>
                        )}
                        {record.receipt_url && (
                          <a className="flex-shrink-0" href={record.receipt_url} target="_blank" rel="noreferrer" title="Abrir comprovante">
                            <FileText className="w-4 h-4 text-primary-500" />
                          </a>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-x-3 gap-y-1 text-sm text-gray-500 mt-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <Calendar className="w-3 h-3" />
                          <span className="truncate">{new Date(record.maintenance_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {record.workshop_name && (
                          <span className="break-words min-w-0">{record.workshop_name}</span>
                        )}
                        {record.km_at_maintenance && (
                          <span className="whitespace-nowrap">{record.km_at_maintenance.toLocaleString('pt-BR')} km</span>
                        )}
                      </div>
                      {record.description && (
                        <p className="text-sm text-gray-600 mt-1 break-words">{record.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex sm:block items-end justify-between gap-3 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
                    <p className="font-bold text-lg text-gray-900 whitespace-nowrap">{formatCurrency(record.cost)}</p>
                    {record.next_maintenance_km && (
                      <p className="text-sm text-gray-500 whitespace-nowrap">
                        Proxima: {record.next_maintenance_km.toLocaleString('pt-BR')} km
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <MaintenanceModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        trucks={trucks}
        onSave={async (data) => {
          setSaving(true);
          try {
            await createMaintenanceRecord(data);
            setShowModal(false);
            loadData();
          } catch (error) {
            console.error('Error saving maintenance:', error);
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
      />
    </div>
  );
}

function MaintenanceModal({ isOpen, onClose, trucks, onSave, saving }: {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  onSave: (data: Omit<MaintenanceRecord, 'id' | 'created_at' | 'truck'>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    truck_id: '',
    maintenance_type: 'oil_change' as MaintenanceRecord['maintenance_type'],
    maintenance_date: new Date().toISOString().split('T')[0],
    km_at_maintenance: 0,
    workshop_name: '',
    description: '',
    cost: 0,
    next_maintenance_km: 0,
    receipt_url: '',
  });

  useEffect(() => {
    if (isOpen && trucks.length > 0) {
      const truck = trucks.find(t => t.id === form.truck_id) || trucks[0];
      setForm(prev => ({
        ...prev,
        truck_id: truck.id,
        km_at_maintenance: truck.current_km,
        next_maintenance_km: truck.next_maintenance_km || 0,
      }));
    }
  }, [isOpen, trucks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      truck_id: form.truck_id,
      maintenance_type: form.maintenance_type,
      maintenance_date: form.maintenance_date,
      km_at_maintenance: form.km_at_maintenance || undefined,
      workshop_name: form.workshop_name || undefined,
      description: form.description || undefined,
      cost: form.cost,
      next_maintenance_km: form.next_maintenance_km || undefined,
      receipt_url: form.receipt_url || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Manutencao" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ReceiptExtractor
          onExtract={(result) => {
            const itemSummary = result.items.slice(0, 5).map(item => item.description).join(', ');
            setForm(prev => ({
              ...prev,
              maintenance_date: result.date || prev.maintenance_date,
              workshop_name: result.issuer || prev.workshop_name,
              description: itemSummary || prev.description,
              cost: result.total || prev.cost,
              receipt_url: result.receiptUrl || prev.receipt_url,
            }));
          }}
        />

        <Select
          label="Caminhao"
          value={form.truck_id}
          onChange={(e) => {
            const truck = trucks.find(t => t.id === e.target.value);
            if (truck) {
              setForm(prev => ({
                ...prev,
                truck_id: truck.id,
                km_at_maintenance: truck.current_km,
              }));
            }
          }}
          options={trucks.map(t => ({ value: t.id, label: `${t.plate} - ${t.model}` }))}
          required
        />

        <Select
          label="Tipo de Manutencao"
          value={form.maintenance_type}
          onChange={(e) => setForm({ ...form, maintenance_type: e.target.value as MaintenanceRecord['maintenance_type'] })}
          options={MAINTENANCE_TYPES.map(t => ({ value: t.value, label: t.label }))}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Data"
            type="date"
            value={form.maintenance_date}
            onChange={(e) => setForm({ ...form, maintenance_date: e.target.value })}
          />
          <Input
            label="KM na Manutencao"
            type="number"
            value={form.km_at_maintenance}
            onChange={(e) => setForm({ ...form, km_at_maintenance: parseInt(e.target.value) })}
          />
        </div>

        <Input
          label="Oficina"
          value={form.workshop_name}
          onChange={(e) => setForm({ ...form, workshop_name: e.target.value })}
          placeholder="Nome da oficina"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={2}
            placeholder="Detalhes da manutencao realizada"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Custo"
            type="number"
            step="0.01"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Proxima Manutencao (KM)"
            type="number"
            value={form.next_maintenance_km}
            onChange={(e) => setForm({ ...form, next_maintenance_km: parseInt(e.target.value) })}
            placeholder="Ex: 120000"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} fullWidth>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
