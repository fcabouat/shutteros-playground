# Déploiement en borne

[English](kiosk.md)

ShutterOS est une application statique. Elle fonctionne dans un navigateur, sans serveur applicatif, base de données, compte utilisateur ni API externe. Une fois les fichiers disponibles, aucune connexion Internet n’est nécessaire. Pour une borne, servez le dossier construit en HTTP local ; un fichier HTML autonome est également fourni.

## Construire et lancer

Utilisez Node.js 22.13 ou ultérieur — la CI utilise Node 24 — et pnpm 11.19.0 :

```sh
pnpm install --frozen-lockfile
pnpm build
```

La construction produit `dist/`. Servez ce dossier avec Python, en remplaçant le chemin par son emplacement absolu :

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory /chemin/vers/dist
```

Ouvrez ensuite `http://127.0.0.1:8080`. `pnpm dev` sert au développement et `pnpm preview` à la vérification locale ; utilisez le build de production pour une borne.

Le jeu charge `kiosk-config.json` à son démarrage. Ce fichier doit rester à côté de `index.html` et être servi comme du JSON. Les logos facultatifs sont également des fichiers locaux placés dans ce dossier ; voir la [personnalisation de l’identité](branding.fr.md).

Après `pnpm build:site`, relancez `pnpm build` avant de distribuer une borne servie à la racine : le site public construit sa démo sous `/demo/`. Pour GitHub Pages, consultez la [documentation de publication](publishing.md).

## Utiliser le fichier autonome

Le même `pnpm build` produit :

```text
dist/portable/shutteros.html
```

Ce fichier peut être ouvert directement dans le navigateur, sans serveur HTTP. Il intègre la configuration de `static/kiosk-config.json`, les logos configurés et les notices de licences. Les fichiers de logos sont vérifiés avant intégration. Pour changer un paramètre ou une image, modifiez les sources puis reconstruisez le livrable.

À l’inverse, le site HTTP lit le JSON déployé au chargement : ses paramètres peuvent être changés sans recompilation.

## Configurer la session

Le fichier `static/kiosk-config.json` utilise le format version 1. Il contient les phrases de connexion fictives, la durée de session, l’identité des organisations, le contact de sécurité et les adresses des messages simulés.

| Paramètre                        | Usage                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `sessionMinutes`                 | Durée maximale de la session : de 1 à 30 minutes, 30 par défaut.                                                |
| `acceptedPasswords`              | Phrases fictives acceptées à la connexion. La première apparaît sur le post-it.                                 |
| `showPasswordHint`               | Affiche le post-it numérique. Mettez `false` pour utiliser une note physique sur l’écran.                       |
| `passwordManagerName`            | Nom du gestionnaire approuvé par votre organisation, de 1 à 80 caractères non blancs. Par défaut : `KeePassXC`. |
| `supportLabel`, `supportContact` | Nom et coordonnées du canal de signalement de sécurité connu.                                                   |
| `mailLegitimateAddress`          | Expéditeur familier de la demande inhabituelle.                                                                 |
| `mailImpersonatorAddress`        | Expéditeur suspect de la demande d’apparence ordinaire.                                                         |

La durée globale accepte de 1 à 30 minutes et vaut 30 minutes par défaut. Prévoyez généralement 10 à 20 minutes de participation. Le compteur démarre après la connexion simulée. Le Mode facile est proposé à l’accueil ; le joueur peut choisir le Mode défi et changer de mode à tout moment sans perdre sa progression.

Configurez un contact de sécurité direct. L’assistance générale peut être un recours si votre procédure le prévoit ; la maintenance habituelle du poste relève du service informatique.

Le nom du gestionnaire apparaît dans les explications, sans lancer de logiciel ni établir de connexion réelle. Le validateur du kit Ubuntu accepte le même paramètre. Le débrief distingue le gestionnaire autorisé par l’organisation des références produit ; les [sources pédagogiques](content.md) documentent notamment le périmètre de la certification ANSSI citée pour KeePassXC.

Les paramètres inconnus, mal formés ou hors limites bloquent le démarrage avec une erreur explicite. Les anciennes clés `challengeSeconds`, `explorationSeconds` et `defaultCalmMode` restent reconnues et validées pour compatibilité, mais n’ont plus d’effet.

## Langue et connexion fictive

Au chargement, `?lang=fr` ou `?lang=en` choisit explicitement la langue. Sinon, le jeu retient la première langue française ou anglaise prise en charge dans les préférences du navigateur, avec le français par défaut. Le sélecteur FR/EN reste accessible. Son choix survit au passage au joueur suivant, jusqu’au rechargement de la page ; il n’est pas enregistré.

