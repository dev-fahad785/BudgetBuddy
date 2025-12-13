import { type Budget, type Category, type BudgetAllocation, type Expense, type CategoryWithAllocation, type BudgetSummary, type RecurringExpense, type SavingsGoal, type AppSettings } from "@/types";
import { initDB } from "./db";

class StorageService {
  private readonly BUDGETS_KEY = 'budgettracker_budgets';
  private readonly CATEGORIES_KEY = 'budgettracker_categories';
  private readonly ALLOCATIONS_KEY = 'budgettracker_allocations';
  private readonly INCOMES_KEY = 'budgettracker_incomes';
  private readonly EXPENSES_KEY = 'budgettracker_expenses';

  constructor() {
    this.initializeData();
  }

  private async initializeData() {
    const db = await initDB();
    
    // Check if migration is needed (if localStorage has data but DB doesn't)
    const budgetsInDB = await db.count('budgets');
    if (budgetsInDB === 0) {
      const lsBudgets = localStorage.getItem(this.BUDGETS_KEY);
      if (lsBudgets) {
        console.log("Migrating data from LocalStorage to IndexedDB...");
        await this.migrateFromLocalStorage(db);
      } else {
        await this.initializeDefaults(db);
      }
    }

    // Initialize settings if not present
    const settings = await db.get('settings', 'app_settings');
    if (!settings) {
      await db.put('settings', {
        currency: 'PKR',
        theme: 'system'
      }, 'app_settings');
    }

    // Check for recurring expenses
    await this.processRecurringExpenses();
  }

  private async migrateFromLocalStorage(db: any) {
    try {
      const budgets = JSON.parse(localStorage.getItem(this.BUDGETS_KEY) || '[]');
      const categories = JSON.parse(localStorage.getItem(this.CATEGORIES_KEY) || '[]');
      const allocations = JSON.parse(localStorage.getItem(this.ALLOCATIONS_KEY) || '[]');
      const expenses = JSON.parse(localStorage.getItem(this.EXPENSES_KEY) || '[]');
      const incomes = JSON.parse(localStorage.getItem(this.INCOMES_KEY) || '[]');

      const tx = db.transaction(['budgets', 'categories', 'allocations', 'expenses', 'incomes'], 'readwrite');
      
      for (const b of budgets) await tx.objectStore('budgets').put(b);
      for (const c of categories) await tx.objectStore('categories').put(c);
      for (const a of allocations) await tx.objectStore('allocations').put(a);
      for (const e of expenses) await tx.objectStore('expenses').put({ ...e, date: new Date(e.date) });
      for (const i of incomes) await tx.objectStore('incomes').put(i);
      
      await tx.done;
      console.log("Migration completed successfully.");
      
      // Optional: Clear localStorage after successful migration
      // localStorage.clear(); 
    } catch (error) {
      console.error("Migration failed:", error);
    }
  }

  private async initializeDefaults(db: any) {
    const defaultCategories: Category[] = [
      {
        id: crypto.randomUUID(),
        name: "Groceries",
        icon: "shopping-cart",
        color: "#2ECC71",
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        name: "Transport",
        icon: "car",
        color: "#3498DB",
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        name: "Bills",
        icon: "file-text",
        color: "#E74C3C",
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        name: "Utilities",
        icon: "zap",
        color: "#F39C12",
        isDefault: true,
        createdAt: new Date(),
      },
    ];

    const tx = db.transaction('categories', 'readwrite');
    for (const cat of defaultCategories) {
      await tx.store.put(cat);
    }
    await tx.done;
  }

  // Settings
  async getSettings(): Promise<AppSettings> {
    const db = await initDB();
    return (await db.get('settings', 'app_settings')) || { currency: 'PKR', theme: 'system' };
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const db = await initDB();
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await db.put('settings', updated, 'app_settings');
    return updated;
  }

  // Export/Import
  async exportData(): Promise<string> {
    const db = await initDB();
    const data = {
      budgets: await db.getAll('budgets'),
      categories: await db.getAll('categories'),
      allocations: await db.getAll('allocations'),
      expenses: await db.getAll('expenses'),
      incomes: await db.getAll('incomes'),
      recurring_expenses: await db.getAll('recurring_expenses'),
      savings_goals: await db.getAll('savings_goals'),
      settings: await db.get('settings', 'app_settings'),
      exportDate: new Date().toISOString(),
      version: 1
    };
    return JSON.stringify(data, null, 2);
  }

