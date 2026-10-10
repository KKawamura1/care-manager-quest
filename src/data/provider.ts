import { pastProvider } from './past-provider';
import legacy from './legacy-questions.json';
import text from './packs/2025/questions.json';
import keys from './packs/2025/answers.json';
import classification from './packs/2025/classifications.json';
import quality from './packs/2025/quality.json';
import type { Question, QuestionProvider } from '../domain/models';
export const classifications = classification;
const answers = keys as Record<string, { correctChoices: number[]; selectionCount: number; sourceId: string; verifiedAt: string }>;
const mapping = classification as Record<string, { revision: number; title: string; primaryCategory: string; primaryConceptId: string; relatedConceptIds: string[]; difficulty: 1|2|3 }>;
const review = quality as Record<string, { textStatus: string; reviewedAt?: string; independentExplanation: string|null; lawStatus: string }>;
export const officialProvider: QuestionProvider = {
  id: 'official-2025-all60',
  list: () => text.map(q => {
    const a=answers[q.id], c=mapping[q.id], r=review[q.id];
    return {
      id:q.id, version:q.version, domain:q.domain, title:`2025年度 問${q.number}｜${c.title}`, stem:q.stem,
      options:q.choices.map((text,i)=>({id:String(i+1),text,explanation:''})),
      answerIds:a.correctChoices.map(String), selectionCount:a.selectionCount,
      explanation:r.independentExplanation??'', reasoning:'', difficulty:c.difficulty,
      primaryCategory:c.primaryCategory, conceptIds:[c.primaryConceptId,...c.relatedConceptIds],
      classificationRevision:c.revision,
      original:{year:q.year,number:q.number,imagePath:q.imagePath,imageSha256:q.imageSha256,textStatus:r.textStatus==='proofread'?'proofread':'pending',lawStatus:'not_reviewed',sourcePageIndex:q.sourcePageIndex},
      provenance:{kind:'official',author:'公益財団法人 社会福祉振興・試験センター',verifiedAt:a.verifiedAt,sources:[{sourceId:q.sourceId,locator:`2025年度 第28回 問${q.number}（冊子${q.sourcePageIndex}ページ）`},{sourceId:a.sourceId,locator:`正答番号：${a.correctChoices.join('・')}`}]},
    } satisfies Question;
  }),
};
// Archived originals are retained only to read pre-existing history; never feed them into a quest.
export const legacyQuestions = legacy as Question[];
export const questions = [...officialProvider.list(),...pastProvider.list()];
export const availableYears = [...new Set(questions.map(q=>q.original!.year))].sort((a,b)=>b-a);
export const historyQuestions = [...questions,...legacyQuestions];
export const questionById = (id:string) => historyQuestions.find(q=>q.id===id);

