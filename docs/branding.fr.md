# Personnalisation de l’identité

[English](branding.md)

ShutterOS désigne le système fictif du jeu, avec son symbole de fenêtre et de rideaux. Le nom de l’évènement et les identités des organisations apparaissent dans la barre de jeu, dès l’accueil. Vous pouvez ajouter un second partenaire. Sans configuration, le jeu affiche « Votre organisation » ou « Your organization », selon la langue choisie.

Les logos des organisations apparaissent à gauche, suivis d’un séparateur puis du nom de l’évènement. Avec deux organisations, les deux logos sont alignés sur une même ligne. Chaque logo conserve ses proportions dans une zone de 52 px de haut au sein de la barre de 64 px, avec une marge de 6 px en haut et en bas.

Lorsqu’un logo se charge correctement, le nom de l’organisation est masqué visuellement par défaut pour garder une barre compacte. Il reste disponible pour les lecteurs d’écran et dans une infobulle. Sans logo, ou si l’image ne peut pas être chargée, le nom est affiché. La personnalisation privée à la construction peut forcer l’affichage des noms à côté des logos valides grâce à `showOrganizationNames`, décrit plus bas.

Deux méthodes sont disponibles : modifier la configuration du site déjà construit, ou préparer un livrable personnalisé depuis les sources. Les logos restent la propriété de leurs titulaires ; voir les [mentions et licences](legal.md).

## Personnaliser un site déployé

Pour un site servi en HTTP, modifiez les champs suivants dans le fichier complet `../shutteros-build/dist/kiosk-config.json`, en conservant ses autres paramètres :

```json
{
  "organizationName": "Votre organisation",
  "organizationLogo": "logo-organisation.svg",
  "partnerOrganizationName": "Organisation partenaire",
  "partnerOrganizationLogo": "logo-partner-organisation.svg"
}
```

Placez les images à côté du fichier de configuration et de `index.html` :

```text
../shutteros-build/dist/
  index.html
  kiosk-config.json
  logo-organisation.svg
  logo-partner-organisation.svg
```

Pour une seule organisation, omettez les deux champs `partnerOrganization*`. Chaque organisation peut avoir un nom sans logo ; un logo partenaire exige le nom du partenaire. Omettez `organizationName` pour garder le libellé générique traduit.

Les images doivent respecter ces contraintes :

- PNG, WebP ou SVG, de 256 Kio au maximum chacune ;
- nom de fichier composé de lettres ASCII, chiffres, points, tirets ou traits de soulignement ; aucun chemin, URL, paramètre ni fragment ;
- pour un SVG, fichier autonome avec un `viewBox`, sans police ni image externe nécessaire.

Les logos conservent leurs proportions dans la zone de 52 px de haut et s’alignent horizontalement dans la barre de jeu. Sur un petit écran, les commandes passent à la ligne. Un logo absent ou illisible laisse apparaître le nom de l’organisation.

Rechargez la page après modification. Le dossier `../shutteros-build/dist/` est régénéré à chaque build : conservez une copie locale de votre configuration et de vos images ailleurs. Pour une construction depuis les sources, placez les images dans `static/` ; elles seront copiées dans `../shutteros-build/dist/`. Les noms `static/logo-organisation.*` et `static/logo-partner-organisation.*` sont ignorés par Git. Tout autre nom personnalisé exige sa propre règle d’exclusion.

## Personnaliser le fichier HTML autonome

Le livrable `../shutteros-build/dist/portable/shutteros.html` contient sa configuration et ses logos. Pour un build local personnalisé, éditez `private/configuration.json` ; le fichier public `static/kiosk-config.json` reste générique. Placez les images nommées par le JSON du jeu dans `static/`, puis lancez `pnpm build`.

La construction vérifie chaque image avant de l’intégrer : présence, taille, format conforme à l’extension et emplacement dans `static/`, y compris après résolution des liens symboliques. Une image non conforme fait échouer le build. Modifier uniquement le JSON d’un site déployé ne change pas le fichier HTML autonome.

## Personnalisation privée à la construction

Créez un seul fichier ignoré `private/configuration.json` pour l’identité et les paramètres du jeu :

```json
{
  "applicationName": "ShutterOS",
  "organizationName": "Votre organisation",
  "campaignName": "Cybermois",
  "organizationLogo": "private/logo.png",
  "showOrganizationNames": true
}
```

`applicationName` est le nom du système ; `organizationName` est celui de l’organisation. Les champs facultatifs `partnerOrganizationName` et `partnerOrganizationLogo` ajoutent un partenaire, avec son image également placée dans `private/`. Définissez `showOrganizationNames` à `true` pour garder les deux noms visibles même lorsque leurs logos se chargent correctement. Cette option vaut `false` par défaut et n’est disponible que dans `private/configuration.json`, pas dans `kiosk-config.json`.

Pour personnaliser les coordonnées et la simulation, ajoutez au même objet une clé `game` contenant **l’objet complet** de `static/kiosk-config.json` (format version 1), puis changez ses valeurs locales. Sans cette clé, le build utilise le fichier public générique. Le build local copie ce sous-objet dans `../shutteros-build/dist/kiosk-config.json` et l’intègre au HTML autonome. `pnpm verify` et `pnpm build:site` n’utilisent jamais le fichier privé. Les phrases de connexion restent fictives : ne mettez aucun vrai mot de passe ou secret opérationnel dans ce fichier ou dans l’ISO.

Cette méthode accepte des logos PNG, WebP ou SVG de 256 Kio au maximum. Les SVG doivent être autonomes, comme pour la configuration de déploiement. Les commandes de développement, de vérification, de build et de Storybook préparent automatiquement l’identité. Elles vérifient les noms, le format réel des images et leur emplacement, puis génèrent le module local ignoré par Git `../shutteros-build/generated/branding.generated.ts`. Aucune URL distante n’est acceptée.

L’identité privée prend le pas sur celle du déploiement, indépendamment pour chaque organisation. Pour les logos, l’ordre est : image privée, image intégrée au livrable autonome, puis fichier nommé dans `kiosk-config.json`. Sans fichier privé, la construction utilise l’identité générique ShutterOS.

## Garder les livrables publics génériques

Le dossier `private/` et le module généré ne doivent pas être versionnés. Ne mettez aucun mot de passe réel, identifiant d’accès ou secret dans la configuration.

Un livrable personnalisé contient les identités et coordonnées locales : ignorer le fichier source dans Git ne les retire pas du HTML, du JSON produit ou de l’ISO. Ces livrables restent dans `../shutteros-build/`, hors du dépôt public. Pour la démonstration publique, `pnpm build:site` impose la configuration générique. Avant de commiter, vérifiez les fichiers préparés : `.gitignore` n’exclut pas un fichier déjà suivi.

Pour les autres paramètres et la mise en service, consultez le [déploiement en borne](kiosk.fr.md).

`private/` est réservé au JSON et aux images de personnalisation. Les caches ISO, les identifiants opérateur et les fichiers de VM restent dans `../shutteros-build`. `pnpm kiosk:iso` reconstruit le branding local courant ; son option stricte `--skip-build` exige des métadonnées correspondantes et refuse un ancien build public.
