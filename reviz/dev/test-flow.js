// Test de bout en bout avec services Google/Telegram/Gemini simulés : node dev/test-flow.js
const fs = require('fs'), assert = require('assert');
const load = require('./harness');
const exemple = fs.readFileSync(__dirname + '/../exemple/fiche-guerre-froide.json', 'utf8');

let now = 1e12;
const sent = [], geminiCalls = [];
let geminiQueue = [];
const sheets = { queue: [[]], index: [[]] };
const props = { TELEGRAM_TOKEN: 'T', GEMINI_API_KEY: 'G', ALLOWED_CHAT_IDS: '42', SPREADSHEET_ID: 'S', ROOT_FOLDER_ID: 'R' };
const cache = {};

function sheet(name) {
  const d = sheets[name];
  return {
    appendRow: (r) => d.push(r.slice()),
    getLastRow: () => d.length,
    getRange: (row, col, nr, nc) => ({
      getValues: () => d.slice(row - 1, row - 1 + nr).map((r) => Array.from({ length: nc }, (_, i) => r[col - 1 + i] ?? '')),
      setValue: (v) => { d[row - 1][col - 1] = v; }
    })
  };
}
function blob(bytes, type) {
  let name = '';
  return { getBytes: () => bytes, getContentType: () => type, setContentType(t) { type = t; return this; },
    setName(n) { name = n; return this; }, getName: () => name, getDataAsString: () => bytes.toString() };
}
const folder = { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => folder,
  createFile: () => ({ getUrl: () => 'https://drive/file' }), getUrl: () => 'https://drive/folder' };

const gs = load({
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: sheet }) },
  DriveApp: { getFolderById: () => folder },
  ContentService: { createTextOutput: (t) => t },
  MimeType: { PLAIN_TEXT: 'text/plain' },
  Utilities: {
    sleep: () => {}, base64Encode: (b) => Buffer.from(b).toString('base64'),
    formatDate: () => '23/09/2026', newBlob: (s, t, n) => blob(Buffer.from(s), t).setName(n)
  },
  UrlFetchApp: {
    fetch(url, opt) {
      if (url.includes('generativelanguage')) {
        geminiCalls.push(JSON.parse(opt.payload));
        const [code, body] = geminiQueue.shift();
        return { getResponseCode: () => code, getContentText: () => body };
      }
      if (url.includes('/file/bot')) return { getBlob: () => blob(Buffer.from('img'), 'image/jpeg') };
      const method = url.split('/').pop();
      sent.push({ method, ...opt.payload });
      const result = method === 'getFile' ? { file_path: 'photos/x.jpg' } : {};
      return { getContentText: () => JSON.stringify({ ok: true, result }) };
    }
  }
});
require("vm").runInContext("Date", gs).now = () => now;
const ok = (json) => [200, JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: json }] } }] })];
const post = (u) => gs.doPost({ postData: { contents: JSON.stringify(u) } });
const msgs = (m) => sent.filter((s) => s.method === m);
const statuts = () => sheets.queue.slice(1).map((r) => r[9]);

// 1. Album de 2 photos, légende sur la première ; Telegram renvoie un doublon.
post({ update_id: 1, message: { message_id: 10, chat: { id: 42 }, media_group_id: 'A', caption: 'Histoire - La Guerre froide', photo: [{ file_id: 'p1s' }, { file_id: 'p1' }] } });
post({ update_id: 2, message: { message_id: 11, chat: { id: 42 }, media_group_id: 'A', photo: [{ file_id: 'p2' }] } });
post({ update_id: 2, message: { message_id: 11, chat: { id: 42 }, media_group_id: 'A', photo: [{ file_id: 'p2' }] } });
assert.strictEqual(sheets.queue.length, 3, 'doublon ignoré');
assert.strictEqual(msgs('sendMessage').length, 1, 'un seul accusé par album');
assert.strictEqual(sheets.queue[1][6], 'p1', 'plus grande taille de photo');

// 2. Trop tôt : l'album n'est pas considéré comme complet.
gs.processQueue();
assert.strictEqual(geminiCalls.length, 0);

// 3. Après 31 s : 429 puis succès.
now += 31000;
geminiQueue = [[429, '{"error":"quota"}'], ok(exemple)];
gs.processQueue();
assert.strictEqual(geminiCalls.length, 2, 'réessai après 429');
assert.strictEqual(geminiCalls[1].contents[0].parts.filter((p) => p.inlineData).length, 2, '2 photos envoyées');
const doc = msgs('sendDocument')[0];
assert.ok(doc && doc.document.getName() === 'Histoire - La Guerre froide.html');
assert.ok(doc.document.getDataAsString().includes('5 choses à retenir'));
assert.deepStrictEqual(statuts(), ['fait', 'fait']);
assert.strictEqual(sheets.index.length, 2);

// 4. Photo sans légende → question → réponse texte → fiche.
post({ update_id: 3, message: { message_id: 12, chat: { id: 42 }, photo: [{ file_id: 'p3' }] } });
gs.processQueue();
assert.ok(msgs('sendMessage').pop().text.startsWith('Pour quelle matière'));
post({ update_id: 4, message: { message_id: 13, chat: { id: 42 }, text: 'Physique-Chimie - Les ondes' } });
geminiQueue = [ok(exemple)];
gs.processQueue(); // applique la légende…
gs.processQueue(); // …(déjà traité dans la même exécution si possible)
assert.strictEqual(msgs('sendDocument').length, 2);
assert.strictEqual(msgs('sendDocument')[1].document.getName(), 'Physique-Chimie - Les ondes.html');

// 5. JSON invalide 4 fois de suite → 3 exécutions puis message d'échec.
post({ update_id: 5, message: { message_id: 14, chat: { id: 42 }, caption: 'Maths - Suites', photo: [{ file_id: 'p4' }] } });
for (let i = 0; i < 3; i++) { geminiQueue = [ok('{tronqué'), ok('{'), ok('{'), ok('{')]; gs.processQueue(); }
assert.ok(msgs('sendMessage').pop().text.includes('pas réussi'));
assert.strictEqual(statuts().pop(), 'erreur');

// 6. Inconnu → reçoit son identifiant ; /aide.
post({ update_id: 6, message: { message_id: 1, chat: { id: 7 }, text: 'salut' } });
assert.ok(msgs('sendMessage').pop().text.includes('7'));
post({ update_id: 7, message: { message_id: 15, chat: { id: 42 }, text: '/aide' } });
assert.ok(msgs('sendMessage').pop().text.includes('Matière - Chapitre'));

// 7. Légendes.
const p = (s) => JSON.stringify(gs.parseLegende_(s));
assert.strictEqual(p('histoire - la guerre froide'), '{"matiere":"Histoire","chapitre":"La guerre froide"}');
assert.strictEqual(p('Physique-Chimie - Les ondes'), '{"matiere":"Physique-Chimie","chapitre":"Les ondes"}');
assert.strictEqual(p('SVT: La cellule'), '{"matiere":"SVT","chapitre":"La cellule"}');
assert.strictEqual(gs.parseLegende_('mon cours'), null);

// 8. Pas d'injection HTML depuis le contenu du modèle.
const html = gs.fillTemplate_('{{FICHE}}|{{DATA}}', { matiere: 'X', chapitre: 'Y',
  fiche: { resume: '<img src=x onerror=alert(1)> {{DATA}}', notions: [], definitions: [], reperes: [], exemples: [], a_retenir: ['</script>'] } });
assert.ok(!html.includes('<img') && !html.includes('</script>') && html.includes('{{DATA}}'));

console.log('✅ tous les tests passent');
