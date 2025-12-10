import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, DollarSign } from "lucide-react";
import { storageService } from "@/lib/storage";
import { useCreateBudget } from "@/hooks/use-budget";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";

interface MonthlyIncomeModalProps {
    isOpen: boolean;
    currentMonth: string;
    onComplete: () => void;
}

export function MonthlyIncomeModal({ isOpen, currentMonth, onComplete }: MonthlyIncomeModalProps) {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const createBudget = useCreateBudget();
    const { data: settings } = useSettings();
    const currency = settings?.currency || 'PKR';

    const [income, setIncome] = useState("");
    const [loading, setLoading] = useState(true);
    const [rolloverData, setRolloverData] = useState<{
        rollover: number;
        wasOverspent: boolean;
        remaining: number;
    } | null>(null);
    const [previousAllocated, setPreviousAllocated] = useState(0);
    const [validationError, setValidationError] = useState("");
    const [rolloverChoice, setRolloverChoice] = useState<'yes' | 'no' | null>(null);

    // Format month for display
    const monthDisplay = new Date(currentMonth + "-01").toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    useEffect(() => {
        async function loadPreviousMonthData() {
            setLoading(true);
            try {
                const rollover = await storageService.calculatePreviousMonthRemaining(currentMonth);
                const allocated = await storageService.getPreviousMonthTotalAllocated(currentMonth);

                setRolloverData(rollover);
                setPreviousAllocated(allocated);
            } catch (error) {
                console.error("Failed to load previous month data:", error);
            } finally {
                setLoading(false);
            }
        }

        if (isOpen) {
            loadPreviousMonthData();
        }
    }, [isOpen, currentMonth]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError("");

        const incomeAmount = parseFloat(income);
        if (!income || incomeAmount <= 0) {
            setValidationError("Please enter a valid income amount");
            return;
        }

        const rolloverAmount = rolloverChoice === 'yes' ? (rolloverData?.rollover || 0) : 0;
        const totalAvailable = incomeAmount + rolloverAmount;

        // Check if income is less than previous allocations
        if (previousAllocated > 0 && totalAvailable < previousAllocated) {
            setValidationError(
                `Your total available amount (${totalAvailable.toLocaleString()}) is less than your previous month's allocations (${previousAllocated.toLocaleString()}). Please reallocate your budget.`
            );

            // Create budget and redirect to budget setup for reallocation
            try {
                await createBudget.mutateAsync({
                    monthlyIncome: income,
                    month: currentMonth,
                });

                toast({
                    title: "Budget Created",
                    description: "Please reallocate your budget to match your new income.",
                });

                setLocation("/budget-setup");
                onComplete();
            } catch (error) {
                toast({
                    title: "Error",
                    description: "Failed to create budget. Please try again.",
                    variant: "destructive",
                });
            }
            return;
        }

        // Create budget with rollover
        try {
            const newBudget = await storageService.createBudgetWithRollover({
                monthlyIncome: income,
                month: currentMonth,
                includeRollover: rolloverChoice === 'yes',
            });

            // If same or more income, copy previous allocations
            if (previousAllocated > 0 && totalAvailable >= previousAllocated) {
                // Get previous month
                const [year, monthNum] = currentMonth.split('-').map(Number);
                const prevDate = new Date(year, monthNum - 2, 1);
                const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

                const prevBudget = await storageService.getBudget(prevMonth);
                if (prevBudget) {
                    await storageService.copyAllocations(prevBudget.id, newBudget.id);
                }
            }

            toast({
                title: "Budget Created",
                description: `Your budget for ${monthDisplay} has been set up successfully!`,
            });

            onComplete();
        } catch (error) {
            console.error("Failed to create budget:", error);
            toast({
                title: "Error",
                description: "Failed to create budget. Please try again.",
                variant: "destructive",
            });
        }
    };

    const rolloverAmount = rolloverChoice === 'yes' ? (rolloverData?.rollover || 0) : 0;
    const totalAvailable = (parseFloat(income) || 0) + rolloverAmount;

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Set Income for {monthDisplay}
                    </DialogTitle>
                    <DialogDescription>
                        Enter your monthly income to set up your budget
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center text-muted-foreground">
                        Loading previous month data...
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Rollover Information */}
                        {rolloverData && rolloverData.rollover > 0 && (
                            <Alert className={rolloverChoice === null ? "bg-blue-50 border-blue-200" : rolloverChoice === 'yes' ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}>
                                <TrendingUp className={rolloverChoice === null ? "h-4 w-4 text-blue-600" : rolloverChoice === 'yes' ? "h-4 w-4 text-green-600" : "h-4 w-4 text-gray-600"} />
                                <AlertDescription className={rolloverChoice === null ? "text-blue-800" : rolloverChoice === 'yes' ? "text-green-800" : "text-gray-700"}>
                                    {rolloverChoice === null ? (
                                        <div className="space-y-3">
                                            <p>
                                                <strong>Great job!</strong> You have <strong>{currency} {rolloverData.rollover.toLocaleString()}</strong> remaining from last month.
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
                                                <strong>Perfect!</strong> Your remaining <strong>{currency} {rolloverData.rollover.toLocaleString()}</strong> will be added to your new budget.
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
                                                Starting fresh! Your previous savings of <strong>{currency} {rolloverData.rollover.toLocaleString()}</strong> will not be included.
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

                        {/* Overspending Warning */}
                        {rolloverData && rolloverData.wasOverspent && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    You overspent by {currency} {Math.abs(rolloverData.remaining).toLocaleString()} last month. Starting fresh this month!
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Income Input */}
                        <div className="space-y-2">
                            <Label htmlFor="income">Monthly Income *</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {currency}
                                </span>
                                <Input
                                    id="income"
                                    type="number"
                                    placeholder="50000"
                                    value={income}
                                    onChange={(e) => setIncome(e.target.value)}
                                    className="pl-14"
                                    min="0"
                                    step="0.01"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Total Available Display */}
                        {income && parseFloat(income) > 0 && (
                            <div className="rounded-lg bg-primary/5 p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">New Income:</span>
                                    <span className="font-medium">{currency} {parseFloat(income).toLocaleString()}</span>
                                </div>
                                {rolloverData && rolloverData.rollover > 0 && rolloverChoice === 'yes' && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Previous Rollover:</span>
                                        <span className="font-medium text-green-600">+ {currency} {rolloverData.rollover.toLocaleString()}</span>
                                    </div>
                                )}
                                {rolloverData && rolloverData.rollover > 0 && rolloverChoice === 'no' && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Previous Rollover:</span>
                                        <span className="font-medium text-gray-400 line-through">{currency} {rolloverData.rollover.toLocaleString()}</span>
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

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={!income || parseFloat(income) <= 0 || createBudget.isPending || (rolloverData && rolloverData.rollover > 0 && rolloverChoice === null)}
                        >
                            {createBudget.isPending ? "Creating Budget..." : "Continue"}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
