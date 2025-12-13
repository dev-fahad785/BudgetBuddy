import { useState } from "react";
import { useRecurringExpenses, useCreateRecurringExpense, useDeleteRecurringExpense } from "@/hooks/use-recurring";
import { useCategories } from "@/hooks/use-expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import BottomNavigation from "@/components/bottom-navigation";
import { ArrowLeft, Plus, Trash2, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useSettings } from "@/hooks/use-settings";

export default function RecurringExpenses() {
    const { data: recurringExpenses = [] } = useRecurringExpenses();
    const { data: categories = [] } = useCategories();
    const { data: settings } = useSettings();
    const currency = settings?.currency || 'PKR';
    const createRecurring = useCreateRecurringExpense();
    const deleteRecurring = useDeleteRecurringExpense();
    const [isOpen, setIsOpen] = useState(false);

    // Form state
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await createRecurring.mutateAsync({
            amount,
            description,
            categoryId,
            frequency,
            startDate: new Date(),
            active: true
        });
        setIsOpen(false);
        setAmount("");
        setDescription("");
        setCategoryId("");
    };



    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="bg-card border-b border-border sticky top-0 z-40">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <ArrowLeft className="w-6 h-6 cursor-pointer" />
                        </Link>
                        <h1 className="font-semibold text-lg">Recurring Expenses</h1>
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
                                <DialogTitle>Add Recurring Expense</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select value={categoryId} onValueChange={setCategoryId} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((c: any) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="frequency">Frequency</Label>
                                    <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="daily">Daily</SelectItem>
                                            <SelectItem value="weekly">Weekly</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="yearly">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button type="submit" className="w-full">Create</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 mt-6 space-y-4">
                {recurringExpenses.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6 text-center text-muted-foreground">
                            No recurring expenses set up.
                        </CardContent>
                    </Card>
                ) : (
                    recurringExpenses.map((expense) => (
                        <Card key={expense.id}>
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                        <RefreshCw className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{expense.description}</p>
                                        <p className="text-sm text-muted-foreground capitalize">{expense.frequency}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold">
                                        {currency} {Number(expense.amount).toLocaleString()}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive/90"
                                        onClick={() => deleteRecurring.mutate(expense.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <BottomNavigation />
        </div>
    );
}
