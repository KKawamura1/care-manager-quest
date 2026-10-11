// Preserve uploaded text, answer numbers and IDs. Mapping is separate from the originals.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('src/data/packs/knowledge.json',root),'utf8'));
const documents = {}, result = [], used = new Set();
for (const year of [2020,2021,2022,2023,2024]) {
 const input = JSON.parse(readFileSync(new URL(`imports/${year}/questions.json`,root),'utf8'));
 const rows = Array.isArray(input) ? input : input.questions;
 if (rows.length !== 60) throw Error(`${year}: expected 60 questions`);
 const numbers = new Set();
 for (const q of rows) {
  const number=q.number??q.question_number, answers=q.correct_choices??q.correct_answers;
  if (used.has(q.id)||numbers.has(number)||number<1||number>60) throw Error(`Duplicate/invalid ID or number: ${q.id}`);
  if ((q.exam_year??q.year)!==year) throw Error(`Year mismatch: ${q.id}`);
  used.add(q.id); numbers.add(number);
  if (!q.stem?.trim()||q.choices?.length!==5||q.choices.some(c=>typeof c!=='string'||!c.trim())) throw Error(`Missing text: ${q.id}`);
  if (![2,3].includes(q.required_choices)||answers?.length!==q.required_choices||new Set(answers).size!==answers.length||answers.some(n=>!Number.isInteger(n)||n<1||n>5)) throw Error(`Invalid answers: ${q.id}`);
  const domain=number<=25?'介護支援分野':number<=45?'保健医療サービスの知識等':'福祉サービスの知識等';
  if (q.domain!==domain) throw Error(`Domain mismatch: ${q.id}`);
  const imagePath='/'+(q.image_path??q.source_image).replace(/^\//,'');
  const imageFile=new URL(`public${imagePath}`,root);
  const hash=existsSync(imageFile)?createHash('sha256').update(readFileSync(imageFile)).digest('hex'):q.image_sha256;
  if (!hash) throw Error(`Missing image checksum: ${q.id}`);
  if (q.image_sha256&&q.image_sha256!==hash) throw Error(`Image checksum mismatch: ${q.id}`);
  const c=catalog.questions[`${year}-${String(number).padStart(2,'0')}`];
  const sourceUrl=q.source?.url??input.official_problem_url;
  const answerUrl=q.answer_official_url??input.official_answer_url??input.answer_source_url??(year===2020?'https://www.caremanagement.jp/contents3/shiken/2020a':input.official_answer_image_url);
  documents[`official-${year}`]={id:`official-${year}`,title:`${year}年度 公式問題冊子`,url:sourceUrl};
  documents[`official-${year}-answers`]={id:`official-${year}-answers`,title:`${year}年度 正答番号${year===2020?'（公開解答一覧）':''}`,url:answerUrl};
  result.push({
   id:q.id,version:1,domain,title:`${year}年度 問${number}｜${c.title}`,stem:q.stem,
   options:q.choices.map((text,i)=>({id:String(i+1),text,explanation:''})),
   answerIds:answers.map(String),selectionCount:q.required_choices,explanation:'',reasoning:'',difficulty:2,
   primaryCategory:c.primaryCategory,conceptIds:c.conceptIds,classificationRevision:catalog.revision,
   classificationStatus:'provisional',
   original:{year,number,imagePath,imageSha256:hash,textStatus:'pending',lawStatus:'not_reviewed',sourcePageIndex:q.source?.pdf_page_index??((q.source?.pdf_page??1)-1),sourceUrl},
   provenance:{kind:'official',author:'公益財団法人 社会福祉振興・試験センター',verifiedAt:'',sources:[{sourceId:`official-${year}`,locator:`${year}年度 第${q.exam_number}回 問${number}`},{sourceId:`official-${year}-answers`,locator:`正答番号：${answers.join('・')}（添付データを継承・今回の独立再照合は未実施）`}]},
  });
 }
}
writeFileSync(new URL('src/data/packs/historical.json',root),JSON.stringify(result,null,2)+'\n');
writeFileSync(new URL('src/data/packs/historical-sources.json',root),JSON.stringify(Object.values(documents),null,2)+'\n');
console.log('Prepared 2020–2024: 300 text questions; original IDs/wording/answers retained; unavailable image files use source PDF links.');
