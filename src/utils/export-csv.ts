/**
 * Universal CSV Export Utility with UTF-8 BOM for Arabic language support in Microsoft Excel.
 */

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
) {
  if (typeof window === "undefined") return;

  // \uFEFF is UTF-8 Byte Order Mark (BOM) ensuring Excel displays Arabic characters properly
  const bom = "\uFEFF";

  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows: string[] = [];

  // 1. Headers
  csvRows.push(headers.map(escapeCell).join(","));

  // 2. Data rows
  for (const row of rows) {
    csvRows.push(row.map(escapeCell).join(","));
  }

  const csvContent = csvRows.join("\r\n");
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cleanFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", cleanFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
