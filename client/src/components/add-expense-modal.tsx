import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Currency symbol replaced inline with 'PKR'
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateExpense } from "@/hooks/use-expenses";
import { useQuery } from "@tanstack/react-query";
import { useCategoriesWithAllocations } from "@/hooks/use-expenses";
import { useToast } from "@/hooks/use-toast";
import { storageService } from "@/lib/storage";
import { type Category } from "@/types";
import { useSettings } from "@/hooks/use-settings";

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
}

export default function AddExpenseModal({ open, onOpenChange, budgetId }: AddExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { data: settings } = useSettings();
  const currency = settings?.currency || 'PKR';

  const { toast } = useToast();
  const createExpense = useCreateExpense();

  // Prefer categories that belong to this budget and have allocations
  const { data: categoriesWithAllocations = [] } = useCategoriesWithAllocations(budgetId);

  // Only show categories that have an allocated amount > 0
  const availableCategories = categoriesWithAllocations.filter((c) => (c.allocated ?? 0) > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !categoryId) {
      toast({
        title: "Error",
        description: "Please fill in amount and select a category",
        variant: "destructive",
      });
      return;
    }

    try {
      await createExpense.mutateAsync({
        budgetId,
        expenseData: {
          amount: amount,
          description: description || "",
          categoryId,
          date,
        },
      });

      toast({
        title: "Success",
        description: "Expense added successfully",
      });

      // Reset form
      setAmount("");
      setDescription("");
      setCategoryId("");
      setDate(new Date().toISOString().slice(0, 10));
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add expense",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md slide-up" data-testid="add-expense-modal">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">{`${currency}\u00A0`}</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-12"
                data-testid="input-amount"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              type="text"
              placeholder="What did you spend on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-description"
            />
          </div>

          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="input-date"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createExpense.isPending}
              data-testid="button-add-expense"
            >
              {createExpense.isPending ? "Adding..." : "Add Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
