import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  CreditCard,
  RotateCcw
} from "lucide-react";
import NavigationMenu from "@/components/navigation-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, transformToXano } from "@/lib/queryClient";
import type { Card as CardType } from "@shared/schema";

interface Subscription {
  id: string;
  name: string;
  value: number;
  cardId: string;
  startDate: string;
  description?: string;
  status: 'active' | 'cancelled';
  cancelledAt?: string;
  createdAt: string;
  card?: CardType;
}

// Função para corrigir timezone local
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Transformações específicas para assinaturas
const transformSubscriptionFromXano = (item: any): Subscription => {
  return {
    id: item.id,
    name: item.name,
    value: item.value,
    cardId: item.card_id,
    startDate: item.start_date,
    description: item.description,
    status: item.status,
    cancelledAt: item.cancelled_at,
    createdAt: item.created_at,
    card: item.card ? {
      id: item.card.id,
      bankName: item.card.bank_name,
      logoUrl: item.card.logo_url || "",
      closingDay: item.card.closing_day,
      dueDay: item.card.due_day,
      createdAt: item.card.created_at
    } : undefined
  };
};

const transformSubscriptionToXano = (item: any): any => {
  return {
    name: item.name,
    value: item.value,
    card_id: item.cardId,
    start_date: item.startDate,
    description: item.description || "",
    status: item.status || 'active'
  };
};

