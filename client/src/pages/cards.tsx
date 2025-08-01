import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import type { Card as CardType } from "@shared/schema";

export default function Cards() {
  const { data: cards = [], isLoading } = useQuery<CardType[]>({
    queryKey: ["expenses", "/cards"], // plural /cards
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      // endpoint ajustado para /card/:id
      const res = await apiRequest("DELETE", `/card/${cardId}`);
      return res; // apiRequest já retorna JSON
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", "/cards"] });
      queryClient.invalidateQueries({ queryKey: ["expenses", "/purchases"] });
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
