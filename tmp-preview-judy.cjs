const XLSX = require('xlsx');
const wb = XLSX.readFile('./judyworkout.xlsx');
console.log('Sheets:', wb.SheetNames);
for (const n of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null });
  console.log(`\\n${n}: ${rows.length} rows`);
  if (rows.length) {
    console.log('Columns:', Object.keys(rows[0]).join(', '));
    console.log('First row:', JSON.stringify(rows[0]));
  }
}
