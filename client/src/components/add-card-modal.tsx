import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, transformToXano } from "@/lib/queryClient";
import { insertCardSchema, type InsertCard } from "@shared/schema";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddCardModal({ isOpen, onClose }: AddCardModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertCard>({
    resolver: zodResolver(insertCardSchema),
    defaultValues: {
      bankName: "",
      logoUrl: "",
      closingDay: 0,
      dueDay: 0,
    },
  });

  const createCardMutation = useMutation({
    mutationFn: async (data: InsertCard) => {
      console.log("Criando cartão:", data);
      
      // Transformar dados para formato do Xano
      const xanoData = transformToXano(data);
      
      console.log("Dados para Xano:", xanoData);
      
      const response = await apiRequest("POST", "/api/cards", xanoData);
      const result = await response.json();
      
      console.log("Resposta do Xano:", result);
      
      return result;
    },
    onSuccess: (data) => {
      console.log("Cartão criado com sucesso:", data);
      
      // Invalidar cache das queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      
      toast({
        title: "Sucesso",
        description: "Cartão cadastrado com sucesso!",
      });
      
      form.reset();
      onClose();
    },
    onError: (error) => {
      console.error("Erro ao criar cartão:", error);
      
      toast({
        title: "Erro",
        description: `Erro ao cadastrar cartão: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCard) => {
    console.log("Dados do formulário:", data);
    
    // Validar dados antes de enviar
    if (!data.bankName.trim()) {
      toast({
        title: "Erro",
        description: "Nome do banco é obrigatório",
        variant: "destructive",
      });
      return;
    }
    
    if (data.closingDay < 1 || data.closingDay > 31) {
      toast({
        title: "Erro", 
        description: "Dia de fechamento deve ser entre 1 e 31",
        variant: "destructive",
      });
      return;
    }
    
    if (data.dueDay < 1 || data.dueDay > 31) {
      toast({
        title: "Erro",
        description: "Dia de vencimento deve ser entre 1 e 31", 
        variant: "destructive",
      });
      return;
    }
    
    createCardMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cartão</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Banco</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Banco do Brasil" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Logo (opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: https://exemplo.com/logo.png" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="closingDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de Fechamento da Fatura</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ex: 14"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de Vencimento da Fatura</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ex: 21"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={createCardMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-green-500 hover:bg-green-700"
                disabled={createCardMutation.isPending}
              >
                {createCardMutation.isPending ? "Salvando..." : "Salvar Cartão"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}