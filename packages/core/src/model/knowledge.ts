export type KnowledgeId = 'password' | 'incident' | 'mfa';

export type KnowledgeAnswer = {
  id: KnowledgeId;
  answerId: string;
  correct: boolean;
};
