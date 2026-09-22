export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category_id: number | null;
  source_file: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  keywords: string;
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface MonthlyTotal {
  year: number;
  month: number;
  total: number;
}
