/**
 * Point d'entrée du webhook Telegram.
 * Règle d'or : faire le strict minimum et répondre vite (sinon Telegram renvoie
 * le même message). Le vrai travail est fait par processQueue() (Queue.gs).
 */
function doPost(e) {
  try {
    handleUpdate_(JSON.parse(e.postData.contents));
  } catch (err) {
    console.error('doPost : ' + (err && err.stack || err));
  }
  return ContentService.createTextOutput('ok');
}

function handleUpdate_(update) {
  var msg = update.message;
  if (!msg) return;

  // Déduplication : Telegram peut renvoyer le même update_id.
  var cache = CacheService.getScriptCache();
  var key = 'upd_' + update.update_id;
  if (cache.get(key)) return;
  cache.put(key, '1', 21600); // 6 h (maximum)

  var chatId = String(msg.chat.id);
  if (!isAllowed_(chatId)) {
    sendMessage(chatId, 'Ce bot est privé. Ton identifiant Telegram : ' + chatId);
    return;
  }

  if (msg.text && msg.text.charAt(0) === '/') {
    handleCommand_(chatId, msg.text);
    return;
  }

  var image = extractImage_(msg);
  if (image) {
    enqueue_({
      updateId: update.update_id,
      chatId: chatId,
      messageId: msg.message_id,
      group: msg.media_group_id ? 'album_' + msg.media_group_id : 'msg_' + msg.message_id,
      type: 'photo',
      fileId: image.fileId,
      mime: image.mime,
      legende: msg.caption || ''
    });
    // Un seul accusé de réception par album.
    var ackKey = 'ack_' + (msg.media_group_id || msg.message_id);
    if (!cache.get(ackKey)) {
      cache.put(ackKey, '1', 3600);
      sendMessage(chatId, 'Reçu ✅, je prépare ta fiche');
    }
    return;
  }

  if (msg.text) {
    // Peut être la réponse à « Quelle matière et quel chapitre ? ».
    enqueue_({
      updateId: update.update_id,
      chatId: chatId,
      messageId: msg.message_id,
      group: 'msg_' + msg.message_id,
      type: 'texte',
      legende: msg.text
    });
    return;
  }

  sendMessage(chatId, 'Envoie-moi des photos de ton cours 📸 (tape /aide pour voir comment faire)');
}

/** Photo classique, ou image envoyée « en tant que fichier » (meilleure qualité). */
function extractImage_(msg) {
  if (msg.photo && msg.photo.length) {
    return { fileId: msg.photo[msg.photo.length - 1].file_id, mime: 'image/jpeg' };
  }
  if (msg.document && /^image\//.test(msg.document.mime_type || '')) {
    return { fileId: msg.document.file_id, mime: msg.document.mime_type };
  }
  return null;
}

function isAllowed_(chatId) {
  var ids = (prop_('ALLOWED_CHAT_IDS') || '').split(/[\s,;]+/);
  return ids.indexOf(chatId) !== -1;
}

function handleCommand_(chatId, text) {
  var cmd = text.split(/\s+/)[0].split('@')[0].toLowerCase();
  if (cmd === '/liste' || cmd === '/quiz') {
    sendMessage(chatId, 'Cette commande arrive bientôt 🔧');
    return;
  }
  sendMessage(chatId, AIDE_TEXTE);
}

var AIDE_TEXTE = [
  '👋 Je transforme tes cours en fiches de révision.',
  '',
  '📸 Envoie une ou plusieurs photos de ton cours (en une seule fois),',
  'avec en légende : Matière - Chapitre',
  'Exemple : Histoire - La Guerre froide',
  '',
  'Je te renvoie ta fiche quelques minutes plus tard.',
  '',
  '/liste — tes chapitres par matière (bientôt)',
  '/quiz <matière> — un quiz sur tes chapitres (bientôt)',
  '/aide — ce message'
].join('\n');

/** Lecture d'une Script Property. */
function prop_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}
