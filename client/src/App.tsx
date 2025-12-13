import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import InstallButton from "./components/install-button";
import Dashboard from "@/pages/dashboard";
import BudgetSetup from "@/pages/budget-setup";
import ManageBudget from "@/pages/manage-budget";
import Transactions from "@/pages/transactions";
import Settings from "@/pages/settings";
import RecurringExpenses from "@/pages/recurring-expenses";
import SavingsGoals from "@/pages/savings-goals";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/budget-setup" component={BudgetSetup} />
      <Route path="/manage-budget" component={ManageBudget} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/settings" component={Settings} />
      <Route path="/recurring-expenses" component={RecurringExpenses} />
      <Route path="/savings-goals" component={SavingsGoals} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="budget-buddy-theme">
        <TooltipProvider>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', padding: 8 }}>
            <InstallButton />
          </div>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
