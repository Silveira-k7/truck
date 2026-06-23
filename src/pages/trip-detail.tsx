import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Truck,
  User,
  Calendar,
  DollarSign,
  Fuel,
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  FileText,
  Play,
} from 'lucide-react';
import Button from '../components/ui/button';
import Card, { CardHeader } from '../components/ui/card';
import { StatusBadge } from '../components/ui/badge';
import { getTrip, updateTrip, createExpense, deleteExpense, calculateTripSummary } from '../lib/api';
import type { Trip, Expense } from '../lib/types';
import { EXPENSE_CATEGORIES } from '../lib/types';
import Modal from '../components/ui/modal';
import Input from '../components/ui/input';
import Select from '../components/ui/select';
import { useAuth } from '../lib/auth-context';
import ReceiptExtractor from '../components/receipt-extractor';
import { buildReceiptDescription } from '../lib/receipt-extraction';

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    loadTrip();
  }, [id]);

  const loadTrip = async () => {
    if (!id) return;
    try {
      const data = await getTrip(id);
      setTrip(data);
    } catch (error) {
      console.error('Error loading trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: Trip['status']) => {
    if (!trip) return;
    try {
      await updateTrip(trip.id, { status });
      loadTrip();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Viagem nao encontrada</p>
        <Button className="mt-4" onClick={() => navigate('/trips')}>
          Voltar para viagens
        </Button>
      </div>
    );
  }

  const summary = calculateTripSummary(trip);
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/trips')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Trip Info Card */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {trip.origin_city}/{trip.origin_state}
              </h1>
              <MapPin className="w-5 h-5 text-gray-400" />
              <h1 className="text-2xl font-bold text-gray-900">
                {trip.destination_city}/{trip.destination_state}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-gray-500 mb-3">
              <div className="flex items-center gap-1">
                <Truck className="w-4 h-4" />
                <span>{trip.truck?.plate}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{trip.driver?.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(trip.start_date).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <StatusBadge status={trip.status} />
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">Valor do frete</p>
            <p className="text-3xl font-bold text-primary-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(trip.freight_value)}
            </p>
          </div>
        </div>

        {trip.cargo_description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Carga</p>
            <p className="text-gray-900">{trip.cargo_description}</p>
          </div>
        )}

        {/* KM Controls */}
        {trip.status === 'in_progress' && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate(`/trips/${trip.id}/km`)}>
              <Edit className="w-4 h-4 mr-2" />
              Atualizar KM
            </Button>
          </div>
        )}

        {/* Status Actions */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
          {trip.status === 'planned' && (
            <Button onClick={() => handleUpdateStatus('in_progress')}>
              <Play className="w-4 h-4 mr-2" />
              Iniciar Viagem
            </Button>
          )}
          {trip.status === 'in_progress' && (
            <Button onClick={() => handleUpdateStatus('completed')}>
              <Check className="w-4 h-4 mr-2" />
              Finalizar Viagem
            </Button>
          )}
          {trip.status === 'completed' && isAdmin && (
            <Button onClick={() => setShowApprovalModal(true)}>
              <Check className="w-4 h-4 mr-2" />
              Aprovar Viagem
            </Button>
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader title="Lucro Bruto" />
          <p className={`text-2xl font-bold ${summary.grossProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.grossProfit)}
          </p>
        </Card>
        <Card>
          <CardHeader title="Total Gastos" />
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.totalExpenses)}
          </p>
        </Card>
        <Card>
          <CardHeader title="KM Rodados" />
          <p className="text-2xl font-bold text-gray-900">
            {summary.kmDriven.toLocaleString('pt-BR')} km
          </p>
        </Card>
        <Card>
          <CardHeader title="Custo por KM" />
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.costPerKm)}
          </p>
        </Card>
      </div>

      {/* Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-primary-50 border-primary-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-primary-700">Diesel</p>
              <p className="text-xl font-bold text-primary-800">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.dieselExpenses)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="bg-warning-50 border-warning-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning-600 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-warning-700">Pedágios</p>
              <p className="text-xl font-bold text-warning-800">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.tollExpenses)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Outros</p>
              <p className="text-xl font-bold text-gray-800">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary.otherExpenses)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Expenses List */}
      <Card padding="none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Gastos</h2>
          <Button size="sm" onClick={() => setShowExpenseModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Gasto
          </Button>
        </div>
        <div className="divide-y divide-gray-100">
          {trip.expenses && trip.expenses.length > 0 ? (
            trip.expenses.map((expense) => (
              <ExpenseItem
                key={expense.id}
                expense={expense}
                onDelete={async () => {
                  if (confirm('Excluir este gasto?')) {
                    await deleteExpense(expense.id);
                    loadTrip();
                  }
                }}
              />
            ))
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-500">Nenhum gasto registrado</p>
            </div>
          )}
        </div>
      </Card>

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        tripId={trip.id}
        onSaved={loadTrip}
      />

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        trip={trip}
        summary={summary}
        onApprove={async (approved) => {
          await handleUpdateStatus(approved ? 'approved' : 'cancelled');
          setShowApprovalModal(false);
        }}
      />
    </div>
  );
}

function ExpenseItem({ expense, onDelete }: { expense: Expense; onDelete: () => void }) {
  const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category;

  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900">{categoryLabel}</p>
          {expense.receipt_url && (
            <a href={expense.receipt_url} target="_blank" rel="noreferrer" title="Abrir comprovante">
              <FileText className="w-4 h-4 text-primary-500" />
            </a>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {new Date(expense.expense_date).toLocaleDateString('pt-BR')}
          {expense.description && ` - ${expense.description}`}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <p className="font-semibold text-gray-900">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expense.amount)}
        </p>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="w-4 h-4 text-danger-500" />
        </Button>
      </div>
    </div>
  );
}

function ExpenseModal({ isOpen, onClose, tripId, onSaved }: {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category: 'diesel' as Expense['category'],
    amount: 0,
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    location_city: '',
    receipt_url: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createExpense({
        trip_id: tripId,
        category: form.category,
        amount: form.amount,
        description: form.description,
        expense_date: form.expense_date,
        location_city: form.location_city || undefined,
        receipt_url: form.receipt_url || undefined,
      });
      onClose();
      onSaved();
      setForm({
        category: 'diesel',
        amount: 0,
        description: '',
        expense_date: new Date().toISOString().split('T')[0],
        location_city: '',
        receipt_url: '',
      });
    } catch (error) {
      console.error('Error saving expense:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Gasto" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ReceiptExtractor
          onExtract={(result) => {
            setForm(prev => ({
              ...prev,
              category: result.categorySuggestion || prev.category,
              amount: result.total || prev.amount,
              description: buildReceiptDescription(result),
              expense_date: result.date || prev.expense_date,
              location_city: result.city || prev.location_city,
              receipt_url: result.receiptUrl || prev.receipt_url,
            }));
          }}
        />

        <Select
          label="Categoria"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value as Expense['category'] })}
          options={EXPENSE_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
        />

        <Input
          label="Valor"
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
          required
        />

        <Input
          label="Descricao"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Ex: Abastecimento no Posto XYZ"
        />

        <Input
          label="Data"
          type="date"
          value={form.expense_date}
          onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
        />

        <Input
          label="Cidade"
          value={form.location_city}
          onChange={(e) => setForm({ ...form, location_city: e.target.value })}
          placeholder="Onde foi feito o gasto"
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

function ApprovalModal({ isOpen, onClose, trip, summary, onApprove }: {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  summary: ReturnType<typeof calculateTripSummary>;
  onApprove: (approved: boolean) => void;
}) {
  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aprovar Viagem" size="lg">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Valor do Frete</span>
            <span className="font-semibold">{formatCurrency(trip.freight_value)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total de Gastos</span>
            <span className="font-semibold">{formatCurrency(summary.totalExpenses)}</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="text-gray-900 font-semibold">Lucro Bruto</span>
            <span className={`font-bold text-lg ${summary.grossProfit >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              {formatCurrency(summary.grossProfit)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">KM Rodados</p>
            <p className="font-semibold text-lg">{summary.kmDriven.toLocaleString('pt-BR')} km</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Custo por KM</p>
            <p className="font-semibold text-lg">{formatCurrency(summary.costPerKm)}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="danger" fullWidth onClick={() => onApprove(false)}>
            <X className="w-4 h-4 mr-2" />
            Rejeitar
          </Button>
          <Button variant="success" fullWidth onClick={() => onApprove(true)}>
            <Check className="w-4 h-4 mr-2" />
            Aprovar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
