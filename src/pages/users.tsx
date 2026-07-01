import { useEffect, useState } from 'react';
import { AlertCircle, Mail, Plus, ShieldCheck, User, UserRound } from 'lucide-react';
import Button from '../components/ui/button';
import Card from '../components/ui/card';
import Badge from '../components/ui/badge';
import Input from '../components/ui/input';
import Modal from '../components/ui/modal';
import Select from '../components/ui/select';
import { createUser, getUsers, type ManagedUser } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      setError('');
      setUsers(await getUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (profile?.role !== 'admin') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h1 className="text-xl font-semibold text-gray-900">Acesso restrito</h1>
        <p className="text-gray-500 mt-1">Apenas administradores podem gerenciar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500">Cadastre administradores e motoristas com acesso ao painel</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuario
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <UserRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum usuario cadastrado</p>
          <Button className="mt-4" onClick={() => setShowModal(true)}>
            Cadastrar Usuario
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map((user) => (
            <Card key={user.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {user.role === 'admin' ? (
                      <ShieldCheck className="w-5 h-5 text-primary-600" />
                    ) : (
                      <User className="w-5 h-5 text-primary-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{user.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500 min-w-0">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={user.role === 'admin' ? 'primary' : 'success'}>
                  {user.role === 'admin' ? 'Admin' : 'Motorista'}
                </Badge>
              </div>
              {(user.phone || user.cpf) && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 space-y-1">
                  {user.phone && <p>Telefone: {user.phone}</p>}
                  {user.cpf && <p>CPF: {user.cpf}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <UserModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        saving={saving}
        onSave={async (data) => {
          setSaving(true);
          try {
            await createUser(data);
            setShowModal(false);
            await loadUsers();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao cadastrar usuario');
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

function UserModal({
  isOpen,
  onClose,
  saving,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  saving: boolean;
  onSave: (data: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'driver';
    phone?: string;
    cpf?: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'driver' as 'admin' | 'driver',
    phone: '',
    cpf: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    setForm({
      name: '',
      email: '',
      password: '',
      role: 'driver',
      phone: '',
      cpf: '',
    });
  }, [isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({
      ...form,
      email: form.email.trim(),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      cpf: form.cpf.trim() || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Usuario" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome completo"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Nome da pessoa"
          required
        />
        <Input
          label="E-mail"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="pessoa@email.com"
          required
        />
        <Input
          label="Senha inicial"
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Minimo 6 caracteres"
          minLength={6}
          required
        />
        <Select
          label="Perfil"
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value as 'admin' | 'driver' })}
          options={[
            { value: 'driver', label: 'Motorista' },
            { value: 'admin', label: 'Administrador' },
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Telefone"
            type="tel"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="(00) 00000-0000"
          />
          <Input
            label="CPF"
            value={form.cpf}
            onChange={(event) => setForm({ ...form, cpf: event.target.value })}
            placeholder="000.000.000-00"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} fullWidth>
            Cadastrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
