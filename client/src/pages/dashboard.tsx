import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import BudgetOverview from "@/components/budget-overview";
import CategoryTile from "@/components/category-tile";
import AddExpenseModal from "@/components/add-expense-modal";
import BottomNavigation from "@/components/bottom-navigation";
import SpendingChart from "@/components/spending-chart";
import CategoryChartModal from "@/components/category-chart-modal";
import MonthSelector from "@/components/month-selector";
import { MonthlyIncomeModal } from "@/components/monthly-income-modal";
import { useCurrentBudget, useBudgetByMonth, useBudgetSummary } from "@/hooks/use-budget";
import { useCategoriesWithAllocations, useExpenses } from "@/hooks/use-expenses";
import { Skeleton } from "@/components/ui/skeleton";
import { type CategoryWithAllocation } from "@/types";

const COLORS = ['#2ECC71', '#3498DB', '#E74C3C', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#8E44AD'];

import { useSettings } from "@/hooks/use-settings";
import { queryClient } from "@/lib/queryClient";
import { ModeToggle } from "@/components/mode-toggle";

export default function Dashboard() {
  const { data: settings } = useSettings();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showCategoryChart, setShowCategoryChart] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithAllocation | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [, navigate] = useLocation();

  // Ensure current budget exists
  const { data: currentBudget } = useCurrentBudget();

  // Get budget for selected month
  const { data: budget, isLoading: budgetLoading } = useBudgetByMonth(selectedMonth);
  const { data: summary, isLoading: summaryLoading } = useBudgetSummary(budget?.id);
  const { data: categories = [], isLoading: categoriesLoading } = useCategoriesWithAllocations(budget?.id);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(budget?.id);

  // Prepare chart data
  const chartData = categories
    .map((category, index) => ({
      ...category,
      color: COLORS[index % COLORS.length]
    }))
    .filter(category => category.allocated > 0) // Show categories with allocations
    .sort((a, b) => b.allocated - a.allocated) // Sort by allocation amount
    .slice(0, 6); // Show top 6 categories

  // If no budget exists for current month (and we're viewing current month), show income modal
  const isCurrentMonth = selectedMonth === new Date().toISOString().slice(0, 7);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  // Show income modal if viewing current month and no budget exists
  const showIncomeModal = isCurrentMonth && !budgetLoading && !budget;

  const handleIncomeComplete = () => {
    // Refresh budget data
    queryClient.invalidateQueries({ queryKey: ["budget"] });
  };

  const recentExpenses = expenses.slice(-3).reverse();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="font-semibold text-lg hidden sm:block">ExpenseTracker</h1>
            </div>

            <div className="flex items-center space-x-2">
              <MonthSelector
                currentMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
              />
              <ModeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Spending Chart Section */}
      <section className="max-w-md mx-auto px-4 mt-4" data-testid="header-chart-section">
        <SpendingChart expenses={expenses} isLoading={expensesLoading} />
      </section>

      {/* Budget Overview */}
      <BudgetOverview summary={summary} isLoading={summaryLoading} />

      {/* Quick Add Expense */}
      <section className="px-4 mb-6 mt-6">
        <Button
          onClick={() => setShowAddExpense(true)}
          className="w-full py-4 px-6 font-medium flex items-center justify-center space-x-2"
          data-testid="button-quick-add"
        >
          <Plus className="w-5 h-5" />
          <span>Add Expense</span>
        </Button>
      </section>

      {/* Budget Categories */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Budget Categories</h2>
          <Button onClick={() => navigate(`/manage-budget?budgetId=${budget?.id}`)} variant="ghost" size="sm" className="text-accent hover:text-white">
            Manage
          </Button>
        </div>

        {categoriesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No budget categories set up yet.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate(`/manage-budget?budgetId=${budget?.id}`)}
                data-testid="button-setup-categories"
              >
                Set Up Categories
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3" data-testid="categories-list">
            {categories.map((category) => (
              <CategoryTile
                key={category.id}
                category={category}
                onClick={(id) => {
                  const cat = categories.find(c => c.id === id);
                  if (cat) {
                    setSelectedCategory(cat);
                    setShowCategoryChart(true);
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Transactions */}
      <section className="p-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>

          <Button onClick={() => navigate(`/transactions?budgetId=${budget?.id}`)} variant="ghost" size="sm" className="text-accent hover:text-white">
            View All
          </Button>
        </div>

        {expensesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recentExpenses.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No transactions yet.</p>
              <Button
                onClick={() => setShowAddExpense(true)}
                variant="outline"
                className="mt-4"
                data-testid="button-add-first-expense"
              >
                Add Your First Expense
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3" data-testid="recent-transactions">
            {recentExpenses.map((expense) => (
              <Card key={expense.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium" data-testid={`transaction-category-${expense.id}`}>
                          {categories.find((c) => c.id === expense.categoryId)?.name ?? 'Uncategorized'}
                        </p>
                        {expense.description ? (
                          <p className="text-sm text-muted-foreground">{expense.description}</p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                          {new Date(expense.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold" data-testid={`transaction-amount-${expense.id}`}>
                      -{settings?.currency || 'PKR'} {Number(expense.amount).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>


      {/* Add Expense Modal */}
      {budget && (
        <AddExpenseModal
          open={showAddExpense}
          onOpenChange={setShowAddExpense}
          budgetId={budget.id}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation
        onAddExpenseClick={() => setShowAddExpense(true)}
        onManageBudgetClick={() => navigate(`/manage-budget?budgetId=${budget?.id}`)}
        onTransactionsClick={() => navigate(`/transactions?budgetId=${budget?.id}`)}
      />

      {/* Category Chart Modal */}
      <CategoryChartModal
        open={showCategoryChart}
        onOpenChange={(open) => {
          if (!open) setSelectedCategory(null);
          setShowCategoryChart(open);
        }}
        category={selectedCategory}
        expenses={expenses}
      />

      {/* Monthly Income Modal */}
      <MonthlyIncomeModal
        isOpen={showIncomeModal}
        currentMonth={currentMonthStr}
        onComplete={handleIncomeComplete}
      />
    </div>
  );
}
