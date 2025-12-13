import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { storageService } from "@/lib/storage";
import { useExpenses, useDeleteExpense } from "@/hooks/use-expenses";
import { useBudgetByMonth } from "@/hooks/use-budget";
import { type Expense, type Category } from "@/types";
import { ArrowLeft, Filter, X, ShoppingCart, Car, FileText, Zap, Smile, Trash2, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks, parseISO } from "date-fns";
import MonthSelector from "@/components/month-selector";

const iconMap = {
  "shopping-cart": ShoppingCart,
  "car": Car,
  "file-text": FileText,
  "zap": Zap,
  "smile": Smile,
};

export default function Transactions() {
  const [, navigate] = useLocation();
  const initialCategoryId = new URLSearchParams(window.location.search).get('categoryId');

  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [chartPeriod, setChartPeriod] = useState<'day' | 'week' | 'month'>('day');

  // Get budget for selected month
  const { data: budget } = useBudgetByMonth(selectedMonth);
  const { data: expenses = [], isLoading } = useExpenses(budget?.id, true);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => await storageService.getCategories(),
  });

  const deleteMutation = useDeleteExpense();

  // Filter expenses by selected month (though useExpenses(budget.id) should already do this mostly)
  // But we double check to be safe and consistent
  const currentMonthExpenses = useMemo(() => {
    if (!expenses) return [] as Expense[];
    return expenses;
  }, [expenses]);

  const findCategory = (id?: string) => categories.find((c) => c.id === id);
  const findCategoryName = (id?: string) => findCategory(id)?.name ?? "Uncategorized";

  // Filter by category
  const filteredExpenses = useMemo(() => {
    if (!selectedCategoryId) return currentMonthExpenses;
    return currentMonthExpenses.filter((e) => e.categoryId === selectedCategoryId);
  }, [currentMonthExpenses, selectedCategoryId]);

  // Sort expenses
  const sortedExpenses = useMemo(() => {
    const sorted = [...filteredExpenses];
    switch (sortBy) {
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'amount-desc':
        return sorted.sort((a, b) => Number(b.amount) - Number(a.amount));
      case 'amount-asc':
        return sorted.sort((a, b) => Number(a.amount) - Number(b.amount));
      default:
        return sorted;
    }
  }, [filteredExpenses, sortBy]);

  // Calculate stats
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const transactionCount = filteredExpenses.length;

  // Group expenses by category for quick filter
  const categoryStats = useMemo(() => {
    const stats = new Map<string, { count: number; total: number; category: Category }>();
    currentMonthExpenses.forEach((expense) => {
      const catId = expense.categoryId || 'uncategorized';
      const existing = stats.get(catId) || { count: 0, total: 0, category: findCategory(expense.categoryId)! };
      stats.set(catId, {
        count: existing.count + 1,
        total: existing.total + Number(expense.amount),
        category: existing.category,
      });
    });
    return Array.from(stats.entries()).map(([id, data]) => ({ categoryId: id, ...data }));
  }, [currentMonthExpenses, categories]);

  // Calculate chart data - use same implementation as settings page (daily/weekly/monthly)
  const chartData = useMemo(() => {
    if (!currentMonthExpenses || currentMonthExpenses.length === 0 || categories.length === 0) return [];

    // Get categories that have expenses
    const categoriesWithExpenses = categories.filter(cat =>
      currentMonthExpenses.some(exp => exp.categoryId === cat.id)
    );

    if (categoriesWithExpenses.length === 0) return [];

    // Use selected month date for relative calculations
    const monthDate = parseISO(selectedMonth + "-01");
    // If selected month is current month, use now, otherwise use end of that month
    const isCurrentMonth = selectedMonth === new Date().toISOString().slice(0, 7);
    const referenceDate = isCurrentMonth ? new Date() : endOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

    const data: any[] = [];

    if (chartPeriod === 'day') {
      // Last 7 days relative to reference date
      for (let i = 6; i >= 0; i--) {
        const date = subDays(referenceDate, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const dayData: any = {
          label: format(date, "EEE"),
          fullDate: date,
        };

        categoriesWithExpenses.forEach((category) => {
          const categoryExpenses = currentMonthExpenses.filter((exp) => {
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
          const categoryExpenses = currentMonthExpenses.filter((exp) => {
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
          const categoryExpenses = currentMonthExpenses.filter((exp) => {
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
  }, [currentMonthExpenses, categories, chartPeriod, selectedMonth]);

  // Get categories that have expenses for the chart
  const categoriesWithExpenses = useMemo(() => {
    return categories.filter(cat =>
      currentMonthExpenses.some(exp => exp.categoryId === cat.id)
    );
  }, [categories, currentMonthExpenses]);

  const handleDelete = async (expenseId: string) => {
    if (!budget?.id) return;
    await deleteMutation.mutateAsync({ expenseId, budgetId: budget.id });
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-semibold text-xl hidden sm:block">Transactions</h1>
            </div>

            <MonthSelector
              currentMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
            />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Transactions</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{transactionCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Total Spent</p>
                <p className="text-xl sm:text-2xl font-bold text-destructive">₨{totalAmount.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Spending Trends Chart */}
        {currentMonthExpenses.length > 0 && categories.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
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
                <ResponsiveContainer width="100%" height={280} className="sm:h-[320px]">
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
                        const category = categories.find(c => c.id === name);
                        return [`₨${value.toLocaleString()}`, category?.name || name];
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

            </CardContent>
          </Card>
        )}

        {/* Category Filter Chips */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <h3 className="font-medium text-xs sm:text-sm">Filter by Category</h3>
              </div>
              {selectedCategoryId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategoryId(null)}
                  className="h-auto py-1 px-2 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Badge
                variant={!selectedCategoryId ? "default" : "outline"}
                className="cursor-pointer px-2 py-1 text-[10px] sm:text-xs"
                onClick={() => setSelectedCategoryId(null)}
              >
                All ({currentMonthExpenses.length})
              </Badge>
              {categoryStats.map(({ categoryId, count, total, category }) => {
                const IconComponent = category ? iconMap[category.icon as keyof typeof iconMap] || Smile : Smile;
                const isSelected = selectedCategoryId === categoryId;

                return (
                  <Badge
                    key={categoryId}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer px-2 py-1 text-[10px] sm:text-xs flex items-center space-x-1"
                    onClick={() => setSelectedCategoryId(categoryId === selectedCategoryId ? null : categoryId)}
                    style={isSelected && category ? { backgroundColor: category.color, borderColor: category.color } : {}}
                  >
                    {category && <IconComponent className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                    <span className="max-w-[60px] sm:max-w-none truncate">{category?.name || 'Uncategorized'}</span>
                    <span className="opacity-70">({count})</span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sort Options */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div className="text-[11px] sm:text-sm text-muted-foreground">
            {selectedCategoryId ? (
              <>Showing {transactionCount} transaction{transactionCount !== 1 ? 's' : ''} for <span className="font-medium text-foreground">{findCategoryName(selectedCategoryId)}</span></>
            ) : (
              <>Showing all {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}</>
            )}
          </div>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
            <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc" className="text-xs">Newest First</SelectItem>
              <SelectItem value="date-asc" className="text-xs">Oldest First</SelectItem>
              <SelectItem value="amount-desc" className="text-xs">Highest Amount</SelectItem>
              <SelectItem value="amount-asc" className="text-xs">Lowest Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Transactions List */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-sm text-muted-foreground">Loading transactions…</div>
            </CardContent>
          </Card>
        ) : sortedExpenses.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6 sm:py-8">
                <DollarSign className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  {selectedCategoryId
                    ? `No transactions found for ${findCategoryName(selectedCategoryId)}`
                    : 'No transactions for this month.'
                  }
                </p>
                {selectedCategoryId && (
                  <Button
                    variant="outline"
                    className="mt-3 sm:mt-4 text-xs sm:text-sm"
                    onClick={() => setSelectedCategoryId(null)}
                  >
                    View All Transactions
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {sortedExpenses.map((tx, index) => {
              const category = findCategory(tx.categoryId);
              const IconComponent = category ? iconMap[category.icon as keyof typeof iconMap] || Smile : Smile;

              return (
                <Card key={tx.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 sm:gap-4">
                      {/* Left side - Icon and Details */}
                      <div className="flex items-start space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: category ? `${category.color}20` : '#e5e7eb' }}
                        >
                          {category ? (
                            <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: category.color }} />
                          ) : (
                            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-xs sm:text-sm mb-0.5">{findCategoryName(tx.categoryId)}</h3>

                          {tx.description && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 break-words line-clamp-2">
                              {tx.description}
                            </p>
                          )}

                          <div className="flex items-center space-x-1.5 text-[9px] sm:text-xs text-muted-foreground">
                            <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span>{new Date(tx.date).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right side - Amount and Actions */}
                      <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                        <div className="font-bold text-xs sm:text-sm text-destructive whitespace-nowrap">
                          -₨{Number(tx.amount).toLocaleString()}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(tx.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="hidden sm:inline ml-1">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
