import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { storageService } from "@/lib/storage";
import { type Budget, type BudgetSummary } from "@/types";

export function useCurrentBudget() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  return useQuery<Budget | null>({
    queryKey: ["budget", currentMonth],
    queryFn: async () => {
      try {
        const budget = await storageService.getBudget(currentMonth);
        // Return null if no budget exists - this will trigger income entry modal
        return budget || null;
      } catch (error) {
        return null;
      }
    },
  });
}

// Backwards-compatible alias used by pages expecting `useBudget`
export function useBudget() {
  return useCurrentBudget();
}

export function useBudgetByMonth(month: string) {
  return useQuery<Budget | undefined>({
    queryKey: ["budget", month],
    queryFn: async () => {
      return await storageService.getBudget(month);
    },
    enabled: !!month,
  });
}

export function useAvailableMonths() {
  return useQuery<Budget[]>({
    queryKey: ["available-months"],
    queryFn: async () => {
      return await storageService.getRecentBudgets(12); // Fetch last 12 months
    },
  });
}

export function useBudgetSummary(budgetId: string | undefined) {
  return useQuery<BudgetSummary>({
    queryKey: ["budget", budgetId, "summary"],
    queryFn: async () => {
      if (!budgetId) throw new Error("Budget ID is required");
      return await storageService.getBudgetSummary(budgetId);
    },
    enabled: !!budgetId,
  });
}

export function useCreateBudget() {
  return useMutation({
    mutationFn: async (budgetData: { monthlyIncome: string; month: string }) => {
      return await storageService.createBudget(budgetData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget"] });
    },
  });
}

export function useUpdateBudget() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ monthlyIncome: string; month: string }> }) => {
      return await storageService.updateBudget(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget"] });
    },
  });
}
