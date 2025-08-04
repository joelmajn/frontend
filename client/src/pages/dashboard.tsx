import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, CreditCard, University, User, Calendar } from "lucide-react";
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

  // Pegar compras recentes (últimas 5)
  const recentPurchases = useMemo(() => {
    return allPurchases
      .sort((a, b) => new Date(b.createdAt || b.purchaseDate).getTime() - new Date(a.createdAt || a.purchaseDate).getTime())
      .slice(0, 5);
  }, [allPurchases]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      alimentacao: "bg-gray-100 text-gray-600",
      eletronicos: "bg-blue-100 text-blue-600",
      combustivel: "bg-green-100 text-green-600",
      vestuario: "bg-purple-100 text-purple-600",
      saude: "bg-red-100 text-red-600",
      outros: "bg-orange-100 text-orange-600",
    };
    return colors[category] || "bg-gray-100 text-gray-600";
  };

  const getCardColor = (index: number) => {
    const colors = ["border-primary", "border-orange-500", "border-green-500"];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-medium">Minhas Finanças</h1>
            <NavigationMenu />
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Current Month Summary */}
        <section className="mb-8">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <h2 className="text-2xl font-medium text-secondary mb-4">
                Resumo do Mês Atual
              </h2>
              <div className="text-center mb-6">
                <p className="text-sm text-gray-600 capitalize">{currentMonthName}</p>
                <p className="text-3xl font-bold text-[#927cff]">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(totalCurrentMonth)}
                </p>
                <p className="text-sm text-gray-600">Total das Faturas</p>
              </div>



              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthlyInvoicesCalculated.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg mb-2">Nenhuma fatura para este mês</p>
                    <p className="text-sm">Adicione uma compra para começar a acompanhar suas faturas.</p>
                  </div>
                ) : (
                  monthlyInvoicesCalculated.map((invoice, index) => (
                    <Card
                      key={invoice.id}
                      className={`border-l-4 ${getCardColor(index)} bg-gray-50`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-secondary">
                            {invoice.card.bankName}
                          </h3>
                          <div className={`w-8 h-8 ${getCardColor(index).replace('border-', 'bg-')} rounded-full flex items-center justify-center`}>
                            <University className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <p className="text-xl font-bold text-secondary">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(invoice.totalValue)}
                        </p>
                        <p className="text-xs text-gray-600 mb-2">
                          Vencimento: {invoice.card.dueDay}/
                          {format(new Date(), "MM/yyyy")}
                        </p>
                        <p className="text-xs text-blue-600">
                          {invoice.purchases?.length || 0} compra(s) este mês
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Invoice History Button */}
        <section className="mb-6">
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-center">
                <Link href="/invoice-history">
                  <Button className="w-full max-w-md bg-secondary hover:bg-gray-700 text-white">
                    <Calendar className="h-4 w-4 mr-2" />
                    Ver todos os meses
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Recent Purchases */}
        <section className="mb-8">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-medium text-secondary">
                  Compras Recentes
                </h2>
                <Link href="/purchases">
                  <Button variant="ghost" className="text-primary hover:text-blue-700">
                    Ver Todas
                  </Button>
                </Link>
              </div>

              <div className="space-y-3">
                {recentPurchases.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg mb-2">Nenhuma compra registrada</p>
                    <p className="text-sm">Adicione sua primeira compra para começar.</p>
                  </div>
                ) : (
                  recentPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="border-b border-gray-200 pb-3 last:border-b-0"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-secondary">
                              {purchase.name}
                            </h3>
                            <Badge className={getCategoryColor(purchase.category)}>
                              {purchase.category.charAt(0).toUpperCase() + 
                               purchase.category.slice(1)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>
                              {format(new Date(purchase.purchaseDate), "dd/MM/yyyy")}
                            </span>
                            <span>{purchase.card.bankName}</span>
                            <span>
                              {purchase.currentInstallment}/{purchase.totalInstallments} parcelas
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-secondary">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(parseFloat(purchase.totalValue))}
                          </p>
                          <p className="text-xs text-gray-600">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(parseFloat(purchase.installmentValue))}/mês
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Actions */}
        <section className="grid md:grid-cols-2 gap-4 mb-8">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-full flex items-center justify-center mr-4">
                  <CreditCard className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-medium text-secondary">Registrar Compra</h3>
                  <p className="text-sm text-gray-600">
                    Adicionar nova compra ao cartão
                  </p>
                </div>
              </div>
              <Button
                className="w-full bg-primary hover:bg-blue-700"
                onClick={() => setIsPurchaseModalOpen(true)}
              >
                Nova Compra
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-500 bg-opacity-10 rounded-full flex items-center justify-center mr-4">
                  <Plus className="text-green-500 h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-medium text-secondary">Cadastrar Cartão</h3>
                  <p className="text-sm text-gray-600">
                    Adicionar novo cartão de crédito
                  </p>
                </div>
              </div>
              <Button
                className="w-full bg-green-500 hover:bg-green-700"
                onClick={() => setIsCardModalOpen(true)}
              >
                Novo Cartão
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
      
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="lg"
          className="w-14 h-14 rounded-full bg-primary hover:bg-blue-700 shadow-lg"
          onClick={() => setIsPurchaseModalOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
      
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