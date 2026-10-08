# Jouer et animer une session ShutterOS

Vous incarnez Camille Martin sur un poste fictif : une clé USB trouvée, des messages à examiner et des gestes pour protéger le poste. Prévoyez dix à vingt minutes. Les comptes, fichiers et échanges sont simulés : n’utilisez jamais un vrai mot de passe ni des informations personnelles.

## Commencer

L’[écran d’accueil](images/welcome.fr.png) présente la **barre de jeu**, visible pendant tout le parcours, et propose deux modes :

- **Mode facile**, proposé par défaut : avancez une situation après l’autre, avec les choix affichés. L’[écran de connexion](images/login-guided.fr.png) propose un QCM sur le rangement d’un mot de passe à côté du compte. Vous pouvez répondre ou ouvrir directement la session avec le mot de passe fictif.
- **Mode défi (exploration libre)** : explorez les applications et trouvez les commandes pour agir. À la connexion, retrouvez le mot de passe fictif ; un indice aide après trois essais ratés ou deux minutes de recherche.

Choisissez le niveau qui vous convient à l’accueil. Vous pouvez changer de mode à tout moment sans perdre votre progression.

Utiliser le post-it pour entrer dans la simulation n’est pas une faute : il illustre un secret mal protégé. Le gestionnaire cité dans les explications est celui configuré pour l’exercice, KeePassXC par défaut.

Les fenêtres **Vigilance** invitent à examiner une situation ; celles portant **Protéger mon poste** proposent des gestes de sécurisation. Les libellés accompagnent les couleurs : le jeu ne demande pas de deviner la fonction d’une fenêtre.

## Trouver son chemin

La barre de jeu affiche les activités restantes, **Un indice ?**, le changement de mode et le temps disponible. Les commandes sans effet à l’étape courante sont désactivées. Depuis le bureau, le compteur permet de rejoindre la prochaine activité sans révéler son indice.

Un indice donne une piste, parfois un repère visuel. Vous pouvez le masquer puis le relire. En mode défi, cherchez comment agir dans les applications : le QCM ne s’ouvre jamais automatiquement. Passez en mode facile pour afficher les choix, sans perdre votre place ; revenir au mode défi les masque. L’indice reste indépendant du mode et se propose aussi après deux minutes sans progression. Aucun chrono local ne presse votre réponse.

Le parcours comprend sept scénarios et une activité en trois étapes : mot de passe, mises à jour et verrouillage. En mode facile, une consigne indique le prochain geste à effectuer et les boutons à utiliser. Ces trois gestes doivent être essayés avant le bilan ; la question complémentaire sur le mot de passe est facultative. Dans la messagerie, continuer après un premier courriel conduit à celui qui reste.

Dans l’assistant IA, le [mode défi propose un chat simulé](images/ai-free.fr.png) : choisissez l’outil, relisez la charte et préparez le message avant de l’envoyer. Le [mode facile présente directement les cinq messages sous forme de QCM](images/ai-guided.fr.png). Le changement de mode conserve votre sélection.

## Lire son bilan

Un [premier écran récapitule votre parcours](images/journey-summary.fr.png), les activités réalisées sur sept, les gestes de sécurisation sur trois et les indices d’activité consultés sur huit. Ses badges décrivent les gestes réalisés ; demander de l’aide ne retire aucun point. Le bilan détaillé explique ensuite les résultats. Il n’y a pas de note, d’enregistrement ni d’envoi de vos réponses.

Un résultat orange indique une bonne réaction après une prise de risque, par exemple éjecter une clé après avoir ouvert son fichier texte. Rejouer permet de comparer sans remplacer le premier résultat. La charte IA de l’exercice reste accessible depuis la réponse de l’assistant.

Le sablier démarre après l’exercice de connexion et laisse trente minutes par défaut. Vous pouvez terminer plus tôt pour passer au joueur suivant. À zéro ou après une déconnexion, l’accueil revient et la progression est effacée. Une fenêtre de bilan réduite peut être retrouvée depuis la barre de jeu.

## Commandes utiles

- **Langue** : FR ou EN dès l’accueil, puis dans la barre des tâches.
- **Fenêtres** : déplacez-les par leur titre, redimensionnez les fenêtres principales par leurs bords, réduisez-les puis retrouvez-les dans la barre des tâches. Les indices et le fichier texte sont des fenêtres indépendantes.
- **Taille** : les nouvelles activités s’ouvrent en fenêtre dans les deux modes, pour garder le bureau visible. Vous pouvez les agrandir ; le QCM peut élargir la fenêtre pour accueillir les choix, sans la maximiser.
- **Clavier** : Tab passe d’une commande à l’autre ; Entrée ou Espace active les boutons. Le mot de passe fictif est masqué ; le bouton œil permet de le vérifier.
- **Déconnexion** : une confirmation évite d’effacer la progression par erreur. Le raccourci opérateur `Ctrl+Alt+Home` réinitialise immédiatement le jeu.

## Animer une session

Laissez la personne chercher, puis demandez « Qu’est-ce qui vous a fait choisir cette action ? ». Les erreurs et le recours aux indices ouvrent la discussion. Pour les usages réels, les procédures et la charte de votre organisation priment sur celles de l’exercice.

Avant l’évènement, essayez les deux modes sur le poste prévu, avec changement de langue, déconnexion et remise à zéro. Vérifiez les contacts de sécurité affichés. Pour préparer le poste : [personnalisation](branding.md), [déploiement en borne](kiosk.md), [installation Ubuntu](ubuntu-kiosk.md). Les [notes pédagogiques](content.md) expliquent les scénarios **en dévoilant les solutions** ; ces documents techniques sont en anglais.
