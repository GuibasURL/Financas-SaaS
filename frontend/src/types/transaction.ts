export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category_id: number | null;
  statement_id: number;
  created_at: string;
}

export interface Statement {
  id: number;
  filename: string;
  uploaded_at: string;
  transaction_count: number;
  start_date: string | null;
  end_date: string | null;
}

export interface Category {
  id: number;
  name: string;
  keywords: string;
  // Transações desta categoria não entram nos gráficos (ex: pagamento de fatura)
  ignore_in_reports: boolean;
  // Para que transações a regra vale: entradas e saídas, só entradas ou só saídas
  direction: CategoryDirection;
}

export type CategoryDirection = "all" | "in" | "out";

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface MonthlyTotal {
  year: number;
  month: number;
  total: number;
}
