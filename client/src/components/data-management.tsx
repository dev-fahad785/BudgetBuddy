import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { storageService } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { generateCSV, downloadCSV, generatePDF } from "@/lib/export-utils";
import { useSettings } from "@/hooks/use-settings";

export default function DataManagement() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const { data: settings } = useSettings();
    const currency = settings?.currency || 'PKR';

    const handleExport = async () => {
        try {
            setLoading(true);
            const json = await storageService.exportData();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `budget-buddy-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({
                title: "Export Successful",
                description: "Your data has been downloaded.",
            });
        } catch (error) {
            toast({
                title: "Export Failed",
                description: "Could not export data.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            setLoading(true);
            const expenses = await storageService.getAllExpenses();
            const categories = await storageService.getCategories();
            const csv = generateCSV(expenses, categories);
            downloadCSV(csv, `budget-buddy-expenses-${new Date().toISOString().slice(0, 10)}.csv`);
            toast({
                title: "Export Successful",
                description: "Expenses exported to CSV.",
            });
        } catch (error) {
            toast({
                title: "Export Failed",
                description: "Could not export to CSV.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        try {
            setLoading(true);
            const expenses = await storageService.getAllExpenses();
            const categories = await storageService.getCategories();
            generatePDF(expenses, categories, currency);
            toast({
                title: "Export Successful",
                description: "Expenses exported to PDF.",
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Export Failed",
                description: "Could not export to PDF.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const text = await file.text();
            await storageService.importData(text);

            toast({
                title: "Import Successful",
                description: "Your data has been restored. Reloading...",
            });

            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            toast({
                title: "Import Failed",
                description: "Invalid backup file or import error.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
            // Reset input
            event.target.value = '';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Backup or restore your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-4">


                    <div className="grid grid-cols-2 gap-2">
                        <Button onClick={handleExportCSV} disabled={loading} variant="outline" className="w-full justify-start">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                            Export CSV
                        </Button>
                        <Button onClick={handleExportPDF} disabled={loading} variant="outline" className="w-full justify-start">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                            Export PDF
                        </Button>
                    </div>

                    <div className="relative">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={loading}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
