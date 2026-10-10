import type { Question } from './models';
import { availableYears } from '../data/provider';
export const EXAM_YEARS = availableYears;
export type YearFilter = typeof EXAM_YEARS[number] | 'all';
export const YEAR_STORAGE_KEY = 'care-manager-quest:year-filter';
export function parseYearFilter(value: string|null): YearFilter {
  if (value==='all') return 'all';
  const year=Number(value);
  return EXAM_YEARS.includes(year as typeof EXAM_YEARS[number]) ? year as YearFilter : 2025;
}
export function filterQuestions(pool: readonly Question[], year: YearFilter, domain: string): Question[] {
  return pool.filter(q=>(year==='all'||q.original?.year===year)&&(domain==='all'||q.domain===domain));
}
