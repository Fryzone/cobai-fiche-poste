/**
 * File d'attente (feuille « queue ») + traitement par le déclencheur minute.
 * Un seul chapitre par exécution, protégé par un verrou.
 */
var QUEUE_COLS = ['update_id', 'recu_le', 'chat_id', 'message_id', 'groupe', 'type',
                  'file_id', 'mime', 'legende', 'statut', 'essais'];
var ALBUM_ATTENTE_MS = 30 * 1000; // laisser à l'album le temps d'arriver en entier
var MAX_ESSAIS = 3;

function enqueue_(item) {
  queueSheet_().appendRow([
    item.updateId, Date.now(), item.chatId, item.messageId, item.group, item.type,
    item.fileId || '', item.mime || '', texteSur_(item.legende), 'nouveau', 0
  ]);
}

/** Déclencheur toutes les minutes (créé par setup()). */
function processQueue() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // un traitement est déjà en cours
  try {
    var rows = readQueue_();
    if (!rows.length) return;
    traiterReponsesTexte_(rows);
    traiterUnChapitre_(rows);
  } finally {
    lock.releaseLock();
  }
}

/** Les messages texte servent à donner la légende d'un album qui n'en avait pas. */
function traiterReponsesTexte_(rows) {
  rows.filter(function (r) { return r.type === 'texte' && r.statut === 'nouveau'; })
    .forEach(function (t) {
      var enAttente = rows.filter(function (r) {
        return r.chatId === t.chatId && r.statut === 'attente_legende';
      });
      var parsed = parseLegende_(t.legende);
      if (enAttente.length && parsed) {
        enAttente.forEach(function (r) {
          r.legende = t.legende;
          setStatut_(r, 'nouveau', { legende: t.legende });
        });
      } else if (enAttente.length) {
        sendMessage(t.chatId, 'Je n\'ai pas compris 🤔 Écris-moi : Matière - Chapitre\n' +
          'Exemple : Histoire - La Guerre froide');
      } else {
        sendMessage(t.chatId, AIDE_TEXTE);
      }
      setStatut_(t, 'fait');
    });
}

function traiterUnChapitre_(rows) {
  var groupes = {};
  var ordre = [];
  rows.forEach(function (r) {
    if (r.type !== 'photo' || r.statut !== 'nouveau') return;
    if (!groupes[r.groupe]) { groupes[r.groupe] = []; ordre.push(r.groupe); }
    groupes[r.groupe].push(r);
  });

  for (var i = 0; i < ordre.length; i++) {
    var g = groupes[ordre[i]];
    var dernier = Math.max.apply(null, g.map(function (r) { return r.recuLe; }));
    var estAlbum = ordre[i].indexOf('album_') === 0;
    if (estAlbum && Date.now() - dernier < ALBUM_ATTENTE_MS) continue; // album incomplet

    var legende = g.map(function (r) { return r.legende; }).filter(String)[0] || '';
    var parsed = parseLegende_(legende);
    if (!parsed) {
      g.forEach(function (r) { setStatut_(r, 'attente_legende'); });
      sendMessage(g[0].chatId, 'Pour quelle matière et quel chapitre ? 📚\n' +
        'Réponds par exemple : Histoire - La Guerre froide');
      continue; // demander est rapide : on peut passer au groupe suivant
    }

    traiterGroupe_(g, parsed);
    return; // un seul chapitre par exécution (limite de 6 min)
  }
}

