// Preserve uploaded text, answer numbers and IDs. Mapping is separate from the originals.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const coarseCategories = {
 care_system:'A0', care_services:'A3', care_finance:'A2', community_support:'A3',
 care_certification:'B2', care_management:'B3', geriatric_medicine:'C1', medical_basics:'C1',
 nutrition_swallowing:'C1', dementia_mental:'C2', medical_collaboration:'C3', rehabilitation:'C3',
 infection_safety:'C3', home_medical:'C3', care_services_medical:'C3', care_facilities:'C4',
 social_work:'C4', welfare_services:'C4', social_security:'C4', rights_protection:'C5',
};
const anchors = {A0:'insurer',A1:'planning',A2:'insured',A3:'supply',A4:'benefits',B1:'eligibility',B2:'certification',B3:'assessment',B4:'coordination',B5:'monitoring'};
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
  const title=q.topic_title??q.knowledge_category_label??q.topic??'知識分類待ち';
  const group=q.primary_group;
  let category=year===2020?coarseCategories[q.category]:group==='C'?(number<=45?'C3':'C4'):group==='B6'?'B5':group;
  // Reform and basic-principle topics belong to the existing A0 region.
  if (category&&/基本理念|制度の考え方|介護保険法改正/.test(title)) category='A0';
  if (!category) category='U1';
  const pending=category==='U1';
  const conceptId=pending?`pending:${q.id}`:`history:${year}:${q.primary_concept_id??q.subcategory??q.id}`;
  const related=anchors[category]?[anchors[category]]:[];
  const sourceUrl=q.source?.url??input.official_problem_url;
  const answerUrl=q.answer_official_url??input.official_answer_url??input.answer_source_url??(year===2020?'https://www.caremanagement.jp/contents3/shiken/2020a':input.official_answer_image_url);
  documents[`official-${year}`]={id:`official-${year}`,title:`${year}年度 公式問題冊子`,url:sourceUrl};
  documents[`official-${year}-answers`]={id:`official-${year}-answers`,title:`${year}年度 正答番号${year===2020?'（公開解答一覧）':''}`,url:answerUrl};
  result.push({
   id:q.id,version:1,domain,title:`${year}年度 問${number}｜${title}`,stem:q.stem,
   options:q.choices.map((text,i)=>({id:String(i+1),text,explanation:''})),
   answerIds:answers.map(String),selectionCount:q.required_choices,explanation:'',reasoning:'',difficulty:2,
   primaryCategory:category,conceptIds:[conceptId,...related],classificationRevision:1,
   classificationStatus:pending?'pending':'provisional',
   importedClassification:{primaryGroup:q.primary_group??q.category??null,primaryConceptId:q.primary_concept_id??q.subcategory??null,relatedGroups:q.related_groups??[],title:q.topic_title??q.knowledge_category_label??q.topic??null},
   original:{year,number,imagePath,imageSha256:hash,textStatus:'pending',lawStatus:'not_reviewed',sourcePageIndex:q.source?.pdf_page_index??((q.source?.pdf_page??1)-1),sourceUrl},
   provenance:{kind:'official',author:'公益財団法人 社会福祉振興・試験センター',verifiedAt:'',sources:[{sourceId:`official-${year}`,locator:`${year}年度 第${q.exam_number}回 問${number}`},{sourceId:`official-${year}-answers`,locator:`正答番号：${answers.join('・')}（添付データを継承・今回の独立再照合は未実施）`}]},
  });
 }
}
writeFileSync(new URL('src/data/packs/historical.json',root),JSON.stringify(result,null,2)+'\n');
writeFileSync(new URL('src/data/packs/historical-sources.json',root),JSON.stringify(Object.values(documents),null,2)+'\n');
console.log('Prepared 2020–2024: 300 text questions; original IDs/wording/answers retained; unavailable image files use source PDF links.');
