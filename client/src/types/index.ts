// Client-side types (no database dependencies)
export interface Budget {
  id: string;
  monthlyIncome: string;
  previousMonthRollover?: string; // Amount rolled over from previous month
  month: string; // Format: "2024-12"
  createdAt: Date | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean | null;
  createdAt: Date | null;
}

export interface BudgetAllocation {
  id: string;
  budgetId: string;
  categoryId: string;
  allocatedAmount: string;
  createdAt: Date | null;
}

export interface Expense {
  id: string;
  amount: string;
  description: string | null;
  categoryId: string;
  budgetId: string;
  date: Date;
  archived?: boolean; // Flag for soft-deleted expenses
  createdAt: Date | null;
}

export interface CategoryWithAllocation extends Category {
  allocated: number;
  spent: number;
  remaining: number;
  transactionCount: number;
}

export interface BudgetSummary {
  monthlyBudget: number;
  totalAllocated: number;
  totalSpent: number;
  remainingBudget: number;
  unallocatedAmount: number; // Amount not allocated to any category
  daysLeft: number;
  categoryCount: number;
}

// Insert types for forms
export interface InsertBudget {
  monthlyIncome: string;
  month: string;
}

export interface InsertCategory {
  name: string;
  icon: string;
  color: string;
  isDefault?: boolean;
}

export interface InsertBudgetAllocation {
  budgetId: string;
  categoryId: string;
  allocatedAmount: string;
}

export interface InsertExpense {
  amount: string;
  description?: string;
  categoryId: string;
  budgetId: string;
  date: Date;
}

export interface RecurringExpense {
  id: string;
  amount: string;
  description: string;
  categoryId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  lastProcessed: Date | null;
  active: boolean;
  createdAt: Date;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: Date | null;
  icon: string;
  color: string;
  createdAt: Date;
}

export interface AppSettings {
  currency: string;
  theme: 'light' | 'dark' | 'system';
}
