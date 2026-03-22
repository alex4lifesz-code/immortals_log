const XLSX = require('xlsx');
const wb = XLSX.readFile('./workoutxlsx.xlsx');
const ws = wb.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws, { defval: null });

// Show all unique exercise names
const names = [...new Set(data.map(r => r.judy))].sort();
console.log('Unique exercise names:', JSON.stringify(names, null, 2));

// Show date range
const dates = [...new Set(data.map(r => r.Date))].sort();
const toDate = n => {
  const d = new Date(Math.round((n - 25569) * 86400 * 1000));
  return d.toISOString().split('T')[0];
};
console.log('\nDate range:', toDate(dates[0]), 'to', toDate(dates[dates.length-1]));
console.log('Unique dates:', dates.length);

// Show all rows
data.forEach((r, i) => console.log(`${toDate(r.Date)} | ${r.judy} | W:${r.W1}/${r.W2}/${r.W3} R:${r.R1}/${r.R2}/${r.R3} | ${r.Notes||''}`));
