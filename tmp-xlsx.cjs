const XLSX = require('xlsx');
const wb = XLSX.readFile('./workoutxlsx.xlsx');
console.log('Sheets:', wb.SheetNames);
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`\n=== Sheet: ${name} (${data.length} rows) ===`);
  if (data.length > 0) console.log('Columns:', Object.keys(data[0]).join(', '));
  data.slice(0, 5).forEach((row, i) => console.log(`Row ${i+1}:`, JSON.stringify(row)));
});
