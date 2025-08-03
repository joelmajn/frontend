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
    
    // Manter também as propriedades originais do Xano para compatibilidade
    delete transformed.bank_name;
    delete transformed.logo_url;
    delete transformed.closing_day;
    delete transformed.due_day;
    delete transformed.created_at;
  }
  
  // Transformar compra do Xano para formato da aplicação
  if (item.card_id !== undefined) {
    transformed.cardId = item.card_id;
    transformed.purchaseDate = item.purchase_date;
    transformed.totalValue = item.total_value?.toString() || "0";
    transformed.totalInstallments = item.total_installments;
    transformed.currentInstallment = item.current_installment;
    transformed.installmentValue = item.installment_value?.toString() || "0";
    transformed.invoiceMonth = item.invoice_month;
    transformed.createdAt = item.created_at;
    
    // Transformar relacionamento com cartão se existir
    if (item.card && item.card.bank_name !== undefined) {
      transformed.card = transformFromXano(item.card);
    }
    
    // Limpar propriedades do Xano
    delete transformed.card_id;
    delete transformed.purchase_date;
    delete transformed.total_value;
    delete transformed.total_installments;
    delete transformed.current_installment;
    delete transformed.installment_value;
    delete transformed.invoice_month;
    delete transformed.created_at;
  }
  
  // Transformar fatura mensal do Xano
  if (item.month !== undefined && item.total_value !== undefined) {
    transformed.cardId = item.card_id;
    transformed.totalValue = item.total_value?.toString() || "0";
    transformed.createdAt = item.created_at;
    
    if (item.card && item.card.bank_name !== undefined) {
      transformed.card = transformFromXano(item.card);
    }
  }
  
  return transformed;
}

// Função para transformar dados da aplicação para formato do Xano
export function transformToXano(item: any): any {
  if (!item) return item;
  
  const transformed = { ...item };
  
  // Transformar cartão da aplicação para Xano
  if (item.bankName !== undefined) {
    transformed.bank_name = item.bankName;
    transformed.logo_url = item.logoUrl || "";
    transformed.closing_day = item.closingDay;
    transformed.due_day = item.dueDay;
    
    // Remover propriedades da aplicação
    delete transformed.bankName;
    delete transformed.logoUrl;
    delete transformed.closingDay;
    delete transformed.dueDay;
    delete transformed.createdAt; // Deixar o Xano gerar automaticamente
  }
  
  // Transformar compra da aplicação para Xano
  if (item.cardId !== undefined) {
    transformed.card_id = item.cardId;
    transformed.purchase_date = item.purchaseDate;
    transformed.total_value = parseFloat(item.totalValue) || 0;
    transformed.total_installments = item.totalInstallments;
    transformed.current_installment = item.currentInstallment || 1;
    transformed.installment_value = parseFloat(item.installmentValue) || 0;
    transformed.invoice_month = item.invoiceMonth;
    
    // Remover propriedades da aplicação
    delete transformed.cardId;
    delete transformed.purchaseDate;
    delete transformed.totalValue;
    delete transformed.totalInstallments;
    delete transformed.currentInstallment;
    delete transformed.installmentValue;
    delete transformed.invoiceMonth;
    delete transformed.createdAt; // Deixar o Xano gerar automaticamente
  }
  
  return transformed;
}

// Função padrão para buscas (queries)
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey[0] as string;
    const params = queryKey[1] as Record<string, any> | undefined;
    
    // Mapear endpoints para Xano
    let xanoEndpoint = endpoint;
    let shouldFilterInvoices = false;
    let filterMonth = "";
    
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
    } else if (endpoint.startsWith("/api/invoices/")) {
      const month = endpoint.replace("/api/invoices/", "");
      xanoEndpoint = "/monthly_invoice";
      shouldFilterInvoices = true;
      filterMonth = month;
    } else if (endpoint === "/api/invoices") {
      xanoEndpoint = "/monthly_invoice";
    }

    console.log(`Query: ${xanoEndpoint}`, params);

    const res = await fetch(`${BASE_URL}${xanoEndpoint}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    let data = await res.json();
    
    console.log("Raw data from Xano:", data);
    
    // Filtrar faturas por mês se necessário
    if (shouldFilterInvoices && filterMonth) {
      data = data.filter((invoice: any) => invoice.month === filterMonth);
    }
    
    // Transformar dados do Xano para formato da aplicação
    if (Array.isArray(data)) {
      data = data.map(transformFromXano);
    } else {
      data = transformFromXano(data);
    }
    
    console.log("Transformed data:", data);
    
    return data;
  };

// Configuração padrão do React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});