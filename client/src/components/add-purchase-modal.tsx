import { useState, useMemo, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, transformToXano } from "@/lib/queryClient";
import { insertPurchaseSchema, type InsertPurchase, type Card } from "@shared/schema";
import { calculateInstallmentMonths, formatMonthsForDisplay } from "@shared/invoice-calculator";
import { z } from "zod";
import { Settings, Calendar, RotateCcw } from "lucide-react";
import CategoryManager from "@/components/category-manager";

const formSchema = insertPurchaseSchema.extend({
  purchaseDate: z.string().min(1, "Data é obrigatória"),
  totalValue: z.string().min(1, "Valor é obrigatório"),
});

type FormData = z.infer<typeof formSchema>;

interface Category {
  value: string;
  label: string;
  isDefault?: boolean;
  isRecurring?: boolean;
}

interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Categorias padrão
const DEFAULT_CATEGORIES: Category[] = [
  { value: "alimentacao", label: "Alimentação", isDefault: true },
  { value: "eletronicos", label: "Eletrônicos", isDefault: true },
  { value: "combustivel", label: "Combustível", isDefault: true },
  { value: "vestuario", label: "Vestuário", isDefault: true },
  { value: "saude", label: "Saúde", isDefault: true },
  { value: "assinatura", label: "Assinatura", isDefault: true, isRecurring: true },
  { value: "outros", label: "Outros", isDefault: true },
];

