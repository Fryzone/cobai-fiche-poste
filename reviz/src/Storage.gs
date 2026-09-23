/** Rangement dans Drive : /RéviZ/<Matière>/<Chapitre>/ + feuille « index ». */

function chapterFolder_(matiere, chapitre) {
  var root = DriveApp.getFolderById(prop_('ROOT_FOLDER_ID'));
  return sousDossier_(sousDossier_(root, nomFichier_(matiere)), nomFichier_(chapitre));
}

function sousDossier_(parent, nom) {
  var it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}

function appendIndex_(matiere, chapitre, folder, htmlFile) {
  SpreadsheetApp.openById(prop_('SPREADSHEET_ID')).getSheetByName('index').appendRow([
    texteSur_(matiere), texteSur_(chapitre), new Date(), folder.getUrl(), htmlFile.getUrl()
  ]);
}
