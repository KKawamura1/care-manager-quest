export type Difficulty = 1 | 2 | 3;
export interface Source { id: string; title: string; url: string; }
export interface Question {
  id: string; version: number; domain?: string; title: string; stem: string;
  options: { id: string; text: string; explanation: string }[];
  answerIds: string[]; answerVariants?: string[][]; selectionCount: number; explanation: string;
  reasoning: string; difficulty: Difficulty; primaryCategory: string;
  conceptIds: string[]; classificationRevision?: number;
  original?: { year:number; number:number; imagePath?:string; imageSha256?:string; textStatus:'proofread'|'pending'; lawStatus:'not_reviewed'; sourcePageIndex?:number };
  provenance: { kind: 'original' | 'licensed' | 'official'; author: string; verifiedAt: string; sources: { sourceId: string; locator: string }[]; pastExamUrl?: string };
}
export interface Concept { id: string; categoryId: string; label: string; summary: string; relatedIds: string[]; }
export interface Category { id: string; parentId?: string; label: string; description: string; available: boolean; }
export interface Attempt {
  id: string; questionId: string; questionVersion: number; sessionId: string; selectedIds: string[];
  correct: boolean; firstSeen: boolean; combo: number; xp: number; at: string;
  conceptIds: string[]; classificationRevision: number; difficulty: Difficulty;
}
// Concept evidence is separate from question correctness. This is a transparent MVP rule, not a mastery estimator.
export interface ConceptProgress { seenQuestionIds: string[]; correctQuestionIds: string[]; reflected: boolean; }
export interface Session { id: string; questionIds: string[]; index: number; selectedIds: string[]; completed: boolean; }
export interface ExternalRecord { id: string; url: string; label: string; correct: boolean; at: string; }
export interface PlayerState {
  schemaVersion: 2; attempts: Attempt[]; concepts: Record<string, ConceptProgress>;
  session?: Session; externalRecords: ExternalRecord[]; settings: { sound: boolean };
}
export interface QuestionProvider { readonly id: string; list(): readonly Question[]; }

