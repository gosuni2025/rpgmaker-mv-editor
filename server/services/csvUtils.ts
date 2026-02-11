// RFC 4180 compliant CSV parser/serializer (Google Sheets compatible)

export interface CSVRow {
  [key: string]: string;
}

export function parseCSV(content: string): CSVRow[] {
  // Remove UTF-8 BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!content.trim()) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  // Last field/row
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0];
  const result: CSVRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const obj: CSVRow = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = rows[r][c] ?? '';
    }
    result.push(obj);
  }
  return result;
}

function escapeField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function stringifyCSV(rows: CSVRow[], headers?: string[]): string {
  if (rows.length === 0 && !headers) return '';
  const cols = headers || Object.keys(rows[0] || {});
  const lines: string[] = [];
  lines.push(cols.map(escapeField).join(','));
  for (const row of rows) {
    lines.push(cols.map(c => escapeField(row[c] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}
