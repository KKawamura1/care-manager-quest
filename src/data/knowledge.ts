import catalog from './packs/knowledge.json';
import difficulty from './question-difficulty.json';
import type { Category, Concept, Question } from '../domain/models';

export const categories: Category[] = catalog.categories;
export const concepts: Concept[] = catalog.concepts;
export const choiceClassifications = catalog.choices;
export const classifications = catalog.questions;
export const classificationRevision = catalog.revision;
export function questionClassification(year: number, number: number) {
  const id = `${year}-${String(number).padStart(2, '0')}`;
  const row = (classifications as Record<string, typeof classifications['2025-01']>)[id];
  if (!row) throw new Error(`Missing 5x28 classification: ${id}`);
  const sourceId = year === 2020 ? `care_manager_2020_${String(number).padStart(3, '0')}` : id;
  const level = (difficulty as Record<string, 1|2|3>)[sourceId];
  if (![1,2,3].includes(level)) throw new Error(`Missing question difficulty: ${sourceId}`);
  return { ...row, difficulty: level, classificationRevision };
}
export function applyQuestionClassification(q: Question): Question {
  if (!q.original) return q;
  const c = questionClassification(q.original.year, q.original.number);
  return { ...q, title: `${q.original.year}年度 問${q.original.number}｜${c.title}`,
    difficulty: c.difficulty, primaryCategory: c.primaryCategory, conceptIds: c.conceptIds,
    classificationRevision, classificationStatus: 'provisional' };
}
