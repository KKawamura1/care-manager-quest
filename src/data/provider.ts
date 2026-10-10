import data from './questions.json';
import type { Question, QuestionProvider } from '../domain/models';
export const originalProvider: QuestionProvider = { id: 'original-v1', list: () => data as Question[] };
export const questions = originalProvider.list();
export const questionById = (id: string) => questions.find(q => q.id === id);
