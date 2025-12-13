import { useState } from "react";
import { useSavingsGoals, useCreateSavingsGoal, useUpdateSavingsGoal, useDeleteSavingsGoal } from "@/hooks/use-savings";
import { useCurrentBudget } from "@/hooks/use-budget";
import { useCreateExpense, useCategories, useCreateCategory } from "@/hooks/use-expenses";
import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNavigation from "@/components/bottom-navigation";
import { ArrowLeft, Plus, Trash2, Target, Trophy } from "lucide-react";
import { Link } from "wouter";

export default function SavingsGoals() {
    const { data: goals = [] } = useSavingsGoals();
    const { data: settings } = useSettings();
    const currency = settings?.currency || 'PKR';
    const createGoal = useCreateSavingsGoal();
    const updateGoal = useUpdateSavingsGoal();
    const deleteGoal = useDeleteSavingsGoal();
    const [isOpen, setIsOpen] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [targetAmount, setTargetAmount] = useState("");
    const [currentAmount, setCurrentAmount] = useState("0");

    // Add funds modal state
    const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState<any>(null);
    const [fundAmount, setFundAmount] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createGoal.mutateAsync({
            name,
            targetAmount,
            currentAmount,
            targetDate: null,
            icon: "target",
            color: "#2ECC71"
        });
        setIsOpen(false);
        setName("");
        setTargetAmount("");
        setCurrentAmount("0");
    };

    const handleAddFundsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedGoal && fundAmount && !isNaN(Number(fundAmount)) && selectedCategory) {
            await handleAddContribution(selectedGoal, Number(fundAmount), selectedCategory);
            setIsAddFundsOpen(false);
            setFundAmount("");
            setSelectedGoal(null);
            setSelectedCategory("");
        }
    };

    const { data: budget } = useCurrentBudget();
    const createExpense = useCreateExpense();
    const { data: categories = [] } = useCategories();
    const createCategory = useCreateCategory();

    const handleAddContribution = async (goal: any, amount: number, categoryId?: string) => {
        // 1. Update Goal Amount
        const newAmount = Number(goal.currentAmount) + amount;
        await updateGoal.mutateAsync({
            id: goal.id,
            data: { currentAmount: newAmount.toString() }
        });

        // 2. Create Expense Transaction (if budget exists)
        if (budget && categoryId) {
            // Use the selected category for the expense
            await createExpense.mutateAsync({
                budgetId: budget.id,
                expenseData: {
                    amount: amount.toString(),
                    description: `Contribution to ${goal.name}`,
                    categoryId: categoryId,
                    date: new Date().toISOString()
                }
            });
        }
    };



    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="bg-card border-b border-border sticky top-0 z-40">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <ArrowLeft className="w-6 h-6 cursor-pointer" />
                        </Link>
                        <h1 className="font-semibold text-lg">Savings Goals</h1>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                Add
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>New Savings Goal</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Goal Name</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. New Car"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="target">Target Amount</Label>
                                    <Input
                                        id="target"
                                        type="number"
                                        value={targetAmount}
                                        onChange={(e) => setTargetAmount(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="current">Current Savings</Label>
                                    <Input
                                        id="current"
                                        type="number"
                                        value={currentAmount}
                                        onChange={(e) => setCurrentAmount(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full">Create Goal</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 mt-6 space-y-4">
                {goals.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6 text-center text-muted-foreground">
                            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p>No savings goals yet. Start saving today!</p>
                        </CardContent>
                    </Card>
                ) : (
                    goals.map((goal) => {
                        const progress = Math.min(100, (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100);
                        return (
                            <Card key={goal.id}>
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                                <Target className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{goal.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {currency} {Number(goal.currentAmount).toLocaleString()} / {Number(goal.targetAmount).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive/90"
                                            onClick={() => deleteGoal.mutate(goal.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Progress</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <Progress value={progress} className="h-2" />
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                setSelectedGoal(goal);
                                                setIsAddFundsOpen(true);
                                            }}
                                        >
                                            <Plus className="w-3 h-3 mr-2" />
                                            Add Funds
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Add Funds Modal */}
            <Dialog open={isAddFundsOpen} onOpenChange={setIsAddFundsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Funds to {selectedGoal?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddFundsSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id.toString()}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fundAmount">Amount to Add</Label>
                            <Input
                                id="fundAmount"
                                type="number"
                                value={fundAmount}
                                onChange={(e) => setFundAmount(e.target.value)}
                                placeholder="Enter amount"
                                required
                                min="0.01"
                                step="0.01"
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            Add Funds
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <BottomNavigation />
        </div>
    );
}
