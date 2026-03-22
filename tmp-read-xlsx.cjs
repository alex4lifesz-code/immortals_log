const XLSX = require('xlsx');
const wb = XLSX.readFile('alexworkout.xlsx');
console.log('Sheet names:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log('\n=== ' + name + ' (' + data.length + ' rows) ===');
  data.forEach((r, i) => console.log(i, JSON.stringify(r)));
}
