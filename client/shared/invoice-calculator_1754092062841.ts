/**
 * Shared invoice calculation logic used by both frontend and backend
 * to ensure perfect consistency between preview and actual invoice assignment
 */

export function calculateInvoiceMonth(purchaseDate: Date, closingDay: number): string {
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth();
  const closingDate = new Date(year, month, closingDay);
  
  if (purchaseDate >= closingDate) {
    const nextMonthDate = new Date(year, month + 1, 1);
    return `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  } else {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
}

export function calculateInstallmentMonths(
  purchaseDate: Date, 
  closingDay: number, 
  totalInstallments: number
): string[] {
  const firstInvoiceMonth = calculateInvoiceMonth(purchaseDate, closingDay);
  
  const months = [];
  for (let i = 0; i < totalInstallments; i++) {
    const [year, month] = firstInvoiceMonth.split('-').map(Number);
    const installmentDate = new Date(year, month - 1 + i, 1); // month - 1 because Date uses 0-based months
    const invoiceMonth = `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}`;
    months.push(invoiceMonth);
  }
  
  return months;
}

export function formatMonthsForDisplay(invoiceMonths: string[]): string[] {
  return invoiceMonths.map(month => {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  });
}