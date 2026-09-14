import type {
  ChallengeChoiceId,
  ChallengeDecisionChoiceId,
  ChallengeId,
  Outcome,
} from '../model/game';

interface Choice<Id extends ChallengeId> {
  id: ChallengeDecisionChoiceId<Id>;
  label: string;
  detail: string;
}

interface ChallengeContent<Id extends ChallengeId = ChallengeId> {
  title: string;
  app: string;
  tagline: string;
  question: string;
  hints: readonly [string, string];
  choices: readonly Choice<Id>[];
  feedback: Record<Outcome, string>;
  lesson: string;
  shortLesson: string;
}

export type Challenges = { [Id in ChallengeId]: ChallengeContent<Id> };

export const challenges: Challenges = {
  ai: {
    title: 'Un bon prompt. Les bonnes données ?',
    app: 'Assistant IA',
    tagline: 'Projet courant ou document confidentiel : choisissez le bon cadre.',
    question: 'Que pouvez-vous confier à cet outil ?',
    hints: [
      'L’assistant IA peut aider sur un projet concret. Comparez les notes de parking et de sécurité, puis consultez la charte de l’exercice.',
      'Les noms ne sont pas le seul indice : regardez aussi ce que les notes révèlent sur l’organisation et ce que la charte permet.',
    ],
    choices: [],
    feedback: {
      safe: 'Vous avez choisi un usage autorisé pour cet outil. Vérifiez le compte rendu avant de le diffuser.',
      risky:
        'Le choix de l’outil et celui des données doivent tous deux respecter les règles de votre organisation.',
    },
    lesson:
      'Des noms peuvent être utiles et autorisés dans l’outil interne pour un projet courant. Un document confidentiel demande un autre cadre : retirer les noms ne suffit pas, notamment avant un envoi à une IA commerciale. Vérifiez toujours la sensibilité des informations, la politique de votre organisation et sa charte IA.',
    shortLesson: 'Outil autorisé, données nécessaires, charte respectée.',
  },
  usb: {
    title: 'Une clé. Beaucoup de curiosité.',
    app: 'Explorateur de fichiers',
    tagline: 'Une clé USB a été trouvée près de la machine à café.',
    question: 'Vous en faites quoi ?',
    hints: [
      'Il reste un périphérique dont personne ne connaît la provenance.',
      'L’analyse se fait sur un poste dédié et isolé, pas sur votre ordinateur.',
    ],
    choices: [
      {
        id: 'open',
        label: 'Ouvrir le fichier de primes',
        detail: 'Il ressemble à un document, je veux voir son contenu.',
      },
      {
        id: 'eject',
        label: 'Éjecter la clé',
        detail: 'Arrêter l’exploration et retirer le support.',
      },
      {
        id: 'station',
        label: 'Passer par la station blanche',
        detail: 'Faire contrôler la clé sur un poste dédié, séparé de votre ordinateur.',
      },
      {
        id: 'report',
        label: 'La remettre au support',
        detail: 'La confier au circuit de contrôle prévu.',
      },
    ],
    feedback: {
      safe: 'Vous avez choisi le circuit de contrôle de l’organisation avant d’exécuter le programme.',
      risky:
        'La curiosité a déclenché l’infection simulée. La clé aurait dû passer par le contrôle prévu avant toute utilisation.',
    },
    lesson:
      'Ne branchez pas un support inconnu sur votre poste. Confiez-le au support ou à la station de décontamination prévue (station blanche) : un poste dédié et isolé. Une analyse réduit le risque, sans garantir l’innocuité.',
    shortLesson: 'Un support inconnu passe d’abord par la procédure de contrôle.',
  },
  incident: {
    title: 'Le poste ne répond plus comme avant.',
    app: 'Centre de sécurité',
    tagline: 'Des fichiers deviennent illisibles. Il faut agir.',
    question: 'Quel est votre premier geste ?',
    hints: [
      'Le centre de sécurité propose un exercice pour le jour où un clic tourne mal.',
      'Commencez par empêcher le poste de communiquer, puis utilisez le contact habituel des équipes de sécurité informatique.',
    ],
    choices: [
      {
        id: 'restart',
        label: 'Redémarrer le poste',
        detail: 'Avec un peu de chance, cela disparaîtra.',
      },
      {
        id: 'isolate',
        label: 'Couper la connexion réseau',
        detail: 'Débrancher le câble et désactiver le Wi-Fi.',
      },
      {
        id: 'ignore',
        label: 'Continuer mon travail',
        detail: 'Attendre de voir si le problème se confirme.',
      },
    ],
    feedback: {
      safe: 'Poste isolé, équipes de sécurité informatique prévenues : vous avez limité la propagation et permis la prise en charge de l’incident.',
      risky:
        'Attendre, redémarrer ou effacer des traces peut compliquer la prise en charge. La priorité est d’isoler le réseau, puis d’alerter.',
    },
    lesson:
      'Isolez le poste du réseau, puis contactez rapidement les équipes de sécurité informatique par un canal connu. Évitez de redémarrer, d’éteindre ou de supprimer des fichiers sans leurs consignes.',
    shortLesson:
      'Isoler le réseau. Alerter les équipes de sécurité informatique. Suivre leurs consignes.',
  },
  mail: {
    title: 'Une prime. Et beaucoup d’urgence.',
    app: 'Messagerie',
    tagline: 'Un message des ressources humaines réclame une action immédiate.',
    question: 'Comment vérifiez-vous cette demande ?',
    hints: [
      'Un mail attend une réponse. Le nom de l’expéditeur semble familier…',
      'Affichez l’adresse complète. Pour confirmer, ne reprenez pas les coordonnées contenues dans le message suspect.',
    ],
    choices: [
      { id: 'open', label: 'Ouvrir le lien', detail: 'La demande a l’air officielle.' },
      {
        id: 'reply',
        label: 'Répondre au message',
        detail: 'Demander à son auteur si le mail est authentique.',
      },
      {
        id: 'verify',
        label: 'Contacter les RH via l’annuaire',
        detail: 'Vérifier par un second canal déjà connu.',
      },
      {
        id: 'report',
        label: 'Signaler le message',
        detail: 'Le transmettre au canal de signalement prévu.',
      },
    ],
    feedback: {
      safe: 'Vous avez quitté le canal potentiellement piégé. Votre contact habituel peut confirmer la demande, indépendamment du message reçu.',
      risky:
        'Le lien et la réponse restent dans le canal choisi par l’expéditeur. Un imposteur peut confirmer sa propre histoire.',
    },
    lesson:
      'Vérifiez l’adresse complète et la cohérence de la demande. Au moindre doute, contactez la personne par un numéro ou un canal déjà connu. L’absence de signature numérique ne suffit pas à prouver une fraude.',
    shortLesson: 'Confirmer une demande inhabituelle par un second canal connu.',
  },
  spoof: {
    title: 'Et si l’expéditeur, c’était vous ?',
    app: 'Studio expéditeur',
    tagline: 'Changez le champ « De », puis observez le message reçu.',
    question: 'Un nom rassurant suffit-il à faire confiance ?',
    hints: [
      'Vous savez examiner un mail. Essayez maintenant de modifier son expéditeur.',
      'Choisissez l’adresse de l’usurpateur, gardez un nom crédible, puis envoyez le message dans la simulation.',
    ],
    choices: [],
    feedback: {
      safe: 'Quelques caractères ont suffi à changer l’identité affichée. Ce que vous voyez dans l’en-tête ne constitue pas, à lui seul, une preuve d’identité.',
      risky:
        'Un nom familier et une signature en bas de message peuvent être recopiés. Revenez à un contact connu pour vérifier.',
    },
    lesson:
      'Une adresse d’envoi déléguée peut être légitime. Le nom affiché reste facile à modifier. Même si la messagerie vérifie l’expéditeur, une demande inhabituelle mérite une vérification auprès de votre contact connu.',
    shortLesson: 'L’identité affichée se modifie. La confiance se vérifie.',
  },
  web: {
    title: 'Un portail presque familier.',
    app: 'Navigateur',
    tagline: 'Le lien du document mène à une nouvelle page de connexion.',
    question: 'Que faites-vous avant de vous connecter ?',
    hints: [
      'Un document partagé vous invite à vous reconnecter sur un portail.',
      'Comparez l’adresse du site avec votre favori habituel. Un cadenas ne suffit pas à prouver que le site est le bon.',
    ],
    choices: [
      { id: 'submit', label: 'Me connecter', detail: 'La page ressemble à mon espace habituel.' },
      {
        id: 'trust-lock',
        label: 'Faire confiance au cadenas',
        detail: 'La connexion est chiffrée, donc le site doit être fiable.',
      },
      {
        id: 'known-address',
        label: 'Revenir à mon favori connu',
        detail: 'Accéder au service sans passer par ce lien.',
      },
    ],
    feedback: {
      safe: 'Vous reprenez un chemin connu vers le service. Le piège ne reçoit aucun identifiant.',
      risky:
        'Le portail aurait pu récupérer vos identifiants. Son apparence et sa connexion chiffrée ne prouvent pas son identité.',
    },
    lesson:
      'Le cadenas indique que les échanges avec ce site sont protégés, même si le site est frauduleux. Comparez son adresse et utilisez votre favori habituel. Ici, les champs étaient fictifs : aucune donnée réelle n’a été transmise.',
    shortLesson: 'Le cadenas chiffre la connexion ; il ne certifie pas le site.',
  },
  mfa: {
    title: 'Encore une demande de connexion.',
    app: 'Vérification de connexion',
    tagline: 'Votre téléphone insiste. Vous n’avez pourtant rien demandé.',
    question: 'Vous validez ?',
    hints: [
      'Une demande de connexion attend votre validation.',
      'Si vous n’avez pas commencé la connexion, ne l’approuvez pas. Prévenez ensuite les équipes de sécurité informatique.',
    ],
    choices: [
      { id: 'approve', label: 'Approuver', detail: 'Pour faire disparaître les notifications.' },
      { id: 'ignore', label: 'Ignorer les demandes', detail: 'Cela finira bien par s’arrêter.' },
      {
        id: 'deny-report',
        label: 'Refuser et signaler',
        detail: 'Je n’ai pas initié cette connexion.',
      },
    ],
    feedback: {
      safe: 'Vous avez refusé la connexion et donné l’alerte. Les demandes répétées n’ont pas obtenu votre accord.',
      risky:
        'Approuver pourrait ouvrir votre compte à un tiers. Ignorer les demandes sans les signaler laisse une tentative en cours sans prise en charge.',
    },
    lesson:
      'Une demande de confirmation de connexion que vous n’avez pas déclenchée se refuse et se signale. Si vous avez accepté par erreur, contactez immédiatement les équipes de sécurité informatique. Le lieu affiché peut être approximatif ; le signal clé est que vous n’avez rien demandé.',
    shortLesson: 'Une connexion non demandée : refuser, puis signaler.',
  },
};

export const incidentNotify = {
  question: 'Le poste est isolé. Qui prévenez-vous ?',
  choices: [
    {
      id: 'call-number',
      label: 'Le numéro dans la fenêtre suspecte',
      detail: 'Il propose une assistance immédiate.',
    },
    {
      id: 'notify',
      label: 'Les équipes de sécurité informatique',
      detail: 'Depuis un autre appareil ou un canal connu.',
    },
    {
      id: 'delete',
      label: 'Personne, je supprime les fichiers',
      detail: 'Pour effacer le problème moi-même.',
    },
  ],
} satisfies {
  question: string;
  choices: readonly {
    id: ChallengeChoiceId<'incident', 'notify'>;
    label: string;
    detail: string;
  }[];
};
