import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, User, Mail, Lock } from 'lucide-react';
import { AuthManager } from '@/lib/auth';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [isSetup, setIsSetup] = useState(!AuthManager.getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    pin: '',
    confirmPin: ''
  });

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.pin !== formData.confirmPin) {
      setError('PINs não coincidem');
      return;
    }

    if (formData.pin.length !== 4) {
      setError('PIN deve ter 4 dígitos');
      return;
    }

    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Nome e email são obrigatórios');
      return;
    }

    setIsLoading(true);
    try {
      await AuthManager.setupPIN(formData.name, formData.email, formData.pin);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await AuthManager.verifyPIN(formData.pin);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const user = AuthManager.getCurrentUser();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">FinTrack</h1>
            <p className="text-gray-600 mt-2">
              {isSetup ? 'Configure sua segurança' : 'Digite seu PIN para continuar'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {isSetup ? (
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Nome
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Lock className="w-4 h-4 inline mr-1" />
                  PIN de 4 dígitos
                </label>
                <Input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={formData.pin}
                  onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
                  placeholder="••••"
                  className="text-center text-2xl tracking-widest"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar PIN
                </label>
                <Input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={formData.confirmPin}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPin: e.target.value.replace(/\D/g, '') }))}
                  placeholder="••••"
                  className="text-center text-2xl tracking-widest"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? 'Configurando...' : 'Configurar Segurança'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Olá, <strong>{user?.name}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Digite seu PIN de 4 dígitos
                </label>
                <Input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={formData.pin}
                  onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
                  placeholder="••••"
                  className="text-center text-3xl tracking-widest font-bold"
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading || formData.pin.length !== 4}
              >
                {isLoading ? 'Verificando...' : 'Entrar'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-500"
                onClick={() => {
                  if (confirm('Isso irá apagar todos os dados. Continuar?')) {
                    AuthManager.logout();
                    setIsSetup(true);
                    setFormData({ name: '', email: '', pin: '', confirmPin: '' });
                  }
                }}
              >
                Resetar Aplicativo
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Seus dados são armazenados localmente no seu dispositivo
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}