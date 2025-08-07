export interface User {
  id: string;
  email: string;
  name: string;
  pinCode: string;
}

export class AuthManager {
  private static readonly STORAGE_KEY = 'fintrack_user';
  private static readonly PIN_ATTEMPTS_KEY = 'fintrack_pin_attempts';
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos

  static getCurrentUser(): User | null {
    try {
      const userData = localStorage.getItem(this.STORAGE_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  static setUser(user: User): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    this.clearAttempts();
  }

  static logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.PIN_ATTEMPTS_KEY);
  }

  static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  static async setupPIN(name: string, email: string, pin: string): Promise<boolean> {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new Error('PIN deve ter exatamente 4 dígitos');
    }

    const hashedPin = await this.hashPIN(pin);
    const user: User = {
      id: Date.now().toString(),
      name,
      email,
      pinCode: hashedPin
    };

    this.setUser(user);
    return true;
  }

  static async verifyPIN(pin: string): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) return false;

    // Verificar se está bloqueado
    if (this.isLockedOut()) {
      throw new Error('Muitas tentativas incorretas. Tente novamente em 15 minutos.');
    }

    const hashedPin = await this.hashPIN(pin);
    
    if (hashedPin === user.pinCode) {
      this.clearAttempts();
      return true;
    } else {
      this.recordFailedAttempt();
      const attemptsLeft = this.MAX_ATTEMPTS - this.getAttempts();
      
      if (attemptsLeft <= 0) {
        throw new Error('Conta bloqueada por 15 minutos devido a muitas tentativas incorretas.');
      } else {
        throw new Error(`PIN incorreto. ${attemptsLeft} tentativa(s) restante(s).`);
      }
    }
  }

  static async hashPIN(pin: string): Promise<string> {
    // Hash simples usando Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'fintrack_salt_2025');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private static getAttempts(): number {
    const data = localStorage.getItem(this.PIN_ATTEMPTS_KEY);
    if (!data) return 0;
    
    const { attempts, timestamp } = JSON.parse(data);
    
    // Reset attempts if lockout time passed
    if (Date.now() - timestamp > this.LOCKOUT_TIME) {
      this.clearAttempts();
      return 0;
    }
    
    return attempts;
  }

  private static recordFailedAttempt(): void {
    const attempts = this.getAttempts() + 1;
    localStorage.setItem(this.PIN_ATTEMPTS_KEY, JSON.stringify({
      attempts,
      timestamp: Date.now()
    }));
  }

  private static clearAttempts(): void {
    localStorage.removeItem(this.PIN_ATTEMPTS_KEY);
  }

  private static isLockedOut(): boolean {
    return this.getAttempts() >= this.MAX_ATTEMPTS;
  }
}