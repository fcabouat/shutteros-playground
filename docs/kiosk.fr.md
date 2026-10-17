# Déploiement en borne

[English](kiosk.md)

ShutterOS est une application statique. Elle fonctionne dans un navigateur, sans serveur applicatif, base de données, compte utilisateur ni API externe. Une fois les fichiers disponibles, aucune connexion Internet n’est nécessaire. Pour une borne, servez le dossier construit en HTTP local ; un fichier HTML autonome est également fourni.

## Construire et lancer

Utilisez Node.js 22.13 ou ultérieur — la CI utilise Node 24 — et pnpm 11.19.0 :

```sh
pnpm install --frozen-lockfile
pnpm build
```

La construction produit `../shutteros-build/dist/`. Servez ce dossier avec Python, en remplaçant le chemin par son emplacement absolu :

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory /chemin/vers/dist
```

Ouvrez ensuite `http://127.0.0.1:8080`. `pnpm dev` sert au développement et `pnpm preview` à la vérification locale ; utilisez le build de production pour une borne.

Le jeu charge `kiosk-config.json` à son démarrage. Ce fichier doit rester à côté de `index.html` et être servi comme du JSON. Les logos facultatifs sont également des fichiers locaux placés dans ce dossier ; voir la [personnalisation de l’identité](branding.fr.md).

Après `pnpm build:site`, relancez `pnpm build` avant de distribuer une borne servie à la racine : le site public construit sa démo sous `/demo/`. Pour GitHub Pages, consultez la [documentation de publication](publishing.md).

## Utiliser le fichier autonome

Le même `pnpm build` produit :

```text
../shutteros-build/dist/portable/shutteros.html
```

Ce fichier peut être ouvert directement dans le navigateur, sans serveur HTTP. Il intègre la configuration locale de `private/configuration.json` si `game` y est défini, sinon celle de `static/kiosk-config.json`, ainsi que les logos et les notices de licences. Pour changer un paramètre ou une image, modifiez la configuration privée puis reconstruisez le livrable.

À l’inverse, le site HTTP lit le JSON déployé au chargement : ses paramètres peuvent être changés sans recompilation.

## Configurer la session

