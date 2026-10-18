import pack2025 from './explanations/2025.json';
import truth from '../../data/choice-tf/choice-answers-2005-2025.json';
import type { Question } from '../domain/models';
import { matchesExplanation, type BundledExplanation } from '../domain/bundledExplanation';

export const bundledExplanations: readonly BundledExplanation[] = pack2025;
const byExam = new Map(bundledExplanations.map(entry => [`${entry.year}-${entry.number}`, entry]));
export function explanationFor(q: Question | undefined): BundledExplanation | undefined {
  if (!q?.original) return undefined;
  const entry = byExam.get(`${q.original.year}-${q.original.number}`);
  const record = (truth.questions as Record<string, { mode: string; correctChoiceTruth: string; choiceAnswers: string[] }>)[`${q.original.year}-${String(q.original.number).padStart(2,'0')}`];
  return entry && matchesExplanation(q, entry) && record?.mode === 'choice_correctness'
    && record.correctChoiceTruth === 'true'
    && entry.choices.every((c,i) => record.choiceAnswers[i] === (c.truth ? '○' : '×')) ? entry : undefined;
}
