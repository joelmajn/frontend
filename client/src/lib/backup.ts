import { AuthManager } from './auth';

export class BackupManager {
  static exportData() {
    const data = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      user: AuthManager.getCurrentUser(),
      subscriptions: JSON.parse(localStorage.getItem('fintrack_subscriptions') || '[]'),
      categories: JSON.parse(localStorage.getItem('custom_categories') || '[]'),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fintrack-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async importData(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.version || !data.timestamp) {
        throw new Error('Arquivo de backup inválido');
      }

      // Confirmar importação
      if (!confirm(`Importar backup de ${new Date(data.timestamp).toLocaleString('pt-BR')}? Isso irá sobrescrever todos os dados atuais.`)) {
        return false;
      }

      // Restaurar dados
      if (data.subscriptions) {
        localStorage.setItem('fintrack_subscriptions', JSON.stringify(data.subscriptions));
      }

      if (data.categories) {
        localStorage.setItem('custom_categories', JSON.stringify(data.categories));
      }

      if (data.user) {
        AuthManager.setUser(data.user);
      }

      return true;
    } catch (error) {
      console.error('Erro ao importar backup:', error);
      return false;
    }
  }
}