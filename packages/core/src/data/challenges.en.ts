import type { ChallengeChoiceId } from '../model/game';
import type { Challenges } from './challenges';

export const englishChallenges: Challenges = {
  ai: {
    title: 'A good prompt. The right data?',
    app: 'AI assistant',
    tagline: 'Routine project or confidential document: choose the right scope.',
    question: 'What can you share with this tool?',
    hints: [
      'The AI assistant can help with a real work task. Compare the car park and security notes, then check the exercise policy.',
      'Names are not the only clue: also consider what the notes reveal about the organisation and what the policy permits.',
    ],
    choices: [],
    feedback: {
      safe: 'You chose an approved use for this tool. Check the minutes before sharing them.',
      risky: 'Both the tool and the data must comply with your organisation’s rules.',
    },
    lesson:
      'Names can be useful and permitted in the internal tool for routine work. Confidential documents need a different approved scope: removing names is not enough, especially before sending to a commercial AI service. Always check how sensitive the information is, your organisation’s policy and its AI usage charter.',
    shortLesson: 'Approved tool, necessary data, policy followed.',
  },
  usb: {
    title: 'One drive. Lots of curiosity.',
    app: 'File explorer',
    tagline: 'A USB drive was found near the coffee machine.',
    question: 'What do you do with it?',
    hints: [
      'There is a device whose origin nobody knows.',
      'Analysis happens on a dedicated, isolated station, not on your computer.',
    ],
    choices: [
      {
        id: 'open',
        label: 'Open the bonuses file',
        detail: 'It looks like a document; I want to see its contents.',
      },
      {
        id: 'archive',
        label: 'Open the photo archive',
        detail: 'The ZIP file looks less suspicious than the disguised program.',
      },
      {
        id: 'eject',
        label: 'Eject the drive',
        detail: 'Stop exploring and remove the device.',
      },
      {
        id: 'station',
        label: 'Use the media sanitisation station',
        detail: 'Have the drive checked on a dedicated computer, separate from your workstation.',
      },
      {
        id: 'report',
        label: 'Give it to support',
        detail: 'Hand it to the designated inspection process.',
      },
    ],
    feedback: {
      safe: 'You chose your organisation’s inspection process before running the program.',
      risky:
        'Curiosity triggered the simulated infection. The media should have gone through the required check first.',
    },
    lesson:
      'Do not plug unknown media into your workstation. Give it to support or the designated media sanitisation station: a dedicated, isolated computer. Analysis reduces risk without guaranteeing safety.',
    shortLesson: 'Unknown media goes through the checking procedure first.',
  },
  incident: {
    title: 'The workstation is not behaving as before.',
    app: 'Security center',
    tagline: 'Files are becoming unreadable. You need to act.',
    question: 'What is your first move?',
    hints: [
      'The security center offers an exercise for the day when a click goes wrong.',
      'First stop the workstation communicating, then use your known security contact.',
    ],
    choices: [
      {
        id: 'restart',
        label: 'Restart the workstation',
        detail: 'Maybe the problem will disappear.',
      },
      {
        id: 'isolate',
        label: 'Cut the network connection',
        detail: 'Unplug the cable and disable Wi-Fi.',
      },
      {
        id: 'ignore',
        label: 'Continue working',
        detail: 'Wait to see whether the problem is confirmed.',
      },
    ],
    feedback: {
      safe: 'Workstation isolated, security team alerted: you limited the spread and enabled incident response.',
      risky:
        'Waiting, restarting, or erasing traces can complicate response. First isolate the network, then alert the security team.',
    },
    lesson:
      'Isolate the workstation from the network, then promptly contact the security team through a known channel. Do not restart, shut down, or delete files without their instructions.',
    shortLesson: 'Isolate the network. Alert the security team. Follow their instructions.',
  },
  mail: {
    title: 'An almost ordinary attachment.',
    app: 'Mail',
    tagline: 'A plausible message arrives with an odd address and a file to open.',
    question: 'What do you do with this message?',
    hints: [
      'The subject and tone look ordinary. Examine the full address and attachment too.',
      'Replying stays in the channel chosen by the sender. Reporting lets the security team examine the message.',
    ],
    choices: [
      {
        id: 'open',
        label: 'Open the attachment',
        detail: 'The message explains why it was sent.',
      },
      {
        id: 'reply',
        label: 'Reply to the message',
        detail: 'Ask the sender to confirm the attachment.',
      },
      {
        id: 'report',
        label: 'Forward to the security team',
        detail: 'Use the organisation’s designated reporting channel.',
      },
    ],
    feedback: {
      safe: 'You sent the suspicious message through the designated channel. The security team can examine it without running the attachment.',
      risky:
        'Opening the attachment or replying stays in the situation prepared by the sender. An impostor can confirm their own story.',
    },
    lesson:
      'A plausible message can contain a dangerous attachment. Check the full address and whether the request makes sense, then forward suspicious messages to the security team through the designated channel. If you need to confirm, use a known contact independent of the message.',
    shortLesson: 'Examine the address and request. Report without opening or replying.',
  },
  spoof: {
    title: 'A known address. An unusual request.',
    app: 'Mail',
    tagline: 'A usual contact asks you to send an internal document to a personal address.',
    question: 'What do you do with this request?',
    hints: [
      'The displayed address belongs to your usual contact, but the request falls outside normal work practice.',
      'A real account can be compromised. Forward the message to the security team instead of using the suspicious conversation.',
    ],
    choices: [
      {
        id: 'comply',
        label: 'Send the document',
        detail: 'The message came from the usual work address.',
      },
      {
        id: 'reply',
        label: 'Reply to confirm',
        detail: 'Ask in this conversation whether the request is correct.',
      },
      {
        id: 'report',
        label: 'Forward to the security team',
        detail: 'Use the organisation’s designated reporting channel.',
      },
    ],
    feedback: {
      safe: 'You reported an unusual request before moving the internal document outside its work environment.',
      risky:
        'A familiar address does not make the request safe. A reply may reach the same impostor or already compromised account.',
    },
    lesson:
      'A displayed name can be copied, an address can be forged, and a real mailbox can also be compromised. Mail systems have technical checks, but visible identity alone does not validate an unusual request. Report it through the designated channel and check with a known contact independent of the message.',
    shortLesson: 'Even a known mailbox can be compromised. Report the unusual request.',
  },
  web: {
    title: 'A nearly familiar portal.',
    app: 'Browser',
    tagline: 'The document link leads to a new sign-in page.',
    question: 'What do you do before signing in?',
    hints: [
      'A shared document asks you to sign in again on a portal.',
      'Compare the site address with your usual bookmark. A padlock alone does not prove it is the right site.',
    ],
    choices: [
      { id: 'submit', label: 'Sign in', detail: 'The page looks like my usual space.' },
      {
        id: 'trust-lock',
        label: 'Trust the padlock',
        detail: 'The connection is encrypted, so the site must be trustworthy.',
      },
      {
        id: 'known-address',
        label: 'Return to my known bookmark',
        detail: 'Access the service without using this link.',
      },
    ],
    feedback: {
      safe: 'You took a known route to the service. The trap received no credentials.',
      risky:
        'The portal could have captured your credentials. Its appearance and encrypted connection do not prove its identity.',
    },
    lesson:
      'The padlock means exchanges with this site are protected, even if the site is fraudulent. Compare its address and use your usual bookmark. Here, the fields were fictional: no real data was sent.',
    shortLesson: 'The padlock encrypts the connection; it does not certify the site.',
  },
  mfa: {
    title: 'Another sign-in request.',
    app: 'Sign-in check',
    tagline: 'Your phone keeps insisting, but you requested nothing.',
    question: 'Do you approve it?',
    hints: [
      'A sign-in request is waiting for your approval.',
      'If you did not start the sign-in, do not approve it. Then alert the security team.',
    ],
    choices: [
      { id: 'approve', label: 'Approve', detail: 'To make the notifications disappear.' },
      { id: 'ignore', label: 'Ignore the requests', detail: 'They will eventually stop.' },
      { id: 'deny-report', label: 'Deny and report', detail: 'I did not start this sign-in.' },
    ],
    feedback: {
      safe: 'You denied the sign-in and raised the alert. The repeated requests did not get your approval.',
      risky:
        'Approving could give a third party access to your account. Ignoring without reporting leaves an attempt unhandled.',
    },
    lesson:
      'Deny and report a sign-in confirmation you did not request. If you accepted by mistake, contact the security team immediately. The displayed location may be approximate; the key signal is that you did not request the sign-in.',
    shortLesson: 'An unrequested sign-in: deny, then report.',
  },
};

export const englishIncidentNotify = {
  question: 'The workstation is isolated. Who do you alert?',
  choices: [
    {
      id: 'call-number',
      label: 'The number in the suspicious window',
      detail: 'It offers immediate assistance.',
    },
    { id: 'notify', label: 'The security team', detail: 'From another device or a known channel.' },
    { id: 'delete', label: 'Nobody; delete the files', detail: 'Fix the problem myself.' },
  ],
} satisfies {
  question: string;
  choices: readonly {
    id: ChallengeChoiceId<'incident', 'notify'>;
    label: string;
    detail: string;
  }[];
};
