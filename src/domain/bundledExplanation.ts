import type { Question } from './models';

export interface ExplanationSource { title: string; url: string; locator?: string }
export interface BundledExplanation {
  year: number;
  number: number;
  questionVersion: number;
  expectedStem: string;
  expectedAnswers: string[][];
  overview: string;
  choices: { id: string; expectedText: string; truth: boolean; explanation: string }[];
  sources: ExplanationSource[];
  basis: string;
  lawNote: string;
}

// Content and answer snapshots prevent silently attaching an explanation to a
// revised question, including corrections which did not increment its version.
export function matchesExplanation(q: Question, entry: BundledExplanation): boolean {
  const variants = q.answerVariants ?? [q.answerIds];
  return q.original?.year === entry.year && q.original.number === entry.number
    && q.version === entry.questionVersion && q.stem === entry.expectedStem
    && JSON.stringify(variants) === JSON.stringify(entry.expectedAnswers)
    && q.options.length === entry.choices.length
    && q.options.every((option, i) => option.id === entry.choices[i].id && option.text === entry.choices[i].expectedText);
}
