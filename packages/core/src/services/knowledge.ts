import type { GameState } from '../model/game';
import type { KnowledgeAnswer, KnowledgeAnswerId, KnowledgeId } from '../model/knowledge';

const answers: Readonly<Record<KnowledgeId, Readonly<Record<string, boolean>>>> = {
  password: { 'replace-now': true, 'wait-cycle': false },
  incident: { 'report-now': true, 'wait-symptoms': false },
  mfa: { 'never-share': true, 'share-code': false },
};

/**
 * Optional questions belong to a learning context, not to a separate game phase.
 * Password practice follows guided account renewal; incident/MFA checks follow
 * their feedback. Answers stay outside primary challenge results and progression.
 */
export function currentKnowledgeId(state: GameState): KnowledgeId | null {
  if (state.phase !== 'session') return null;
  if (state.scene.kind === 'routines' && state.routines.password === 'done') {
    return 'password';
  }
  if (state.scene.kind !== 'feedback') return null;
  if (state.scene.result.id === 'incident') return 'incident';
  if (state.scene.result.id === 'mfa') return 'mfa';
  return null;
}

export function knowledgeAnswer(id: KnowledgeId, answerId: string): KnowledgeAnswer | null {
  if (typeof answerId !== 'string') return null;
  if (!isKnowledgeAnswerId(answerId)) return null;
  const choices = answers[id];
  if (!Object.prototype.hasOwnProperty.call(choices, answerId)) return null;
  const correct = choices[answerId];
  if (correct === undefined) return null;
  return { id, answerId, correct };
}

function isKnowledgeAnswerId(value: string): value is KnowledgeAnswerId {
  return (
    value === 'replace-now' ||
    value === 'wait-cycle' ||
    value === 'report-now' ||
    value === 'wait-symptoms' ||
    value === 'never-share' ||
    value === 'share-code'
  );
}
