import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, DollarSign, RotateCcw } from "lucide-react";
import { storageService } from "@/lib/storage";
import { useResetBudget } from "@/hooks/use-reset-budget";
import { useSettings } from "@/hooks/use-settings";

interface ResetBudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    budgetId: string;
}

export function ResetBudgetModal({ isOpen, onClose, budgetId }: ResetBudgetModalProps) {
    const resetBudget = useResetBudget();
    const { data: settings } = useSettings();
    const currency = settings?.currency || 'PKR';

    const [newIncome, setNewIncome] = useState("");
    const [loading, setLoading] = useState(true);
    const [remainingBalance, setRemainingBalance] = useState(0);
    const [expenseCount, setExpenseCount] = useState(0);
    const [rolloverChoice, setRolloverChoice] = useState<'yes' | 'no' | null>(null);
    const [validationError, setValidationError] = useState("");

    useEffect(() => {
        async function loadBudgetData() {
            if (!isOpen || !budgetId) return;

            setLoading(true);
            try {
                // Calculate current remaining balance
                const allocations = await storageService.getBudgetAllocations(budgetId);
                const expenses = await storageService.getExpenses(budgetId);

                const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
                const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
                const remaining = totalAllocated - totalSpent;

                setRemainingBalance(Math.max(0, remaining));
                setExpenseCount(expenses.length);
            } catch (error) {
                console.error("Failed to load budget data:", error);
            } finally {
                setLoading(false);
            }
        }

        loadBudgetData();
    }, [isOpen, budgetId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError("");

        const incomeAmount = parseFloat(newIncome);
        if (!newIncome || incomeAmount <= 0) {
            setValidationError("Please enter a valid income amount");
            return;
        }

        // If there's remaining balance, user must make a choice
        if (remainingBalance > 0 && rolloverChoice === null) {
            setValidationError("Please choose whether to include remaining balance");
            return;
        }

        try {
            await resetBudget.mutateAsync({
                budgetId,
                newIncome,
                includeRollover: rolloverChoice === 'yes',
            });

            // Reset form and close
            setNewIncome("");
            setRolloverChoice(null);
            onClose();
        } catch (error) {
            // Error handled in hook
        }
    };

    const rolloverAmount = rolloverChoice === 'yes' ? remainingBalance : 0;
    const totalAvailable = (parseFloat(newIncome) || 0) + rolloverAmount;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5" />
                        Reset Monthly Budget
                    </DialogTitle>
                    <DialogDescription>
                        Start a new budget period with fresh expenses
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center text-muted-foreground">
                        Loading budget data...
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Current Budget Info */}
                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                                This will archive <strong>{expenseCount}</strong> current expense{expenseCount !== 1 ? 's' : ''} and start fresh.
                                All data will be preserved for history and exports.
                            </AlertDescription>
                        </Alert>

                        {/* Rollover Choice - Only show if there's remaining balance */}
                        {remainingBalance > 0 && (
                            <Alert className={rolloverChoice === null ? "bg-blue-50 border-blue-200" : rolloverChoice === 'yes' ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}>
                                <TrendingUp className={rolloverChoice === null ? "h-4 w-4 text-blue-600" : rolloverChoice === 'yes' ? "h-4 w-4 text-green-600" : "h-4 w-4 text-gray-600"} />
                                <AlertDescription className={rolloverChoice === null ? "text-blue-800" : rolloverChoice === 'yes' ? "text-green-800" : "text-gray-700"}>
                                    {rolloverChoice === null ? (
                                        <div className="space-y-3">
                                            <p>
                                                <strong>Great job!</strong> You have <strong>{currency} {remainingBalance.toLocaleString()}</strong> remaining balance.
                                            </p>
                                            <p className="text-sm">
                                                Would you like to add this amount to your new monthly income?
                                            </p>
                                            <div className="flex gap-2 mt-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => setRolloverChoice('yes')}
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                >
                                                    Yes, Add to Income
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setRolloverChoice('no')}
                                                    className="border-gray-300 hover:bg-gray-100"
                                                >
                                                    No, Start Fresh
                                                </Button>
                                            </div>
                                        </div>
                                    ) : rolloverChoice === 'yes' ? (
                                        <div>
                                            <p>
                                                <strong>Perfect!</strong> Your remaining <strong>{currency} {remainingBalance.toLocaleString()}</strong> will be added to your new budget.
                                            </p>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setRolloverChoice(null)}
                                                className="text-xs mt-2 h-6 px-2"
                                            >
                                                Change choice
                                            </Button>
                                        </div>
                                    ) : (
                                        <div>
                                            <p>
                                                Starting fresh! Your remaining <strong>{currency} {remainingBalance.toLocaleString()}</strong> will not be included.
                                            </p>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setRolloverChoice(null)}
                                                className="text-xs mt-2 h-6 px-2"
                                            >
                                                Change choice
                                            </Button>
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* New Income Input */}
                        <div className="space-y-2">
                            <Label htmlFor="newIncome">New Monthly Income *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {currency}
                                </span>
                                <Input
                                    id="newIncome"
                                    type="number"
                                    placeholder="50000"
                                    value={newIncome}
                                    onChange={(e) => setNewIncome(e.target.value)}
                                    className="pl-14"
                                    min="0"
                                    step="0.01"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Total Available Display */}
                        {newIncome && parseFloat(newIncome) > 0 && (
                            <div className="rounded-lg bg-primary/5 p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">New Income:</span>
                                    <span className="font-medium">{currency} {parseFloat(newIncome).toLocaleString()}</span>
                                </div>
                                {remainingBalance > 0 && rolloverChoice === 'yes' && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Remaining Balance:</span>
                                        <span className="font-medium text-green-600">+ {currency} {remainingBalance.toLocaleString()}</span>
                                    </div>
                                )}
                                {remainingBalance > 0 && rolloverChoice === 'no' && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Remaining Balance:</span>
                                        <span className="font-medium text-gray-400 line-through">{currency} {remainingBalance.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-base font-semibold pt-2 border-t">
                                    <span>Total Available:</span>
                                    <span className="text-primary">{currency} {totalAvailable.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Validation Error */}
                        {validationError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{validationError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="flex-1"
                                disabled={resetBudget.isPending}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                                disabled={
                                    !newIncome ||
                                    parseFloat(newIncome) <= 0 ||
                                    resetBudget.isPending ||
                                    (remainingBalance > 0 && rolloverChoice === null)
                                }
                            >
                                {resetBudget.isPending ? "Resetting..." : "Reset Budget"}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
