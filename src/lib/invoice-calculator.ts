export function calculateInvoiceMonth(purchaseDate: Date, closingDay: number): string {
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth(); // Mês da compra (0-11)
  const day = purchaseDate.getDate();

  let invoiceYear = year;
  let invoiceMonth = month; // Mês da fatura (0-11)

  // Cria uma data para o dia de fechamento da fatura no mês da compra
  const currentMonthClosingDate = new Date(year, month, closingDay);

  // Se o dia da compra for menor que o dia de fechamento, a compra pertence à fatura do mês atual.
  // Ex: Compra em 03/07, fechamento dia 14. 03 < 14, então é fatura de Julho.
  // Se o dia da compra for maior ou igual ao dia de fechamento, a compra pertence à fatura do próximo mês.
  // Ex: Compra em 15/07, fechamento dia 14. 15 >= 14, então é fatura de Agosto.
  // Exceção: Se o dia da compra for igual ao dia de fechamento, a compra vai para o próximo mês.
  if (day >= closingDay) {
    // A compra será contabilizada para o próximo mês de fatura
    invoiceMonth++;
    if (invoiceMonth > 11) { // Se virar o ano
      invoiceMonth = 0;
      invoiceYear++;
    }
  }
  // Se o dia da compra for menor que o dia de fechamento, o mês da fatura já é o mês da compra
  // (a menos que a compra seja do mês anterior e a fatura feche no mês atual, o que é tratado abaixo)

  // Ajuste para o cenário onde a fatura fecha no mês atual, mas engloba compras do mês anterior
  // Ex: Fechamento dia 14. Compra em 03/07. Fatura de Julho (que engloba 15/06 a 14/07).
  // A lógica acima já trata isso, mas é bom ter certeza.
  // Se a compra foi feita no mês anterior, mas depois do dia de fechamento do mês anterior,
  // ela ainda pertence à fatura do mês atual.

  // Formata o mês para ter dois dígitos (ex: 01 para Janeiro)
  const formattedMonth = String(invoiceMonth + 1).padStart(2, '0');

  return `${invoiceYear}-${formattedMonth}`;
}