import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { storageService } from "@/lib/storage";
import { type Expense, type CategoryWithAllocation } from "@/types";

export function useExpenses(budgetId: string | undefined, includeArchived: boolean = false) {
  return useQuery<Expense[]>({
    queryKey: ["budget", budgetId, "expenses", includeArchived],
    queryFn: async () => {
      if (!budgetId) throw new Error("Budget ID is required");
      return await storageService.getExpenses(budgetId, includeArchived);
    },
    enabled: !!budgetId,
  });
}

export function useCategoriesWithAllocations(budgetId: string | undefined) {
  return useQuery<CategoryWithAllocation[]>({
    queryKey: ["budget", budgetId, "categories-with-allocations"],
    queryFn: async () => {
      if (!budgetId) throw new Error("Budget ID is required");
      return await storageService.getCategoriesWithAllocations(budgetId);
    },
    enabled: !!budgetId,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      return await storageService.getCategories();
    },
  });
}

export function useCreateExpense() {
  return useMutation({
    mutationFn: async ({ budgetId, expenseData }: {
      budgetId: string;
      expenseData: {
        amount: string;
        description: string;
        categoryId: string;
        date: string;
      }
    }) => {
      return await storageService.createExpense({
        ...expenseData,
        budgetId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budget", variables.budgetId, "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["budget", variables.budgetId, "categories-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["budget", variables.budgetId, "summary"] });
    },
  });
}

export function useDeleteExpense() {
  return useMutation({
    mutationFn: async ({ expenseId, budgetId }: { expenseId: string; budgetId: string }) => {
      await storageService.deleteExpense(expenseId);
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["budget", variables.budgetId, "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["budget", variables.budgetId, "categories-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["budget", variables.budgetId, "summary"] });
    },
  });
}

export function useCreateCategory() {
  return useMutation({
    mutationFn: async (categoryData: { name: string; icon: string; color: string; isDefault?: boolean }) => {
      return await storageService.createCategory(categoryData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
