// Decode the checksum-protected 2025 ZIP projection and its verified text corrections.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadSourceYear } from './issue32-sources.mjs';
const rows = [...loadSourceYear(2025).questions.values()];
if (!Array.isArray(rows) || rows.length !== 60) throw Error('Expected exactly 60 questions');
const ids = new Set();
const root = new URL('../src/data/packs/2025/', import.meta.url);
const load = name => JSON.parse(readFileSync(new URL(name, root),'utf8'));
const oldQuality = load('quality.json');
const oldAnswers = load('answers.json');
if (Object.keys(oldAnswers).length <25) throw Error('Missing inherited answer keys');
const texts = [], answers = {}, quality = {};
const domains = {'介護支援分野':25,'保健医療サービスの知識等':20,'福祉サービスの知識等':15};
const domainCounts = Object.fromEntries(Object.keys(domains).map(domain=>[domain,0]));
for (const q of rows) {
 if (!/^2025-\d{2}$/.test(q.id) || q.id !== '2025-'+String(q.number).padStart(2,'0') || ids.has(q.id)) throw Error('Invalid/duplicate question ID: '+q.id);
 ids.add(q.id);
 if (!Object.hasOwn(domains,q.domain)) throw Error('Unknown domain: '+q.id);
 domainCounts[q.domain]++;
 if (typeof q.stem !== 'string'||!q.stem.trim()||!Array.isArray(q.choices)||q.choices.length!==5||q.choices.some(t=>typeof t!=='string'||!t.trim())) throw Error('Text missing: '+q.id);
 if (![2,3].includes(q.required_choices)||!Array.isArray(q.correct_choices)||q.correct_choices.length!==q.required_choices||new Set(q.correct_choices).size!==q.required_choices||q.correct_choices.some(n=>!Number.isInteger(n)||n<1||n>5)) throw Error('Answers invalid: '+q.id);
 const oldAnswer=oldAnswers[q.id];
 if (oldAnswer && (oldAnswer.selectionCount!==q.required_choices || oldAnswer.correctChoices.join(',')!==q.correct_choices.join(','))) throw Error('Answer changed vs prior pack: '+q.id);
 // The ZIP Q16 crop omits the final characters; retain the complete official-PDF recrop already checked into the repository.
 texts.push({id:q.id,version:1,number:q.number,year:2025,domain:q.domain,sourceId:'official-2025',stem:q.stem,choices:q.choices,imagePath:'/assets/questions/2025/q'+String(q.number).padStart(2,'0')+'.png',imageSha256:q.number===16?'3c26abb2931b6104c3aa9bce238a882b93e492e65933eb99f0482488702665d1':q.image_sha256,sourcePageIndex:q.sourcePageIndex});
 answers[q.id]=oldAnswer??{correctChoices:q.correct_choices,selectionCount:q.required_choices,sourceId:'official-2025-answers',verifiedAt:'2026-10-10'};
 const prior=oldQuality[q.id];
 quality[q.id]={...prior,textStatus:'pending',secondReview:'pending',lawStatus:'not_reviewed',independentExplanation:null,importedImageSha256:q.image_sha256,transcriptionStatus:q.text_status,answerStatus:'inherited_not_independently_reverified',imageReview:prior?.imageReview??'from_uploaded_original_crop'};
}
for (const [domain,n] of Object.entries(domains)) if(domainCounts[domain]!==n) throw Error('Domain count mismatch: '+domain);
const save=(name,data)=>writeFileSync(new URL(name,root),JSON.stringify(data,null,2)+'\n');
save('questions.json',texts);save('answers.json',answers);save('quality.json',quality);
console.log('Prepared 2025 official questions: 60 text questions; 25 support, 20 medical, 15 welfare; double proofreading pending.');
