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

  // Debug: Log form values
  console.log("Form values:", form.watch());

  // Reset form only when modal closes, not when it opens
  useEffect(() => {
    if (!isOpen) {
      // Only reset when modal is closed
      const timer = setTimeout(() => {
        console.log("Resetting form because modal closed");
        form.reset();
        setUseManualMonth(false);
      }, 300); // Small delay to avoid visual glitch
      
      return () => clearTimeout(timer);
    } else {
      console.log("Modal opened, not resetting form");
    }
  }, [isOpen, form]);

  const { data: cards = [] } = useQuery<Card[]>({
    queryKey: ["/api/cards"],
  });

  console.log("Available cards:", cards);

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
      console.log("Criando compra:", data);
      
      const selectedCard = cards.find(card => card.id === data.cardId);
      if (!selectedCard) {
        throw new Error("Cartão não encontrado");
      }

      // Calcular dados da compra
      const totalValue = parseFloat(data.totalValue);
      const installmentValue = totalValue / data.totalInstallments;
      
      // Calcular mês da fatura
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
          // Vai para próximo mês
          const nextMonth = new Date(year, month + 1, 1);
          invoiceMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
        } else {
          // Fica no mês atual
          invoiceMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        }
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

      console.log("Dados da compra preparados:", purchaseData);

      // Transformar para formato do Xano
      const xanoData = transformToXano(purchaseData);
      
      console.log("Dados para Xano:", xanoData);

      const response = await apiRequest("POST", "/api/purchases", xanoData);
      const result = await response.json();
      
      console.log("Resposta do Xano:", result);
      
      return result;
    },
    onSuccess: (data) => {
      console.log("Compra criada com sucesso:", data);
      
      // Invalidar cache das queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      
      toast({
        title: "Sucesso",
        description: "Compra registrada com sucesso!",
      });
      
      // Don't reset here - let the useEffect handle it when modal closes
      onClose();
    },
    onError: (error) => {
      console.error("Erro ao criar compra:", error);
      
      toast({
        title: "Erro",
        description: `Erro ao registrar compra: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("Dados do formulário:", data);
    
    // Validações
    if (!data.cardId) {
      toast({
        title: "Erro",
        description: "Selecione um cartão",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.name.trim()) {
      toast({
        title: "Erro", 
        description: "Nome da compra é obrigatório",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.category) {
      toast({
        title: "Erro",
        description: "Selecione uma categoria",
        variant: "destructive",
      });
      return;
    }
    
    const totalValue = parseFloat(data.totalValue);
    if (isNaN(totalValue) || totalValue <= 0) {
      toast({
        title: "Erro",
        description: "Valor total deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }
    
    if (data.totalInstallments < 1 || data.totalInstallments > 99) {
      toast({
        title: "Erro",
        description: "Número de parcelas deve ser entre 1 e 99",
        variant: "destructive",
      });
      return;
    }
    
    createPurchaseMutation.mutate(data);
  };

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
                  <Select 
                    onValueChange={(value) => { 
                      console.log('Selected cardId:', value); 
                      field.onChange(value); 
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cartão" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.bankName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="useManualMonth" className="text-sm">
                Selecionar mês da fatura manualmente
              </Label>
            </div>

            {/* Manual month selection field */}
            {useManualMonth && (
              <FormField
                control={form.control}
                name="manualInvoiceMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mês da Fatura</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o mês da fatura" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableMonths.map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
              
(Content truncated due to size limit. Use page ranges or line ranges to read remaining content)