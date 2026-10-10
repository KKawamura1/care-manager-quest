import type { Question } from './models';
export const EXAM_YEARS = [2025,2024,2023,2022,2021,2020] as const;
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
