/**
 * À lancer une fois depuis l'éditeur Apps Script (et après chaque nouveau déploiement
 * si l'URL change). Relançable sans risque : ne crée que ce qui manque.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  ['TELEGRAM_TOKEN', 'GEMINI_API_KEY', 'ALLOWED_CHAT_IDS'].forEach(function (k) {
    if (!props.getProperty(k)) throw new Error('Propriété manquante : ' + k + ' (voir README)');
  });

  // 1. Dossier Drive « RéviZ »
  var root = props.getProperty('ROOT_FOLDER_ID') && DriveApp.getFolderById(props.getProperty('ROOT_FOLDER_ID'));
  if (!root) {
    root = DriveApp.createFolder('RéviZ');
    props.setProperty('ROOT_FOLDER_ID', root.getId());
  }

  // 2. Classeur avec les feuilles « queue » et « index »
  var ss;
  if (props.getProperty('SPREADSHEET_ID')) {
    ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  } else {
    ss = SpreadsheetApp.create('RéviZ - index');
    DriveApp.getFileById(ss.getId()).moveTo(root);
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  feuille_(ss, 'index', ['Matière', 'Chapitre', 'Date', 'Dossier', 'Fiche HTML']);
  feuille_(ss, 'queue', QUEUE_COLS);
  var vide = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (vide && ss.getSheets().length > 2) ss.deleteSheet(vide);

  // 3. Déclencheur toutes les minutes
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processQueue') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processQueue').timeBased().everyMinutes(1).create();

  // 4. Webhook Telegram → URL de la Web App
  var url = props.getProperty('WEBAPP_URL') || ScriptApp.getService().getUrl();
  if (!url) throw new Error('Déploie d\'abord la Web App (clasp deploy), puis renseigne WEBAPP_URL.');
  tgCall_('setWebhook', {
    url: url,
    allowed_updates: JSON.stringify(['message']),
    max_connections: 1,         // messages traités un par un : pas de course dans doPost
    drop_pending_updates: true
  });
  tgCall_('setMyCommands', {
    commands: JSON.stringify([
      { command: 'liste', description: 'Mes chapitres par matière' },
      { command: 'quiz', description: 'Quiz sur une matière' },
      { command: 'aide', description: 'Comment ça marche' }
    ])
  });

  console.log('✅ RéviZ prêt.\nDossier : ' + root.getUrl() + '\nIndex : ' + ss.getUrl() +
    '\nWebhook : ' + url + '\n' + JSON.stringify(tgCall_('getWebhookInfo', {})));
}

function feuille_(ss, nom, entetes) {
  var sh = ss.getSheetByName(nom) || ss.insertSheet(nom);
  if (sh.getLastRow() === 0) {
    sh.appendRow(entetes);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, entetes.length).setFontWeight('bold');
  }
  return sh;
}
