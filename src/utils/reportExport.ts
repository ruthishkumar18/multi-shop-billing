import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bill, ShopProfile } from '../types';

export interface MonthlyReportData {
  monthName: string;
  monthIndex: number; // 0-11
  year: number;
  profile: ShopProfile;
  bills: Bill[];
}

export function computeMonthlyMetrics(bills: Bill[], monthIndex: number, year: number) {
  // Filter bills for the given month and year
  const monthlyBills = bills.filter(b => {
    const d = new Date(b.bill_date);
    return d.getMonth() === monthIndex && d.getFullYear() === year;
  });

  const completedBills = monthlyBills.filter(b => b.status === 'completed');
  const voidBills = monthlyBills.filter(b => b.status === 'void');

  const totalGross = completedBills.reduce((acc, b) => acc + (b.subtotal || b.grand_total), 0);
  const totalDiscount = completedBills.reduce((acc, b) => acc + (b.discount || 0), 0);
  const totalNetSales = completedBills.reduce((acc, b) => acc + b.grand_total, 0);
  const avgBillValue = completedBills.length > 0 ? totalNetSales / completedBills.length : 0;

  // Payment Breakdown
  const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
  completedBills.forEach(b => {
    const mode = b.payment_mode || 'Cash';
    if (!paymentBreakdown[mode]) {
      paymentBreakdown[mode] = { count: 0, amount: 0 };
    }
    paymentBreakdown[mode].count += 1;
    paymentBreakdown[mode].amount += b.grand_total;
  });

  return {
    monthlyBills,
    completedBills,
    voidBills,
    totalGross,
    totalDiscount,
    totalNetSales,
    avgBillValue,
    paymentBreakdown
  };
}

/**
 * Downloads a professionally formatted CSV file of the Monthly Sales Report
 * Includes metadata header, executive summary KPIs, payment mode split, and detailed invoice register.
 */
export async function exportMonthlySalesCSV(data: MonthlyReportData): Promise<{ filename: string; savedPath?: string }> {
  const { monthName, monthIndex, year, profile, bills } = data;
  const metrics = computeMonthlyMetrics(bills, monthIndex, year);
  const currency = profile.currency_symbol || '₹';

  const rows: string[] = [];

  const sanitize = (text: string | number | undefined | null) => {
    if (text === undefined || text === null) return '""';
    const str = String(text).replace(/"/g, '""');
    return `"${str}"`;
  };

  // 1. Report Header
  rows.push(`"========================================================================================"`);
  rows.push(sanitize(`MONTHLY SALES AUDIT & REVENUE REPORT - ${monthName.toUpperCase()} ${year}`));
  rows.push(sanitize(`Store: ${profile.brand_name} | Owner: ${profile.owner_name}`));
  rows.push(sanitize(`Mobile: ${profile.mobile} ${profile.email ? '| Email: ' + profile.email : ''}`));
  if (profile.address) {
    rows.push(sanitize(`Address: ${profile.address}`));
  }
  rows.push(sanitize(`Generated On: ${new Date().toLocaleString()} | Currency: ${currency}`));
  rows.push(`"========================================================================================"`);
  rows.push('');

  // 2. Executive Summary Metrics
  rows.push(`"EXECUTIVE SALES SUMMARY (${monthName} ${year})"`);
  rows.push(`"Metric","Value"`);
  rows.push(`"Report Period",${sanitize(`${monthName} ${year}`)}`);
  rows.push(`"Total Invoices Generated",${metrics.monthlyBills.length}`);
  rows.push(`"Completed & Paid Invoices",${metrics.completedBills.length}`);
  rows.push(`"Void / Cancelled Invoices",${metrics.voidBills.length}`);
  rows.push(`"Gross Sales Subtotal (${currency})",${metrics.totalGross.toFixed(2)}`);
  rows.push(`"Total Discounts Given (${currency})",${metrics.totalDiscount.toFixed(2)}`);
  rows.push(`"Net Realized Revenue (${currency})",${metrics.totalNetSales.toFixed(2)}`);
  rows.push(`"Average Order Value (${currency})",${metrics.avgBillValue.toFixed(2)}`);
  rows.push('');

  // 3. Payment Mode Breakdown
  rows.push(`"PAYMENT METHODS BREAKDOWN"`);
  rows.push(`"Payment Mode","Invoices Count","Total Revenue (${currency})","Percentage of Net"`);
  Object.entries(metrics.paymentBreakdown).forEach(([mode, info]) => {
    const pct = metrics.totalNetSales > 0 ? ((info.amount / metrics.totalNetSales) * 100).toFixed(1) + '%' : '0%';
    rows.push(`${sanitize(mode)},${info.count},${info.amount.toFixed(2)},${sanitize(pct)}`);
  });
  rows.push('');

  // 4. Detailed Invoices Register
  rows.push(`"DETAILED INVOICE REGISTER"`);
  rows.push([
    '"Bill Number"',
    '"Date"',
    '"Time"',
    '"Customer Name"',
    '"Customer Mobile"',
    '"Payment Mode"',
    '"Items Count"',
    `"Subtotal (${currency})"`,
    `"Discount (${currency})"`,
    `"Grand Total (${currency})"`,
    '"Status"',
    '"Void Reason"'
  ].join(','));

  if (metrics.monthlyBills.length === 0) {
    rows.push(`"No invoices recorded for this month"`);
  } else {
    metrics.monthlyBills.forEach(b => {
      const d = new Date(b.bill_date);
      const dateStr = d.toLocaleDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rows.push([
        sanitize(b.bill_number),
        sanitize(dateStr),
        sanitize(timeStr),
        sanitize(b.buyer_name),
        sanitize(b.buyer_mobile || ''),
        sanitize(b.payment_mode || 'Cash'),
        b.items?.length || 1,
        (b.subtotal || b.grand_total).toFixed(2),
        (b.discount || 0).toFixed(2),
        b.grand_total.toFixed(2),
        sanitize(b.status.toUpperCase()),
        sanitize(b.void_reason || '')
      ].join(','));
    });
  }

  // Prepend UTF-8 BOM so Microsoft Excel renders Unicode currency symbols & characters flawlessly
  const csvContent = '\uFEFF' + rows.join('\r\n');
  const cleanShopName = profile.brand_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `sales_report_${cleanShopName}_${year}_${monthName.toLowerCase()}.csv`;

  // 1. Browser download for web/mobile/tablet
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.warn('Browser download fallback:', err);
  }

  // 2. Direct save to user Downloads folder via Backend for Desktop .exe
  const saveResult = await saveFileToBackend(filename, csvContent, false);
  return {
    filename,
    savedPath: saveResult?.saved_path
  };
}

