# Migração para Xano - Guia Completo

## Arquivos Principais Adaptados

### 1. **queryClient.ts** 
- ✅ Adaptado para usar APIs do Xano
- ✅ Mapeamento automático de endpoints (`/api/cards` → `/card`)  
- ✅ Transformação de dados do Xano para formato da aplicação
- ✅ Filtro de faturas por mês no frontend

### 2. **add-card-modal.tsx**
- ✅ Transformação de dados para formato Xano (`bankName` → `bank_name`)
- ✅ Mantém toda funcionalidade original

### 3. **add-purchase-modal.tsx** 
- ✅ Cálculo correto de fatura baseado na data de fechamento
- ✅ Transformação de dados para Xano (`cardId` → `card_id`)
- ✅ Lógica de parcelas mantida

## Configuração Necessária

### 1. **Substituir Arquivos**
```bash
# Substitua estes arquivos na sua estrutura:
src/lib/queryClient.ts
src/components/add-card-modal.tsx  
src/components/add-purchase-modal.tsx
src/main.tsx
src/App.tsx
src/pages/dashboard.tsx
package.json
vite.config.ts
```

### 2. **Variável de Ambiente**
```bash
# .env.local
VITE_API_BASE_URL=https://x8ki-letl-twmt.n7.xano.io/api:agAjCmuq
```

### 3. **Estrutura de Dados no Xano**

#### Tabela `card`:
```json
{
  "id": "string (auto)",
  "bank_name": "string", 
  "logo_url": "string",
  "closing_day": "number",
  "due_day": "number", 
  "created_at": "datetime (auto)"
}
```

#### Tabela `purchase`:
```json
{
  "id": "string (auto)",
  "card_id": "string (relation to card)",
  "purchase_date": "date",
  "name": "string",
  "category": "string", 
  "total_value": "number",
  "total_installments": "number",
  "current_installment": "number",
  "installment_value": "number",
  "invoice_month": "string (YYYY-MM)",
  "created_at": "datetime (auto)"
}
```

#### Tabela `monthly_invoice`:
```json
{
  "id": "string (auto)",
  "month": "string (YYYY-MM)",
  "card_id": "string (relation to card)", 
  "total_value": "number",
  "created_at": "datetime (auto)"
}
```

## Deploy no Vercel

### 1. **Configuração no Vercel**
- Framework: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`

### 2. **Environment Variables**
```
VITE_API_BASE_URL=https://x8ki-letl-twmt.n7.xano.io/api:agAjCmuq
```

### 3. **vercel.json**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Funcionamento

### ✅ O que funciona automaticamente:
- Listagem de cartões
- Cadastro de cartões  
- Listagem de compras
- Cadastro de compras com cálculo de faturas
- Preview de parcelas em tempo real
- Dashboard com totais do mês
- Navegação entre páginas

### ⚠️ Verificar no Xano:
1. **CORS**: Liberar domínio do Vercel
2. **Relacionamentos**: Configurar relação `card_id` nas tabelas
3. **Filtros**: Verificar se aceita query parameters para filtrar por mês

## Diferenças Principais

| Replit + Google Sheets | Vercel + Xano |
|---|---|
| `/api/cards` | `/card` |
| `bankName` | `bank_name` |  
| `cardId` | `card_id` |
| Filtro no backend | Filtro no frontend |
| Python + Express | Somente frontend |

## Teste Local

```bash
npm install
npm run dev
# App rodará em http://localhost:3000
```

Todos os arquivos adaptados estão prontos para deploy no Vercel com integração completa ao Xano!