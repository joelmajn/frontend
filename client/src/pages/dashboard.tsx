import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, CreditCard, University, Calendar, RotateCcw } from "lucide-react";
import AddPurchaseModal from "@/components/add-purchase-modal";
import AddCardModal from "@/components/add-card-modal";
import NavigationMenu from "@/components/navigation-menu";
import type { Card as CardType, Purchase } from "@shared/schema";

export default function Dashboard() {
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  const currentMonth = format(new Date(), "yyyy-MM");
  const currentMonthName = format(new Date(), "MMMM yyyy", { locale: ptBR });

  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: allPurchases = [] } = useQuery<(Purchase & { card: CardType })[]>({
    queryKey: ["/api/purchases"],
  });

  // Calcular totais do mês atual diretamente das compras
  const monthlyInvoicesCalculated = useMemo(() => {
    // Agrupar compras por cartão para o mês atual
    const currentMonthPurchases = allPurchases.filter(purchase => {
      // Calcular todos os meses que esta compra afeta (considerando parcelas)
      const affectedMonths = [];
      const baseInvoiceDate = parse(purchase.invoiceMonth, 'yyyy-MM', new Date());
      
      for (let i = 0; i < purchase.totalInstallments; i++) {
        const installmentDate = addMonths(baseInvoiceDate, i);
        const monthKey = format(installmentDate, 'yyyy-MM');
        affectedMonths.push(monthKey);
      }
      
      return affectedMonths.includes(currentMonth);
    });

    // Agrupar por cartão
    const invoicesByCard = new Map();

    currentMonthPurchases.forEach(purchase => {
      const cardId = purchase.card?.id || purchase.cardId;
      
      if (!invoicesByCard.has(cardId)) {
        // Buscar dados completos do cartão
        let cardData = purchase.card;
        
        // Se não tem dados do cartão na compra, buscar na lista de cartões
        if (!cardData || !cardData.bankName) {
          cardData = cards.find(card => String(card.id) === String(cardId));
        }
        
        // Fallback se ainda não encontrou
        if (!cardData) {
          cardData = {
            id: cardId,
            bankName: `Cartão ${cardId}`,
            logoUrl: "",
            closingDay: 15,
            dueDay: 20,
            createdAt: new Date().toISOString()
          };
        }

        invoicesByCard.set(cardId, {
          id: `calc-${cardId}-${currentMonth}`,
          month: currentMonth,
          cardId: cardId,
          card: cardData,
          totalValue: 0,
          purchases: []
        });
      }

      const invoice = invoicesByCard.get(cardId);
      invoice.totalValue += parseFloat(purchase.installmentValue);
      invoice.purchases.push(purchase);
    });

    return Array.from(invoicesByCard.values());
  }, [allPurchases, currentMonth, cards]);

  // Calcular total geral do mês
  const totalCurrentMonth = monthlyInvoicesCalculated.reduce(
    (sum, invoice) => sum + invoice.totalValue,
    0
  );

  // Pegar compras mais recentes (últimas 5)
  const recentPurchases = useMemo(() => {
    return allPurchases
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [allPurchases]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-medium">FinTrack</h1>
              <Badge variant="secondary" className="bg-white bg-opacity-20 text-white">
                {currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)}
              </Badge>
            </div>
            <NavigationMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Total Geral do Mês */}
        <Card className="shadow-lg mb-8 bg-gradient-to-r from-primary to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-lg font-medium opacity-90">Total Geral do Mês</h2>
              <p className="text-4xl font-bold mb-2">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalCurrentMonth)}
              </p>
              <p className="text-sm opacity-75">
                {monthlyInvoicesCalculated.length} cartão(s) com gastos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Faturas por Cartão */}
        <div className="grid md:grid-cols-1 gap-6 mb-8">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-medium text-secondary">Faturas do Mês</h2>
                <Link href="/invoice-history">
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Ver Todos os Meses
                  </Button>
                </Link>
              </div>

              {monthlyInvoicesCalculated.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg mb-2">Nenhuma fatura para este mês</p>
                  <p className="text-sm">Adicione compras para começar o controle.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {monthlyInvoicesCalculated.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                          <University className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium text-secondary">
                            {invoice.card.bankName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Vence dia {invoice.card.dueDay}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-secondary">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(invoice.totalValue)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {invoice.purchases.length} compra(s)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Compras Recentes */}
        <div className="grid md:grid-cols-1 gap-6 mb-8">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-medium text-secondary">Compras Recentes</h2>
                <Link href="/purchases">
                  <Button variant="outline" size="sm">
                    Ver Todas
                  </Button>
                </Link>
              </div>

              {recentPurchases.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-gray-400 mb-4">
                    <CreditCard className="h-12 w-12 mx-auto" />
                  </div>
                  <p className="text-lg mb-2">Nenhuma compra registrada</p>
                  <p className="text-sm">Clique em "Nova Compra" para começar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm">{purchase.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {purchase.currentInstallment}/{purchase.totalInstallments}x
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>{purchase.card.bankName}</span>
                          <span>•</span>
                          <span>{format(new Date(purchase.purchaseDate), "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-secondary">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(parseFloat(purchase.installmentValue))}
                        </p>
                        <p className="text-xs text-gray-500">
                          Total: {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(parseFloat(purchase.totalValue))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="grid md:grid-cols-2 gap-4">
          <Button
            size="lg"
            className="h-16 bg-primary hover:bg-blue-700"
            onClick={() => setIsPurchaseModalOpen(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nova Compra
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16"
            onClick={() => setIsCardModalOpen(true)}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Novo Cartão
          </Button>
        </div>

        {/* Links Rápidos */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <Link href="/cards">
            <Button variant="ghost" className="w-full justify-start">
              <CreditCard className="h-4 w-4 mr-2" />
              Cartões Registrados
            </Button>
          </Link>
          <Link href="/subscriptions">
            <Button variant="ghost" className="w-full justify-start">
              <RotateCcw className="h-4 w-4 mr-2" />
              Assinaturas Recorrentes
            </Button>
          </Link>
          <Link href="/invoice-history">
            <Button variant="ghost" className="w-full justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              Histórico de Faturas
            </Button>
          </Link>
        </div>
      </main>

      {/* Botão Flutuante */}
      <div className="fixed bottom-6 right-6">
        <Button
          size="lg"
          className="w-14 h-14 rounded-full bg-primary hover:bg-blue-700 shadow-lg"
          onClick={() => setIsPurchaseModalOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Modais */}
      <AddPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
      />

      <AddCardModal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
      />
    </div>
  );
}