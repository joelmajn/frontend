import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/api"; // Ajuste o caminho conforme seu projeto
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast"; // Ajuste se necessário
import type { Card as CardType } from "@shared/schema";

export default function Cards() {
  // Busca os cartões usando o getQueryFn padrão do queryClient
  const { data: cards = [], isLoading } = useQuery<CardType[]>({
    queryKey: ["expenses", "/card"],
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await apiRequest("DELETE", `/card/${cardId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", "/card"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", "/purchase"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", "/monthly_invoice"] });
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

  if (isLoading) return <div>Carregando cartões...</div>;

  return (
    <div className="space-y-4">
      {cards.length === 0 && <p>Nenhum cartão cadastrado.</p>}

      {cards.map((card) => (
        <Card key={card.id} className="shadow hover:shadow-md transition-shadow">
          <CardContent className="flex justify-between items-center">
            <div>
              <h3 className="font-medium text-secondary">{card.bankName}</h3>
              <p className="text-sm text-gray-600">Vencimento: {card.dueDay}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteCardMutation.mutate(card.id)}
              disabled={deleteCardMutation.isLoading}
            >
              Excluir
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
