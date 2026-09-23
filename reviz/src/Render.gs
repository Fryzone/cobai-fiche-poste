/**
 * JSON → HTML. Le modèle ne produit jamais de HTML : tout passe par ce fichier
 * et par template.html. La fiche est rendue ici (lisible même sans JavaScript,
 * ex. aperçu Telegram sur iPhone).
 */

function renderHtml(data) {
  var tpl = HtmlService.createHtmlOutputFromFile('template').getContent();
  return fillTemplate_(tpl, data);
}

function fillTemplate_(tpl, data) {
  var valeurs = {
    TITRE: esc_(data.matiere + ' — ' + data.chapitre),
    MATIERE: esc_(data.matiere),
    CHAPITRE: esc_(data.chapitre),
    DATE: esc_(data.date || ''),
    COULEUR: couleurMatiere_(data.matiere),
    FICHE: ficheHtml_(data.fiche),
    // Données brutes pour les onglets Jeux / Visuel (étapes 2 et 3).
    DATA: JSON.stringify({ matiere: data.matiere, chapitre: data.chapitre, fiche: data.fiche })
      .replace(/</g, '\\u003c')
  };
  // Un seul passage : le contenu inséré n'est jamais ré-interprété.
  return tpl.replace(/\{\{(\w+)\}\}/g, function (m, k) {
    return Object.prototype.hasOwnProperty.call(valeurs, k) ? valeurs[k] : m;
  });
}

function ficheHtml_(f) {
  var h = [];
  if (f.resume) h.push('<p class="resume">' + fmt_(f.resume) + '</p>');

  if (f.notions.length) {
    h.push(bloc_('notions', '🧠', 'Notions clés', f.notions.map(function (n) {
      return '<div class="notion"><h3>' + fmt_(n.titre) + '</h3>' + liste_(n.points) + '</div>';
    }).join('')));
  }
  if (f.definitions.length) {
    h.push(bloc_('definitions', '📖', 'Définitions', '<dl>' + f.definitions.map(function (d) {
      return '<dt>' + fmt_(d.terme) + '</dt><dd>' + fmt_(d.definition) + '</dd>';
    }).join('') + '</dl>'));
  }
  if (f.reperes.length) {
    h.push(bloc_('reperes', '📅', 'Repères (dates, formules)', '<ul class="reperes-liste">' +
      f.reperes.map(function (r) {
        return '<li><span class="badge">' + fmt_(r.repere) + '</span><span>' + fmt_(r.explication) + '</span></li>';
      }).join('') + '</ul>'));
  }
  if (f.exemples.length) h.push(bloc_('exemples', '💡', 'Exemples', liste_(f.exemples)));
  if (f.a_retenir.length) {
    h.push(bloc_('retenir', '⭐', f.a_retenir.length + ' choses à retenir',
      '<ol>' + f.a_retenir.map(function (s) { return '<li>' + fmt_(s) + '</li>'; }).join('') + '</ol>'));
  }
  if (f.aller_plus_loin && f.aller_plus_loin.length) {
    h.push('<details class="plus-loin"><summary>🔭 Pour aller plus loin <small>(facultatif, hors cours)</small></summary>' +
      liste_(f.aller_plus_loin) + '</details>');
  }
  return h.join('\n');
}

function bloc_(classe, icone, titre, contenu) {
  return '<section class="bloc ' + classe + '"><h2><span aria-hidden="true">' + icone + '</span> ' +
    esc_(titre) + '</h2>' + contenu + '</section>';
}

function liste_(items) {
  return '<ul>' + items.map(function (s) { return '<li>' + fmt_(s) + '</li>'; }).join('') + '</ul>';
}

/** Échappe le texte, puis active **gras** et surligne [illisible]. */
function fmt_(s) {
  return esc_(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[illisible\]/gi, '<mark class="illisible" title="Passage illisible sur la photo">[illisible]</mark>');
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** Une teinte par matière (repère visuel constant d'une fiche à l'autre). */
function couleurMatiere_(matiere) {
  var m = String(matiere || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  var connues = [
    [/hist|geo|hggsp|emc/, 18], [/math/, 220], [/phys|chim/, 265], [/svt|bio|vie/, 140],
    [/fran|litt|lettre/, 340], [/philo/, 290], [/angl|espa|allem|ital|lv|langue/, 190],
    [/ses|eco/, 40], [/nsi|info|snt/, 200]
  ];
  for (var i = 0; i < connues.length; i++) if (connues[i][0].test(m)) return String(connues[i][1]);
  var h = 0;
  for (var j = 0; j < m.length; j++) h = (h * 31 + m.charCodeAt(j)) % 360;
  return String(h);
}