  async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      const db = await initDB();
      const tx = db.transaction(
        ['budgets', 'categories', 'allocations', 'expenses', 'incomes', 'recurring_expenses', 'savings_goals', 'settings'], 
        'readwrite'
      );

      // Clear existing data
      await tx.objectStore('budgets').clear();
      await tx.objectStore('categories').clear();
      await tx.objectStore('allocations').clear();
      await tx.objectStore('expenses').clear();
      await tx.objectStore('incomes').clear();
      await tx.objectStore('recurring_expenses').clear();
      await tx.objectStore('savings_goals').clear();

      // Import new data
      if (data.budgets) for (const item of data.budgets) await tx.objectStore('budgets').put(item);
      if (data.categories) for (const item of data.categories) await tx.objectStore('categories').put(item);
      if (data.allocations) for (const item of data.allocations) await tx.objectStore('allocations').put(item);
      if (data.expenses) for (const item of data.expenses) await tx.objectStore('expenses').put({ ...item, date: new Date(item.date) });
      if (data.incomes) for (const item of data.incomes) await tx.objectStore('incomes').put(item);
      if (data.recurring_expenses) for (const item of data.recurring_expenses) await tx.objectStore('recurring_expenses').put({ ...item, startDate: new Date(item.startDate), lastProcessed: item.lastProcessed ? new Date(item.lastProcessed) : null });
      if (data.savings_goals) for (const item of data.savings_goals) await tx.objectStore('savings_goals').put(item);
      if (data.settings) await tx.objectStore('settings').put(data.settings, 'app_settings');

