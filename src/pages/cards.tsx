import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, CreditCard, University, Plus, Edit, Trash2 } from "lucide-react";
import AddCardModal from "@/components/add-card-modal";
import NavigationMenu from "@/components/navigation-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Card as CardType } from "@shared/schema";

export default function CardsPage() {
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cards = [], isLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const response = await apiRequest("DELETE", `/api/cards/${cardId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Sucesso",
        description: "Cartão removido com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover cartão. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteCard = (cardId: string, bankName: string) => {
    if (confirm(`Tem certeza que deseja remover o cartão ${bankName}? Todas as compras associadas também serão removidas.`)) {
      deleteCardMutation.mutate(cardId);
    }
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
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white hover:bg-opacity-20">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <h1 className="text-xl font-medium">Cartões Registrados</h1>
            </div>
            <NavigationMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-medium text-secondary">
                Meus Cartões de Crédito
              </h2>
              <Button
                className="bg-green-500 hover:bg-green-700"
                onClick={() => setIsCardModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Cartão
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Carregando cartões...
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg mb-2">Nenhum cartão cadastrado</p>
                <p className="text-sm">Adicione seu primeiro cartão para começar a acompanhar suas finanças.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card, index) => (
                  <Card
                    key={card.id}
                    className={`border-l-4 ${getCardColor(index)} bg-gray-50 hover:shadow-md transition-shadow`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${getCardColor(index).replace('border-', 'bg-')} rounded-full flex items-center justify-center`}>
                            <University className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-medium text-secondary">
                              {card.bankName}
                            </h3>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 p-1">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700 p-1"
                            onClick={() => handleDeleteCard(card.id, card.bankName)}
                            disabled={deleteCardMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Fechamento:</span>
                          <Badge variant="outline">Dia {card.closingDay}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Vencimento:</span>
                          <Badge variant="outline">Dia {card.dueDay}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AddCardModal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
      />
    </div>
  );
}