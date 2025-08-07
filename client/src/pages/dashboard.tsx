import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, CreditCard, University, Calendar, RotateCcw } from "lucide-react";
import AddPurchaseModal from "@/components/add-purchase-modal";
import AddCardModal from "@/components/add-card-modal";
import NavigationMenu from "@/components/navigation-menu";
import type { Card as CardType, Purchase } from "@shared/schema";

export default function Dashboard() {
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  const currentMonth = format(new Date(), "yyyy-MM");
  const currentMonthName = format(new Date(), "MMMM yyyy", { locale: ptBR });

  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: allPurchases = [] } = useQuery<(Purchase & { card: CardType })[]>({
    queryKey: ["/api/purchases"],
  });

  // Calcular totais do mês atual diretamente das compras
  const monthlyInvoicesCalculated = useMemo(() => {
    // Agrupar compras por cartão para o mês atual
    const currentMonthPurchases = allPurchases.filter(purchase => {
      // Calcular todos os meses que esta compra afeta (considerando parcelas)
      const affectedMonths = [];
      const baseInvoiceDate = parse(purchase.invoiceMonth, 'yyyy-MM', new Date());
      
      for (let i = 0; i < purchase.totalInstallments; i++) {
        const installmentDate = addMonths(baseInvoiceDate, i);
        const monthKey = format(installmentDate, 'yyyy-MM');
        affectedMonths.push(monthKey);
      }
      
      return affectedMonths.includes(currentMonth);
    });

    // Agrupar por cartão
    const invoicesByCard = new Map();

    currentMonthPurchases.forEach(purchase => {
      const cardId = purchase.card?.id || purchase.cardId;
      
      if (!invoicesByCard.has(cardId)) {
        // Buscar dados completos do cartão
        let cardData = purchase.card;
        
        // Se não tem dados do cartão na compra, buscar na lista de cartões
        if (!cardData || !cardData.bankName) {
          cardData = cards.find(card => String(card.id) === String(cardId));
        }
        
        // Fallback se ainda não encontrou
        if (!cardData) {
          cardData = {
            id: cardId,
            bankName: `Cartão ${cardId}`,
            logoUrl: "",
            closingDay: 15,
            dueDay: 20,
            createdAt: new Date().toISOString()
          };
        }

        invoicesByCard.set(cardId, {
          id: `calc-${cardId}-${currentMonth}`,
          month: currentMonth,
          cardId: cardId,
          card: cardData,
          totalValue: 0,
          purchases: []
        });
      }

      const invoice = invoicesByCard.get(cardId);
      invoice.totalValue += parseFloat(purchase.installmentValue);
      invoice.purchases.push(purchase);
    });

    return Array.from(invoicesByCard.values());
  }, [allPurchases, currentMonth, cards]);

  // Calcular total geral do mês
  const totalCurrentMonth = monthlyInvoicesCalculated.reduce(
    (sum, invoice) => sum + invoice.totalValue,
    0
  );

  // Pegar comp