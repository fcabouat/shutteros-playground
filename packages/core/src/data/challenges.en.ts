import type { ChallengeChoiceId } from '../model/game';
import type { Challenges } from './challenges';

export const englishChallenges: Challenges = {
  ai: {
    title: 'A good prompt. The right data?',
    app: 'AI assistant',
    tagline: 'Meeting minutes to prepare, two possible tools.',
    question: 'What can you share with this tool?',
    hints: [
      'The AI assistant can help you draft. Check which tool is approved and review the message before sending.',
      'The exercise policy is available in the chat. Removing a name removes neither identifying details nor confidential information.',
    ],
    choices: [],
    feedback: {
      safe: 'You used the approved tool with a general request, without internal notes or personal data. Fill in the template in your work tools and review the result.',
      risky: 'Both the tool and the data must comply with your organisation’s rules.',
    },
    lesson:
      'Protect confidentiality, even without names. Careful anonymisation can help, but does not make every document suitable for a commercial service. An internal tool can suit information of low sensitivity within its approved scope. Always follow your organisation’s policy and AI usage charter.',
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
    title: 'A bonus. And a lot of urgency.',
    app: 'Mail',
    tagline: 'A human resources message demands immediate action.',
    question: 'How do you check this request?',
    hints: [
      'An email awaits a reply. The sender name looks familiar…',
      'Show the full address. To confirm, do not use contact details in the suspicious message.',
    ],
    choices: [
      { id: 'open', label: 'Open the link', detail: 'The request looks official.' },
      {
        id: 'reply',
        label: 'Reply to the message',
        detail: 'Ask its author whether the email is genuine.',
      },
      {
        id: 'verify',
        label: 'Contact HR via the directory',
        detail: 'Check through a second, already known channel.',
      },
      {
        id: 'report',
        label: 'Report the message',
        detail: 'Send it through the organisation’s reporting channel.',
      },
    ],
    feedback: {
      safe: 'You left the potentially trapped channel. Your usual contact can confirm the request independently.',
      risky:
        'The link and reply stay in the channel chosen by the sender. An impostor can confirm their own story.',
    },
    lesson:
      'Check the full address and whether the request makes sense. When in doubt, contact the person through a number or channel you already know. The absence of a digital signature alone does not prove fraud.',
    shortLesson: 'Confirm an unusual request through a second known channel.',
  },
  spoof: {
    title: 'What if the sender were you?',
    app: 'Sender studio',
    tagline: 'Change the “From” field, then watch the received message.',
    question: 'Is a reassuring name enough to trust?',
    hints: [
      'You know how to inspect an email. Now try changing its sender.',
      'Choose the impostor address, keep a credible name, then send it in the simulation.',
    ],
    choices: [],
    feedback: {
      safe: 'A few characters were enough to change the displayed identity. What you see in the header alone does not prove identity.',
      risky:
        'A familiar name and a signature at the bottom can be copied. Return to a known contact to check.',
    },
    lesson:
      'A delegated sending address may be legitimate. The displayed name is easy to change. Even if the mail system verifies the sender, check an unusual request with your known contact.',
    shortLesson: 'Displayed identity can change. Trust must be checked.',
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
