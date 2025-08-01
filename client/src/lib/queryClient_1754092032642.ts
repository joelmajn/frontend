import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Base URL das suas APIs do Xano
const BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:agAjCmuq";

// Função para requisições genéricas à API
export async function apiRequest(
  method: string,
  endpoint: string,
  data?: unknown
): Promise<Response> {
  // Mapear endpoints antigos para endpoints do Xano
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
  } else if (endpoint.startsWith("/api/invoices/")) {
    const month = endpoint.replace("/api/invoices/", "");
    // Para Xano, vamos buscar todas as faturas e filtrar por mês no frontend
    xanoEndpoint = `/monthly_invoice`;
  } else if (endpoint === "/api/invoices") {
    xanoEndpoint = "/monthly_invoice";
  }

  const res = await fetch(`${BASE_URL}${xanoEndpoint}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

// Função padrão para buscas (queries)
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey[0] as string;
    
    // Mapear endpoints para Xano
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
    } else if (endpoint.startsWith("/api/invoices/")) {
      xanoEndpoint = "/monthly_invoice";
    } else if (endpoint === "/api/invoices") {
      xanoEndpoint = "/monthly_invoice";
    }

    const res = await fetch(`${BASE_URL}${xanoEndpoint}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    let data = await res.json();
    
    // Filtrar faturas por mês se for endpoint de invoices
    if (endpoint.startsWith("/api/invoices/")) {
      const month = endpoint.replace("/api/invoices/", "");
      data = data.filter((invoice: any) => invoice.month === month);
    }
    
    // Transformar dados do Xano para formato esperado pela aplicação
    if (Array.isArray(data)) {
      data = data.map(transformXanoData);
    } else {
      data = transformXanoData(data);
    }
    
    return data;
  };

// Função para transformar dados do Xano para o formato esperado
function transformXanoData(item: any) {
  if (!item) return item;
  
  // Transformar campos do Xano para formato da aplicação
  const transformed = { ...item };
  
  // Se for um cartão
  if (item.bank_name) {
    transformed.bankName = item.bank_name;
    transformed.logoUrl = item.logo_url || "";
    transformed.closingDay = item.closing_day;
    transformed.dueDay = item.due_day;
    transformed.createdAt = item.created_at;
  }
  
  // Se for uma compra
  if (item.card_id && item.purchase_date) {
    transformed.cardId = item.card_id;
    transformed.purchaseDate = item.purchase_date;
    transformed.totalValue = item.total_value?.toString() || "0";
    transformed.totalInstallments = item.total_installments;
    transformed.currentInstallment = item.current_installment;
    transformed.installmentValue = item.installment_value?.toString() || "0";
    transformed.invoiceMonth = item.invoice_month;
    transformed.createdAt = item.created_at;
  }
  
  // Se for uma fatura mensal
  if (item.month && item.total_value !== undefined) {
    transformed.cardId = item.card_id;
    transformed.totalValue = item.total_value?.toString() || "0";
    transformed.createdAt = item.created_at;
  }
  
  return transformed;
}

// Configuração padrão do React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
