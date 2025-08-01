import { z } from "zod";

// Type definitions for Google Sheets storage
export interface Card {
  id: string;
  bankName: string;
  logoUrl: string;
  closingDay: number;
  dueDay: number;
  createdAt: string;
}

export interface Purchase {
  id: string;
  cardId: string;
  purchaseDate: string;
  name: string;
  category: string;
  totalValue: string;
  totalInstallments: number;
  currentInstallment: number;
  installmentValue: string;
  invoiceMonth: string; // Format: YYYY-MM
  createdAt: string;
}

export interface MonthlyInvoice {
  id: string;
  month: string; // Format: YYYY-MM
  cardId: string;
  totalValue: string;
  createdAt: string;
}

// Insert schemas for validation
export const insertCardSchema = z.object({
  bankName: z.string().min(1, "Nome do banco é obrigatório"),
  logoUrl: z.string().optional().default(""),
  closingDay: z.number().min(1).max(31),
  dueDay: z.number().min(1).max(31),
});

export const insertPurchaseSchema = z.object({
  cardId: z.string().min(1, "Cartão é obrigatório"),
  purchaseDate: z.string().min(1, "Data da compra é obrigatória"),
  name: z.string().min(1, "Nome da compra é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  totalValue: z.string().transform((val) => parseFloat(val)),
  totalInstallments: z.number().min(1).max(99),
  currentInstallment: z.number().min(1).default(1),
  manualInvoiceMonth: z.string().optional().describe("Manual invoice month selection (YYYY-MM format)")
});

// Insert types inferred from schemas
export type InsertCard = z.infer<typeof insertCardSchema>;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;

// Categories for purchases
export const PURCHASE_CATEGORIES = [
  "alimentacao",
  "transporte", 
  "saude",
  "lazer",
  "educacao",
  "casa",
  "vestuario",
  "tecnologia",
  "outros"
] as const;

export type PurchaseCategory = typeof PURCHASE_CATEGORIES[number];