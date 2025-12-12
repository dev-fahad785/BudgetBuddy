import { useMutation, useQueryClient } from "@tanstack/react-query";
import { storageService } from "@/lib/storage";
import { useToast } from "./use-toast";

export function useResetBudget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      budgetId: string;
      newIncome: string;
      includeRollover: boolean;
    }) => {
      return storageService.resetMonthlyBudget(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["budget-summary"] });
      queryClient.invalidateQueries({ queryKey: ["categories-with-allocations"] });
      
      toast({
        title: "Budget Reset Successfully",
        description: "Your monthly budget has been reset with new income.",
      });
    },
    onError: (error) => {
      console.error("Reset budget error:", error);
      toast({
        title: "Error",
        description: "Failed to reset budget. Please try again.",
        variant: "destructive",
      });
    },
  });
}