function traiterGroupe_(g, parsed) {
  var chatId = g[0].chatId;
  if (g[0].essais >= MAX_ESSAIS) { // exécutions précédentes interrompues (délai dépassé)
    g.forEach(function (r) { setStatut_(r, 'erreur'); });
    sendMessage(chatId, '😕 Je n\'ai pas réussi à faire la fiche « ' + parsed.chapitre + ' ». ' +
      'Essaie avec moins de photos à la fois.');
    return;
  }
  var essais = g[0].essais + 1;
  g.forEach(function (r) { setStatut_(r, 'nouveau', { essais: essais }); });
  try {
    genererEtEnvoyer_(chatId, g, parsed.matiere, parsed.chapitre);
    g.forEach(function (r) { setStatut_(r, 'fait'); });
  } catch (err) {
    console.error('Chapitre « ' + parsed.chapitre + ' » (essai ' + essais + ') : ' +
      (err && err.stack || err));
    if (err.definitif || essais >= MAX_ESSAIS) {
      g.forEach(function (r) { setStatut_(r, 'erreur'); });
      sendMessage(chatId, '😕 Je n\'ai pas réussi à faire la fiche « ' + parsed.chapitre + ' ».\n' +
        (err.messageEleve || 'Réessaie un peu plus tard en renvoyant les photos.'));
    }
    // sinon : on laisse « nouveau », nouvel essai à la prochaine minute.
  }
}

/** Le cœur : photos → Gemini → HTML → Telegram. */
function genererEtEnvoyer_(chatId, g, matiere, chapitre) {
  var folder = chapterFolder_(matiere, chapitre);
  var stamp = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd_HHmm');

  var images = g.map(function (r, i) {
    var blob = downloadTelegramFile(r.fileId);
    var mime = r.mime || blob.getContentType() || 'image/jpeg';
    blob.setContentType(mime).setName(stamp + '_photo' + (i + 1) + extension_(mime));
    folder.createFile(blob);
    return blob;
  });

  var data = generateFiche(images, matiere, chapitre);
  data.matiere = matiere;
  data.chapitre = chapitre;
  data.date = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy');

  var base = nomFichier_(matiere + ' - ' + chapitre);
  folder.createFile(stamp + '_transcription.txt', data.transcription || '', MimeType.PLAIN_TEXT);
  folder.createFile(stamp + '_fiche.json', JSON.stringify(data, null, 2), 'application/json');
  var html = Utilities.newBlob(renderHtml(data), 'text/html', base + '.html');
  var htmlFile = folder.createFile(html);

  appendIndex_(matiere, chapitre, folder, htmlFile);
  sendDocument(chatId, html, '📘 ' + matiere + ' — ' + chapitre +
    '\nOuvre le fichier avec ton navigateur 🙂');
}

/** « Histoire - La Guerre froide » → {matiere, chapitre}. Accepte - – — :
 *  Le séparateur entouré d'espaces est prioritaire (« Physique-Chimie - Les ondes »). */
function parseLegende_(texte) {
  var t = String(texte || '').replace(/\s+/g, ' ').trim();
  var m = t.match(/^(.{2,40}?) [-–—:] (.{2,120})$/) || t.match(/^(.{2,40}?) ?[-–—:] ?(.{2,120})$/);
  if (!m) return null;
  var cap = function (s) { s = s.trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
  return { matiere: cap(m[1]), chapitre: cap(m[2]) };
}

// ---------- accès à la feuille ----------

function queueSheet_() {
  return SpreadsheetApp.openById(prop_('SPREADSHEET_ID')).getSheetByName('queue');
}

function readQueue_() {
  var sh = queueSheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, QUEUE_COLS.length).getValues().map(function (v, i) {
    return {
      row: i + 2, updateId: v[0], recuLe: Number(v[1]), chatId: String(v[2]),
      messageId: v[3], groupe: String(v[4]), type: v[5], fileId: String(v[6]),
      mime: String(v[7]), legende: String(v[8]), statut: v[9], essais: Number(v[10]) || 0
    };
  }).filter(function (r) { return r.statut === 'nouveau' || r.statut === 'attente_legende'; });
}

function setStatut_(r, statut, extra) {
  var sh = queueSheet_();
  r.statut = statut;
  sh.getRange(r.row, 10).setValue(statut);
  if (extra && extra.essais != null) { r.essais = extra.essais; sh.getRange(r.row, 11).setValue(extra.essais); }
  if (extra && extra.legende != null) sh.getRange(r.row, 9).setValue(texteSur_(extra.legende));
}

/** Évite qu'un texte commençant par = + - @ soit pris pour une formule. */
function texteSur_(s) {
  s = String(s || '');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function extension_(mime) {
  return { 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' }[mime] || '.jpg';
}

function nomFichier_(s) {
  return s.replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}
