import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreVertical, CreditCard, ShoppingCart, History, Home, RotateCcw, Shield, LogOut, User } from "lucide-react";
import { AuthManager } from "@/lib/auth";

export default function NavigationMenu() {
  const user = AuthManager.getCurrentUser();

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair? Você precisará inserir o PIN novamente.')) {
      AuthManager.logout();
      window.location.reload();
    }
  };

  const handleResetApp = () => {
    if (confirm('⚠️ ATENÇÃO: Isso irá apagar TODOS os dados do aplicativo (cartões, compras, assinaturas). Esta ação é IRREVERSÍVEL. Continuar?')) {
      if (confirm('Última confirmação: Tem ABSOLUTA certeza? Todos os dados serão perdidos permanentemente.')) {
        // Limpar todos os dados
        localStorage.clear();
        window.location.reload();
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white hover:bg-opacity-20">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Informações do usuário */}
        <div className="px-3 py-2 text-sm border-b">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="font-medium">{user?.name}</span>
          </div>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>

        {/* Navegação principal */}
        <DropdownMenuItem asChild>
          <Link href="/" className="flex items-center gap-2 w-full">
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/cards" className="flex items-center gap-2 w-full">
            <CreditCard className="h-4 w-4" />
            Cartões Registrados
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/purchases" className="flex items-center gap-2 w-full">
            <ShoppingCart className="h-4 w-4" />
            Compras Registradas
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/subscriptions" className="flex items-center gap-2 w-full">
            <RotateCcw className="h-4 w-4" />
            Assinaturas Recorrentes
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/invoice-history" className="flex items-center gap-2 w-full">
            <History className="h-4 w-4" />
            Histórico de Faturas
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Opções de segurança */}
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair do App
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleResetApp} className="text-red-600 focus:text-red-600">
          <Shield className="h-4 w-4 mr-2" />
          Resetar Aplicativo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}