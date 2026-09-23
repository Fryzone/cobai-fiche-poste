# Guide de déploiement RéviZ

Compter **30 minutes** la première fois. Tout est gratuit.
Il te faut : un compte Google, Telegram sur ton téléphone et un ordinateur avec [Node.js](https://nodejs.org) (version LTS).

Plan :

1. [Créer le bot Telegram](#1-créer-le-bot-telegram)
2. [Créer la clé Gemini](#2-créer-la-clé-gemini)
3. [Installer clasp](#3-installer-clasp)
4. [Envoyer le code et déployer](#4-envoyer-le-code-et-déployer)
5. [Configurer et lancer `setup()`](#5-configurer-et-lancer-setup)
6. [Tester](#6-tester)

Ensuite : [Mettre à jour](#mettre-à-jour-le-code) · [Dépannage](#dépannage)

---

## 1. Créer le bot Telegram

1. Dans Telegram, ouvre une conversation avec **@BotFather** (badge bleu ✔).
2. Envoie `/newbot`.
3. Donne un **nom** (ex : `RéviZ de Léa`), puis un **identifiant** qui finit par `bot` (ex : `revizlea_bot`).
4. BotFather répond avec un **token** du type `123456789:AAH…`. **Copie-le** et ne le partage pas.

**Identifiant Telegram de ta fille** : sur son téléphone, elle ouvre **@userinfobot** et envoie n'importe quel message.
Le bot répond avec `Id: 987654321`. **Note ce nombre.**

> Pas pressé ? Tu peux aussi le récupérer plus tard : si elle écrit au bot RéviZ sans être autorisée, il lui répond son identifiant.

## 2. Créer la clé Gemini

1. Va sur <https://aistudio.google.com/apikey> avec ton compte Google.
2. **Create API key** → accepte les conditions → **copie la clé** (`AIza…`).

Aucune carte bancaire n'est demandée. Si un projet « facturé » est proposé, **ne l'active pas** : RéviZ fonctionne avec l'offre gratuite.

## 3. Installer clasp

clasp est l'outil de Google pour envoyer le code vers Apps Script. Dans un terminal (Windows : *PowerShell*) :

```bash
npm install -g @google/clasp
clasp login
```

`clasp login` ouvre le navigateur : connecte-toi avec **le compte Google qui gardera les fiches** et accepte.

Puis active l'API Apps Script : <https://script.google.com/home/usersettings> → **API Google Apps Script : Activé**.

## 4. Envoyer le code et déployer

Récupère le code (`git clone …`, ou *Code → Download ZIP* sur GitHub puis dézippe) et place-toi dans le dossier `reviz` :

```bash
cd reviz
clasp create --type standalone --title "RéviZ" --rootDir src
```

⚠️ `clasp create` **remplace** `src/appsscript.json` et ajoute un fichier `src/Code.js` vide. Annule ça :

```bash
git checkout -- src/appsscript.json     # remet notre version
rm src/Code.js                          # Windows PowerShell : del src\Code.js
```

> Téléchargé en ZIP (pas de git) ? Re-copie `src/appsscript.json` depuis le ZIP d'origine.

Envoie le code, puis crée le déploiement Web App :

```bash
clasp push -f
clasp deploy -d "RéviZ"
```

La dernière commande affiche `Deployed AKfycb…xyz @1`. **Note l'identifiant `AKfycb…xyz`** : ton URL de Web App est

```
https://script.google.com/macros/s/AKfycb…xyz/exec
```

## 5. Configurer et lancer `setup()`

1. Ouvre le projet : `clasp open-script` (ou va sur <https://script.google.com> → **RéviZ**).
2. ⚙️ **Paramètres du projet** (menu de gauche) → tout en bas **Propriétés du script** → **Ajouter une propriété du script**. Ajoute ces 4 propriétés :

   | Propriété | Valeur |
   |---|---|
   | `TELEGRAM_TOKEN` | le token de BotFather (étape 1) |
   | `GEMINI_API_KEY` | la clé `AIza…` (étape 2) |
   | `ALLOWED_CHAT_IDS` | l'identifiant de ta fille, ex : `987654321` (plusieurs personnes : `987654321,123456789`) |
   | `WEBAPP_URL` | l'URL `…/exec` de l'étape 4 |

   → **Enregistrer les propriétés du script**.
3. **Éditeur** `< >` → ouvre `Setup.gs` → dans la liste des fonctions en haut, choisis **`setup`** → **▶ Exécuter**.
4. Google demande des autorisations :
   **Examiner les autorisations** → ton compte → *« Google n'a pas validé cette application »* →
   **Paramètres avancés** → **Accéder à RéviZ (non sécurisé)** → **Autoriser**.
   C'est normal : c'est ton propre script, il n'est visible que par toi.
5. Le **journal d'exécution** doit afficher `✅ RéviZ prêt.`, avec les liens vers le dossier Drive et la feuille index.

`setup()` a créé :

- le dossier Drive **RéviZ** ;
- la feuille **RéviZ - index**, avec les onglets `index` et `queue` ;
- le déclencheur « toutes les minutes » ;
- le webhook Telegram ;
- le menu des commandes du bot.

`setup()` peut être relancé sans risque : il ne recrée que ce qui manque.

## 6. Tester

1. Dans Telegram, ouvre ton bot et envoie `/aide` → le message d'aide arrive tout de suite.
2. Envoie une photo de cours avec la légende `Histoire - La Guerre froide` → le bot répond **« Reçu ✅ »**.
3. Attends **1 à 3 minutes** → le fichier `Histoire - La Guerre froide.html` arrive. Ouvre-le.
4. Vérifie dans Drive : `RéviZ/Histoire/La Guerre froide/` contient la photo, la transcription, le JSON et le HTML.

Si ça marche, il ne reste qu'à ajouter le bot sur le téléphone de ta fille : elle cherche l'identifiant du bot et appuie sur **Démarrer**.

---

## Mettre à jour le code

Après une modification, **il faut toujours faire les deux commandes** :

```bash
clasp push -f
clasp deploy -i AKfycb…xyz -d "mise à jour"
```

- `clasp push -f` met à jour le traitement des fiches : le déclencheur utilise toujours le dernier code envoyé.
- `clasp deploy -i …` met à jour la réception des messages (la Web App), **en gardant la même URL**.

Sans `-i`, tu créerais une nouvelle URL, et il faudrait mettre à jour `WEBAPP_URL` puis relancer `setup()`.

Si Google redemande des autorisations (après ajout d'une fonctionnalité), relance `setup()` depuis l'éditeur.

Réglages sans toucher au code, dans les **Propriétés du script** :

- `GEMINI_MODEL` : le modèle IA (par défaut `gemini-3.8-flash`).
- `ALLOWED_CHAT_IDS` : les personnes autorisées.

## Dépannage

**Où regarder :**

- Éditeur Apps Script → **Exécutions** (menu de gauche) : chaque passage de `doPost` et de `processQueue`, avec les erreurs.
- Feuille **RéviZ - index**, onglet `queue` : l'état de chaque photo (`nouveau`, `attente_legende`, `fait`, `erreur`).
- État du webhook : ouvre dans le navigateur `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

| Symptôme | Cause probable → solution |
|---|---|
| Le bot ne répond rien, même à `/aide` | Le webhook n'est pas en place, ou `WEBAPP_URL` est fausse (elle doit finir par `/exec`). Vérifie la propriété, puis relance `setup()`. |
| `getWebhookInfo` affiche une erreur `302` | Apps Script répond à Telegram par une redirection. Si le bot répond quand même, ignore : les doublons sont filtrés. |
| Le bot répond « Ce bot est privé » | L'identifiant n'est pas dans `ALLOWED_CHAT_IDS` : copie le nombre donné par le bot dans la propriété. Pas besoin de redéployer. |
| « Reçu ✅ » mais jamais de fiche | Regarde **Exécutions** → `processQueue`. Vérifie que le déclencheur existe (menu **Déclencheurs** ⏰), sinon relance `setup()`. |
| Erreur `API key not valid` ou `403` dans les exécutions | La clé Gemini est mal copiée dans `GEMINI_API_KEY`. |
| Erreur `404` + `model` | Le modèle n'existe plus : mets un modèle Flash actuel dans `GEMINI_MODEL` (liste : <https://ai.google.dev/gemini-api/docs/models>). |
| Erreur `429` répétée | Quota gratuit du jour atteint : il revient chaque jour (minuit, heure du Pacifique). Le bot réessaie tout seul ; après 3 échecs, il prévient l'élève. |
| « Je n'ai pas réussi… Essaie avec moins de photos » | Le traitement a dépassé le temps maximal. Envoyer 4 à 6 photos maximum par chapitre. |
| Une modification du code n'a aucun effet | Tu as fait `clasp push` sans `clasp deploy -i …` (ou l'inverse) : fais les deux. |
| `clasp push` refuse (« Project file already exists » / « not found ») | Lance les commandes depuis le dossier `reviz/`, là où se trouve `.clasp.json`. |