/**
 * Saves exported file content directly into user's Downloads folder via the backend.
 * Bypasses pywebview/WebView2 restrictions where synthetic <a> downloads are silently blocked.
 */
export async function saveFileToBackend(
  filename: string,
  content: string,
  isBase64: boolean = false,
  openAfter: boolean = false
): Promise<{ success: boolean; saved_path?: string; directory?: string } | null> {
  try {
    const res = await fetch('/api/export/save-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        content,
        is_base64: isBase64,
        open_after: openAfter
      })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Offline or pure client mode
  }
  return null;
}

/**
 * Downloads a high-resolution, formatted PDF Monthly Sales Report using jsPDF & autoTable
 */
export async function exportMonthlySalesPDF(data: MonthlyReportData): Promise<{ filename: string; savedPath?: string }> {
  const { monthName, monthIndex, year, profile, bills } = data;
  const metrics = computeMonthlyMetrics(bills, monthIndex, year);
  const currency = profile.currency_symbol || 'Rs.';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 30;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(30, currentY, pageWidth - 60, 60, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.brand_name.toUpperCase(), 45, currentY + 26);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`MONTHLY SALES AUDIT REPORT · ${monthName.toUpperCase()} ${year}`, 45, currentY + 44);

  currentY += 75;

  // Metadata Row
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.text(`Owner: ${profile.owner_name} | Mobile: ${profile.mobile}`, 30, currentY);
  if (profile.address) {
    currentY += 13;
    doc.text(`Address: ${profile.address}`, 30, currentY);
  }
  currentY += 13;
  doc.text(`Generated: ${new Date().toLocaleString()} | Currency: ${currency}`, 30, currentY);

  currentY += 16;

  // KPI Summary Boxes (4 cards)
  const cardWidth = (pageWidth - 60 - 30) / 4;
  const cardHeight = 44;
  const cards = [
    { label: 'NET REVENUE', value: `${currency} ${metrics.totalNetSales.toFixed(2)}`, color: [16, 185, 129] },
    { label: 'COMPLETED BILLS', value: `${metrics.completedBills.length}`, color: [59, 130, 246] },
    { label: 'TOTAL DISCOUNTS', value: `${currency} ${metrics.totalDiscount.toFixed(2)}`, color: [245, 158, 11] },
    { label: 'AVG ORDER VALUE', value: `${currency} ${metrics.avgBillValue.toFixed(2)}`, color: [139, 92, 246] }
  ];

  cards.forEach((c, idx) => {
    const x = 30 + idx * (cardWidth + 10);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 4, 4, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, x + 8, currentY + 14);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(c.value, x + 8, currentY + 32);
  });

  currentY += cardHeight + 20;

  // Payment Breakdown Mini-Table
  const paymentRows = Object.entries(metrics.paymentBreakdown).map(([mode, info]) => {
    const pct = metrics.totalNetSales > 0 ? ((info.amount / metrics.totalNetSales) * 100).toFixed(1) + '%' : '0%';
    return [mode, `${info.count} bill(s)`, `${currency} ${info.amount.toFixed(2)}`, pct];
  });

  if (paymentRows.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Payment Methods Summary', 30, currentY);
    currentY += 8;

    autoTable(doc, {
      startY: currentY,
      margin: { left: 30, right: 30 },
      head: [['Payment Method', 'Invoices Count', 'Revenue', '% Share']],
      body: paymentRows,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
      styles: { cellPadding: 4 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;
  }

  // Itemized Invoices Table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Invoices Register (${metrics.monthlyBills.length} records)`, 30, currentY);
  currentY += 8;

  const tableRows = metrics.monthlyBills.map((b, idx) => {
    const d = new Date(b.bill_date);
    const dateFormatted = `${d.getDate()}/${d.getMonth() + 1} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return [
      idx + 1,
      b.bill_number,
      dateFormatted,
      b.buyer_name,
      b.buyer_mobile || '—',
      b.payment_mode || 'Cash',
      `${currency} ${b.grand_total.toFixed(2)}`,
      b.status.toUpperCase()
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: 30, right: 30 },
    head: [['#', 'Bill #', 'Date & Time', 'Customer', 'Mobile', 'Mode', 'Amount', 'Status']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 85, fontStyle: 'bold' },
      2: { cellWidth: 70 },
      3: { cellWidth: 95 },
      4: { cellWidth: 65 },
      5: { cellWidth: 50 },
      6: { cellWidth: 65, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 55, halign: 'center' }
    },
    foot: [
      ['', 'MONTHLY TOTALS', '', '', '', `${metrics.completedBills.length} Paid`, `${currency} ${metrics.totalNetSales.toFixed(2)}`, '']
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8
    },
    styles: { cellPadding: 4 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 30;

  // Authorized Signatory Line
  if (finalY + 40 < doc.internal.pageSize.getHeight()) {
    doc.setDrawColor(203, 213, 225);
    doc.line(pageWidth - 180, finalY + 25, pageWidth - 40, finalY + 25);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signature & Stamp', pageWidth - 160, finalY + 37);
  }

  const cleanShopName = profile.brand_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `sales_report_${cleanShopName}_${year}_${monthName.toLowerCase()}.pdf`;

  // 1. Browser download
  try {
    doc.save(filename);
  } catch (err) {
    console.warn('Browser doc.save fallback:', err);
  }

  // 2. Direct save to user Downloads folder via Backend for Desktop .exe
  const pdfBase64 = doc.output('datauristring');
  const saveResult = await saveFileToBackend(filename, pdfBase64, true);

  return {
    filename,
    savedPath: saveResult?.saved_path
  };
}

/**
 * Generates and downloads a clean, professional PDF Tax Invoice for any bill.
 * Works seamlessly in both web browsers and compiled Windows Desktop .exe.
 */
export async function exportInvoicePDF(
  bill: Bill,
  profile: ShopProfile
): Promise<{ filename: string; savedPath?: string }> {
  const currency = profile.currency_symbol || 'Rs.';
  const filename = `invoice_${bill.bill_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 36;

  // Header Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(36, currentY, pageWidth - 72, 60, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.brand_name, 50, currentY + 26);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  const contactText = [profile.mobile ? `Tel: ${profile.mobile}` : '', profile.email || ''].filter(Boolean).join(' | ');
  doc.text(contactText || 'Retail Store Billing & Invoice', 50, currentY + 44);

  doc.setTextColor(56, 189, 248); // sky-400
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth - 50, currentY + 26, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(bill.bill_number, pageWidth - 50, currentY + 44, { align: 'right' });

  currentY += 76;

  // Store Address & Bill Details Row
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FROM:', 36, currentY);
  doc.text('BILLED TO:', 220, currentY);
  doc.text('INVOICE DETAILS:', pageWidth - 160, currentY);

  currentY += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  // Store info
  if (profile.address) {
    const addressLines = doc.splitTextToSize(profile.address, 160);
    doc.text(addressLines, 36, currentY);
  } else {
    doc.text('Store Outlet', 36, currentY);
  }

  // Buyer info
  doc.setFont('helvetica', 'bold');
  doc.text(bill.buyer_name, 220, currentY);
  doc.setFont('helvetica', 'normal');
  if (bill.buyer_mobile) {
    doc.text(`Mobile: ${bill.buyer_mobile}`, 220, currentY + 14);
  }

  // Date / Mode info
  const billDate = new Date(bill.bill_date);
  doc.text(`Date: ${billDate.toLocaleDateString()}`, pageWidth - 160, currentY);
  doc.text(`Time: ${billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 160, currentY + 14);
  doc.text(`Payment: ${bill.payment_mode || 'Cash'}`, pageWidth - 160, currentY + 28);
  if (bill.status === 'void') {
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.text('STATUS: VOID / CANCELLED', pageWidth - 160, currentY + 42);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
  }

  currentY += 56;

  // Items Table
  const tableRows = (bill.items || []).map((item, idx) => [
    idx + 1,
    item.product_name,
    `${item.quantity} ${item.unit || 'pcs'}`,
    `${currency} ${Number(item.unit_price).toFixed(2)}`,
    `${currency} ${Number(item.amount).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: 36, right: 36 },
    head: [['#', 'Item Description', 'Qty & Unit', 'Unit Price', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 80, halign: 'right' },
      3: { cellWidth: 80, halign: 'right' },
      4: { cellWidth: 85, halign: 'right', fontStyle: 'bold' }
    },
    styles: { cellPadding: 6, fontSize: 8.5 }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 16;

  // Totals Box
  const totalsBoxX = pageWidth - 220;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsBoxX, finalY, 184, bill.discount > 0 ? 70 : 52, 4, 4, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', totalsBoxX + 12, finalY + 18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${currency} ${Number(bill.subtotal || bill.grand_total).toFixed(2)}`, totalsBoxX + 172, finalY + 18, { align: 'right' });

  if (bill.discount > 0) {
    doc.setTextColor(16, 185, 129);
    doc.text('Discount:', totalsBoxX + 12, finalY + 34);
    doc.text(`-${currency} ${Number(bill.discount).toFixed(2)}`, totalsBoxX + 172, finalY + 34, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Grand Total:', totalsBoxX + 12, finalY + 54);
    doc.text(`${currency} ${Number(bill.grand_total).toFixed(2)}`, totalsBoxX + 172, finalY + 54, { align: 'right' });
    finalY += 80;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Grand Total:', totalsBoxX + 12, finalY + 38);
    doc.text(`${currency} ${Number(bill.grand_total).toFixed(2)}`, totalsBoxX + 172, finalY + 38, { align: 'right' });
    finalY += 62;
  }

  // Terms & Conditions / Footer
  if (profile.terms_conditions && finalY + 40 < doc.internal.pageSize.getHeight()) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('TERMS & CONDITIONS:', 36, finalY);
    doc.setFont('helvetica', 'normal');
    const terms = doc.splitTextToSize(profile.terms_conditions, pageWidth - 72);
    doc.text(terms, 36, finalY + 10);
    finalY += 24;
  }

  // Footer text
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const footerMsg = profile.bill_footer || 'Thank you for your purchase!';
  doc.text(footerMsg, pageWidth / 2, doc.internal.pageSize.getHeight() - 25, { align: 'center' });

  // 1. Browser download
  try {
    doc.save(filename);
  } catch (err) {
    console.warn('Browser doc.save fallback:', err);
  }

  // 2. Direct save to user Downloads folder via Backend for Desktop .exe
  const pdfBase64 = doc.output('datauristring');
  const saveResult = await saveFileToBackend(filename, pdfBase64, true);

  return {
    filename,
    savedPath: saveResult?.saved_path
  };
}
