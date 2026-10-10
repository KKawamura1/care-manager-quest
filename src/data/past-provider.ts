import type { Question, QuestionProvider } from '../domain/models';
import { sources } from './sources';
import text2018 from './packs/2018/questions.json';
import text2019 from './packs/2019/questions.json';
import answers2018 from './packs/2018/answers.json';
import answers2019 from './packs/2019/answers.json';
import classifications2018 from './packs/2018/classifications.json';
import classifications2019 from './packs/2019/classifications.json';
import quality2018 from './packs/2018/quality.json';
import quality2019 from './packs/2019/quality.json';
interface TextRow { id:string; version:number; year:number; number:number; domain:string; stem:string; note?:string; choices:string[]; sourceId:string; sourceUrl:string; secondarySourceUrl?:string; sourcePageIndex?:number }
interface Answer { correctChoices:number[]; selectionCount:number; sourceId:string; verifiedAt:string; answerVariants?:number[][] }
interface Classification { revision:number; title:string; primaryCategory:string; primaryConceptId:string; relatedConceptIds:string[]; difficulty:1|2|3 }
interface Quality { excluded?:boolean; exclusionReason?:string; textStatus:string; lawStatus:string }
const texts = import.meta.glob<TextRow[]>('./packs/pre2018/*/questions.json', {eager:true,import:'default'});
const answerPacks = import.meta.glob<Record<string,Answer>>('./packs/pre2018/*/answers.json', {eager:true,import:'default'});
const classificationPacks = import.meta.glob<Record<string,Classification>>('./packs/pre2018/*/classifications.json', {eager:true,import:'default'});
const qualityPacks = import.meta.glob<Record<string,Quality>>('./packs/pre2018/*/quality.json', {eager:true,import:'default'});
const answers = Object.assign({},...Object.values(answerPacks),answers2018,answers2019) as Record<string,Answer>;
const classifications = Object.assign({},...Object.values(classificationPacks),classifications2018,classifications2019) as Record<string,Classification>;
const quality = Object.assign({},...Object.values(qualityPacks),quality2018,quality2019) as Record<string,Quality>;
export const pastExamTexts:TextRow[] = [...Object.values(texts).flat(),...text2018,...text2019];
export const excludedPastExamIds = pastExamTexts.filter(q=>quality[q.id]?.excluded).map(q=>q.id);
export const pastProvider:QuestionProvider = {
  id:'historical-published-text',
  list:()=>pastExamTexts.filter(q=>!quality[q.id]?.excluded).map(q=>{
    const a=answers[q.id],c=classifications[q.id];
    return {
      id:q.id,version:q.version,domain:q.domain,title:`${q.year}年度 問${q.number}｜${c.title}`,stem:q.stem+(q.note?`\n${q.note}`:''),
      options:q.choices.map((text,i)=>({id:String(i+1),text,explanation:''})),
      answerIds:a.correctChoices.map(String),answerVariants:a.answerVariants?.map(ids=>ids.map(String)),selectionCount:a.selectionCount,
      explanation:'',reasoning:'',difficulty:c.difficulty,primaryCategory:c.primaryCategory,conceptIds:[c.primaryConceptId,...c.relatedConceptIds],classificationRevision:c.revision,
      original:{year:q.year,number:q.number,textStatus:'pending',lawStatus:'not_reviewed'},
      provenance:{kind:'official',author:'公益財団法人 社会福祉振興・試験センター',verifiedAt:a.verifiedAt,pastExamUrl:q.sourceUrl,sources:[{sourceId:q.sourceId,locator:`${q.year}年度 第${q.year-1997}回 問${q.number}（${q.year===2018?`公式PDFの文字起こし、PDF ${q.sourcePageIndex!+1}ページ`:q.year===2019?'提供された原本PDFの文字起こし・民間掲載文との照合':'民間掲載テキストから収集'}）`},{sourceId:a.sourceId,locator:`試験当時の正答：${(a.answerVariants??[a.correctChoices]).map(ids=>ids.join('・')).join(' または ')}`},...(q.year===2019?[{sourceId:'2019-answer-key-secondary',locator:'民間掲載正答との照合'}]:[]),...(q.secondarySourceUrl?[{sourceId:q.sourceId+'-comparison',locator:'文字差の照合・フィールド採用元'}]:[])]},
    } satisfies Question;
  }),
};
// URLs are part of the imported question provenance; no publisher explanations or site assets are bundled.
for (const q of pastExamTexts) if (!sources.some(s=>s.id===q.sourceId)) sources.push({id:q.sourceId,title:`${q.year}年度 問${q.number}の掲載元`,url:q.sourceUrl});
for (const q of pastExamTexts) if (q.secondarySourceUrl) sources.push({id:q.sourceId+'-comparison',title:`${q.year}年度 問${q.number}の文字照合元`,url:q.secondarySourceUrl});
for (const a of Object.values(answers)) if (!sources.some(s=>s.id===a.sourceId)) throw new Error(`Missing answer source: ${a.sourceId}`);
