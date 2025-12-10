import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUpdateBudget, useBudgetByMonth } from "@/hooks/use-budget";
import { useBudgetSummary } from "@/hooks/use-budget";
import { storageService } from "@/lib/storage";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Category, BudgetAllocation } from "@/types";
import { ShoppingCart, Car, FileText, Zap, Smile, ArrowLeft, Plus, Wallet, TrendingUp, ChevronDown, ChevronUp, BarChart3, Trash2 } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks, parseISO } from "date-fns";
import { useExpenses } from "@/hooks/use-expenses";
import ResetTransactionsModal from "@/components/reset-transactions-modal";
import MonthSelector from "@/components/month-selector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const iconMap = {
  "shopping-cart": ShoppingCart,
  "car": Car,
  "file-text": FileText,
  "zap": Zap,
  "smile": Smile,
};

export default function ManageBudget() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Get budget for selected month
  const { data: budget } = useBudgetByMonth(selectedMonth);
  const budgetId = budget?.id;

  const { data: summary } = useBudgetSummary(budgetId || undefined);
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => await storageService.getCategories(),
  });
  const { data: settings } = useSettings();
  const currency = settings?.currency || 'PKR';

  const { data: allocations = [] } = useQuery<BudgetAllocation[]>({
    queryKey: ["allocations", budgetId],
    enabled: !!budgetId,
    queryFn: async () => (budgetId ? await storageService.getBudgetAllocations(budgetId) : []),
  });

  const [localAlloc, setLocalAlloc] = useState<Record<string, { id?: string; allocatedAmount: string }>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [extraIncome, setExtraIncome] = useState("");
  const [extraIncomeNote, setExtraIncomeNote] = useState("");
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateBudget = useUpdateBudget();

  const { data: expenses = [] } = useExpenses(budgetId || undefined);

  const iconOptions = [
    { value: "shopping-cart", label: "Shopping Cart", icon: ShoppingCart },
    { value: "car", label: "Car", icon: Car },
    { value: "file-text", label: "File", icon: FileText },
    { value: "zap", label: "Lightning", icon: Zap },
    { value: "smile", label: "Smile", icon: Smile },
  ];

  const colorOptions = [
    { value: "#2ECC71", label: "Green" },
    { value: "#3498DB", label: "Blue" },
    { value: "#E74C3C", label: "Red" },
    { value: "#F39C12", label: "Orange" },
    { value: "#9B59B6", label: "Purple" },
  ];

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: { name: string; icon: string; color: string }) => {
      return await storageService.createCategory({ ...categoryData, isDefault: false });
    },
    onSuccess: (created: Category) => {
      queryClient.setQueryData(["categories"], (old: Category[] | undefined) => {
        const arr = old ? [...old] : [];
        arr.push(created);
        return arr;
      });

      setLocalAlloc((s) => ({ ...s, [created.id]: { id: undefined, allocatedAmount: "0" } }));

      setNewCategoryName("");
      setNewCategoryIcon("");
      setNewCategoryColor("");
      setIsCreating(false);
      setShowCreateCategory(false);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      toast({ title: "Success", description: "Category created successfully!" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      return await storageService.deleteCategory(categoryId);
    },
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(["categories"], (old: Category[] | undefined) => {
        return old ? old.filter(c => c.id !== deletedId) : [];
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["budget"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      toast({ title: "Success", description: "Category deleted successfully!" });
      setShowDeleteConfirm(false);
      setCategoryToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Delete Category",
        description: error.message,
        variant: "destructive"
      });
      setShowDeleteConfirm(false);
      setCategoryToDelete(null);
    },
  });

  useEffect(() => {
    const map: Record<string, { id?: string; allocatedAmount: string }> = {};
    categories.forEach((c) => {
      const existing = allocations.find((a) => a.categoryId === c.id);
      map[c.id] = { id: existing?.id, allocatedAmount: existing ? String(existing.allocatedAmount) : "0" };
    });
    setLocalAlloc(map);
  }, [categories, allocations]);

  const handleCreateCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCategoryName || !newCategoryIcon || !newCategoryColor) {
      toast({ title: "Error", description: "Please fill in all category fields", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      await createCategoryMutation.mutateAsync({ name: newCategoryName, icon: newCategoryIcon, color: newCategoryColor });
    } catch (err: any) {
      setIsCreating(false);
      toast({
        title: "Error",
        description: err?.message || "Failed to create category",
        variant: "destructive"
      });
    }
  };

  const handleAddExtraIncome = async () => {
    if (!budgetId) return;
    const amount = parseFloat(extraIncome || "0");
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    try {
      const current = summary?.monthlyBudget ?? 0;
      const newTotal = current + amount;
      await updateBudget.mutateAsync({ id: budgetId, data: { monthlyIncome: String(newTotal) } });
      await storageService.createIncomeRecord({ budgetId, amount: String(amount), note: extraIncomeNote });

      queryClient.setQueryData(["budget", budgetId, "summary"], (old: any) => {
        if (!old) return old;
        const monthlyBudget = Number(old.monthlyBudget ?? 0) + amount;
        const totalAllocated = old.totalAllocated ?? 0;
        const totalSpent = old.totalSpent ?? 0;
        const remainingBudget = monthlyBudget - totalAllocated;
        return { ...old, monthlyBudget, totalAllocated, totalSpent, remainingBudget };
      });
      queryClient.setQueryData(["budget", budgetId], (old: any) => {
        if (!old) return old;
        return { ...old, monthlyIncome: String(Number(old.monthlyIncome ?? 0) + amount) };
      });

      queryClient.invalidateQueries({ queryKey: ["budget", budgetId, "summary"] });
      queryClient.invalidateQueries({ queryKey: ["budget", budgetId] });
      queryClient.invalidateQueries();

      toast({ title: "Success", description: `Added ${currency} ${amount.toLocaleString()} to monthly budget` });
      setExtraIncome("");
      setExtraIncomeNote("");
      setShowAddIncome(false);
    } catch (err) {
      toast({ title: "Error", description: "Failed to update budget", variant: "destructive" });
    }
  };

  const handleChange = (categoryId: string, value: string) => {
    setLocalAlloc((s) => ({ ...s, [categoryId]: { ...s[categoryId], allocatedAmount: value } }));
  };

  const handleSave = async () => {
    if (!budgetId) return;
    const totalAllocated = Object.values(localAlloc).reduce((sum, v) => sum + Number(v.allocatedAmount || 0), 0);
    const monthlyBudget = summary?.monthlyBudget ?? Infinity;
    if (totalAllocated > monthlyBudget) {
      toast({ title: "Error", description: "Total allocations exceed monthly budget", variant: "destructive" });
      return;
    }

    try {
      for (const categoryId of Object.keys(localAlloc)) {
        const amount = localAlloc[categoryId].allocatedAmount || "0";
        const existing = allocations.find((a) => a.categoryId === categoryId);

        if (existing) {
          if (Number(amount) === 0) {
            await storageService.deleteBudgetAllocation(existing.id);
          } else if (String(existing.allocatedAmount) !== String(amount)) {
            await storageService.updateBudgetAllocation(existing.id, { allocatedAmount: amount });
          }
        } else {
          if (Number(amount) > 0) {
            await storageService.createBudgetAllocation({ budgetId, categoryId, allocatedAmount: amount });
          }
        }
      }

      const newAllocations: BudgetAllocation[] = Object.keys(localAlloc).map((categoryId) => {
        const existing = allocations.find((a) => a.categoryId === categoryId);
        return {
          id: existing?.id ?? crypto.randomUUID(),
          budgetId: budgetId,
          categoryId,
          allocatedAmount: localAlloc[categoryId].allocatedAmount,
          createdAt: new Date(),
        } as unknown as BudgetAllocation;
      }).filter(a => Number(a.allocatedAmount) > 0);

      queryClient.setQueryData(["allocations", budgetId], newAllocations);
      queryClient.invalidateQueries({ queryKey: ["budget", budgetId, "summary"] });
      queryClient.invalidateQueries({ queryKey: ["allocations", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["budget", budgetId, "categories-with-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["budget", budgetId, "expenses"] });

      toast({ title: "Success", description: "Allocations updated successfully" });
      navigate("/");
    } catch (error) {
      toast({ title: "Error", description: "Failed to update allocations", variant: "destructive" });
    }
  };

  const totalAllocated = Object.values(localAlloc).reduce((sum, v) => sum + Number(v.allocatedAmount || 0), 0);
  const monthlyBudget = summary?.monthlyBudget ?? 0;
  const remaining = Math.max(0, monthlyBudget - totalAllocated);
  const overBudget = totalAllocated > monthlyBudget;
  const allocationPercentage = monthlyBudget > 0 ? Math.min((totalAllocated / monthlyBudget) * 100, 100) : 0;

  // Calculate chart data - only for categories with expenses
  const chartData = useMemo(() => {
    if (!expenses || expenses.length === 0 || categories.length === 0) return [];

    // Get categories that have expenses
    const categoriesWithExpenses = categories.filter(cat =>
      expenses.some(exp => exp.categoryId === cat.id)
    );

    if (categoriesWithExpenses.length === 0) return [];

    // Use selected month date for relative calculations
    const monthDate = parseISO(selectedMonth + "-01");
    // If selected month is current month, use now, otherwise use end of that month
    const isCurrentMonth = selectedMonth === new Date().toISOString().slice(0, 7);
    const referenceDate = isCurrentMonth ? new Date() : endOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

    const data: any[] = [];

    if (chartPeriod === 'day') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = subDays(referenceDate, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const dayData: any = {
          label: format(date, "EEE"),
          fullDate: date,
        };

        categoriesWithExpenses.forEach((category) => {
          const categoryExpenses = expenses.filter((exp) => {
            const expDate = new Date(exp.date);
            return exp.categoryId === category.id && expDate >= dayStart && expDate <= dayEnd;
          });

          const total = categoryExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
          dayData[category.id] = total;
        });

        data.push(dayData);
      }
    } else if (chartPeriod === 'week') {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(referenceDate, i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(subWeeks(referenceDate, i), { weekStartsOn: 1 });

        const weekData: any = {
          label: `W${4 - i}`,
          fullDate: weekStart,
        };

        categoriesWithExpenses.forEach((category) => {
          const categoryExpenses = expenses.filter((exp) => {
            const expDate = new Date(exp.date);
            return exp.categoryId === category.id && expDate >= weekStart && expDate <= weekEnd;
          });

          const total = categoryExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
          weekData[category.id] = total;
        });

        data.push(weekData);
      }
    } else {
      // Last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = subDays(referenceDate, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const dayData: any = {
          label: format(date, "d"),
          fullDate: date,
        };

        categoriesWithExpenses.forEach((category) => {
          const categoryExpenses = expenses.filter((exp) => {
            const expDate = new Date(exp.date);
            return exp.categoryId === category.id && expDate >= dayStart && expDate <= dayEnd;
          });

          const total = categoryExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
          dayData[category.id] = total;
        });

        data.push(dayData);
      }
    }

    return data;
  }, [expenses, categories, chartPeriod, selectedMonth]);

  // Get categories that have expenses for the chart
  const categoriesWithExpenses = useMemo(() => {
    return categories.filter(cat =>
      expenses.some(exp => exp.categoryId === cat.id)
    );
  }, [categories, expenses]);

  // Calculate current month transactions for reset functionality
  const currentMonthTransactions = useMemo(() => {
    if (!expenses) return 0;
    // We are already filtered by budgetId which corresponds to selectedMonth
    return expenses.length;
  }, [expenses]);

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold text-xl hidden sm:block">Manage Budget</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">Allocate your monthly budget</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <MonthSelector
                currentMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
              />

              {currentMonthTransactions > 0 && budgetId && (
                <ResetTransactionsModal
                  budgetId={budgetId}
                  transactionCount={currentMonthTransactions}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Budget Summary Card */}
        <Card className="border-2 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Wallet className="w-5 h-5 text-primary" />
              <span>Budget Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Monthly Budget</p>
                <p className="text-lg font-bold text-primary">{currency} {monthlyBudget.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Allocated</p>
                <p className={`text-lg font-bold ${overBudget ? 'text-destructive' : 'text-blue-500'}`}>
                  {currency} {totalAllocated.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p className={`text-lg font-bold ${overBudget ? 'text-destructive' : 'text-green-500'}`}>
                  {currency} {remaining.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Allocation Progress</span>
                <span className={`font-medium ${overBudget ? 'text-destructive' : ''}`}>
                  {allocationPercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={allocationPercentage} className="h-2" />
            </div>

            {overBudget && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Total allocations exceed monthly budget by {currency} {(totalAllocated - monthlyBudget).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending Trends Chart */}
        {categoriesWithExpenses.length > 0 && chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-primary flex-shrink-0" />
                  <CardTitle className="text-base sm:text-lg">Spending Trends</CardTitle>
                </div>
                <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as typeof chartPeriod)} className="w-full sm:w-auto">
                  <TabsList className="h-8 p-0.5 bg-muted/50 w-full sm:w-auto">
                    <TabsTrigger value="day" className="text-[10px] sm:text-xs px-2 py-1 flex-1 sm:flex-none">Daily</TabsTrigger>
                    <TabsTrigger value="week" className="text-[10px] sm:text-xs px-2 py-1 flex-1 sm:flex-none">Weekly</TabsTrigger>
                    <TabsTrigger value="month" className="text-[10px] sm:text-xs px-2 py-1 flex-1 sm:flex-none">Monthly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height={280} className="sm:h-[300px]">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                      interval={chartPeriod === 'month' ? 5 : chartPeriod === 'week' ? 0 : 0}
                      height={20}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => value === 0 ? '0' : `${(value / 1000).toFixed(0)}k`}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '10px',
                        padding: '6px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number, name: string) => {
                        const category = categoriesWithExpenses.find(c => c.id === name);
                        return [`${currency} ${value.toLocaleString()}`, category?.name || name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          const data = payload[0].payload;
                          if (chartPeriod === 'day') {
                            return format(data.fullDate, "EEEE, MMM d");
                          } else if (chartPeriod === 'week') {
                            return `Week of ${format(data.fullDate, "MMM d")}`;
                          } else {
                            return format(data.fullDate, "MMM d, yyyy");
                          }
                        }
                        return label;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '9px', paddingTop: '8px' }}
                      formatter={(value) => {
                        const category = categoriesWithExpenses.find(c => c.id === value);
                        return category?.name || value;
                      }}
                      iconSize={8}
                    />
                    {categoriesWithExpenses.map((category) => (
                      <Line
                        key={category.id}
                        type="monotone"
                        dataKey={category.id}
                        stroke={category.color}
                        strokeWidth={2}
                        dot={{ fill: category.color, strokeWidth: 1.5, r: 2, stroke: '#ffffff' }}
                        activeDot={{ r: 4, fill: category.color, stroke: '#ffffff', strokeWidth: 2 }}
                        name={category.name}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center mt-2">
                {chartPeriod === 'day' && "Daily spending for the last 7 days"}
                {chartPeriod === 'week' && "Weekly spending for the last 4 weeks"}
                {chartPeriod === 'month' && "Daily spending for the last 30 days"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center space-y-2"
            onClick={() => setShowAddIncome(!showAddIncome)}
            data-testid="button-toggle-add-income"
          >
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium">Add Income</span>
            {showAddIncome ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center space-y-2"
            onClick={() => setShowCreateCategory(!showCreateCategory)}
            data-testid="button-toggle-create-category"
          >
            <Plus className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium">New Category</span>
            {showCreateCategory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Add Income Section */}
        {showAddIncome && (
          <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Extra Income</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="extra-income">Amount ({currency}) *</Label>
                <Input
                  id="extra-income"
                  type="number"
                  placeholder="e.g. 5000"
                  value={extraIncome}
                  onChange={(e) => setExtraIncome(e.target.value)}
                  data-testid="input-extra-income"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="extra-note">Note (optional)</Label>
                <Input
                  id="extra-note"
                  placeholder="e.g. freelance project, bonus"
                  value={extraIncomeNote}
                  onChange={(e) => setExtraIncomeNote(e.target.value)}
                  data-testid="input-extra-note"
                  className="mt-1"
                />
              </div>
              <div className="flex space-x-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddIncome(false);
                    setExtraIncome("");
                    setExtraIncomeNote("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleAddExtraIncome} className="flex-1" data-testid="button-add-extra">
                  Add Income
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Category Section */}
        {showCreateCategory && (
          <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Create New Category</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCategory} className="space-y-3">
                <div>
                  <Label htmlFor="categoryName">Category Name *</Label>
                  <Input
                    id="categoryName"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Entertainment, Travel"
                    data-testid="input-category-name"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="categoryIcon">Icon *</Label>
                  <Select value={newCategoryIcon} onValueChange={setNewCategoryIcon} required>
                    <SelectTrigger data-testid="select-category-icon" className="mt-1">
                      <SelectValue placeholder="Select an icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((option) => {
                        const IconComponent = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center space-x-2">
                              <IconComponent className="w-4 h-4" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="categoryColor">Color *</Label>
                  <Select value={newCategoryColor} onValueChange={setNewCategoryColor} required>
                    <SelectTrigger data-testid="select-category-color" className="mt-1">
                      <SelectValue placeholder="Select a color" />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: option.value }}
                            ></div>
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateCategory(false);
                      setNewCategoryName("");
                      setNewCategoryIcon("");
                      setNewCategoryColor("");
                    }}
                    className="flex-1"
                    data-testid="button-cancel-category"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createCategoryMutation.isPending}
                    data-testid="button-create-category"
                  >
                    {createCategoryMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Category Allocations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Category Allocations</span>
              <Badge variant="secondary">{categories.length} categories</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No categories yet. Create your first category!</p>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateCategory(true)}
                >
                  Create Category
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map((category, index) => {
                  const allocated = Number(localAlloc[category.id]?.allocatedAmount || 0);
                  const percentage = monthlyBudget > 0 ? (allocated / monthlyBudget) * 100 : 0;
                  const IconComponent = iconMap[category.icon as keyof typeof iconMap] || Smile;

                  return (
                    <div key={category.id}>
                      {index > 0 && <Separator className="my-4" />}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${category.color}20` }}
                            >
                              <IconComponent className="w-5 h-5" style={{ color: category.color }} />
                            </div>
                            <div>
                              <p className="font-medium">{category.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {percentage > 0 ? `${percentage.toFixed(1)}% of budget` : 'Not allocated'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-32">
                              <Label htmlFor={`alloc-${category.id}`} className="sr-only">
                                Allocation for {category.name}
                              </Label>
                              <Input
                                id={`alloc-${category.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={localAlloc[category.id]?.allocatedAmount ?? "0"}
                                onChange={(e) => handleChange(category.id, e.target.value)}
                                data-testid={`input-alloc-${category.id}`}
                                className="text-right font-medium"
                                placeholder="0"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCategoryToDelete(category);
                                setShowDeleteConfirm(true);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {allocated > 0 && (
                          <Progress
                            value={Math.min(percentage, 100)}
                            className="h-1.5"
                            style={{
                              // @ts-ignore
                              '--progress-background': category.color
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t">
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              className="flex-1"
              size="lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={overBudget}
              className="flex-1"
              size="lg"
            >
              Save Allocations
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Category Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{categoryToDelete?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteConfirm(false);
              setCategoryToDelete(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (categoryToDelete) {
                  deleteCategoryMutation.mutate(categoryToDelete.id);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