Le post-it standard affiche `Bureau2026` en français ou `Office2026` en anglais, si la traduction figure dans les phrases acceptées. Une première phrase personnalisée reste identique dans les deux langues. Les autres entrées permettent d’accepter des mots de passe faibles courants. Par défaut, la casse et les espaces en début ou fin ne comptent pas. Après trois essais infructueux, un indice aide à avancer.

En mode facile, la connexion demande où conserver un mot de passe, sans saisir de phrase. Cela ne simule pas l’ouverture d’un gestionnaire sur un poste verrouillé pour déverrouiller ce même poste.

Les phrases du jeu sont publiques et fictives : n’utilisez jamais un vrai mot de passe. Le champ est extérieur à un formulaire et désactive l’autocomplétion. Le texte est masqué visuellement, avec un champ de type mot de passe en repli si le navigateur ne prend pas en charge le masquage CSS. Il n’est ni conservé, ni journalisé, ni envoyé. Ce choix limite les déclenchements des gestionnaires du navigateur, sans pouvoir garantir le comportement de toutes les extensions ; [l’autocomplétion reste une indication au navigateur](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Turning_off_form_autocompletion).

## Préparer le poste

Le dépôt fournit `deployment/ubuntu/install.sh`, des scripts de vérification et de désinstallation pour Ubuntu 24.04 Server. Le [guide Ubuntu](ubuntu-kiosk.md), en anglais, détaille les prérequis, la configuration Cage/Chromium, la recette matérielle et la récupération.

Le système hôte reste responsable du confinement : raccourcis système, accès physique, sortie du navigateur et redémarrage après incident. ShutterOS dispose d’un raccourci volontaire de remise à zéro, `Ctrl+Alt+Home`, qui revient à l’accueil ; il ne verrouille pas le système d’exploitation.

Le lanceur Ubuntu active une protection de confort avec `?kiosk=1`. Lors du clic de démarrage, le jeu demande le plein écran et le verrouillage clavier si le navigateur le permet. Il filtre certains raccourcis tout en laissant fonctionner la saisie, la navigation clavier et le raccourci opérateur. Le menu contextuel, les clics auxiliaires et le zoom par Ctrl + molette sont désactivés dans ce mode ; le défilement et le tactile restent disponibles.

Cette protection n’est pas un confinement du poste : sa capture peut échouer et un appui prolongé sur Échap peut la libérer. Le jeu ne redemande pas le plein écran sans un nouveau clic de démarrage. La démo publique n’active pas cette protection.

## Avant d’accueillir les participants

- Utilisez un profil navigateur dédié, avec l’enregistrement des mots de passe et le remplissage automatique désactivés selon la politique du poste.
- Gardez les identités et phrases du jeu fictives, mais configurez l’identité et le contact de sécurité réels de votre organisation.
- Essayez le parcours complet sur l’écran et avec le dispositif de pointage prévus. Le jeu fonctionne sans son ; l’accueil explique les commandes.
- Vérifiez la déconnexion, le passage au joueur suivant et une remise à zéro à l’expiration de la session.

Aucune progression n’est persistée. Un rechargement, la fermeture du navigateur ou la déconnexion du jeu ouvre une nouvelle session.

Après une mise à jour de fichiers ou de configuration, rechargez la page ou redémarrez Chromium. Une session déjà ouverte conserve son code et sa configuration ; changer de joueur ne les recharge pas. Il n’y a pas de service worker, mais les caches du navigateur ou de l’hébergement peuvent intervenir : contrôlez la version affichée après rechargement. L’installateur Ubuntu redémarre le navigateur lors d’une mise à jour. Pour une vérification de développement, redémarrez `pnpm preview` après reconstruction.

Le compteur se resynchronise au retour du focus ou de la visibilité. Si le processus du navigateur est suspendu, l’expiration prend effet lorsqu’il peut fonctionner à nouveau ; la récupération après un arrêt du processus reste du ressort de l’hôte.

## Fichiers produits

| Chemin                                | Contenu                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `dist/`                               | Site statique, configuration et licences ; copier et servir le dossier complet. |
| `dist/portable/shutteros.html`        | Édition autonome en un fichier.                                                 |
| `.svelte-kit/`                        | Fichiers intermédiaires du compilateur, ignorés par Git.                        |
| `src/app.html`, `portable/index.html` | Modèles sources des deux éditions.                                              |
