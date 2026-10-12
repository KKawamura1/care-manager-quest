import { categories, concepts } from './knowledge';
import { buildStudyScope } from '../domain/studyScope';

export const studyScope = buildStudyScope(categories, concepts);
