import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowLeft, Calendar, University, CreditCard, Folder, Edit, Trash2 } from "lucide-react";
import type { Card as CardType, Purchase } from "@shared/schema";

export default function PurchaseHistory() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Usando as keys corretas para integrar com apiRequest
  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["expenses", "/card"],
  });

  const { data: allPurchases = [] } = useQuery<(Purchase & { card: CardType })[]>({
    queryKey: ["expenses", "/purchase"],
  });

  const filteredPurchases = allPurchases.filter((purchase) => {
    if (selectedMonth !== "all" && purchase.invoiceMonth !== selectedMonth) return false;
    if (selectedBank !== "all" && purchase.card.id !== selectedBank) return false;
    if (selectedCategory !== "all" && purchase.category !== selectedCategory) return false;
    return true;
  });

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

  const availableMonths = Array.from(
    new Set(allPurchases.map((p) => p.invoiceMonth))
  ).sort().reverse();

  const availableCategories = Array.from(
    new Set(allPurchases.map((p) => p.category))
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white hover:bg-opacity-20">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <h1 className="text-xl font-medium">Histórico de Compras</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-medium text-secondary">
                Histórico de Compras
              </h2>
            </div>

            {/* Filtros */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {availableMonths.map((month) => {
                    const date = new Date(month + "-01");
                    return (
                      <SelectItem key={month} value={month}>
                        {format(date, "MMMM yyyy", { locale: ptBR })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bancos</SelectItem>
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {categoryLabels[category] || category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lista de compras */}
            <div className="space-y-4">
              {filteredPurchases.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma compra encontrada com os filtros selecionados.
                </div>
              ) : (
                filteredPurchases.map((purchase) => (
                  <Card
                    key={purchase.id}
                    className="border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-secondary">
                              {purchase.name}
                            </h3>
                            <Badge className={getCategoryColor(purchase.category)}>
                              {categoryLabels[purchase.category] || purchase.category}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(purchase.purchaseDate), "dd/MM/yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <University className="h-3 w-3" />
                              {purchase.card.bankName}
                            </span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              {purchase.currentInstallment}/{purchase.totalInstallments} parcelas
                            </span>
                            <span className="flex items-center gap-1">
                              <Folder className="h-3 w-3" />
                              {format(new Date(purchase.invoiceMonth + "-01"), "MMM yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
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
                          <div className="flex gap-2 mt-2">
                            <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700 p-1">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 p-1">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
