import type { GameState } from '../model/game';
import type { KnowledgeAnswer, KnowledgeId } from '../model/knowledge';

const answers: Readonly<Record<KnowledgeId, Readonly<Record<string, boolean>>>> = {
  password: { 'replace-now': true, 'wait-cycle': false },
  incident: { 'report-now': true, 'wait-symptoms': false },
  mfa: { 'never-share': true, 'share-code': false },
};

export function currentKnowledgeId(state: GameState): KnowledgeId | null {
  if (state.phase !== 'session') return null;
  if (state.scene.kind === 'challenge' && state.scene.id === 'mail') {
    return state.routines.password === 'done' ? 'password' : null;
  }
  if (state.scene.kind !== 'feedback') return null;
  if (state.scene.result.id === 'incident') return 'incident';
  if (state.scene.result.id === 'mfa') return 'mfa';
  return null;
}

export function knowledgeAnswer(id: KnowledgeId, answerId: string): KnowledgeAnswer | null {
  if (typeof answerId !== 'string') return null;
  const choices = answers[id];
  if (!Object.prototype.hasOwnProperty.call(choices, answerId)) return null;
  const correct = choices[answerId];
  if (correct === undefined) return null;
  return { id, answerId, correct };
}
