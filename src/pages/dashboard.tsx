import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Truck,
  Fuel,
  CreditCard,
  Wrench,
  AlertTriangle,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { StatCard } from '../components/ui/card';
import Button from '../components/ui/button';
import Input from '../components/ui/input';
import { StatusBadge } from '../components/ui/badge';
import { getDashboardSummary, getTrips } from '../lib/api';
import type { Trip, Truck as TruckType, Driver } from '../lib/types';

// Simple hooks for data fetching
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function useDashboard(month: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardSummary>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getDashboardSummary(month)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [month]);

  return { data, loading, error };
}

function useRecentTrips(month: string) {
  const [data, setData] = useState<(Trip & { truck?: TruckType; driver?: Driver })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    getTrips()
      .then((trips) => setData(trips.filter((trip) => trip.start_date?.startsWith(month)).slice(0, 5)))
      .finally(() => setLoading(false));
  }, [month]);

  return { data, loading };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const { data: summary, loading: summaryLoading, error: summaryError } = useDashboard(selectedMonth);
  const { data: recentTrips } = useRecentTrips(selectedMonth);

  if (profile?.role === 'driver') {
    return <DriverDashboard />;
  }

  if (summaryLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Visao geral da sua frota</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <Input
            label="Mes"
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonth())}
            className="sm:w-44"
          />
          <Button onClick={() => navigate('/trips/new')}>
            Nova Viagem
          </Button>
        </div>
      </div>

      {summaryError && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          Nao foi possivel carregar os indicadores: {summaryError}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Faturamento do Mes"
          value={summary ? formatCurrency(summary.totalRevenue) : 'R$ 0'}
          icon={DollarSign}
          color="success"
        />
        <StatCard
          title="Lucro Liquido"
          value={summary ? formatCurrency(summary.netProfit) : 'R$ 0'}
          icon={summary && summary.netProfit >= 0 ? TrendingUp : TrendingDown}
          color={summary && summary.netProfit >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          title="KM Rodados"
          value={summary ? formatNumber(summary.totalKm) : '0'}
          subtitle="km"
          icon={Truck}
          color="primary"
        />
        <StatCard
          title="Pedagios"
          value={summary ? formatCurrency(summary.totalTolls) : 'R$ 0'}
          icon={CreditCard}
          color="warning"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Gasto com Diesel"
          value={summary ? formatCurrency(summary.totalDiesel) : 'R$ 0'}
          icon={Fuel}
          color="gray"
        />
        <StatCard
          title="Manutencao"
          value={summary ? formatCurrency(summary.totalMaintenance) : 'R$ 0'}
          icon={Wrench}
          color="gray"
        />
        <StatCard
          title="Aguardando Aprovacao"
          value={summary?.pendingApprovals || 0}
          subtitle="viagens"
          icon={Clock}
          color={summary && summary.pendingApprovals > 0 ? 'warning' : 'gray'}
        />
      </div>

      {/* Highlights */}
      {summary?.topTruck && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-success-50 rounded-xl p-4 border border-success-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-success-700 font-medium">Caminhao que mais lucrou</p>
                <p className="text-lg font-bold text-success-800">{summary.topTruck.plate}</p>
                <p className="text-sm text-success-600">{formatCurrency(summary.topTruck.profit)}</p>
              </div>
            </div>
          </div>
          {summary.mostExpensiveTruck && (
            <div className="bg-danger-50 rounded-xl p-4 border border-danger-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-danger-600 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-danger-700 font-medium">Caminhao com mais gastos</p>
                  <p className="text-lg font-bold text-danger-800">{summary.mostExpensiveTruck.plate}</p>
                  <p className="text-sm text-danger-600">{formatCurrency(summary.mostExpensiveTruck.expenses)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Trips */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Viagens Recentes</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/trips')}>
            Ver todas
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="divide-y divide-gray-100">
          {recentTrips.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Nenhuma viagem cadastrada
            </div>
          ) : (
            recentTrips.map((trip) => (
              <div
                key={trip.id}
                className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/trips/${trip.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="font-medium text-gray-900 leading-snug min-w-0">
                      {trip.origin_city}/{trip.origin_state} → {trip.destination_city}/{trip.destination_state}
                    </p>
                    <StatusBadge status={trip.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    {trip.truck?.plate} • {trip.driver?.name}
                  </p>
                </div>
                <div className="sm:text-right flex sm:block items-end justify-between gap-3">
                  <p className="font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(trip.freight_value)}</p>
                  <p className="text-sm text-gray-500 whitespace-nowrap">{new Date(trip.start_date).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DriverDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActiveTrip = async () => {
      try {
        const trips = await getTrips({ status: 'in_progress' });
        const driverTrips = trips.filter((t: Trip) => t.driver?.user_id === profile?.id);
        if (driverTrips.length > 0) {
          setActiveTrip(driverTrips[0]);
        }
      } catch (error) {
        console.error('Error loading active trip:', error);
      } finally {
        setLoading(false);
      }
    };
    loadActiveTrip();
  }, [profile?.id]);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-32 bg-gray-200 rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ola, {profile?.name}</h1>
          <p className="text-gray-500">Bom trabalho</p>
        </div>
      </div>

      {activeTrip ? (
        <div className="bg-primary-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <p className="text-primary-100 font-medium">Viagem em andamento</p>
            <StatusBadge status="in_progress" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            {activeTrip.origin_city} → {activeTrip.destination_city}
          </h2>
          <p className="text-primary-100 mb-4">
            {activeTrip.truck?.plate} • Iniciou em {new Date(activeTrip.start_date).toLocaleDateString('pt-BR')}
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(`/trips/${activeTrip.id}/expense`)}
            >
              Adicionar Gasto
            </Button>
            <Button
              className="bg-white text-primary-600 hover:bg-primary-50"
              onClick={() => navigate(`/trips/${activeTrip.id}`)}
            >
              Ver Detalhes
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-xl p-8 text-center">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">Nenhuma viagem em andamento</p>
          <Button onClick={() => navigate('/trips/new')}>
            Iniciar Nova Viagem
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/fuel')}
          className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <Fuel className="w-6 h-6 text-primary-600" />
          </div>
          <span className="font-medium text-gray-900">Abastecer</span>
        </button>
        <button
          onClick={() => navigate('/trips')}
          className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center">
            <Truck className="w-6 h-6 text-success-600" />
          </div>
          <span className="font-medium text-gray-900">Minhas Viagens</span>
        </button>
      </div>
    </div>
  );
}
