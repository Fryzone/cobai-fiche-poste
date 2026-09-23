# RéviZ 📘

Bot Telegram : photos de cours → fiche de révision HTML (Google Apps Script + Gemini gratuit).
Étape 1 (MVP) : la fiche. Les jeux, les visuels, le PDF, /liste et /quiz viendront ensuite.

## Installation (5 étapes)

> Guide détaillé pas à pas, et dépannage : **[DEPLOIEMENT.md](DEPLOIEMENT.md)**.

**1. Créer le bot Telegram.** Dans Telegram, écris à **@BotFather** → `/newbot` → choisis un nom.
Note le **token** (`123456:ABC…`). Pour avoir l'**identifiant Telegram** de ta fille, elle écrit à
**@userinfobot**, qui lui répond avec son `Id`.

**2. Créer la clé Gemini.** Sur <https://aistudio.google.com/apikey> → *Create API key*. Gratuit, sans carte bancaire.

**3. Installer clasp** (il faut [Node.js](https://nodejs.org)) :
```bash
npm install -g @google/clasp
clasp login
```
Puis active *Google Apps Script API* sur <https://script.google.com/home/usersettings>.

**4. Envoyer le code et déployer** (dans ce dossier `reviz/`) :
```bash
clasp create --type standalone --title "RéviZ" --rootDir src
git checkout -- src/appsscript.json   # clasp écrase ce fichier : on remet le nôtre
rm src/Code.js                        # fichier vide ajouté par clasp
clasp push -f
clasp deploy -d "RéviZ"
```
`clasp deploy` affiche un identifiant `AKfy…`. L'URL de la Web App est
`https://script.google.com/macros/s/AKfy…/exec`.

**5. Configurer et lancer `setup()`.** Ouvre le projet avec `clasp open-script`.
Dans ⚙️ *Paramètres du projet* → *Propriétés du script*, ajoute :

| Propriété | Valeur |
|---|---|
| `TELEGRAM_TOKEN` | le token de l'étape 1 |
| `GEMINI_API_KEY` | la clé de l'étape 2 |
| `ALLOWED_CHAT_IDS` | l'identifiant Telegram de ta fille (plusieurs : séparés par des virgules) |
| `WEBAPP_URL` | l'URL `…/exec` de l'étape 4 |

Dans l'éditeur, choisis la fonction `setup` → *Exécuter* → accepte les autorisations.
C'est fini : le dossier Drive **RéviZ**, la feuille **RéviZ - index**, le déclencheur et le webhook sont créés.

> Si quelqu'un d'autre écrit au bot, le bot lui répond son identifiant. C'est pratique pour ajouter une personne dans `ALLOWED_CHAT_IDS`.

## Au quotidien

- **Mettre à jour le code en gardant la même URL :** `clasp push -f` puis `clasp deploy -i AKfy…` (toujours les deux)
- **Changer de modèle :** propriété `GEMINI_MODEL` (par défaut `gemini-3.8-flash`).
- **Modifier les consignes données à l'IA :** `src/Prompts.gs`. **L'apparence :** `src/template.html`.
- **En cas de souci :** onglet *Exécutions* de l'éditeur Apps Script, et la feuille `queue`
  (statut de chaque photo : `nouveau`, `attente_legende`, `fait`, `erreur`).

## Tester en local (facultatif)

```bash
node dev/test-flow.js                                   # simule tout le flux (sans Google)
node dev/render-exemple.js exemple/fiche-guerre-froide.json > exemple/test.html
```
