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
  { value: "transporte", label: "Transporte", isDefault: true },
  { value: "lazer", label: "Lazer", isDefault: true },
  { value: "educacao", label: "Educação", isDefault: true },
  { value: "casa", label: "Casa e Decoração", isDefault: true },
  { value: "assinatura", label: "Assinatura", isDefault: true, isRecurring: true },
  { value: "outros", label: "Outros", isDefault: true },
];

// Função para corrigir timezone local
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
      purchaseDate: formatDateForInput(new Date()), // ✅ Correção do timezone
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

      form.reset({
        cardId: "",
        purchaseDate: formatDateForInput(new Date()), // ✅ Reset com data correta
        name: "",
        category: "",
        totalValue: "",
        totalInstallments: 1,
        currentInstallment: 1,
        manualInvoiceMonth: "",
      });
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
      toast({ title: