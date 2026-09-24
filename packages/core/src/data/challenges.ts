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
  lessonEmphasis: string;
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
      'L’assistant IA peut aider sur un projet concret. Comparez les notes de préparation d’un repas et de sécurité, puis consultez la charte de l’exercice.',
      'Les noms ne sont pas le seul indice : regardez aussi ce que les notes révèlent sur l’organisation et ce que la charte permet.',
    ],
    choices: [],
    feedback: {
      safe: 'Vous avez choisi un usage autorisé pour cet outil. Vérifiez le compte rendu avant de le diffuser.',
      risky:
        'Le choix de l’outil et celui des données doivent tous deux respecter les règles de votre organisation.',
    },
    lessonEmphasis: 'retirer les noms ne suffit pas',
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
        id: 'archive',
        label: 'Ouvrir l’archive de photos',
        detail: 'Je veux consulter les photos qui se trouvent dans l’archive.',
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
    lessonEmphasis: 'Ne branchez pas un support inconnu sur votre poste.',
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
    lessonEmphasis: 'Isolez le poste du réseau',
    lesson:
      'Isolez le poste du réseau, puis contactez rapidement les équipes de sécurité informatique par un canal connu. Évitez de redémarrer, d’éteindre ou de supprimer des fichiers sans leurs consignes.',
    shortLesson:
      'Isoler le réseau. Alerter les équipes de sécurité informatique. Suivre leurs consignes.',
  },
  mail: {
    title: 'Une pièce jointe presque ordinaire.',
    app: 'Messagerie',
    tagline: 'Un message plausible arrive avec une adresse étrange et un fichier à ouvrir.',
    question: 'Que faites-vous de ce message ?',
    hints: [
      'Le sujet et le ton paraissent ordinaires. Examinez aussi l’adresse complète et la pièce jointe.',
      'Répondre reste dans le canal choisi par l’expéditeur. Le signalement permet aux équipes de sécurité informatique d’examiner le message.',
    ],
    choices: [
      {
        id: 'report',
        label: 'Transmettre aux équipes de sécurité informatique',
        detail: 'Utiliser le canal de signalement prévu par l’organisation.',
      },
      {
        id: 'open',
        label: 'Ouvrir la pièce jointe',
        detail: 'Le message explique pourquoi elle a été envoyée.',
      },
      {
        id: 'reply',
        label: 'Répondre au message',
        detail: 'Demander à l’expéditeur de confirmer la pièce jointe.',
      },
    ],
    feedback: {
      safe: 'Vous avez transmis le message suspect au canal prévu. Les équipes de sécurité informatique peuvent l’examiner sans exécuter la pièce jointe.',
      risky:
        'Ouvrir la pièce jointe ou répondre reste dans le scénario préparé par l’expéditeur. Un imposteur peut confirmer sa propre histoire.',
    },
    lessonEmphasis: 'Vérifiez l’adresse complète et la cohérence de la demande',
    lesson:
      'Un message plausible peut contenir une pièce jointe dangereuse. Vérifiez l’adresse complète et la cohérence de la demande, puis transmettez les messages suspects aux équipes de sécurité informatique par le canal prévu. Si vous devez confirmer, utilisez un contact connu indépendant du message.',
    shortLesson: 'Examiner l’adresse et la demande. Signaler sans ouvrir ni répondre.',
  },
  spoof: {
    title: 'Une adresse connue. Une demande inhabituelle.',
    app: 'Messagerie',
    tagline:
      'Un contact habituel demande d’envoyer un document interne vers une adresse personnelle.',
    question: 'Que faites-vous de cette demande ?',
    hints: [
      'L’adresse affichée est celle du contact habituel, mais la demande sort du cadre de travail normal.',
      'Un compte réel peut être compromis. Transmettez le message aux équipes de sécurité informatique au lieu d’utiliser la conversation suspecte.',
    ],
    choices: [
      {
        id: 'comply',
        label: 'Envoyer le document',
        detail: 'Le message vient de l’adresse professionnelle habituelle.',
      },
      {
        id: 'report',
        label: 'Transmettre aux équipes de sécurité informatique',
        detail: 'Utiliser le canal de signalement prévu par l’organisation.',
      },
      {
        id: 'reply',
        label: 'Répondre pour confirmer',
        detail: 'Demander dans cette conversation si la demande est correcte.',
      },
    ],
    feedback: {
      safe: 'Vous avez signalé une demande inhabituelle avant de sortir le document interne de son environnement de travail.',
      risky:
        'Une adresse familière ne rend pas la demande sûre. Une réponse peut parvenir au même imposteur ou au compte déjà compromis.',
    },
    lessonEmphasis: 'l’identité visible ne suffit pas',
    lesson:
      'Le nom affiché peut être copié, une adresse peut être usurpée et une boîte mail réelle peut aussi être compromise. Les systèmes de messagerie disposent de contrôles, mais l’identité visible ne suffit pas à valider une demande inhabituelle. Signalez-la par le canal prévu et vérifiez avec un contact connu indépendant du message.',
    shortLesson: 'Même une boîte connue peut être compromise. Signaler la demande inhabituelle.',
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
    lessonEmphasis: 'Comparez son adresse et utilisez votre favori habituel.',
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
      {
        id: 'deny-report',
        label: 'Refuser et signaler',
        detail: 'Je n’ai pas initié cette connexion.',
      },
      { id: 'approve', label: 'Approuver', detail: 'Pour faire disparaître les notifications.' },
      { id: 'ignore', label: 'Ignorer les demandes', detail: 'Cela finira bien par s’arrêter.' },
    ],
    feedback: {
      safe: 'Vous avez refusé la connexion et donné l’alerte. Les demandes répétées n’ont pas obtenu votre accord.',
      risky:
        'Approuver pourrait ouvrir votre compte à un tiers. Ignorer les demandes sans les signaler laisse une tentative en cours sans prise en charge.',
    },
    lessonEmphasis: 'se refuse et se signale',
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
