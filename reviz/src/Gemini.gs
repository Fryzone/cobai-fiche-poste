/** Appel à l'API Gemini (offre gratuite) : photos + consigne → JSON de la fiche. */

var GEMINI_MODELE_DEFAUT = 'gemini-3.8-flash'; // remplaçable via la propriété GEMINI_MODEL
var GEMINI_ATTENTES_S = [10, 30, 60];          // attente progressive entre les essais
var GEMINI_BUDGET_MS = 4 * 60 * 1000;          // garde de la marge sur les 6 min d'Apps Script

function generateFiche(images, matiere, chapitre) {
  var parts = [{ text: consigneFiche_(matiere, chapitre) }];
  images.forEach(function (blob) {
    parts.push({ inlineData: { mimeType: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) } });
  });
  var data = callGeminiJson_(parts, FICHE_SCHEMA);
  validerFiche_(data);
  return data;
}

function callGeminiJson_(parts, schema) {
  var modele = prop_('GEMINI_MODEL') || GEMINI_MODELE_DEFAUT;
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modele + ':generateContent';
  var body = {
    systemInstruction: { parts: [{ text: CONSIGNE_SYSTEME }] },
    contents: [{ role: 'user', parts: parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      thinkingConfig: { thinkingLevel: 'LOW' } // plus rapide : on reste sous les délais d'Apps Script
    }
  };
  var debut = Date.now();
  var derniereErreur;

  for (var essai = 0; essai <= GEMINI_ATTENTES_S.length; essai++) {
    if (essai > 0) {
      var attente = GEMINI_ATTENTES_S[essai - 1] * 1000;
      if (Date.now() - debut + attente > GEMINI_BUDGET_MS) break;
      Utilities.sleep(attente);
    }
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': prop_('GEMINI_API_KEY') },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var texte = res.getContentText();

    if (code === 429 || code >= 500) { // quota / surcharge : on réessaie
      derniereErreur = new Error('Gemini HTTP ' + code + ' : ' + texte.slice(0, 500));
      continue;
    }
    if (code !== 200) {
      var e = new Error('Gemini HTTP ' + code + ' : ' + texte.slice(0, 500));
      e.definitif = true;
      e.messageEleve = 'Le service de fiches a un souci de configuration, préviens ton parent 🙏';
      throw e;
    }

    var cand = (JSON.parse(texte).candidates || [])[0];
    if (!cand || !cand.content) {
      var b = new Error('Gemini : réponse vide/bloquée : ' + texte.slice(0, 500));
      b.definitif = true;
      b.messageEleve = 'Je n\'arrive pas à lire ces photos. Essaie avec des photos plus nettes 📸';
      throw b;
    }
    var json = cand.content.parts
      .filter(function (p) { return p.text && !p.thought; })
      .map(function (p) { return p.text; }).join('');
    try {
      return JSON.parse(json);
    } catch (err) { // JSON tronqué ou invalide : on réessaie
      derniereErreur = new Error('JSON invalide (finishReason ' + cand.finishReason + ') : ' + json.slice(0, 300));
    }
  }
  throw derniereErreur || new Error('Gemini : délai dépassé');
}

function validerFiche_(d) {
  var f = d && d.fiche;
  var ok = f && typeof d.transcription === 'string' && typeof f.resume === 'string' &&
    ['notions', 'definitions', 'reperes', 'exemples', 'a_retenir'].every(function (k) {
      return Array.isArray(f[k]);
    }) && f.a_retenir.length > 0;
  if (!ok) throw new Error('Fiche incomplète : ' + JSON.stringify(d).slice(0, 300));
  f.aller_plus_loin = f.aller_plus_loin || [];
}
