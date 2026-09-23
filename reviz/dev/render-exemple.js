// node dev/render-exemple.js exemple/fiche.json > exemple/fiche.html
const fs = require('fs');
const gs = require('./harness')();
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
Object.assign(data, { matiere: data.matiere || 'Histoire', chapitre: data.chapitre || 'La Guerre froide', date: data.date || '23/09/2026' });
process.stdout.write(gs.renderHtml(data));
