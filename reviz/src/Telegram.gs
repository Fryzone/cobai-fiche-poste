/** Petits appels à l'API Telegram Bot. */

function tgCall_(method, payload) {
  var url = 'https://api.telegram.org/bot' + prop_('TELEGRAM_TOKEN') + '/' + method;
  var res = UrlFetchApp.fetch(url, { method: 'post', payload: payload, muteHttpExceptions: true });
  var body = JSON.parse(res.getContentText() || '{}');
  if (!body.ok) throw new Error('Telegram ' + method + ' : ' + res.getContentText());
  return body.result;
}

function sendMessage(chatId, text) {
  try {
    return tgCall_('sendMessage', { chat_id: chatId, text: text });
  } catch (err) {
    console.error(err); // un message raté ne doit jamais bloquer le reste
  }
}

function sendDocument(chatId, blob, caption) {
  return tgCall_('sendDocument', { chat_id: chatId, document: blob, caption: caption || '' });
}

function downloadTelegramFile(fileId) {
  var file = tgCall_('getFile', { file_id: fileId });
  var url = 'https://api.telegram.org/file/bot' + prop_('TELEGRAM_TOKEN') + '/' + file.file_path;
  return UrlFetchApp.fetch(url).getBlob();
}
