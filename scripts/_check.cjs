fetch('http://localhost:3000/api/exercise-library')
  .then(r => r.json())
  .then(d => {
    for (const e of d.exercises || []) {
      console.log(e.name, '/', e.wuxiaName, '/', e.type, '/', e.wuxiaType, '/', e.difficulty, '/', e.wuxiaDifficulty);
    }
  })
  .catch(e => console.error(e));
