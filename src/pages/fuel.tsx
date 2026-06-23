import { useState, useEffect } from 'react';
import { FileText, Fuel, Plus, Calendar, MapPin } from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';
import Card from '../components/ui/card';
import { getFuelRecords, getTrucks, createFuelRecord } from '../lib/api';
import type { FuelRecord, Truck } from '../lib/types';
import Modal from '../components/ui/modal';
import Select from '../components/ui/select';
import ReceiptExtractor from '../components/receipt-extractor';

export default function FuelPage() {
  const [records, setRecords] = useState<FuelRecord[]>([]);
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
      const [fuelData, trucksData] = await Promise.all([getFuelRecords(), getTrucks()]);
      setRecords(fuelData);
      setTrucks(trucksData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const filteredRecords = records.filter((record) => {
    const truck = trucks.find(t => t.id === record.truck_id);
    const searchText = `${record.station_name || ''} ${record.city || ''} ${record.state || ''} ${truck?.plate || ''}`.toLowerCase();
    return searchText.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abastecimentos</h1>
          <p className="text-gray-500">Controle de combustivel</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Abastecimento
        </Button>
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Buscar por posto ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Fuel className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{search ? 'Nenhum abastecimento encontrado' : 'Nenhum abastecimento registrado'}</p>
          {!search && (
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              Registrar Abastecimento
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const truck = trucks.find(t => t.id === record.truck_id);
            return (
              <Card key={record.id} hover>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Fuel className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 min-w-0">
                        <p className="font-semibold text-gray-900 whitespace-nowrap">{truck?.plate || 'Caminhao'}</p>
                        <span className="text-sm text-gray-400">•</span>
                        <span className="text-sm text-gray-500 leading-snug break-words min-w-0">{record.station_name || 'Posto'}</span>
                        {record.receipt_url && (
                          <a className="flex-shrink-0" href={record.receipt_url} target="_blank" rel="noreferrer" title="Abrir comprovante">
                            <FileText className="w-4 h-4 text-primary-500" />
                          </a>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-gray-500 mt-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <Calendar className="w-3 h-3" />
                          <span className="truncate">{new Date(record.fuel_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {record.city && (
                          <div className="flex items-center gap-1 min-w-0">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{record.city}</span>
                          </div>
                        )}
                        <div className="col-span-2 sm:col-span-1">
                          {record.liters.toFixed(2)} L a {formatCurrency(record.price_per_liter)}/L
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex sm:block items-end justify-between gap-3 border-t border-gray-100 pt-3 sm:border-0 sm:pt-0">
                    <p className="font-bold text-lg text-gray-900 whitespace-nowrap">{formatCurrency(record.total_amount)}</p>
                    {record.km_at_refuel && (
                      <p className="text-sm text-gray-500 whitespace-nowrap">{record.km_at_refuel.toLocaleString('pt-BR')} km</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <FuelModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        trucks={trucks}
        onSave={async (data) => {
          setSaving(true);
          try {
            await createFuelRecord(data);
            setShowModal(false);
            loadData();
          } catch (error) {
            console.error('Error saving fuel record:', error);
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
      />
    </div>
  );
}

function FuelModal({ isOpen, onClose, trucks, onSave, saving }: {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  onSave: (data: Omit<FuelRecord, 'id' | 'created_at'>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    truck_id: '',
    fuel_date: new Date().toISOString().split('T')[0],
    station_name: '',
    city: '',
    state: '',
    liters: 0,
    price_per_liter: 0,
    total_amount: 0,
    km_at_refuel: 0,
    receipt_url: '',
  });

  useEffect(() => {
    const total = form.liters * form.price_per_liter;
    setForm(prev => ({ ...prev, total_amount: total }));
  }, [form.liters, form.price_per_liter]);

  useEffect(() => {
    if (isOpen && trucks.length > 0) {
      setForm(prev => ({ ...prev, truck_id: trucks[0].id }));
    }
  }, [isOpen, trucks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      truck_id: form.truck_id,
      fuel_date: form.fuel_date,
      station_name: form.station_name || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      liters: form.liters,
      price_per_liter: form.price_per_liter,
      total_amount: form.total_amount,
      km_at_refuel: form.km_at_refuel || undefined,
      receipt_url: form.receipt_url || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Abastecimento" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ReceiptExtractor
          onExtract={(result) => {
            setForm(prev => ({
              ...prev,
              fuel_date: result.date || prev.fuel_date,
              station_name: result.issuer || prev.station_name,
              city: result.city || prev.city,
              state: result.state || prev.state,
              liters: result.liters || prev.liters,
              price_per_liter: result.pricePerLiter || prev.price_per_liter,
              total_amount: result.total || prev.total_amount,
              receipt_url: result.receiptUrl || prev.receipt_url,
            }));
          }}
        />

        <Select
          label="Caminhao"
          value={form.truck_id}
          onChange={(e) => setForm({ ...form, truck_id: e.target.value })}
          options={trucks.map(t => ({ value: t.id, label: `${t.plate} - ${t.model}` }))}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Data"
            type="date"
            value={form.fuel_date}
            onChange={(e) => setForm({ ...form, fuel_date: e.target.value })}
          />
          <Input
            label="Posto"
            value={form.station_name}
            onChange={(e) => setForm({ ...form, station_name: e.target.value })}
            placeholder="Nome do posto"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Cidade"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Cidade"
          />
          <Input
            label="Estado"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            placeholder="UF"
            maxLength={2}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Litros"
            type="number"
            step="0.001"
            value={form.liters}
            onChange={(e) => setForm({ ...form, liters: parseFloat(e.target.value) })}
            required
          />
          <Input
            label="Preco por Litro"
            type="number"
            step="0.001"
            value={form.price_per_liter}
            onChange={(e) => setForm({ ...form, price_per_liter: parseFloat(e.target.value) })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
            <p className="py-2 font-bold text-lg text-gray-900">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(form.total_amount)}
            </p>
          </div>
        </div>

        <Input
          label="KM no abastecimento"
          type="number"
          value={form.km_at_refuel}
          onChange={(e) => setForm({ ...form, km_at_refuel: parseInt(e.target.value) })}
          placeholder="Quilometragem atual"
        />

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