      await tx.done;
    } catch (error) {
      console.error("Import failed:", error);
      throw new Error("Invalid data format or import failed");
    }
  }

  // Budget operations
  async getBudget(month: string): Promise<Budget | undefined> {
    const db = await initDB();
    return db.getFromIndex('budgets', 'by-month', month);
  }

  async createBudget(budgetData: { monthlyIncome: string; month: string }): Promise<Budget> {
    const db = await initDB();
    const newBudget: Budget = {
      id: crypto.randomUUID(),
      monthlyIncome: budgetData.monthlyIncome,
      month: budgetData.month,
      createdAt: new Date(),
    };
    
    // Check if exists
    const existing = await db.getFromIndex('budgets', 'by-month', budgetData.month);
    if (existing) {
      await db.delete('budgets', existing.id);
    }
    
    await db.put('budgets', newBudget);
    return newBudget;
  }

  async updateBudget(id: string, updateData: Partial<{ monthlyIncome: string; month: string }>): Promise<Budget> {
    const db = await initDB();
    const budget = await db.get('budgets', id);
    if (!budget) throw new Error("Budget not found");
    
    const updated = { ...budget, ...updateData };
    await db.put('budgets', updated);
    return updated;
  }

  async getBudgets(): Promise<Budget[]> {
    const db = await initDB();
    return db.getAll('budgets');
  }

  async getRecentBudgets(limit: number = 8): Promise<Budget[]> {
    const db = await initDB();
    const allBudgets = await db.getAll('budgets');
    // Sort by month descending (newest first)
    return allBudgets
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, limit);
  }

  // Calculate previous month's remaining balance and detect overspending
  async calculatePreviousMonthRemaining(month: string): Promise<{ remaining: number; wasOverspent: boolean; rollover: number }> {
    // Get previous month in YYYY-MM format
    const [year, monthNum] = month.split('-').map(Number);
    const prevDate = new Date(year, monthNum - 2, 1); // monthNum is 1-indexed, so -2 gets previous month
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const prevBudget = await this.getBudget(prevMonth);
    if (!prevBudget) {
      return { remaining: 0, wasOverspent: false, rollover: 0 };
    }

    const allocations = await this.getBudgetAllocations(prevBudget.id);
    const expenses = await this.getExpenses(prevBudget.id);
    
    const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    const remaining = totalAllocated - totalSpent;
    const wasOverspent = totalSpent > totalAllocated;
    const rollover = Math.max(0, remaining); // Only positive rollover
    
    return { remaining, wasOverspent, rollover };
  }

  // Get total allocated amount from previous month
  async getPreviousMonthTotalAllocated(month: string): Promise<number> {
    const [year, monthNum] = month.split('-').map(Number);
    const prevDate = new Date(year, monthNum - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const prevBudget = await this.getBudget(prevMonth);
    if (!prevBudget) return 0;

    const allocations = await this.getBudgetAllocations(prevBudget.id);
    return allocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
  }

  // Create budget with automatic rollover calculation
  async createBudgetWithRollover(budgetData: { monthlyIncome: string; month: string; includeRollover?: boolean }): Promise<Budget> {
    const db = await initDB();
    const { rollover } = await this.calculatePreviousMonthRemaining(budgetData.month);
    
    // Only include rollover if user chose to include it (default to true for backward compatibility)
    const shouldIncludeRollover = budgetData.includeRollover !== false;
    
    const newBudget: Budget = {
      id: crypto.randomUUID(),
      monthlyIncome: budgetData.monthlyIncome,
      previousMonthRollover: (rollover > 0 && shouldIncludeRollover) ? String(rollover) : undefined,
      month: budgetData.month,
      createdAt: new Date(),
    };
    
    // Check if exists
    const existing = await db.getFromIndex('budgets', 'by-month', budgetData.month);
    if (existing) {
      await db.delete('budgets', existing.id);
    }
    
    await db.put('budgets', newBudget);
    return newBudget;
  }


  // Category operations
  async getCategories(): Promise<Category[]> {
    const db = await initDB();
    return db.getAll('categories');
  }

  async createCategory(categoryData: { name: string; icon: string; color: string; isDefault?: boolean }): Promise<Category> {
    const db = await initDB();
    
    // Check for duplicate category name (case-insensitive)
    const existingCategories = await db.getAll('categories');
    const duplicate = existingCategories.find(
      cat => cat.name.toLowerCase() === categoryData.name.toLowerCase()
    );
    
    if (duplicate) {
      throw new Error(`A category named "${duplicate.name}" already exists.`);
    }
    
    const newCategory: Category = {
      id: crypto.randomUUID(),
      name: categoryData.name,
      icon: categoryData.icon,
      color: categoryData.color,
      isDefault: categoryData.isDefault ?? false,
      createdAt: new Date(),
    };
    await db.put('categories', newCategory);
    return newCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    const db = await initDB();
    
    // Check if category has allocations
    const allocations = await db.getAll('allocations');
    const categoryAllocations = allocations.filter(a => a.categoryId === id);
    
    // Check if category has expenses
    const expenses = await db.getAll('expenses');
    const categoryExpenses = expenses.filter(e => e.categoryId === id);
    
    if (categoryAllocations.length > 0 || categoryExpenses.length > 0) {
      const category = await db.get('categories', id);
      const categoryName = category?.name || 'This category';
      throw new Error(
        `${categoryName} cannot be deleted because it has ${categoryAllocations.length} budget allocation(s) and ${categoryExpenses.length} transaction(s). Please remove all allocations and transactions first.`
      );
    }
    
    await db.delete('categories', id);
  }

  // Budget allocation operations
  async getBudgetAllocations(budgetId: string): Promise<BudgetAllocation[]> {
    const db = await initDB();
    return db.getAllFromIndex('allocations', 'by-budget', budgetId);
  }

  async createBudgetAllocation(allocationData: { budgetId: string; categoryId: string; allocatedAmount: string }): Promise<BudgetAllocation> {
    const db = await initDB();
    const newAllocation: BudgetAllocation = {
      id: crypto.randomUUID(),
      budgetId: allocationData.budgetId,
      categoryId: allocationData.categoryId,
      allocatedAmount: allocationData.allocatedAmount,
      createdAt: new Date(),
    };
    await db.put('allocations', newAllocation);
    return newAllocation;
  }

  async updateBudgetAllocation(id: string, updateData: Partial<{ allocatedAmount: string }>): Promise<BudgetAllocation> {
    const db = await initDB();
    const allocation = await db.get('allocations', id);
    if (!allocation) throw new Error("Allocation not found");
    
    const updated = { ...allocation, ...updateData };
    await db.put('allocations', updated);
    return updated;
  }

  async deleteBudgetAllocation(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('allocations', id);
  }

  async copyAllocations(fromBudgetId: string, toBudgetId: string): Promise<void> {
    const db = await initDB();
    const fromAllocations = await db.getAllFromIndex('allocations', 'by-budget', fromBudgetId);
    
    const tx = db.transaction('allocations', 'readwrite');
    for (const a of fromAllocations) {
      await tx.store.put({
        id: crypto.randomUUID(),
        budgetId: toBudgetId,
        categoryId: a.categoryId,
        allocatedAmount: a.allocatedAmount,
        createdAt: new Date(),
      });
    }
    await tx.done;
  }

  // Expense operations
  async getAllExpenses(): Promise<Expense[]> {
    const db = await initDB();
    return db.getAll('expenses');
  }

  async getExpenses(budgetId: string, includeArchived: boolean = true): Promise<Expense[]> {
    const db = await initDB();
    const allExpenses = await db.getAllFromIndex('expenses', 'by-budget', budgetId);
    // Only filter archived if explicitly requested
    if (includeArchived) {
      return allExpenses;
    }
    return allExpenses.filter(expense => !expense.archived);
  }

  async createExpense(expenseData: { amount: string; description: string; categoryId: string; budgetId: string; date: string }): Promise<Expense> {
    const db = await initDB();
    const newExpense: Expense = {
      id: crypto.randomUUID(),
      amount: expenseData.amount,
      description: expenseData.description || "",
      categoryId: expenseData.categoryId,
      budgetId: expenseData.budgetId,
      date: new Date(expenseData.date),
      createdAt: new Date(),
    };
    await db.put('expenses', newExpense);
    return newExpense;
  }

  async deleteExpense(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('expenses', id);
  }

  async resetBudgetExpenses(budgetId: string): Promise<void> {
    const db = await initDB();
    const expenses = await db.getAllFromIndex('expenses', 'by-budget', budgetId);
    const tx = db.transaction('expenses', 'readwrite');
    for (const e of expenses) {
      await tx.store.delete(e.id);
    }
    await tx.done;
  }

  // Archive current month expenses (soft delete)
  async archiveCurrentMonthExpenses(budgetId: string): Promise<number> {
    const db = await initDB();
    const expenses = await db.getAllFromIndex('expenses', 'by-budget', budgetId);
    const activeExpenses = expenses.filter(e => !e.archived);
    
    const tx = db.transaction('expenses', 'readwrite');
    for (const expense of activeExpenses) {
      await tx.store.put({ ...expense, archived: true });
    }
    await tx.done;
    
    return activeExpenses.length;
  }

  // Reset monthly budget with optional rollover
  async resetMonthlyBudget(params: {
    budgetId: string;
    newIncome: string;
    includeRollover: boolean;
  }): Promise<Budget> {
    const { budgetId, newIncome, includeRollover } = params;
    const db = await initDB();
    
    // Get current budget
    const currentBudget = await db.get('budgets', budgetId);
    if (!currentBudget) throw new Error("Budget not found");

    // Calculate current remaining balance
    const allocations = await this.getBudgetAllocations(budgetId);
    const expenses = await this.getExpenses(budgetId, false); // Exclude archived expenses
    const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const remaining = totalAllocated - totalSpent;
    const rollover = Math.max(0, remaining);

    // Archive current expenses
    await this.archiveCurrentMonthExpenses(budgetId);

    // Update budget with new income and optional rollover
    const updatedBudget: Budget = {
      ...currentBudget,
      monthlyIncome: newIncome,
      previousMonthRollover: (rollover > 0 && includeRollover) ? String(rollover) : undefined,
    };

    await db.put('budgets', updatedBudget);
    return updatedBudget;
  }

  // Income operations
  async getIncomeRecords(budgetId?: string): Promise<Array<{ id: string; budgetId: string; amount: string; note?: string; date: string; createdAt: Date }>> {
    const db = await initDB();
    if (budgetId) {
      return db.getAllFromIndex('incomes', 'by-budget', budgetId);
    }
    return db.getAll('incomes');
  }

  async createIncomeRecord(record: { budgetId: string; amount: string; note?: string; date?: string }): Promise<any> {
    const db = await initDB();
    const newRecord = {
      id: crypto.randomUUID(),
      budgetId: record.budgetId,
      amount: record.amount,
      note: record.note || "",
      date: record.date ? record.date : new Date().toISOString(),
      createdAt: new Date(),
    };
    await db.put('incomes', newRecord);
    return newRecord;
  }

  // Recurring Expenses
  async getRecurringExpenses(): Promise<RecurringExpense[]> {
    const db = await initDB();
    return db.getAll('recurring_expenses');
  }

  async createRecurringExpense(data: Omit<RecurringExpense, 'id' | 'createdAt' | 'lastProcessed'>): Promise<RecurringExpense> {
    const db = await initDB();
    const newItem: RecurringExpense = {
      ...data,
      id: crypto.randomUUID(),
      lastProcessed: null,
      createdAt: new Date(),
    };
    await db.put('recurring_expenses', newItem);
    return newItem;
  }

  async deleteRecurringExpense(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('recurring_expenses', id);
  }

  async processRecurringExpenses(): Promise<void> {
    const db = await initDB();
    const recurring = await db.getAll('recurring_expenses');
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);
    
    // Get current budget
    const budget = await db.getFromIndex('budgets', 'by-month', currentMonthStr);
    if (!budget) return; // Cannot add expenses if no budget exists

    const tx = db.transaction(['recurring_expenses', 'expenses'], 'readwrite');
    
    for (const item of recurring) {
      if (!item.active) continue;

      let shouldProcess = false;
      const lastProcessed = item.lastProcessed ? new Date(item.lastProcessed) : null;
      const startDate = new Date(item.startDate);

      if (startDate > today) continue;

      if (!lastProcessed) {
        shouldProcess = true;
      } else {
        // Simple check: if last processed was in a previous period
        // For MVP, we'll just check if it hasn't been processed this month for monthly items
        if (item.frequency === 'monthly') {
          const lastMonth = lastProcessed.toISOString().slice(0, 7);
          if (lastMonth < currentMonthStr) shouldProcess = true;
        }
        // Add other frequencies logic here as needed
      }

      if (shouldProcess) {
        // Create expense
        const newExpense: Expense = {
          id: crypto.randomUUID(),
          amount: item.amount,
          description: `Recurring: ${item.description}`,
          categoryId: item.categoryId,
          budgetId: budget.id,
          date: new Date(),
          createdAt: new Date(),
        };
        await tx.objectStore('expenses').put(newExpense);

        // Update recurring item
        const updatedItem = { ...item, lastProcessed: new Date() };
        await tx.objectStore('recurring_expenses').put(updatedItem);
      }
    }
    await tx.done;
  }

  // Savings Goals
  async getSavingsGoals(): Promise<SavingsGoal[]> {
    const db = await initDB();
    return db.getAll('savings_goals');
  }

  async createSavingsGoal(data: Omit<SavingsGoal, 'id' | 'createdAt'>): Promise<SavingsGoal> {
    const db = await initDB();
    const newItem: SavingsGoal = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    await db.put('savings_goals', newItem);
    return newItem;
  }

  async updateSavingsGoal(id: string, data: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const db = await initDB();
    const goal = await db.get('savings_goals', id);
    if (!goal) throw new Error("Goal not found");
    
    const updated = { ...goal, ...data };
    await db.put('savings_goals', updated);
    return updated;
  }

  async deleteSavingsGoal(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('savings_goals', id);
  }

  // Analytics
  async getCategoriesWithAllocations(budgetId: string): Promise<CategoryWithAllocation[]> {
    const categories = await this.getCategories();
    const allocations = await this.getBudgetAllocations(budgetId);
    const expenses = await this.getExpenses(budgetId, false);

    return categories.map(category => {
      const allocation = allocations.find(a => a.categoryId === category.id);
      const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
      
      const allocated = allocation ? Number(allocation.allocatedAmount) : 0;
      const spent = categoryExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const remaining = allocated - spent;
      const transactionCount = categoryExpenses.length;

      return {
        ...category,
        allocated,
        spent,
        remaining,
        transactionCount,
      };
    }).filter(cat => cat.allocated > 0);
  }

  async getBudgetSummary(budgetId: string): Promise<BudgetSummary> {
    const db = await initDB();
    const budget = await db.get('budgets', budgetId);
    
    if (!budget) {
      throw new Error("Budget not found");
    }

    const allocations = await this.getBudgetAllocations(budgetId);
    const expenses = await this.getExpenses(budgetId, false);
    const categoriesWithAllocations = await this.getCategoriesWithAllocations(budgetId);

    const monthlyIncome = Number(budget.monthlyIncome);
    const rollover = Number(budget.previousMonthRollover || 0);
    const totalAvailable = monthlyIncome + rollover;
    
    const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
    const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const remainingBudget = totalAvailable - totalAllocated;
    const unallocatedAmount = Math.max(0, remainingBudget); // Positive unallocated only

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const daysLeft = lastDay - now.getDate();

    return {
      monthlyBudget: totalAvailable, // Total available including rollover
      totalAllocated,
      totalSpent,
      remainingBudget,
      unallocatedAmount,
      daysLeft: Math.max(0, daysLeft),
      categoryCount: categoriesWithAllocations.length,
    };
  }
}

export const storageService = new StorageService();