export default function SubscriptionsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    value: '',
    cardId: '',
    startDate: '',
    description: ''
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar cartões
  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  // Buscar assinaturas do Xano
  const { data: rawSubscriptions = [], isLoading } = useQuery({
    queryKey: ["/api/subscriptions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subscriptions");
      const data = await response.json();
      return Array.isArray(data) ? data.map(transformSubscriptionFromXano) : [];
    }
  });

  const subscriptions = rawSubscriptions as Subscription[];

  // Criar assinatura
  const createSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionData: any) => {
      const xanoData = transformSubscriptionToXano(subscriptionData);
      const response = await apiRequest("POST", "/api/subscriptions", xanoData);
      const newSubscription = await response.json();
      
      // Criar compras recorrentes para o resto do ano
      await createRecurringPurchasesForSubscription(transformSubscriptionFromXano(newSubscription));
      
      return newSubscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({
        title: "Sucesso",
        description: "Assinatura criada e adicionada às faturas!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Erro ao criar assinatura: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Atualizar assinatura
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const xanoData = transformSubscriptionToXano(data);
      const response = await apiRequest("PUT", `/api/subscriptions/${id}`, xanoData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: "Sucesso",
        description: "Assinatura atualizada com sucesso!",
      });
    }
  });

  // Cancelar assinatura
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      // 1. Atualizar status da assinatura
      await apiRequest("PUT", `/api/subscriptions/${subscriptionId}`, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });

      // 2. Remover compras futuras (mes atual em diante)
      await removeFutureRecurringPurchases(subscriptionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({
        title: "Sucesso",
        description: "Assinatura cancelada e removida das faturas futuras!",
      });
    }
  });

  // Função para criar compras recorrentes
  const createRecurringPurchasesForSubscription = async (subscription: Subscription) => {
    const currentYear = new Date().getFullYear();
    const startDate = new Date(subscription.startDate);
    const startMonth = startDate.getMonth();
    const card = cards.find(c => c.id === subscription.cardId);
    
    if (!card) throw new Error('Cartão não encontrado');

    // Criar compras para todos os meses do ano atual (a partir do mês de início)
    for (let month = startMonth; month < 12; month++) {
      const purchaseDate = new Date(currentYear, month, startDate.getDate());
      
      // Calcular mês da fatura baseado na data de fechamento
      const year = purchaseDate.getFullYear();
      const monthIndex = purchaseDate.getMonth();
      const day = purchaseDate.getDate();
      
      let invoiceMonth: string;
      if (day >= card.closingDay) {
        const nextMonth = new Date(year, monthIndex + 1, 1);
        invoiceMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
      } else {
        invoiceMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      }

      const purchaseData = {
        cardId: subscription.cardId,
        purchaseDate: format(purchaseDate, 'yyyy-MM-dd'),
        name: `${subscription.name} (Assinatura)`,
        category: 'assinatura',
        totalValue: subscription.value.toString(),
        totalInstallments: 1,
        currentInstallment: 1,
        installmentValue: subscription.value.toString(),
        invoiceMonth: invoiceMonth,
        subscriptionId: subscription.id, // ✅ Linkar com assinatura
      };

      const xanoData = transformToXano(purchaseData);
      // Adicionar subscription_id no formato Xano
      xanoData.subscription_id = subscription.id;
      
      await apiRequest("POST", "/api/purchases", xanoData);
    }
  };

  // Função para remover compras futuras
  const removeFutureRecurringPurchases = async (subscriptionId: string) => {
    try {
      // Buscar todas as compras desta assinatura
      const response = await apiRequest("GET", "/api/purchases");
      const allPurchases = await response.json();
      
      // Filtrar compras desta assinatura que são do mês atual em diante
      const currentMonth = format(new Date(), 'yyyy-MM');
      const futurePurchases = allPurchases.filter((purchase: any) => 
        purchase.subscription_id === subscriptionId && 
        purchase.invoice_month >= currentMonth
      );

      // Remover cada compra futura
      for (const purchase of futurePurchases) {
        await apiRequest("DELETE", `/api/purchases/${purchase.id}`);
      }
    } catch (error) {
      console.error('Erro ao remover compras futuras:', error);
    }
  };

  const handleAddSubscription = () => {
    setEditingSubscription(null);
    setFormData({
      name: '',
      value: '',
      cardId: '',
      startDate: formatDateForInput(new Date()),
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      name: subscription.name,
      value: subscription.value.toString(),
      cardId: subscription.cardId,
      startDate: subscription.startDate,
      description: subscription.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveSubscription = async () => {
    const subscriptionData = {
      name: formData.name,
      value: parseFloat(formData.value),
      cardId: formData.cardId,
      startDate: formData.startDate,
      description: formData.description,
      status: 'active'
    };

    if (editingSubscription) {
      updateSubscriptionMutation.mutate({
        id: editingSubscription.id,
        data: subscriptionData
      });
    } else {
      createSubscriptionMutation.mutate(subscriptionData);
    }

    setIsModalOpen(false);
    setFormData({ name: '', value: '', cardId: '', startDate: '', description: '' });
  };

  const handleCancelSubscription = (subscriptionId: string, subscriptionName: string) => {
    if (confirm(`Tem certeza que deseja cancelar a assinatura "${subscriptionName}"? Ela será removida das próximas faturas.`)) {
      cancelSubscriptionMutation.mutate(subscriptionId);
    }
  };

  const totalMonthlyValue = subscriptions
    .filter(sub => sub.status === 'active')
    .reduce((total, sub) => total + sub.value, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-purple-600 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white hover:bg-opacity-20">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <h1 className="text-xl font-medium">Gerenciar Assinaturas</h1>
            </div>
            <NavigationMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Resumo Mensal */}
        <Card className="shadow-lg mb-8 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium opacity-90">Total Mensal em Assinaturas</h2>
                <p className="text-3xl font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(totalMonthlyValue)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">
                  {subscriptions.filter(s => s.status === 'active').length} assinatura(s) ativa(s)
                </p>
                <p className="text-xs opacity-75">
                  Valor anual: {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(totalMonthlyValue * 12)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão Nova Assinatura */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-medium text-secondary">Suas Assinaturas</h2>
          <Button
            onClick={handleAddSubscription}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Assinatura
          </Button>
        </div>

        {/* Lista de Assinaturas */}
        {subscriptions.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <RotateCcw className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma assinatura cadastrada</h3>
              <p className="text-gray-600 mb-4">Adicione suas assinaturas recorrentes para controlar melhor seus gastos mensais.</p>
              <Button onClick={handleAddSubscription} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeira Assinatura
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subscriptions.map((subscription) => {
              const card = subscription.card || cards.find(c => c.id === subscription.cardId);
              return (
                <Card key={subscription.id} className={`border-l-4 ${
                  subscription.status === 'active' ? 'border-purple-500' : 'border-gray-400'
                } ${subscription.status === 'cancelled' ? 'opacity-60' : ''} shadow-lg`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900">{subscription.name}</h3>
                        {subscription.description && (
                          <p className="text-sm text-gray-600">{subscription.description}</p>
                        )}
                      </div>
                      <Badge className="bg-purple-100 text-purple-600">
                        🔄 Recorrente
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-purple-600">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(subscription.value)}
                        </span>
                        <span className="text-sm text-gray-500">/mês</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CreditCard className="w-4 h-4" />
                        <span>{card?.bankName || 'Cartão não encontrado'}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Desde {new Date(subscription.startDate).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {subscription.status === 'cancelled' && subscription.cancelledAt && (
                        <div className="text-sm text-red-600">
                          ❌ Cancelada em {new Date(subscription.cancelledAt).toLocaleDateString('pt-BR')}
                        </div>
                      )}

                      {subscription.status === 'active' && (
                        <div className="flex gap-2 pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSubscription(subscription)}
                            className="flex-1"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelSubscription(subscription.id, subscription.name)}
                            className="flex-1 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                            disabled={cancelSubscriptionMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Informações sobre Assinaturas */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-900 mb-3">ℹ️ Como funcionam as Assinaturas Recorrentes</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>• <strong>Sincronização:</strong> Suas assinaturas agora são salvas na nuvem e sincronizam entre todos os seus dispositivos.</p>
              <p>• <strong>Criação Automática:</strong> Ao cadastrar uma assinatura, ela será automaticamente adicionada a todas as faturas do ano atual.</p>
              <p>• <strong>Edição:</strong> Alterações no valor ou descrição afetam apenas novas faturas.</p>
              <p>• <strong>Cancelamento:</strong> Remove a assinatura das faturas futuras, mantendo o histórico.</p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Modal de Cadastro/Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSubscription ? 'Editar Assinatura' : 'Nova Assinatura'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Assinatura
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Netflix, Spotify, Adobe..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor Mensal
              </label>
              <Input
                type="number"
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cartão de Crédito
              </label>
              <select
                value={formData.cardId}
                onChange={(e) => setFormData(prev => ({ ...prev, cardId: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Selecione o cartão</option>
                {cards.map(card => (
                  <option key={card.id} value={card.id}>{card.bankName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Início
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição (opcional)
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição da assinatura"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveSubscription}
                disabled={!formData.name || !formData.value || !formData.cardId || !formData.startDate || createSubscriptionMutation.isPending || updateSubscriptionMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {createSubscriptionMutation.isPending || updateSubscriptionMutation.isPending
                  ? 'Salvando...'
                  : editingSubscription 
                    ? 'Salvar Alterações' 
                    : 'Adicionar Assinatura'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}