import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { AlertCircle } from 'lucide-react';
import Button from '../components/ui/button';
import Input from '../components/ui/input';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError('Erro ao processar requisicao');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen bg-gradient-to-br from-primary-600 to-primary-800 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[430px]">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="text-center px-6 pt-5 pb-4 sm:px-8 sm:pt-8 sm:pb-6">
            <div
              role="img"
              aria-label="Tik Log Transportes"
              className="mx-auto h-16 sm:h-24 w-full max-w-[280px] sm:max-w-[300px] bg-center bg-no-repeat"
              style={{
                backgroundImage: "url('/logo%20tiklog.png')",
                backgroundSize: 'clamp(220px, 64vw, 260px) clamp(220px, 64vw, 260px)',
              }}
            />
          </div>

          <div className="border-t border-gray-100 px-5 py-5 sm:px-8 sm:py-8">
            {error && (
              <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                Entrar
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-primary-100 text-sm mt-5 sm:mt-6">
          Sistema de controle operacional
        </p>
      </div>
    </div>
  );
}
