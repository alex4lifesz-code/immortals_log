const r = await fetch('http://localhost:3000/api/exercise-library');
const d = await r.json();
for (const e of d.exercises || []) {
  console.log(e.name, '/', e.wuxiaName, '/', e.type, '/', e.wuxiaType, '/', e.difficulty, '/', e.wuxiaDifficulty, '/', e.category);
}
