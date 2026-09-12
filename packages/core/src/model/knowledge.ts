export type KnowledgeId = 'password' | 'incident' | 'mfa';

export type KnowledgeAnswerId =
  'replace-now' | 'wait-cycle' | 'report-now' | 'wait-symptoms' | 'never-share' | 'share-code';

export type KnowledgeAnswer = {
  id: KnowledgeId;
  answerId: KnowledgeAnswerId;
  correct: boolean;
};
