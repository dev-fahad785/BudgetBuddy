import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Expense, Category } from "@/types";
import { format, parseISO } from "date-fns";

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateCSV = (expenses: Expense[], categories: Category[]): string => {
  const headers = ["Date", "Category", "Description", "Amount"];
  
  // Sort by date descending
  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date : new Date(a.date);
    const dateB = b.date instanceof Date ? b.date : new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  const rows = sortedExpenses.map((expense) => {
    const category = categories.find((c) => c.id === expense.categoryId);
    const description = (expense.description || "").replace(/"/g, '""');
    
    // Ensure date is properly formatted
    const expenseDate = expense.date instanceof Date ? expense.date : new Date(expense.date);
    const formattedDate = format(expenseDate, "yyyy-MM-dd");
    
    return [
      formattedDate,
      category ? category.name : "Uncategorized",
      `"${description}"`,
      expense.amount,
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
};

interface GroupedExpenses {
  [month: string]: {
    [categoryId: string]: {
      categoryName: string;
      expenses: Expense[];
      total: number;
    };
  };
}

export const generatePDF = async (expenses: Expense[], categories: Category[], currency: string = 'PKR') => {
  const doc = new jsPDF();
  
  // Add logo
  try {
    const logo = await loadImage('/icon.png');
    doc.addImage(logo, 'PNG', 14, 10, 20, 20);
  } catch (error) {
    console.warn('Could not load logo:', error);
  }

  // Header
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text("BudgetBuddy", 40, 20);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Expense Report", 40, 28);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${format(new Date(), "MMMM dd, yyyy")}`, 40, 34);

  let currentY = 45;

  // Group expenses by month and category
  const groupedExpenses: GroupedExpenses = {};
  
  expenses.forEach((expense) => {
    const expenseDate = expense.date instanceof Date ? expense.date : new Date(expense.date);
    const monthKey = format(expenseDate, "yyyy-MM");
    const categoryId = expense.categoryId || 'uncategorized';
    
    if (!groupedExpenses[monthKey]) {
      groupedExpenses[monthKey] = {};
    }
    
    if (!groupedExpenses[monthKey][categoryId]) {
      const category = categories.find((c) => c.id === categoryId);
      groupedExpenses[monthKey][categoryId] = {
        categoryName: category ? category.name : "Uncategorized",
        expenses: [],
        total: 0,
      };
    }
    
    groupedExpenses[monthKey][categoryId].expenses.push(expense);
    groupedExpenses[monthKey][categoryId].total += Number(expense.amount);
  });

  // Sort months in descending order
  const sortedMonths = Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a));

  // Generate tables for each month
  sortedMonths.forEach((monthKey, monthIndex) => {
    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    // Month header
    doc.setFontSize(14);
    doc.setTextColor(41, 128, 185);
    doc.text(format(parseISO(monthKey + "-01"), "MMMM yyyy"), 14, currentY);
    currentY += 8;

    const monthData = groupedExpenses[monthKey];
    const categoryIds = Object.keys(monthData);

    // Calculate month total
    const monthTotal = categoryIds.reduce((sum, catId) => sum + monthData[catId].total, 0);

    // For each category in this month
    categoryIds.forEach((categoryId) => {
      const categoryData = monthData[categoryId];
      
      // Check if we need a new page
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Category subheader
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`${categoryData.categoryName} (${categoryData.expenses.length} transactions)`, 14, currentY);
      currentY += 2;

      // Prepare table data for this category
      const tableRows: any[] = categoryData.expenses.map((expense) => {
        const expenseDate = expense.date instanceof Date ? expense.date : new Date(expense.date);
        return [
          format(expenseDate, "MMM dd, yyyy"),
          expense.description || "-",
          `${currency} ${Number(expense.amount).toLocaleString()}`,
        ];
      });

      // Add category total row
      tableRows.push([
        { content: "Category Total", colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } } as any,
        { content: `${currency} ${categoryData.total.toLocaleString()}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } } as any,
      ]);

      autoTable(doc, {
        head: [["Date", "Description", "Amount"]],
        body: tableRows,
        startY: currentY,
        theme: 'striped',
        headStyles: { 
          fillColor: [41, 128, 185],
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 35, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
    });

    // Month total
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Month Total: ${currency} ${monthTotal.toLocaleString()}`, 14, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 10;
  });

  // Add footer with copyright
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `© ${new Date().getFullYear()} BudgetBuddy. All rights reserved.`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 20,
      doc.internal.pageSize.height - 10,
      { align: 'right' }
    );
  }

  doc.save(`budget-buddy-expenses-${format(new Date(), "yyyy-MM-dd")}.pdf`);
};

// Helper function to load image
const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
};
