import type { ChallengeId, Outcome } from '../model/game';

export interface Choice {
  id: string;
  label: string;
  detail: string;
}

export interface ChallengeContent {
  title: string;
  app: string;
  tagline: string;
  question: string;
  hints: readonly [string, string];
  choices: readonly Choice[];
  feedback: Record<Outcome, string>;
  lesson: string;
  shortLesson: string;
}

export const challenges: Record<ChallengeId, ChallengeContent> = {
  usb: {
    title: 'Une clé. Beaucoup de curiosité.',
    app: 'Explorateur de fichiers',
    tagline: 'Une clé USB a été trouvée près de la machine à café.',
    question: 'Vous en faites quoi ?',
    hints: [
      'Il reste un périphérique dont personne ne connaît la provenance.',
      'L’analyse se fait sur un poste dédié et isolé, pas sur votre ordinateur.',
    ],
    choices: [
      { id: 'open', label: 'Ouvrir la clé', detail: 'Juste pour savoir à qui elle appartient.' },
      {
        id: 'station',
        label: 'Passer par la station blanche',
        detail: 'Suivre la procédure prévue pour les supports externes.',
      },
      { id: 'report', label: 'La remettre au support', detail: 'Sans la brancher sur mon poste.' },
    ],
    feedback: {
      safe: 'La clé reste hors du poste de travail. Vous avez évité un risque avant même d’ouvrir un fichier.',
      risky:
        'Bingo : dans cette simulation, la clé a infecté le poste. Son contenu aurait dû passer par le contrôle prévu avant toute utilisation.',
      timeout:
        'Une clé inconnue peut attendre. Mieux vaut demander au support que la brancher par curiosité.',
    },
    lesson:
      'Ne branchez pas un support inconnu sur votre poste. Confiez-le au support ou à la station blanche prévue : un poste dédié et isolé. Une analyse réduit le risque, sans garantir l’innocuité.',
    shortLesson: 'Un support inconnu passe d’abord par la procédure de contrôle.',
  },
  incident: {
    title: 'Le poste ne répond plus comme avant.',
    app: 'Centre de sécurité',
    tagline: 'Des fichiers deviennent illisibles. Il faut agir.',
    question: 'Quel est votre premier geste ?',
    hints: [
      'Le centre de sécurité propose un exercice pour le jour où un clic tourne mal.',
      'Commencez par empêcher le poste de communiquer, puis utilisez le contact habituel du support.',
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
      safe: 'Poste isolé, support prévenu : vous avez limité la propagation et permis la prise en charge de l’incident.',
      risky:
        'Attendre, redémarrer ou effacer des traces peut compliquer la prise en charge. La priorité est d’isoler le réseau, puis d’alerter.',
      timeout:
        'L’important n’est pas d’improviser un dépannage. Retenez les deux étapes : isoler le poste, puis prévenir le support.',
    },
    lesson:
      'Isolez le poste du réseau, puis contactez rapidement l’équipe informatique ou SSI par un canal connu. Évitez de redémarrer, d’éteindre ou de supprimer des fichiers sans ses consignes.',
    shortLesson: 'Isoler le réseau. Alerter le support. Suivre ses consignes.',
  },
  mail: {
    title: 'Une prime. Et beaucoup d’urgence.',
    app: 'Messagerie',
    tagline: 'Un message des ressources humaines réclame une action immédiate.',
    question: 'Comment vérifiez-vous cette demande ?',
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
    ],
    feedback: {
      safe: 'Vous avez quitté le canal potentiellement piégé. Votre contact habituel peut confirmer la demande, indépendamment du message reçu.',
      risky:
        'Le lien et la réponse restent dans le canal choisi par l’expéditeur. Un imposteur peut confirmer sa propre histoire.',
      timeout:
        'L’urgence fait partie du piège. Vous n’avez pas besoin d’obéir à un délai imposé par un message douteux.',
    },
    lesson:
      'Vérifiez l’adresse complète et la cohérence de la demande. Au moindre doute, contactez la personne par un numéro ou un canal déjà connu. L’absence de signature numérique ne suffit pas à prouver une fraude.',
    shortLesson: 'Confirmer une demande inhabituelle par un second canal connu.',
  },
  spoof: {
    title: 'Et si l’expéditeur, c’était vous ?',
    app: 'Studio expéditeur',
    tagline: 'Changez le champ « De », puis observez le message reçu.',
    question: 'Un nom rassurant suffit-il à faire confiance ?',
    hints: [
      'Vous savez examiner un mail. Essayez maintenant de modifier son expéditeur.',
      'Choisissez l’adresse de l’usurpateur, gardez un nom crédible, puis envoyez le message dans la simulation.',
    ],
    choices: [],
    feedback: {
      safe: 'Quelques caractères ont suffi à changer l’identité affichée. Ce que vous voyez dans l’en-tête ne constitue pas, à lui seul, une preuve d’identité.',
      risky:
        'Un nom familier et une signature en bas de message peuvent être recopiés. Revenez à un contact connu pour vérifier.',
      timeout:
        'Le champ « De » ne raconte pas toute l’histoire. Une délégation peut être légitime ; un nom affiché peut aussi imiter quelqu’un.',
    },
    lesson:
      'Une adresse d’envoi déléguée peut être légitime. Le nom affiché reste facile à modifier. Une signature numérique valide apporte des garanties d’intégrité et de certificat, pas une garantie d’innocuité du contenu.',
    shortLesson: 'L’identité affichée se modifie. La confiance se vérifie.',
  },
  web: {
    title: 'Un portail presque familier.',
    app: 'Navigateur',
    tagline: 'Le lien du document mène à une nouvelle page de connexion.',
    question: 'Que faites-vous avant de vous connecter ?',
    hints: [
      'Un document partagé vous invite à vous reconnecter sur un portail.',
      'Regardez le domaine. Le cadenas parle du chiffrement, pas de la légitimité du site.',
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
      timeout:
        'Vous pouvez laisser ce formulaire de côté et retrouver le service par votre chemin habituel.',
    },
    lesson:
      'HTTPS chiffre la connexion, y compris vers un site frauduleux. Vérifiez le domaine et utilisez une adresse ou un favori connu. Ici, les champs étaient fictifs : aucune donnée réelle n’a été transmise.',
    shortLesson: 'Le cadenas chiffre la connexion ; il ne certifie pas le site.',
  },
  mfa: {
    title: 'Encore une demande de connexion.',
    app: 'Vérification de connexion',
    tagline: 'Votre téléphone insiste. Vous n’avez pourtant rien demandé.',
    question: 'Vous validez ?',
    hints: [
      'Une demande de connexion attend votre validation.',
      'Si vous n’avez pas commencé la connexion, ne l’approuvez pas. Prévenez ensuite le support.',
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
      timeout:
        'Aucune validation n’a eu lieu. Pensez aussi à signaler cette demande inattendue : quelqu’un peut tenter d’utiliser votre compte.',
    },
    lesson:
      'Une validation MFA inattendue se refuse et se signale. Si vous avez accepté par erreur, contactez immédiatement le support. Le lieu affiché peut être approximatif ; le signal clé est que vous n’avez rien demandé.',
    shortLesson: 'Une connexion non demandée : refuser, puis signaler.',
  },
};

export const incidentNotify = {
  question: 'Le poste est isolé. Qui prévenez-vous ?',
  choices: [
    {
      id: 'call-number',
      label: 'Le numéro dans la fenêtre suspecte',
      detail: 'Il propose une assistance immédiate.',
    },
    {
      id: 'notify',
      label: 'Mon support habituel',
      detail: 'Depuis un autre appareil ou un canal connu.',
    },
    {
      id: 'delete',
      label: 'Personne, je supprime les fichiers',
      detail: 'Pour effacer le problème moi-même.',
    },
  ],
} satisfies { question: string; choices: readonly Choice[] };
