import type { Category, Concept } from '../domain/models';
import { pastConcepts } from './past-concepts';
import classification from './packs/2025/classifications.json';
export const categories: Category[] = [
 {id:'A',label:'制度マネジメント',description:'地域全体を支える仕組み',available:true},
 {id:'A0',parentId:'A',label:'制度の理念・保険者',description:'何のために、誰が運営するか',available:true},
 {id:'A1',parentId:'A',label:'需要予測・行政計画',description:'必要なサービスを見通す',available:true},
 {id:'A2',parentId:'A',label:'被保険者・財源',description:'誰が加入し、誰が負担するか',available:true},
 {id:'A3',parentId:'A',label:'サービス供給体制',description:'地域の支援を組み立てる',available:true},
 {id:'A4',parentId:'A',label:'保険給付・監督・不服申立て',description:'給付と権利を守る',available:true},
 {id:'B',label:'個別ケアマネジメント',description:'ひとりの生活を支える流れ',available:true},
 {id:'B1',parentId:'B',label:'利用資格',description:'使える条件を判断する',available:true},
 {id:'B2',parentId:'B',label:'要介護認定',description:'必要な支援の程度を認定する',available:true},
 {id:'B3',parentId:'B',label:'アセスメント・ケアプラン',description:'希望を支援の計画につなぐ',available:true},
 {id:'B4',parentId:'B',label:'サービス提供・連携',description:'計画を暮らしの中で実行する',available:true},
 {id:'B5',parentId:'B',label:'モニタリング・再評価',description:'変化を見て、見直す',available:true},
 {id:'C',label:'保健医療・福祉の専門知識',description:'認知症施策から専門知識へ',available:true},
 ...['疾病・身体機能','認知症・精神機能','医療・看護・リハビリ','生活支援・福祉','権利擁護・終末期ケア'].map((label,i)=>({id:`C${i+1}`,parentId:'C',label,description:'過去問で扱う専門知識',available:true})),
];
const c = (id:string,categoryId:string,label:string,summary:string,relatedIds:string[]):Concept=>({id,categoryId,label,summary,relatedIds});
const baseConcepts: Concept[] = [
 c('insurer','A0','保険者','市町村・特別区が介護保険を運営する。',['planning','certification']),
 c('dignity','A0','尊厳と自立','できることを活かして、その人の暮らしを支える。',['assessment','choice']),
 c('planning','A1','介護保険事業計画','市町村は3年を一期に、地域の需要を見通して計画する。',['premium','supply']),
 c('insured','A2','被保険者','第1号は65歳以上、第2号は40〜64歳の医療保険加入者。',['eligibility','premium']),
 c('premium','A2','保険料','第1号の保険料は市町村の条例で定め、地域の見込費用等を反映する。',['planning','insurer']),
 c('supply','A3','国・県・市町村の役割','国は必要な施策、県は助言・援助、市町村は保険の運営を担う。',['insurer','planning']),
 c('community','A3','地域包括支援センター','総合相談や権利擁護、ケアマネジャーへの支援を担う。',['coordination','dignity']),
 c('benefits','A4','介護給付と予防給付','要介護者には介護給付、要支援者には予防給付。',['eligibility','prevention']),
 c('appeal','A4','不服申立て','認定・給付・保険料の処分への審査請求は介護保険審査会へ。',['certification','insurer']),
 c('protection','A4','受給権の保護','給付を受ける権利は譲渡・担保・差押えの対象にできない。',['benefits','dignity']),
 c('eligibility','B1','受給の条件','加入と給付は別。第2号は特定疾病が原因であることも必要。',['insured','certification']),
 c('prevention','B1','要支援と予防','要支援者の支援も介護保険制度の一部。',['benefits','dignity']),
 c('certification','B2','認定の役割分担','審査会が審査判定し、市町村が認定・通知する。',['insurer','medical-opinion']),
 c('medical-opinion','B2','認定調査と主治医意見書','生活の状況と医学的な情報の双方を使う。',['assessment','certification']),
 c('application','B2','申請と効力','要介護認定は申請日に遡って効力を生じる。',['certification','reassessment']),
 c('reassessment','B5','区分変更と見直し','状態が変われば区分変更を申請し、計画も見直す。',['application','monitoring']),
 c('assessment','B3','アセスメント','能力・環境・生活上の課題を把握して計画の土台を作る。',['dignity','choice']),
 c('choice','B3','本人の選択','希望と課題をもとに、最適な支援の組合せを考える。',['neutrality','consent']),
 c('consent','B3','説明と同意','原案を説明し、文書で本人の同意を得る。',['choice','coordination']),
 c('coordination','B4','担当者会議と連携','本人・家族の参加を基本に、各担当者の専門的意見をつなぐ。',['assessment','monitoring']),
 c('informal','B4','保険外の支援','地域の活動等も計画に位置付けるよう努める。',['choice','community']),
 c('neutrality','B4','公正中立','本人の立場に立ち、特定の事業者へ不当に偏らない。',['choice','dignity']),
 c('monitoring','B5','モニタリング','実施状況と変化を把握し、必要な計画変更や連絡調整を行う。',['assessment','reassessment']),
];

export const concepts: Concept[] = [...baseConcepts,...pastConcepts,...Object.values(classification).map(c=>({
 id:c.primaryConceptId,categoryId:c.primaryCategory,label:c.title,
 summary:'2025年度の過去問で扱う論点です。分類は暫定で、現行法との適合性は未確認です。',
 relatedIds:c.relatedConceptIds,
}))];

