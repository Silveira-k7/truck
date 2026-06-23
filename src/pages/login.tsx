import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Truck, AlertCircle } from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'driver'>('driver');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          navigate('/');
        }
      } else {
        const result = await signUp(email, password, name, role);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess('Conta criada com sucesso! Faca login para continuar.');
          setIsLogin(true);
          setPassword('');
        }
      }
    } catch (err) {
      setError('Erro ao processar requisicao');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Truck className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">FrotaControl</h1>
          <p className="text-primary-100 mt-2">Controle inteligente de frota</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isLogin ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isLogin ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Cadastrar
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-success-50 border border-success-200 rounded-lg">
              <p className="text-sm text-success-700">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <Input
                  label="Nome completo"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de conta
                  </label>
                  <div className="flex gap-3">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={role === 'admin'}
                        onChange={() => setRole('admin')}
                        className="sr-only peer"
                      />
                      <div className="py-2.5 border rounded-lg text-center transition-colors peer-checked:bg-primary-50 peer-checked:border-primary-500 hover:bg-gray-50">
                        <span className={`text-sm font-medium ${role === 'admin' ? 'text-primary-700' : 'text-gray-600'}`}>
                          Administrador
                        </span>
                      </div>
                    </label>
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value="driver"
                        checked={role === 'driver'}
                        onChange={() => setRole('driver')}
                        className="sr-only peer"
                      />
                      <div className="py-2.5 border rounded-lg text-center transition-colors peer-checked:bg-primary-50 peer-checked:border-primary-500 hover:bg-gray-50">
                        <span className={`text-sm font-medium ${role === 'driver' ? 'text-primary-700' : 'text-gray-600'}`}>
                          Motorista
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            )}

            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />

            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
              required
              minLength={6}
            />

            <Button type="submit" fullWidth loading={loading} size="lg">
              {isLogin ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </div>

        <p className="text-center text-primary-100 text-sm mt-6">
          Controle de frota familiar
        </p>
      </div>
    </div>
  );
}
