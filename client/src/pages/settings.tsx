import { useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useBudget } from "@/hooks/use-budget";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import DataManagement from "@/components/data-management";
import { ResetBudgetModal } from "@/components/reset-budget-modal";
import BottomNavigation from "@/components/bottom-navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Link } from "wouter";

const CURRENCIES = [
    { code: "PKR", symbol: "PKR", name: "Pakistani Rupee" },
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
];

export default function Settings() {
    const { data: settings } = useSettings();
    const updateSettings = useUpdateSettings();
    const { data: currentBudget } = useBudget();
    const [resetModalOpen, setResetModalOpen] = useState(false);

    const handleCurrencyChange = (value: string) => {
        updateSettings.mutate({ currency: value });
    };

    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7);

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="bg-card border-b border-border sticky top-0 z-40">
                <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/">
                        <ArrowLeft className="w-6 h-6 cursor-pointer" />
                    </Link>
                    <h1 className="font-semibold text-lg">Settings</h1>
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 mt-6 space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="space-y-1">
                            <CardTitle>Preferences</CardTitle>
                            <CardDescription>Customize your experience</CardDescription>
                        </div>
                        <ModeToggle />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Select
                                value={settings?.currency || "PKR"}
                                onValueChange={handleCurrencyChange}
                            >
                                <SelectTrigger id="currency">
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CURRENCIES.map((c) => (
                                        <SelectItem key={c.code} value={c.code}>
                                            {c.name} ({c.symbol})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Budget Management Card */}
                {currentBudget && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Budget Management</CardTitle>
                            <CardDescription>
                                Manage your current monthly budget
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={() => setResetModalOpen(true)}
                                variant="outline"
                                className="w-full"
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reset Monthly Budget
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                                Start a new budget period when your salary arrives. Current expenses will be archived for history.
                            </p>
                        </CardContent>
                    </Card>
                )}

                <DataManagement />
            </div>

            <BottomNavigation />

            {/* Reset Budget Modal */}
            {currentBudget && (
                <ResetBudgetModal
                    isOpen={resetModalOpen}
                    onClose={() => setResetModalOpen(false)}
                    budgetId={currentBudget.id}
                />
            )}
        </div>
    );
}
