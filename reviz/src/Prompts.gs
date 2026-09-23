/**
 * Consignes données à Gemini. C'est ici qu'on ajuste le ton, la longueur, etc.
 * Gemini renvoie uniquement du JSON (voir FICHE_SCHEMA) ; le HTML est fait par Render.gs.
 */

var CONSIGNE_SYSTEME = [
  'Tu es un professeur de lycée (seconde à terminale) qui prépare des fiches de révision',
  'pour une élève, à partir des photos de ses cours écrits à la main.',
  '',
  'RÈGLES ABSOLUES',
  '1. Fidélité : n\'utilise QUE ce qui est écrit dans le cours. N\'invente rien :',
  '   ni date, ni chiffre, ni définition, ni exemple absent du cours.',
  '2. Si un mot ou un passage est illisible, écris [illisible] à sa place. Ne devine pas.',
  '3. Seule exception : la rubrique « aller_plus_loin », qui peut contenir 0 à 3 compléments',
  '   utiles hors du cours. Laisse-la vide en cas de doute.',
  '4. Langage clair et simple, phrases courtes, niveau lycée. Pas de jargon inutile.',
  '5. La fiche doit tenir sur UNE page : va à l\'essentiel.',
  '6. Tu peux mettre en gras les mots-clés avec **mot**. Aucun autre formatage (pas de HTML).',
  '7. Les formules : écris-les en texte simple lisible (ex : v = d / t, E = m × c²).'
].join('\n');

function consigneFiche_(matiere, chapitre) {
  return [
    'Matière : ' + matiere,
    'Chapitre : ' + chapitre,
    '',
    'Voici les photos de mon cours, dans l\'ordre. Fais :',
    '- transcription : le texte complet du cours, recopié fidèlement (garde les titres).',
    '- fiche : la fiche de révision, avec :',
    '  • resume : 1 ou 2 phrases qui disent de quoi parle le chapitre ;',
    '  • notions : 2 à 5 grandes parties, chacune avec 2 à 4 points courts ;',
    '  • definitions : les termes importants définis dans le cours ;',
    '  • reperes : les dates (histoire…) ou formules (sciences…) à connaître, avec une',
    '    courte explication ; liste vide s\'il n\'y en a pas ;',
    '  • exemples : les exemples du cours (1 phrase chacun) ;',
    '  • a_retenir : exactement 5 phrases, les choses les plus importantes ;',
    '  • aller_plus_loin : 0 à 3 compléments hors cours (facultatif).'
  ].join('\n');
}

/** Format de sortie imposé à Gemini (JSON strict). */
var FICHE_SCHEMA = {
  type: 'object',
  properties: {
    transcription: { type: 'string', description: 'Texte intégral du cours, [illisible] si besoin.' },
    fiche: {
      type: 'object',
      properties: {
        resume: { type: 'string' },
        notions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              titre: { type: 'string' },
              points: { type: 'array', items: { type: 'string' } }
            },
            required: ['titre', 'points']
          }
        },
        definitions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { terme: { type: 'string' }, definition: { type: 'string' } },
            required: ['terme', 'definition']
          }
        },
        reperes: {
          type: 'array',
          description: 'Dates ou formules clés.',
          items: {
            type: 'object',
            properties: { repere: { type: 'string' }, explication: { type: 'string' } },
            required: ['repere', 'explication']
          }
        },
        exemples: { type: 'array', items: { type: 'string' } },
        a_retenir: { type: 'array', items: { type: 'string' } },
        aller_plus_loin: { type: 'array', items: { type: 'string' } }
      },
      required: ['resume', 'notions', 'definitions', 'reperes', 'exemples', 'a_retenir', 'aller_plus_loin']
    }
  },
  required: ['transcription', 'fiche']
};