export default function AddPurchaseModal({ isOpen, onClose }: AddPurchaseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [useManualMonth, setUseManualMonth] = useState(false);
  const [isRecurringPurchase, setIsRecurringPurchase] = useState(false);
  const [customCategories, setCustomCategories] = useState<Category[]>(DEFAULT_CATEGORIES);

  // Carregar categorias do localStorage ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      loadCategoriesFromStorage();
    }
  }, [isOpen]);

  const loadCategoriesFromStorage = () => {
    try {
      const stored = localStorage.getItem("custom_categories");
      
      if (stored) {
        const storedCategories = JSON.parse(stored);
        // Mesclar categorias padrão com customizadas
        const merged = mergeCategories(DEFAULT_CATEGORIES, storedCategories);
        setCustomCategories(merged);
      } else {
        setCustomCategories([...DEFAULT_CATEGORIES]);
      }
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
      setCustomCategories([...DEFAULT_CATEGORIES]);
    }
  };

  const mergeCategories = (defaultCats: Category[], customCats: Category[]): Category[] => {
    const merged = [...defaultCats];
    
    customCats.forEach(customCat => {
      const existingIndex = merged.findIndex(cat => cat.value === customCat.value);
      
      if (existingIndex >= 0) {
        merged[existingIndex] = { ...merged[existingIndex], ...customCat };
      } else {
        merged.push(customCat);
      }
    });
    
    return merged;
  };

  // Generate available months for manual selection
  const availableMonths = useMemo(() => {
    const months = [];
    const currentDate = new Date();

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

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
  });

  const findCardById = (cardId: string | number) => {
    if (!cardId) return null;
    
    const searchId = String(cardId);
    const found = cards.find(card => String(card.id) === searchId) || null;
    return found;
  };

  // Detectar se a categoria selecionada é recorrente
  const selectedCategory = form.watch("category");
  const selectedCategoryData = customCategories.find(cat => cat.value === selectedCategory);

  // Automatically set recurring if category is recurring
  useEffect(() => {
    if (selectedCategoryData?.isRecurring) {
      setIsRecurringPurchase(true);
    }
  }, [selectedCategoryData]);

  const invoiceMonthsPreview = useMemo(() => {
    const cardId = form.watch("cardId");
    const purchaseDate = form.watch("purchaseDate");
    const totalInstallments = form.watch("totalInstallments");
    const manualInvoiceMonth = form.watch("manualInvoiceMonth");

    if (!cardId || !totalInstallments) {
      return null;
    }

    const selectedCard = findCardById(cardId);
    if (!selectedCard) {
      return null;
    }

    let installmentMonths: string[];
    let displayMonths: string[];
    let isNextMonth = false;

    if (useManualMonth && manualInvoiceMonth) {
      installmentMonths = [];
      const [year, month] = manualInvoiceMonth.split('-').map(Number);
      for (let i = 0; i < totalInstallments; i++) {
        const date = new Date(year, month - 1 + i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        installmentMonths.push(monthKey);
      }
      displayMonths = formatMonthsForDisplay(installmentMonths);
    } else if (purchaseDate) {
      const purchaseDateObj = new Date(purchaseDate);
      installmentMonths = calculateInstallmentMonths(purchaseDateObj, selectedCard.closingDay, totalInstallments);
      displayMonths = formatMonthsForDisplay(installmentMonths);

      const closingDate = new Date(purchaseDateObj.getFullYear(), purchaseDateObj.getMonth(), selectedCard.closingDay);
      isNextMonth = purchaseDateObj >= closingDate;
    } else {
      return null;
    }

    return {
      firstMonth: displayMonths[0],
      allMonths: displayMonths,
      isNextMonth,
      isManual: useManualMonth && manualInvoiceMonth,
      isRecurring: isRecurringPurchase || selectedCategoryData?.isRecurring
    };
  }, [form.watch("cardId"), form.watch("purchaseDate"), form.watch("totalInstallments"), form.watch("manualInvoiceMonth"), cards, useManualMonth, isRecurringPurchase, selectedCategoryData]);

  const createPurchaseMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const selectedCard = findCardById(data.cardId);
      if (!selectedCard) {
        throw new Error("Cartão não encontrado");
      }

      const totalValue = parseFloat(data.totalValue);
      if (isNaN(totalValue) || totalValue <= 0) {
        throw new Error("Valor inválido");
      }

      const installmentValue = totalValue / data.totalInstallments;

      let invoiceMonth: string;
      if (useManualMonth && data.manualInvoiceMonth) {
        invoiceMonth = data.manualInvoiceMonth;
      } else {
        const purchaseDate = new Date(data.purchaseDate);
        const closingDay = selectedCard.closingDay;
        const year = purchaseDate.getFullYear();
        const month = purchaseDate.getMonth();
        const day = purchaseDate.getDate();

        if (day >= closingDay) {
          const nextMonth = new Date(year, month + 1, 1);
          invoiceMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
        } else {
          invoiceMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        }
      }

      const purchaseData = {
        cardId: selectedCard.id,
        purchaseDate: data.purchaseDate,
        name: data.name,
        category: data.category,
        totalValue: totalValue.toString(),
        totalInstallments: data.totalInstallments,
        currentInstallment: 1,
        installmentValue: installmentValue.toString(),
        invoiceMonth: invoiceMonth,
      };

      const xanoData = transformToXano(purchaseData);

      // Se for compra recorrente, adicionar metadata
      if (isRecurringPurchase || selectedCategoryData?.isRecurring) {
        xanoData.is_recurring = true;
      }

      try {
        const response = await apiRequest("POST", "/api/purchases", xanoData);
        const result = await response.json();
        return result;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/cards"] });

      toast({
        title: "Sucesso",
        description: isRecurringPurchase || selectedCategoryData?.isRecurring 
          ? "Compra recorrente registrada com sucesso!"
          : "Compra registrada com sucesso!",
      });

      form.reset();
      setUseManualMonth(false);
      setIsRecurringPurchase(false);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Erro ao registrar compra: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    // Validações
    if (!data.cardId) {
      toast({ title: "Erro", description: "Selecione um cartão", variant: "destructive" });
      return;
    }

    if (!data.name.trim()) {
      toast({ title: "Erro", description: "Nome da compra é obrigatório", variant: "destructive" });
      return;
    }

    if (!data.category) {
      toast({ title: "Erro", description: "Selecione uma categoria", variant: "destructive" });
      return;
    }

    const totalValue = parseFloat(data.totalValue);
    if (isNaN(totalValue) || totalValue <= 0) {
      toast({ title: "Erro", description: "Valor total deve ser maior que zero", variant: "destructive" });
      return;
    }

    if (data.totalInstallments < 1 || data.totalInstallments > 99) {
      toast({ title: "Erro", description: "Número de parcelas deve ser entre 1 e 99", variant: "destructive" });
      return;
    }

    const selectedCard = findCardById(data.cardId);
    if (!selectedCard) {
      toast({ title: "Erro", description: "Cartão selecionado não foi encontrado", variant: "destructive" });
      return;
    }

    try {
      await createPurchaseMutation.mutateAsync(data);
    } catch (error) {
      console.error("Erro no mutateAsync:", error);
    }
  };

  const selectedCard = findCardById(form.watch("cardId"));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nova Compra</DialogTitle>
        </DialogHeader>

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
                    >
                      <option value="">Selecione o cartão</option>
                      {cards.map((card) => (
                        <option key={card.id} value={String(card.id)}>
                          {card.bankName}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                  {selectedCard && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-800">
                        ✓ Cartão selecionado: {selectedCard.bankName}
                      </p>
                      <p className="text-xs text-green-600">
                        Fechamento dia {selectedCard.closingDay}
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
                          {category.label}{category.isRecurring ? " 🔄" : ""}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                  
                  {/* Aviso sobre categoria recorrente */}
                  {selectedCategoryData?.isRecurring && (
                    <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded">
                      <p className="text-sm text-purple-800">
                        🔄 Esta categoria é recorrente - aparecerá automaticamente todos os meses
                      </p>
                    </div>
                  )}
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

            {/* Opção de compra recorrente */}
            {!selectedCategoryData?.isRecurring && (
              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="isRecurring"
                  checked={isRecurringPurchase}
                  onCheckedChange={setIsRecurringPurchase}
                />
                <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Compra recorrente (repetir mensalmente)
                </label>
              </div>
            )}

            {/* Manual invoice month selection toggle */}
            <div className="flex items-center space-x-2 py-2">
              <Checkbox
                id="useManualMonth"
                checked={useManualMonth}
                onCheckedChange={setUseManualMonth}
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
              <div className={`p-3 rounded-lg border ${
                invoiceMonthsPreview.isRecurring 
                  ? 'bg-purple-50 border-purple-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className={`h-4 w-4 ${
                    invoiceMonthsPreview.isRecurring ? 'text-purple-600' : 'text-blue-600'
                  }`} />
                  <span className={`text-sm font-medium ${
                    invoiceMonthsPreview.isRecurring ? 'text-purple-900' : 'text-blue-900'
                  }`}>
                    {invoiceMonthsPreview.isRecurring ? "Compra Recorrente" : "Previsão das Parcelas"}
                  </span>
                </div>
                
                <div className={`text-xs mb-2 ${
                  invoiceMonthsPreview.isRecurring ? 'text-purple-700' : 'text-blue-700'
                }`}>
                  {invoiceMonthsPreview.isRecurring 
                    ? "Esta compra se repetirá automaticamente todos os meses"
                    : invoiceMonthsPreview.isManual 
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
                        invoiceMonthsPreview.isRecurring
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          : invoiceMonthsPreview.isManual 
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}
                    >
                      {invoiceMonthsPreview.isRecurring ? "🔄" : `${index + 1}ª:`} {month}
                    </Badge>
                  ))}
                </div>
                
                {!invoiceMonthsPreview.isRecurring && invoiceMonthsPreview.allMonths.length > 1 && (
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
        onClose={() => {
          setIsCategoryManagerOpen(false);
          loadCategoriesFromStorage(); // Recarregar categorias após fechar o manager
        }}
        categories={customCategories}
        onCategoriesChange={setCustomCategories}
      />
    </Dialog>
  );
}