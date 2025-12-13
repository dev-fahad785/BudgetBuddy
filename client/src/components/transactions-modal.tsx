import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { storageService } from "@/lib/storage";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { type Expense, type Category } from "@/types";
import { useMemo } from "react";
import ResetTransactionsModal from "./reset-transactions-modal";
import { useSettings } from "@/hooks/use-settings";

interface TransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId?: string;
  categoryId?: string | null;
}

export default function TransactionsModal({ open, onOpenChange, budgetId, categoryId }: TransactionsModalProps) {
  const { data: expenses = [], isLoading } = useExpenses(budgetId);
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => await storageService.getCategories(),
    enabled: !!open,
  });
  const { data: settings } = useSettings();
  const currency = settings?.currency || 'PKR';

  const deleteMutation = useDeleteExpense();

  const currentMonthExpenses = useMemo(() => {
    if (!expenses) return [] as Expense[];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      // sort by timestamp descending so newest transactions appear first
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses]);

  const findCategoryName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  // if `categoryId` prop is passed, only show transactions for that category
  const filteredExpenses = useMemo(() => {
    if (!categoryId) return currentMonthExpenses;
    return currentMonthExpenses.filter((e) => (e.categoryId ?? "__uncat") === categoryId);
  }, [currentMonthExpenses, categoryId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl mx-2 sm:mx-auto max-h-[80vh] sm:max-h-[70vh]">
        <DialogHeader className="pr-10">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {`Transactions - ${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}
              {categoryId ? ` / ${findCategoryName(categoryId)}` : ''}
            </DialogTitle>
            {/* Place reset in a container with right margin so it doesn't collide with the close button */}
            <div className="flex items-center gap-2 mr-6">
              {!categoryId && filteredExpenses.length > 0 && budgetId && (
                <ResetTransactionsModal
                  budgetId={budgetId}
                  transactionCount={filteredExpenses.length}
                />
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-2 overflow-auto max-h-[60vh] sm:max-h-[50vh]">
          {isLoading ? (
            <div className="text-muted-foreground">Loading transactions…</div>
          ) : filteredExpenses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">No transactions for this month.</div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {categoryId ? (
                <div className="px-2 mb-1 text-sm text-muted-foreground">Showing transactions for <span className="font-medium text-foreground">{findCategoryName(categoryId)}</span></div>
              ) : null}

              {filteredExpenses.map((tx) => (
                <div key={tx.id} className="border rounded p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 10h18M7 6h10M5 14h14M9 18h6" /></svg>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{findCategoryName(tx.categoryId)}</div>
                          {tx.description ? (
                            <div className="text-xs text-muted-foreground truncate max-w-[18rem] sm:max-w-none">{tx.description}</div>
                          ) : null}
                          <div className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 sm:mt-0 sm:ml-4 flex items-center space-x-3 justify-end">
                      <div className="font-semibold text-sm text-right">{currency} {Number(tx.amount).toLocaleString()}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          if (!budgetId) return;
                          await deleteMutation.mutateAsync({ expenseId: tx.id, budgetId });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end p-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
