import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Base URL do Xano
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://x8ki-letl-twmt.n7.xano.io/api:agAjCmuq";

// Função para requisições genéricas à API
export async function apiRequest(
  method: string,
  endpoint: string,
  data?: unknown
): Promise<Response> {
  // Mapear endpoints da aplicação para endpoints do Xano
  let xanoEndpoint = endpoint;
  
  if (endpoint === "/api/cards") {
    xanoEndpoint = "/card";
  } else if (endpoint.startsWith("/api/cards/")) {
    const cardId = endpoint.replace("/api/cards/", "");
    xanoEndpoint = `/card/${cardId}`;
  } else if (endpoint === "/api/purchases") {
    xanoEndpoint = "/purchase";
  } else if (endpoint.startsWith("/api/purchases/")) {
    const purchaseId = endpoint.replace("/api/purchases/", "");
    xanoEndpoint = `/purchase/${purchaseId}`;
  } else if (endpoint === "/api/subscriptions") {
    xanoEndpoint = "/subscription";
  } else if (endpoint.startsWith("/api/subscriptions/")) {
    const subscriptionId = endpoint.replace("/api/subscriptions/", "");
    xanoEndpoint = `/subscription/${subscriptionId}`;
  } else if (endpoint.startsWith("/api/invoices")) {
    xanoEndpoint = "/monthly_invoice";
  }

  console.log(`API Request: ${method} ${xanoEndpoint}`, data);

  const res = await fetch(`${BASE_URL}${xanoEndpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

// Função para transformar dados do Xano para o formato da aplicação
function transformFromXano(item: any): any {
  if (!item) return item;
  
  const transformed = { ...item };
  
  // Transformar cartão do Xano para formato da aplicação
  if (item.bank_name !== undefined) {
    transformed.bankName = item.bank_name;
    transformed.logoUrl = item.logo_url || "";
    transformed.closingDay = item.closing_day;
    transformed.dueDay = item.due_day;
    transformed.createdAt = item.created_at;
    
    // Limpar propriedades do Xano
    delete transformed.bank_name;
    delete transformed.logo_url;
    delete transformed.closing_day;
    delete transformed.due_day;
    delete transformed.created_at;
  }
  
  // CORREÇÃO: Transformar compra do Xano para formato da aplicação
  if (item.card_id !== undefined) {
    transformed.cardId = item.card_id;
    transformed.purchaseDate = item.purchase_date;
    transformed.totalValue = item.total_value?.toString() || "0";
    transformed.totalInstallments = item.total_installments;
    transformed.currentInstallment = item.current_installment;
    transformed.installmentValue = item.installment_value?.toString() || "0";
    transformed.invoiceMonth = item.invoice_month;
    transformed.subscriptionId = item.subscription_id; // ✅ Novo campo
    transformed.createdAt = item.created_at;
    
    // CORREÇÃO CRÍTICA: Verificar se o relacionamento 'card' existe
    if (item.card && typeof item.card === 'object') {
      // Se o relacionamento existe, transformar
      transformed.card = transformFromXano(item.card);
      console.log("✅ Relacionamento 'card' encontrado e transformado:", transformed.card);
    } else {
      // FALLBACK: Se não há relacionamento, buscar o cartão nos dados em cache
      console.warn("⚠️ Relacionamento 'card' não encontrado para compra:", item);
      
      // Tentar encontrar o cartão no cache do React Query
      const cardsCache = queryClient.getQueryData(['/api/cards']) as any[];
      if (cardsCache && Array.isArray(cardsCache)) {
        const relatedCard = cardsCache.find(card => 
          String(card.id) === String(item.card_id)
        );
        
        if (relatedCard) {
          transformed.card = relatedCard;
          console.