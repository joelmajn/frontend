import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, transformToXano } from "@/lib/queryClient";
import { insertPurchaseSchema, type InsertPurchase, type Card } from "@shared/schema";
import { calculateInstallmentMonths, formatMonthsForDisplay } from "@shared/invoice-calculator";
import { z } from "zod";
import { Settings, Calendar } from "lucide-react";
import CategoryManager from "@/components/category-manager";

const formSchema = insertPurchaseSchema.extend({
  purchaseDate: z.string().min(1, "Data é obrigatória"),
  totalValue: z.string().min(1, "Valor é obrigatório"),
});

type FormData = z.infer<typeof formSchema>;

interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddPurchaseModal({ isOpen, onClose }: AddPurchaseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [useManualMonth, setUseManualMonth] = useState(false);
  const [customCategories, setCustomCategories] = useState([
    { value: "alimentacao", label: "Alimentação" },
    { value: "eletronicos", label: "Eletrônicos" },
    { value: "combustivel", label: "Combustível" },
    { value: "vestuario", label: "Vestuário" },
    { value: "saude", label: "Saúde" },
    { value: "outros", label: "Outros" },
  ]);

  // Generate available months for manual selection
  const availableMonths = useMemo(() => {
    const months = [];
    const currentDate = new Date();

    // Generate months from current month to next 24 months
    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      months.push({
        value: monthKey,
        label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
      });
    }

    return months;
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cardId: "",
      purchaseDate: "",
      name: "",
      category: "",
      totalValue: "",
      totalInstallments: 1,
      currentInstallment: 1,
      manualInvoiceMonth: "",
    },
  });

  const { data: cards = [], isLoading: cardsLoading, error: cardsError } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
  });

  // Debug logs
  console.log("=== DEBUG XANO INTEGRATION ===");
  console.log("Cards loading:", cardsLoading);
  console.log("Cards error:", cardsError);
  console.log("Cards data (raw):", cards);
  console.log("Form cardId value:", form.watch("cardId"));
  console.log("Selected card object:", cards.find(card => card.id === form.watch("cardId")));

  // Real-time calculation of invoice months
  const invoiceMonthsPreview = useMemo(() => {
    const cardId = form.watch("cardId");
    const purchaseDate = form.watch("purchaseDate");
    const totalInstallments = form.watch("totalInstallments");
    const manualInvoiceMonth = form.watch("manualInvoiceMonth");

    if (!cardId || !totalInstallments) {
      return null;
    }

    const selectedCard = cards.find(card => card.id === cardId);
    if (!selectedCard) {
      return null;
    }

    let installmentMonths: string[];
    let displayMonths: string[];
    let isNextMonth = false;

    if (useManualMonth && manualInvoiceMonth) {
      // Use manual selection
      installmentMonths = [];
      const [year, month] = manualInvoiceMonth.split('-').map(Number);
      for (let i = 0; i < totalInstallments; i++) {
        const date = new Date(year, month - 1 + i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        installmentMonths.push(monthKey);
      }
      displayMonths = formatMonthsForDisplay(installmentMonths);
    } else if (purchaseDate) {
      // Use automatic calculation based on card closing date
      const purchaseDateObj = new Date(purchaseDate);
      installmentMonths = calculateInstallmentMonths(purchaseDateObj, selectedCard.closingDay, totalInstallments);
      displayMonths = formatMonthsForDisplay(installmentMonths);

      // Check if purchase goes to next month
      const closingDate = new Date(purchaseDateObj.getFullYear(), purchaseDateObj.getMonth(), selectedCard.closingDay);
      isNextMonth = purchaseDateObj >= closingDate;
    } else {
      return null;
    }

    return {
      firstMonth: displayMonths[0],
      allMonths: displayMonths,
      isNextMonth,
      isManual: useManualMonth && manualInvoiceMonth
    };
  }, [form.watch("cardId"), form.watch("purchaseDate"), form.watch("totalInstallments"), form.watch("manualInvoiceMonth"), cards, useManualMonth]);

  const createPurchaseMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log("=== INICIANDO CRIAÇÃO DA COMPRA ===");
      console.log("1. Dados do formulário recebidos:", data);

      const selectedCard = cards.find(card => card.id === data.cardId);
      console.log("2. Cartão selecionado encontrado:", selectedCard);
      
      if (!selectedCard) {
        console.error("❌ ERRO: Cartão não encontrado");
        console.log("Available cards:", cards.map(c => ({ id: c.id, name: c.bankName })));
        console.log("Looking for cardId:", data.cardId);
        throw new Error("Cartão não encontrado. Verifique se o cartão ainda está disponível.");
      }

      // Calcular dados da compra
      const totalValue = parseFloat(data.totalValue);
      const installmentValue = totalValue / data.totalInstallments;

      console.log("3. Valores calculados:", {
        totalValue,
        installmentValue,
        totalInstallments: data.totalInstallments
      });

      // Calcular mês da fatura
      let invoiceMonth: string;
      if (useManualMonth && data.manualInvoiceMonth) {
        invoiceMonth = data.manualInvoiceMonth;
        console.log("4. Usando mês manual:", invoiceMonth);
      } else {
        const purchaseDate = new Date(data.purchaseDate);
        const closingDay = selectedCard.closingDay;
        const year = purchaseDate.getFullYear();
        const month = purchaseDate.getMonth();
        const day = purchaseDate.getDate();

        if (day >= closingDay) {
          // Vai para próximo mês
          const nextMonth = new Date(year, month + 1, 1);
          invoiceMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
        } else {
          // Fica no mês atual
          invoiceMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        }
        console.log("4. Mês da fatura calculado automaticamente:", invoiceMonth);
      }

      // Preparar dados para envio
      const purchaseData = {
        cardId: data.cardId,
        purchaseDate: data.purchaseDate,
        name: data.name,
        category: data.category,
        totalValue: totalValue.toString(),
        totalInstallments: data.totalInstallments,
        currentInstallment: 1,
        installmentValue: installmentValue.toString(),
        invoiceMonth: invoiceMonth,
      };

      console.log("5. Dados da compra preparados:", purchaseData);

      // Transformar para formato do Xano
      const xanoData = transformToXano(purchaseData);
      console.log("6. Dados transformados para Xano:", xanoData);

      try {
        console.log("7. Enviando requisição para o Xano...");
        const response = await apiRequest("POST", "/api/purchases", xanoData);
        const result = await response.json();

        console.log("8. ✅ Resposta do Xano:", result);
        return result;
      } catch (error) {
        console.error("8. ❌ Erro na requisição para o Xano:", error);
        
        // Adicionar informações de debug do erro
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("✅ Compra criada com sucesso:", data);

      // Invalidar cache das queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });

      toast({
        title: "Sucesso",
        description: "Compra registrada com sucesso!",
      });

      form.reset();
      setUseManualMonth(false);
      onClose();
    },
    onError: (error) => {
      console.error("❌ Erro ao criar compra:", error);

      let errorMessage = "Erro desconhecido ao registrar compra";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Adicionar informações específicas para diferentes tipos de erro
        if (errorMessage.includes("404")) {
          errorMessage = "Cartão não encontrado no servidor. Verifique se o cartão ainda existe.";
        } else if (errorMessage.includes("400")) {
          errorMessage = "Dados inválidos enviados para o servidor.";
        } else if (errorMessage.includes("500")) {
          errorMessage = "Erro interno do servidor. Tente novamente em alguns minutos.";
        }
      }

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("=== VALIDAÇÃO DO FORMULÁRIO ===");
    console.log("Dados do formulário:", data);

    // Validações
    if (!data.cardId) {
      console.error("❌ Validação falhou: cardId vazio");
      toast({
        title: "Erro",
        description: "Selecione um cartão",
        variant: "destructive",
      });
      return;
    }

    if (!data.name.trim()) {
      console.error("❌ Validação falhou: nome vazio");
      toast({
        title: "Erro",
        description: "Nome da compra é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!data.category) {
      console.error("❌ Validação falhou: categoria vazia");
      toast({
        title: "Erro",
        description: "Selecione uma categoria",
        variant: "destructive",
      });
      return;
    }

    const totalValue = parseFloat(data.totalValue);
    if (isNaN(totalValue) || totalValue <= 0) {
      console.error("❌ Validação falhou: valor inválido", data.totalValue);
      toast({
        title: "Erro",
        description: "Valor total deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    if (data.totalInstallments < 1 || data.totalInstallments > 99) {
      console.error("❌ Validação falhou: parcelas inválidas", data.totalInstallments);
      toast({
        title: "Erro",
        description: "Número de parcelas deve ser entre 1 e 99",
        variant: "destructive",
      });
      return;
    }

    console.log("✅ Todas as validações passaram, enviando para mutation");
    createPurchaseMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nova Compra</DialogTitle>
        </DialogHeader>

        {/* Debug Information */}
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs">
          <div><strong>Debug Xano:</strong></div>
          <div>Cards loading: {cardsLoading ? "Sim" : "Não"}</div>
          <div>Cards count: {cards?.length || 0}</div>
          <div>Selected cardId: {form.watch("cardId") || "Nenhum"}</div>
          {cardsError && <div className="text-red-600">Error: {String(cardsError)}</div>}
          {cards?.length > 0 && (
            <div>
              <div>Cards disponíveis:</div>
              {cards.map(card => (
                <div key={card.id} className="ml-2 text-xs">
                  - ID: {card.id} | Nome: {card.bankName} | Tipo: {typeof card.id}
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 text-blue-600">
            Selected card: {JSON.stringify(cards.find(card => card.id === form.watch("cardId")), null, 2)}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cartão</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onChange={(e) => {
                        console.log("Card selection changed:", e.target.value);
                        console.log("Available cards:", cards);
                        field.onChange(e.target.value);
                      }}
                    >
                      <option value="">Selecione o cartão</option>
                      {cardsLoading ? (
                        <option value="" disabled>Carregando cartões...</option>
                      ) : cards.length === 0 ? (
                        <option value="" disabled>Nenhum cartão encontrado</option>
                      ) : (
                        cards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.bankName}
                          </option>
                        ))
                      )}
                    </select>
                  </FormControl>
                  <FormMessage />
                  {/* Visual feedback for selected card */}
                  {field.value && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        ✓ Cartão selecionado: {cards.find(c => c.id === field.value)?.bankName}
                      </p>
                      <p className="text-xs text-green-600">
                        ID: {field.value}
                      </p>
                    </div>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da Compra</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Compra</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Compra no supermercado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Categoria</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCategoryManagerOpen(true)}
                      className="h-6 px-2 text-xs"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Gerenciar
                    </Button>
                  </div>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">Selecione a categoria</option>
                      {customCategories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="totalValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Total</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="totalInstallments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Parcelas</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Manual invoice month selection toggle */}
            <div className="flex items-center space-x-2 py-2">
              <input
                type="checkbox"
                id="useManualMonth"
                checked={useManualMonth}
                onChange={(e) => setUseManualMonth(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="useManualMonth" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Selecionar mês da fatura manualmente
              </label>
            </div>

            {/* Manual month selection field */}
            {useManualMonth && (
              <FormField
                control={form.control}
                name="manualInvoiceMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mês da Fatura</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="">Selecione o mês da fatura</option>
                        {availableMonths.map((month) => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Real-time invoice months preview */}
            {invoiceMonthsPreview && (
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Previsão das Parcelas
                  </span>
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  {invoiceMonthsPreview.isManual 
                    ? "Mês da fatura selecionado manualmente" 
                    : invoiceMonthsPreview.isNextMonth 
                      ? "Compra após o fechamento - vai para a próxima fatura"
                      : "Compra antes do fechamento - entra na fatura atual"
                  }
                </div>
                <div className="flex flex-wrap gap-1">
                  {invoiceMonthsPreview.allMonths.map((month, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className={`text-xs ${
                        invoiceMonthsPreview.isManual 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}
                    >
                      {index + 1}ª: {month}
                    </Badge>
                  ))}
                </div>
                {invoiceMonthsPreview.allMonths.length > 1 && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Total: {invoiceMonthsPreview.allMonths.length} parcelas distribuídas
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={createPurchaseMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-blue-700"
                disabled={createPurchaseMutation.isPending}
              >
                {createPurchaseMutation.isPending ? "Salvando..." : "Salvar Compra"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      <CategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={customCategories}
        onCategoriesChange={setCustomCategories}
      />
    </Dialog>
  );
}