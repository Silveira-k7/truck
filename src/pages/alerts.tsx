import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Check, Wrench, Truck } from 'lucide-react';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';
import Button from '../components/ui/button';
import { getAlerts, markAlertRead, resolveAlert } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { Alert } from '../lib/types';

export default function AlertsPage() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, [profile?.id]);

  const loadAlerts = async () => {
    if (!profile) return;
    try {
      const data = await getAlerts(profile.id);
      setAlerts(data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (alert: Alert) => {
    if (!profile) return;
    await resolveAlert(alert.id, profile.id);
    loadAlerts();
  };

  const handleMarkRead = async (alertId: string) => {
    await markAlertRead(alertId);
    loadAlerts();
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'maintenance':
        return Wrench;
      case 'trip':
        return Truck;
      default:
        return AlertTriangle;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="text-gray-500">Notificacoes importantes</p>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum alerta pendente</p>
          <p className="text-sm text-gray-400 mt-2">Voce sera notificado sobre manutencoes, viagens e problemas importantes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const Icon = getAlertIcon(alert.alert_type);
            return (
              <Card
                key={alert.id}
                className={alert.is_read ? 'opacity-75' : ''}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    alert.priority === 'high' ? 'bg-danger-100' :
                    alert.priority === 'medium' ? 'bg-warning-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      alert.priority === 'high' ? 'text-danger-600' :
                      alert.priority === 'medium' ? 'text-warning-600' : 'text-gray-600'
                    }`} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                      <Badge variant={getPriorityColor(alert.priority) as 'danger' | 'warning' | 'gray'}>
                        {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Media' : 'Baixa'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(alert.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(alert.id)}
                    >
                      Marcar como lido
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleResolve(alert)}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Resolver
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
