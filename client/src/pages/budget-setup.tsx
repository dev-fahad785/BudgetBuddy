import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Plus, ShoppingCart, Car, FileText, Zap, Smile, Trash2 } from "lucide-react";
import { useCreateBudget } from "@/hooks/use-budget";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { storageService } from "@/lib/storage";
import { type Category } from "@/types";
import { useSettings } from "@/hooks/use-settings";
// Currency symbol replaced inline with 'PKR'

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

export default function BudgetSetup() {
  const [step, setStep] = useState(1);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [budget, setBudget] = useState<any>(null);
  const [allocations, setAllocations] = useState<{ [key: string]: string }>({});
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createBudget = useCreateBudget();
  const { data: settings } = useSettings();
  const currency = settings?.currency || 'PKR';

  const { data: categories = [], refetch: refetchCategories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => await storageService.getCategories(),
    enabled: step === 2,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: { name: string; icon: string; color: string }) => {
      return await storageService.createCategory({
        ...categoryData,
        isDefault: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      refetchCategories();
      setShowCreateCategory(false);
      setNewCategoryName("");
      setNewCategoryIcon("");
      setNewCategoryColor("");
      toast({
        title: "Success",
        description: "Category created successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const createAllocationsMutation = useMutation({
    mutationFn: async (allocationData: { budgetId: string; allocations: { categoryId: string; amount: string }[] }) => {
      const promises = allocationData.allocations.map(allocation =>
        storageService.createBudgetAllocation({
          budgetId: allocationData.budgetId,
          categoryId: allocation.categoryId,
          allocatedAmount: allocation.amount,
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Budget setup completed successfully!",
      });
      setLocation("/");
    },
  });

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!monthlyIncome || parseFloat(monthlyIncome) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid monthly income",
        variant: "destructive",
      });
      return;
    }

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      const newBudget = await createBudget.mutateAsync({
        monthlyIncome: monthlyIncome,
        month: currentMonth,
      });

      setBudget(newBudget);
      setStep(2);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create budget",
        variant: "destructive",
      });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCategoryName || !newCategoryIcon || !newCategoryColor) {
      toast({
        title: "Error",
        description: "Please fill in all category fields",
        variant: "destructive",
      });
      return;
    }

    createCategoryMutation.mutate({
      name: newCategoryName,
      icon: newCategoryIcon,
      color: newCategoryColor,
    });
  };

  const handleFinishSetup = async () => {
    const allocationsArray = Object.entries(allocations)
      .filter(([_, amount]) => amount && parseFloat(amount) > 0)
      .map(([categoryId, amount]) => ({ categoryId, amount }));

    if (allocationsArray.length === 0) {
      toast({
        title: "Info",
        description: "No budget allocations set. You can allocate later from the dashboard.",
      });
      setLocation("/");
      return;
    }

    createAllocationsMutation.mutate({
      budgetId: budget.id,
      allocations: allocationsArray,
    });
  };

  const totalAllocated = Object.values(allocations)
    .filter(amount => amount)
    .reduce((sum, amount) => sum + parseFloat(amount), 0);

  const remainingBudget = parseFloat(monthlyIncome) - totalAllocated;

  const getIconComponent = (iconName: string) => {
    const iconOption = iconOptions.find(opt => opt.value === iconName);
    return iconOption ? iconOption.icon : Smile;
  };

  if (step === 1) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="budget-setup-form">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Set Up Your Budget</CardTitle>
            <p className="text-muted-foreground">
              Enter your monthly income to get started with expense tracking
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleIncomeSubmit} className="space-y-6">
              <div>
                <Label htmlFor="monthlyIncome">Monthly Income *</Label>
                <div className="relative">
                  <span
                    className="absolute left-3 inset-y-0 flex items-center text-sm text-muted-foreground pointer-events-none"
                    aria-hidden="true"
                  >
                    {currency}
                  </span>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    step="1"
                    placeholder="5000.00"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="pl-14"
                    data-testid="input-monthly-income"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This will be used as the basis for your budget allocations
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createBudget.isPending}
                data-testid="button-create-budget"
              >
                {createBudget.isPending ? "Creating Budget..." : "Continue to Categories"}
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Next: Set up budget categories and allocations
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card data-testid="category-allocation-form">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Allocate Your Budget</CardTitle>
            <p className="text-muted-foreground">
              Distribute your {currency} {parseFloat(monthlyIncome).toLocaleString()} monthly income across categories
            </p>
            <div className="flex justify-center items-center mt-4 space-x-4 text-sm">
              <div className="flex items-center">
                <span className="text-muted-foreground">Allocated: </span>
                <span className="font-medium ml-1 text-primary">
                  {currency} {totalAllocated.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-muted-foreground">Remaining: </span>
                <span className={`font-medium ml-1 ${remainingBudget >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {currency} {remainingBudget.toLocaleString()}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${remainingBudget >= 0 ? 'bg-primary' : 'bg-destructive'
                  }`}
                style={{ width: `${Math.min((totalAllocated / parseFloat(monthlyIncome)) * 100, 100)}%` }}
              ></div>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Budget Categories</h3>
                <Dialog open={showCreateCategory} onOpenChange={setShowCreateCategory}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-add-category">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md" data-testid="create-category-modal">
                    <DialogHeader>
                      <DialogTitle>Create New Category</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateCategory} className="space-y-4">
                      <div>
                        <Label htmlFor="categoryName">Category Name *</Label>
                        <Input
                          id="categoryName"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="e.g. Entertainment"
                          data-testid="input-category-name"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="categoryIcon">Icon *</Label>
                        <Select value={newCategoryIcon} onValueChange={setNewCategoryIcon} required>
                          <SelectTrigger data-testid="select-category-icon">
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
                          <SelectTrigger data-testid="select-category-color">
                            <SelectValue placeholder="Select a color" />
                          </SelectTrigger>
                          <SelectContent>
                            {colorOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center space-x-2">
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: option.value }}
                                  ></div>
                                  <span>{option.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCreateCategory(false)}
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
                          {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {categories.map((category) => {
                const IconComponent = getIconComponent(category.icon);
                return (
                  <Card key={category.id} className="border border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${category.color}20`, color: category.color }}
                          >
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-medium">{category.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {category.isDefault ? 'Default category' : 'Custom category'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            <span
                              className="absolute left-3 inset-y-0 flex items-center text-sm text-muted-foreground pointer-events-none"
                              aria-hidden="true"
                            >
                              {currency}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={allocations[category.id] || ""}
                              onChange={(e) => setAllocations({ ...allocations, [category.id]: e.target.value })}
                              className="w-32 pl-12"
                              data-testid={`input-allocation-${category.id}`}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
                data-testid="button-back"
              >
                Back
              </Button>
              <Button
                onClick={handleFinishSetup}
                className="flex-1"
                disabled={createAllocationsMutation.isPending}
                data-testid="button-finish-setup"
              >
                {createAllocationsMutation.isPending ? "Setting up..." : "Finish Setup"}
              </Button>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                You can skip allocations and set them up later from the dashboard
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