Le fichier public `static/kiosk-config.json` utilise le format version 1. Pour une borne propre à votre organisation, placez ce même objet sous la clé `game` dans le fichier ignoré `private/configuration.json`, aux côtés des champs d’identité visuelle. `pnpm build` l’intègre au site local et au fichier autonome ; les builds publics continuent d’utiliser la version générique. La configuration contient les phrases de connexion fictives, la durée de session, le contact de sécurité et les adresses des messages simulés. Voir la [configuration privée unique](branding.fr.md#personnalisation-privée-à-la-construction).

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

Le kit système cible uniquement Ubuntu Server 26.04 amd64 avec Cage et Chromium
Snap. Le [guide technique](ubuntu-kiosk.md), en anglais, décrit les contrôles de
politique navigateur, la recette matérielle et la récupération.

## Clé USB Ubuntu 26.04 hors ligne

Préparez une fois les dépendances avec Internet dans une VM Ubuntu 26.04 fournie
par l’opérateur, avec APT, snapd, `xorriso`, `unsquashfs` (squashfs-tools), `python3-yaml` et le trousseau Ubuntu.
Avant de préparer le cache, placez l’ISO officielle Ubuntu Server 26.04.1 amd64 dans
`../shutteros-build/cache/ubuntu/ubuntu-26.04.1-live-server-amd64.iso`, depuis le
checkout accessible dans cette VM, avec son `SHA256SUMS` vérifié à côté. Utilisez
ce même fichier ISO pour la préparation et l’assemblage. Depuis ce checkout :

```sh
sudo pnpm kiosk:prepare
# Sans pnpm dans cette VM, point d’entrée Python équivalent :
sudo python3 -B deployment/ubuntu/prepare-offline-cache.py \
  --output ../shutteros-build/cache/offline \
  --base-iso ../shutteros-build/cache/ubuntu/ubuntu-26.04.1-live-server-amd64.iso
```

Le cache est calculé depuis les paquets installés dans cette ISO exacte, et non
ceux de la VM de préparation. La simulation APT hors ligne refuse tout retrait de paquet (`--no-remove`) ou dépendance incompatible.
La commande ne crée ni ne démarre la VM. Elle produit
`../shutteros-build/cache/offline`, avec les DEB et les Snap signés nécessaires.
Si la machine de construction est distincte, copiez-y ce cache et la même ISO
avec son `SHA256SUMS`, aux mêmes emplacements relatifs au checkout.

Après l’installation verrouillée des dépendances du projet :

```sh
pnpm kiosk:iso
# Ou :
bun run kiosk:iso
```

Cette commande reconstruit le jeu avec la personnalisation locale courante et
assemble l’image dans `../shutteros-build/kiosk-iso`. Elle ne télécharge pas de
paquets manquants. L’option `--skip-build` exige un build racine dont les métadonnées
correspondent aux sources, à la configuration et au branding actuels ; elle refuse
un ancien build public. `--base-iso` et `--cache` permettent d’utiliser d’autres
emplacements locaux.

Par défaut, l’installateur demande sur chaque PC le nom de la machine, le nom du
compte administrateur et son mot de passe. Vous pouvez choisir `kiosk-admin` comme
nom de compte. Le mot de passe saisi n’est pas intégré à l’ISO commune : conservez-le
selon vos règles d’administration, car il sert à la récupération en console et à
SSH. Les anciens fichiers `../shutteros-build/config/operator.json` et
`operator-password.txt`, s’ils existent, ne sont pas repris automatiquement.
L’option explicite `--admin-config /chemin/operator.json` reste disponible pour une
configuration préparée à l’avance ; son hash ou ses clés SSH sont alors présents
sur le média. Gardez ces fichiers hors de `private/`, réservé à la configuration
locale du jeu et à ses images, et de Git.

Écrivez l’ISO sur la clé avec votre outil habituel, en vérifiant le périphérique
visé. Au démarrage de chaque PC, renseignez le compte administrateur et son mot de
passe, sélectionnez le disque puis confirmez l’installation dans l’installateur.
Vérifiez attentivement le disque choisi : son contenu sera remplacé. La clé
contient les dépendances pour l’installation et le premier démarrage : aucun
accès Internet n’est requis sur les postes. Le premier démarrage installe les
Snap signés, connecte leur interface de politiques puis configure la borne.

Sur une clé plus grande que l’ISO hybride, `fdisk` peut signaler que la copie de
secours de la table GPT se trouve à la fin de l’image, pas à la fin de la clé.
Ce décalage de capacité n’empêche pas, à lui seul, l’amorçage UEFI. Ne modifiez
pas la table de partitions de l’ISO pour l’adapter à une taille de clé : elle
doit fonctionner sur plusieurs capacités. Vérifiez le SHA-256 du **fichier ISO**,
la présence des partitions de données et EFI sur la clé, puis effectuez le test
d’amorçage sur un PC cible. Une lecture intégrale de la clé peut différer de
l’ISO dans les métadonnées GPT après manipulation de la clé.

Une ISO antérieure du 13 octobre 2026 a passé l’installation hors ligne sur
disque virtuel vierge, le premier démarrage, l’affichage du jeu et l’accès
administrateur par console et SSH local. L’ISO reconstruite avec la
configuration privée a passé le contrôle de son contenu et un démarrage UEFI
jusqu’à Subiquity, sans nouvelle installation complète. Aucune de ces recettes
VM ne valide le démarrage USB ni le matériel des PC prévus :
effectuez d’abord une installation et une recette complètes sur un PC physique
avant de déployer les autres bornes. En cas d’échec, utilisez
`Ctrl+Alt+F2` puis authentifiez-vous avec le compte administrateur et son mot de
passe, ou utilisez SSH. Cage autorise ce changement de console pendant que la
borne fonctionne ; `Ctrl+Alt+F1` revient au jeu. Un administrateur configuré
uniquement avec des clés SSH a un mot de passe verrouillé et nécessite SSH sur
un réseau local pour la récupération. Consultez
`/var/log/shutteros-provisioning/firstboot.log` et
`journalctl -u shutteros-firstboot.service`. Les détails de reprise sont dans le
[guide technique](ubuntu-kiosk.md#recovery-and-removal). Ni la construction ISO ni
les essais VM ne sont exécutés automatiquement ou dans la CI.

## Fichiers vides ou services masqués après un redémarrage

Un service indiqué « masked » peut être un fichier d’unité de zéro octet.
Un écran blanc peut aussi venir d’un `index.html` ou de fichiers JavaScript vides,
même si les services sont actifs. Ce n’est pas un nettoyage normal de systemd.
Conservez les fichiers endommagés et les journaux avant restauration ; le
[diagnostic technique](ubuntu-kiosk.md#recovery-and-removal) donne les contrôles
à effectuer. La seule présence de fichiers vides ne démontre ni une coupure
électrique ni une panne du disque.

Le kit synchronise désormais les fichiers sur disque avant de lancer le jeu,
remplace les unités et lanceurs par renommage de fichiers complets, et conserve
un inventaire SHA-256 du site. `verify.sh` détecte les fichiers manquants ou
altérés et vérifie le contenu HTTP, pas seulement la réponse du serveur. Une
modification volontaire de configuration doit passer par la source du build et
une réinstallation pour renouveler cet inventaire. Le marqueur de réussite du
premier démarrage est lui aussi synchronisé avant sa publication.

Ces changements concernent les futures installations avec le nouveau kit ; ils
ne modifient pas les ISO déjà générées ni les postes réparés. Une ancienne
installation sans inventaire nécessite une réinstallation contrôlée pour passer
le nouveau vérificateur. Si son marqueur de propriété est vide, ne devinez pas
l’ancien état de la console et ne relancez pas aveuglément le premier démarrage.

Après installation ou réparation, utilisez `sudo sync && sudo systemctl poweroff`,
attendez l’extinction complète, puis rallumez et contrôlez le jeu et les sommes de
contrôle. Les écritures synchronisées réduisent le risque de perte lors d’une
coupure ; elles ne rendent pas toute l’installation indivisible et ne corrigent
pas un stockage défectueux.

## Avant d’accueillir les participants

- Utilisez un profil navigateur dédié, avec l’enregistrement des mots de passe et le remplissage automatique désactivés selon la politique du poste.
- Gardez les identités et phrases du jeu fictives, mais configurez l’identité et le contact de sécurité réels de votre organisation.
- Essayez le parcours complet sur l’écran et avec le dispositif de pointage prévus. Le jeu fonctionne sans son ; l’accueil explique les commandes.
- Vérifiez la déconnexion, le passage au joueur suivant et une remise à zéro à l’expiration de la session.

Aucune progression n’est persistée. Un rechargement, la fermeture du navigateur ou la déconnexion du jeu ouvre une nouvelle session.

Après une mise à jour de fichiers ou de configuration, rechargez la page ou redémarrez Chromium. Une session déjà ouverte conserve son code et sa configuration ; changer de joueur ne les recharge pas. Il n’y a pas de service worker, mais les caches du navigateur ou de l’hébergement peuvent intervenir : contrôlez la version affichée après rechargement. L’installateur Ubuntu redémarre le navigateur lors d’une mise à jour. Pour une vérification de développement, redémarrez `pnpm preview` après reconstruction.

Le compteur se resynchronise au retour du focus ou de la visibilité. Si le processus du navigateur est suspendu, l’expiration prend effet lorsqu’il peut fonctionner à nouveau ; la récupération après un arrêt du processus reste du ressort de l’hôte.

## Fichiers produits

| Chemin                                            | Contenu                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `../shutteros-build/dist/`                        | Site statique, configuration et licences ; copier et servir le dossier complet. |
| `../shutteros-build/dist/portable/shutteros.html` | Édition autonome en un fichier.                                                 |
| `../shutteros-build/svelte-kit/`                  | Fichiers intermédiaires du compilateur, ignorés par Git.                        |
| `src/app.html`, `portable/index.html`             | Modèles sources des deux éditions.                                              |
