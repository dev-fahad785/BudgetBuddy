import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { type Expense, type CategoryWithAllocation } from "@/types";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { X, List } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

interface CategoryChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryWithAllocation | null;
  expenses: Expense[];
}

type ChartPeriod = "day" | "week" | "month";

interface ChartDataPoint {
  label: string;
  amount: number;
  date: Date;
}

export default function CategoryChartModal({ open, onOpenChange, category, expenses }: CategoryChartModalProps) {
  const { data: settings } = useSettings();
  const currency = settings?.currency || 'PKR';
  const [period, setPeriod] = useState<ChartPeriod>("day");
  const [, navigate] = useLocation();

  // Filter expenses for this category
  const categoryExpenses = useMemo(() => {
    if (!category) return [];
    return expenses.filter(exp => exp.categoryId === category.id);
  }, [expenses, category]);

  // Aggregate expenses by period
  const chartData = useMemo(() => {
    if (!categoryExpenses || categoryExpenses.length === 0) return [];

    const now = new Date();
    const today = startOfDay(now);
    const data: ChartDataPoint[] = [];

    if (period === "day") {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const dayExpenses = categoryExpenses.filter(exp => {
          const expDate = new Date(exp.date);
          return expDate >= dayStart && expDate <= dayEnd;
        });

        const total = dayExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

        data.push({
          label: format(date, "EEE"),
          amount: total,
          date: date,
        });
      }
    } else if (period === "week") {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });

        const weekExpenses = categoryExpenses.filter(exp => {
          const expDate = new Date(exp.date);
          return expDate >= weekStart && expDate <= weekEnd;
        });

        const total = weekExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

        data.push({
          label: `W${4 - i}`,
          amount: total,
          date: weekStart,
        });
      }
    } else {
      // Last 30 days (monthly view) - only show up to today
      for (let i = 29; i >= 0; i--) {
        const date = subDays(today, i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        // Only include dates up to today
        if (date <= today) {
          const dayExpenses = categoryExpenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= dayStart && expDate <= dayEnd;
          });

          const total = dayExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

          data.push({
            label: format(date, "d"),
            amount: total,
            date: date,
          });
        }
      }
    }

    return data;
  }, [categoryExpenses, period]);

  // Calculate stats
  const stats = useMemo(() => {
    if (chartData.length === 0) return { total: 0, average: 0, highest: 0, transactionCount: 0 };

    const total = chartData.reduce((sum, d) => sum + d.amount, 0);
    const average = total / chartData.length;
    const highest = Math.max(...chartData.map(d => d.amount));

    return {
      total,
      average,
      highest,
      transactionCount: categoryExpenses.length
    };
  }, [chartData, categoryExpenses]);

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${category.color}20` }}
              >
                <span className="text-xl">💰</span>
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">{category.name}</DialogTitle>
                <p className="text-xs text-muted-foreground">Spending Analysis</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4">
          {/* Period Selector */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Spending Trend</h3>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as ChartPeriod)} className="w-auto">
              <TabsList className="h-8 p-1 bg-muted/50">
                <TabsTrigger value="day" className="text-xs px-2.5 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Day
                </TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2.5 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Week
                </TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2.5 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Month
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Chart */}
          {chartData.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No spending data for this period
            </div>
          ) : (
            <>
              <div className="w-full" style={{ touchAction: 'pan-y' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 5, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id={`colorAmount-${category.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={category.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={category.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      opacity={0.5}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                      height={25}
                      interval={period === "month" ? Math.floor(chartData.length / 6) : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => value === 0 ? '0' : `${(value / 1000).toFixed(0)}k`}
                      width={35}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '11px',
                        padding: '6px 10px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number) => [`${currency} ${value.toLocaleString()}`, 'Spent']}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          const data = payload[0].payload as ChartDataPoint;
                          if (period === "day") {
                            return format(data.date, "EEEE, MMM d");
                          } else if (period === "week") {
                            return `Week of ${format(data.date, "MMM d")}`;
                          } else {
                            return format(data.date, "MMM d, yyyy");
                          }
                        }
                        return label;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke={category.color}
                      strokeWidth={3}
                      fill={`url(#colorAmount-${category.id})`}
                      dot={{
                        fill: category.color,
                        strokeWidth: 2,
                        r: 3,
                        stroke: '#ffffff'
                      }}
                      activeDot={{
                        r: 5,
                        fill: category.color,
                        stroke: '#ffffff',
                        strokeWidth: 2
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {/* Total */}
                <div className="bg-muted/30 rounded-lg p-2.5 border border-border/50">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Total</p>
                  <p className="text-xs font-bold leading-tight">
                    {currency} {stats.total.toLocaleString()}
                  </p>
                </div>

                {/* Average */}
                <div className="bg-muted/30 rounded-lg p-2.5 border border-border/50">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Avg</p>
                  <p className="text-xs font-bold leading-tight">
                    {currency} {Math.round(stats.average).toLocaleString()}
                  </p>
                </div>

                {/* Highest */}
                <div className="bg-muted/30 rounded-lg p-2.5 border border-border/50">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Highest</p>
                  <p className="text-xs font-bold leading-tight" style={{ color: category.color }}>
                    {currency} {stats.highest.toLocaleString()}
                  </p>
                </div>

                {/* Transaction Count */}
                <div className="bg-muted/30 rounded-lg p-2.5 border border-border/50">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Count</p>
                  <p className="text-xs font-bold leading-tight">
                    {stats.transactionCount}
                  </p>
                </div>
              </div>

              {/* Period Description */}
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                {period === "day" && "Daily spending for the last 7 days"}
                {period === "week" && "Weekly spending for the last 4 weeks"}
                {period === "month" && "Daily spending for the last 30 days"}
              </p>
            </>
          )}

          {/* Budget Overview */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-muted/20 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Allocated</p>
                <p className="text-base font-bold">{currency} {category.allocated.toLocaleString()}</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Remaining</p>
                <p className={`text-base font-bold ${category.remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {currency} {category.remaining.toLocaleString()}
                </p>
              </div>
            </div>

            {/* View Transactions Button */}
            {categoryExpenses.length > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const budgetId = categoryExpenses[0]?.budgetId;
                  if (budgetId) {
                    onOpenChange(false);
                    navigate(`/transactions?budgetId=${budgetId}&categoryId=${category.id}`);
                  }
                }}
              >
                <List className="w-4 h-4 mr-2" />
                View All {categoryExpenses.length} Transaction{categoryExpenses.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
