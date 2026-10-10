import type { Concept } from '../domain/models';
export const pastConcepts: Concept[] = [
  {id:'past.disease',categoryId:'C1',label:'疾病・身体機能の過去問',summary:'加齢、疾病、症状、検査など。各年度の試験当時の出題を収録しています。',relatedIds:['medical-opinion','assessment']},
  {id:'past.mental',categoryId:'C2',label:'認知症・精神機能の過去問',summary:'認知症、精神症状とその支援。各年度の試験当時の出題を収録しています。',relatedIds:['dignity','assessment']},
  {id:'past.clinical',categoryId:'C3',label:'医療・看護・リハビリの過去問',summary:'医療管理、看護、リハビリテーションと医療系サービス。各年度の試験当時の出題を収録しています。',relatedIds:['medical-opinion','coordination']},
  {id:'past.social',categoryId:'C4',label:'生活支援・福祉の過去問',summary:'相談援助、生活支援、福祉サービス。各年度の試験当時の出題を収録しています。',relatedIds:['choice','community']},
  {id:'past.rights',categoryId:'C5',label:'権利擁護・終末期ケアの過去問',summary:'虐待防止、成年後見、意思決定、終末期支援。各年度の試験当時の出題を収録しています。',relatedIds:['dignity','consent']},
];
