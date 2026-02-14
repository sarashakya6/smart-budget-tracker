import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, Account, Category } from '../types';

interface ExportContext {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  currency: string;
  dateRangeTitle: string;
}

// Utility for safe UUID generation (works in all contexts)
const generateUUID = () => {
    // Try crypto.randomUUID first, wrapped in try-catch because it throws in insecure contexts
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {
        // Fallback if crypto throws
    }
    
    // Manual fallback (UUID v4)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// === EXCEL EXPORT ===
export const exportToExcel = ({ transactions, accounts, categories, currency, dateRangeTitle }: ExportContext) => {
  try {
    let runningBalance = 0;
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const rows = sortedTx.map(t => {
      const isIncome = t.type === 'income';
      const isExpense = t.type === 'expense';
      const isTransfer = t.type === 'transfer';
      
      let amountChange = 0;
      if (isIncome) amountChange = t.amount;
      else if (isExpense) amountChange = -t.amount;
      
      runningBalance += amountChange;

      return {
        'Date': new Date(t.date).toLocaleDateString(),
        'Description': t.note || (isTransfer ? 'Transfer' : 'Transaction'),
        'Category': t.categoryId ? categories.find(c => c.id === t.categoryId)?.name : (isTransfer ? 'Transfer' : '-'),
        'SubCategory': t.subCategory || '-',
        'Account': t.accountId ? accounts.find(a => a.id === t.accountId)?.name : '-',
        'Income': isIncome ? t.amount : '',
        'Expenses': isExpense ? t.amount : '',
        'Balance': runningBalance
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows, { origin: 'A5' }); 

    XLSX.utils.sheet_add_aoa(ws, [
      [`Transaction Report`],
      [`Period: ${dateRangeTitle}`],
      [`Generated on: ${new Date().toLocaleString()}`],
      ['']
    ], { origin: 'A1' });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    
    XLSX.writeFile(wb, `SmartBudget_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    return true;
  } catch (e) {
    console.error("Excel Export Error", e);
    return false;
  }
};

// === PDF EXPORT ===
export const exportToPDF = ({ transactions, accounts, categories, currency, dateRangeTitle }: ExportContext) => {
  try {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(`Transaction Report`, 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${dateRangeTitle}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const net = totalIncome - totalExpense;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Income: ${currency} ${totalIncome.toFixed(2)}`, 14, 45);
    doc.text(`Total Expense: ${currency} ${totalExpense.toFixed(2)}`, 80, 45);
    doc.text(`Net Balance: ${currency} ${net.toFixed(2)}`, 150, 45);

    let runningBalance = 0;
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const tableData = sortedTx.map(t => {
      const isIncome = t.type === 'income';
      const isExpense = t.type === 'expense';
      if (isIncome) runningBalance += t.amount;
      else if (isExpense) runningBalance -= t.amount;

      return [
        new Date(t.date).toLocaleDateString(),
        t.note || t.type,
        (categories.find(c => c.id === t.categoryId)?.name || '-') + (t.subCategory ? ` / ${t.subCategory}` : ''),
        isIncome ? `${currency} ${t.amount.toFixed(2)}` : '',
        isExpense ? `${currency} ${t.amount.toFixed(2)}` : '',
        `${currency} ${runningBalance.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Description', 'Category', 'Income', 'Expense', 'Balance']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 25 },
        3: { halign: 'right', textColor: [22, 163, 74] },
        4: { halign: 'right', textColor: [220, 38, 38] },
        5: { halign: 'right', fontStyle: 'bold' },
      }
    });

    doc.save(`SmartBudget_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    return true;
  } catch (e) {
    console.error("PDF Export Error", e);
    return false;
  }
};

// === EXCEL IMPORT ===
export const parseExcelImport = async (file: File, categories: Category[], accounts: Account[]): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        let headerRowIndex = 0;
        
        for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
            const row = (rawRows[i] || []).map(c => String(c).toLowerCase());
            if (row.includes('income') || row.includes('expenses') || row.includes('amount') || row.includes('category')) {
                headerRowIndex = i;
                break;
            }
        }

        const jsonData = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });

        const parsedTransactions: Transaction[] = jsonData.map((row: any) => {
            let amount = 0;
            let type: any = 'expense';

            if (row['Income'] && !isNaN(parseFloat(row['Income'])) && parseFloat(row['Income']) !== 0) {
                amount = parseFloat(row['Income']);
                type = 'income';
            } else if (row['Expenses'] && !isNaN(parseFloat(row['Expenses'])) && parseFloat(row['Expenses']) !== 0) {
                amount = parseFloat(row['Expenses']);
                type = 'expense';
            } else if (row['Amount']) {
                amount = parseFloat(row['Amount']);
                const typeStr = String(row['Type'] || '').toLowerCase();
                if (typeStr.includes('income')) type = 'income';
                else if (typeStr.includes('transfer')) type = 'transfer';
                else type = 'expense';
            }

            const note = row['Description'] || row['Note'] || '';
            const categoryName = String(row['Category'] || '').trim(); // Added trim()
            const subCategoryName = String(row['SubCategory'] || '').trim(); // Added trim()
            const accountName = String(row['Account'] || '').trim(); // Added trim()

            // Map Category Name to ID
            const foundCategory = categories.find(c => 
              c.name.toLowerCase() === categoryName.toLowerCase() && c.type === type
            );

            // Map Account Name to ID
            const foundAccount = accounts.find(a => 
              a.name.toLowerCase() === accountName.toLowerCase()
            );

            let date = new Date().toISOString();
            if (row['Date']) {
                const parsedDate = new Date(row['Date']);
                if (!isNaN(parsedDate.getTime())) {
                    date = parsedDate.toISOString();
                }
            }

            return {
                id: generateUUID(),
                date,
                amount: Math.abs(amount),
                type,
                note,
                categoryId: foundCategory?.id,
                subCategory: subCategoryName,
                accountId: foundAccount?.id || accounts[0]?.id,
            } as Transaction;
        });
        
        resolve(parsedTransactions.filter(t => t.amount > 0));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};