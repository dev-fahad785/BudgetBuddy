import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, AlertTriangle, CheckCircle, Wallet, PieChart } from "lucide-react";
import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";

// Mock BudgetSummary type - in real app this would be imported
interface BudgetSummary {
  monthlyBudget: number;
  totalAllocated: number;
  totalSpent: number;
  remainingBudget: number;
  categoryCount: number;
  daysLeft: number;
}

interface BudgetOverviewProps {
  summary: BudgetSummary | undefined;
  isLoading: boolean;
}

export default function BudgetOverview({ summary, isLoading }: BudgetOverviewProps) {
  const { data: settings } = useSettings();
  const currency = settings?.currency || 'PKR';
  const [animateProgress, setAnimateProgress] = useState(false);

  useEffect(() => {
    if (summary) {
      const timer = setTimeout(() => setAnimateProgress(true), 100);
      return () => clearTimeout(timer);
    }
  }, [summary]);

  if (isLoading) {
    return (
      <div className="mx-4 mt-4 space-y-4">
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-12 w-48" />
                <Skeleton className="h-4 w-full max-w-sm" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-4 mt-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <PieChart className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Budget Data</h3>
            <p className="text-muted-foreground">Set up your monthly budget to start tracking your finances</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allocationPercentage = summary.monthlyBudget > 0 ? (summary.totalAllocated / summary.monthlyBudget) * 100 : 0;
  const spentPercentage = summary.monthlyBudget > 0 ? (summary.totalSpent / summary.monthlyBudget) * 100 : 0;
  const availableAmount = summary.monthlyBudget - summary.totalSpent;
  const isOverBudget = summary.totalSpent > summary.monthlyBudget;
  const isOverAllocated = summary.totalAllocated > summary.monthlyBudget;
  const dailyBudget = summary.daysLeft > 0 ? availableAmount / summary.daysLeft : 0;

  const getBudgetStatus = () => {
    if (isOverBudget) return { text: "Over Budget", color: "text-red-600", icon: AlertTriangle, bgColor: "bg-red-50 dark:bg-red-900/20" };
    if (spentPercentage > 80) return { text: "Almost Spent", color: "text-orange-600", icon: TrendingUp, bgColor: "bg-orange-50 dark:bg-orange-900/20" };
    if (spentPercentage < 50) return { text: "On Track", color: "text-green-600", icon: CheckCircle, bgColor: "bg-green-50 dark:bg-green-900/20" };
    return { text: "Good Progress", color: "text-blue-600", icon: TrendingUp, bgColor: "bg-blue-50 dark:bg-blue-900/20" };
  };

  const status = getBudgetStatus();
  const StatusIcon = status.icon;

  return (
    <div className="mx-4 mt-4 space-y-4" data-testid="budget-overview">
      {/* Main Budget Card */}
      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20">

      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        {/* Total Spent */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              {spentPercentage > 80 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="total-spent">
              {currency} {summary.totalSpent.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total Spent</p>
            <div className="mt-2 text-xs">
              <span className={`font-medium ${spentPercentage > 100 ? 'text-red-600' : 'text-gray-600'}`}>
                {spentPercentage.toFixed(1)}% of budget
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Available Amount */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              {availableAmount > summary.monthlyBudget * 0.5 && <CheckCircle className="w-4 h-4 text-green-500" />}
            </div>
            <p className={`text-2xl font-bold ${availableAmount < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`} data-testid="available-amount">
              {currency} {availableAmount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Available</p>
            {summary.daysLeft > 0 && (
              <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                {currency} {dailyBudget.toLocaleString()}/day
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories and Days Left cards removed as per request */}
      </div>

      {/* Insights Card */}
      {(isOverBudget || isOverAllocated || summary.daysLeft <= 7) && (
        <Card className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Budget Alerts</h4>
                <ul className="space-y-1 text-sm text-orange-700 dark:text-orange-300">
                  {isOverBudget && <li>• You've exceeded your monthly budget by {currency} {(summary.totalSpent - summary.monthlyBudget).toLocaleString()}</li>}
                  {isOverAllocated && <li>• Your allocations exceed the budget by {currency} {(summary.totalAllocated - summary.monthlyBudget).toLocaleString()}</li>}
                  {summary.daysLeft <= 7 && <li>• Only {summary.daysLeft} days left in the current month</li>}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Demo component with mock data
function BudgetOverviewDemo() {
  const [isLoading, setIsLoading] = useState(true);

  const mockSummary: BudgetSummary = {
    monthlyBudget: 150000,
    totalAllocated: 140000,
    totalSpent: 95000,
    remainingBudget: 10000,
    categoryCount: 8,
    daysLeft: 12
  };

  // Simulate loading
  useState(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 px-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Budget Overview</h1>
          <p className="text-muted-foreground mt-2">Track your monthly budget and spending patterns</p>
        </div>
        <BudgetOverview summary={isLoading ? undefined : mockSummary} isLoading={isLoading} />
      </div>
    </div>
  );
}