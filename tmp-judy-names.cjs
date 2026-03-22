const XLSX = require('xlsx');
const wb = XLSX.readFile('./judyworkout.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: null });
const names = [...new Set(rows.map(r => String(r.judy || '').trim()))].sort();
console.log('Unique names:', JSON.stringify(names, null, 2));
