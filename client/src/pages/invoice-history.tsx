import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  Calendar, 
  University, 
  CreditCard, 
  DollarSign,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import NavigationMenu from "@/components/navigation-menu";
import type { Card as CardType, Purchase } from "@shared/schema";

interface MonthData {
  month: string;
  monthName: string;
  totalValue: number;
  purchases: (Purchase & { card: CardType })[];
}

export default function InvoiceHistoryPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: allPurchases = [], isLoading } = useQuery<(Purchase & { card: CardType })[]>({
    queryKey: ["/api/purchases"],
  });

  // Get all available years from purchases
  const availableYears = Array.from(
    new Set(
      allPurchases.map(purchase => 
        parseInt(purchase.invoiceMonth.split('-')[0])
      )
    )
  ).sort((a, b) => b - a);

  // Ensure current year is always available
  if (!availableYears.includes(new Date().getFullYear())) {
    availableYears.push(new Date().getFullYear());
    availableYears.sort((a, b) => b - a);
  }

  // Generate all months for the selected year
  const monthsData: MonthData[] = [];
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(selectedYear, i, 1);
    const monthKey = format(monthDate, "yyyy-MM");
    const monthName = format(monthDate, "MMMM yyyy", { locale: ptBR });
    
    // Get purchases for this month, handling installments correctly
    const monthPurchases = allPurchases.filter(purchase => {
      // Calculate all months this purchase affects (parcelas)
      const invoiceMonths = [];
      for (let installment = 0; installment < purchase.totalInstallments; installment++) {
        const baseInvoiceDate = parse(purchase.invoiceMonth, 'yyyy-MM', new Date());
        const installmentInvoiceDate = addMonths(baseInvoiceDate, installment);
        const installmentMonth = format(installmentInvoiceDate, 'yyyy-MM');
        invoiceMonths.push(installmentMonth);
      }
      
      return invoiceMonths.includes(monthKey);
    });

    // Sum do valor das parcelas para o mês
    const totalValue = monthPurchases.reduce((sum, purchase) => {
      return sum + parseFloat(purchase.installmentValue);
    }, 0);

    monthsData.push({
      month: monthKey,
      monthName,
      totalValue,
      purchases: monthPurchases
    });
  }

  // Mostrar meses mais recentes primeiro
  monthsData.reverse();

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

  const categoryLabels: Record<string, string> = {
    alimentacao: "Alimentação",
    eletronicos: "Eletrônicos",
    combustivel: "Combustível",
    vestuario: "Vestuário",
    saude: "Saúde",
    outros: "Outros",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white hover:bg-opacity-20">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <h1 className="text-xl font-medium">Histórico de Faturas</h1>
            </div>
            <NavigationMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-medium text-secondary">
                Histórico de Faturas
              </h2>
              
              {/* Navegação entre anos */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedYear(prev => prev - 1)}
                  disabled={!availableYears.includes(selectedYear - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedYear(prev => prev + 1)}
                  disabled={!availableYears.includes(selectedYear + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Carregando histórico...
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {monthsData.map((monthData) => (
                  <Card 
                    key={monthData.month} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      monthData.totalValue > 0 
                        ? 'border-primary hover:border-primary-dark' 
                        : 'border-gray-200 opacity-60'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-secondary capitalize">
                            {monthData.monthName}
                          </h3>
                        </div>
                        {monthData.totalValue > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {monthData.purchases.length} compras
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-center mb-4">
                        <div className={`text-2xl font-bold ${
                          monthData.totalValue > 0 ? 'text-primary' : 'text-gray-400'
                        }`}>
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(monthData.totalValue)}
                        </div>
                        <div className="text-xs text-gray-500">Total do mês</div>
                      </div>

                      {monthData.totalValue > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-gray-600 flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Compras do mês:
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {monthData.purchases.map((purchase) => (
                              <div key={purchase.id} className="text-xs p-2 bg-gray-50 rounded">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{purchase.name}</div>
                                    <div className="flex items-center gap-1 text-gray-500">
                                      <span className="truncate">{purchase.card.bankName}</span>
                                      <span>•</span>
                                      <span>{purchase.currentInstallment}/{purchase.totalInstallments}x</span>
                                    </div>
                                    <Badge 
                                      className={`${getCategoryColor(purchase.category)} text-xs h-4`}
                                      variant="secondary"
                                    >
                                      {categoryLabels[purchase.category] || purchase.category}
                                    </Badge>
                                  </div>
                                  <div className="text-right ml-2">
                                    <div className="font-bold text-primary">
                                      {new Intl.NumberFormat("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                      }).format(parseFloat(purchase.installmentValue))}
                                    </div>
                                    <div className="text-gray-500 text-xs">
                                      {format(new Date(purchase.purchaseDate), "dd/MM")}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
