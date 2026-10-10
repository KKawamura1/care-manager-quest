import historicalSources from './packs/historical-sources.json';
import type { Source } from '../domain/models';
export const sources: Source[] = [
 ...historicalSources,
 {id:'official-2025',title:'2025年度 公式問題冊子（東京都掲載）',url:'https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/r7shikenmondai'},
 {id:'official-2025-answers',title:'2025年度 正答番号の公表（東京都）',url:'https://www.fukushi.metro.tokyo.lg.jp/kourei/shikaku/r7_seitoukijyun'},
 {id:'reuse-guidance',title:'試験センターの過去問題利用条件',url:'https://www.sssc.or.jp/pastissues/index.html'},
  { id: 'law', title: '厚生労働省・介護保険法', url: 'https://www.mhlw.go.jp/web/t_doc?dataId=82998034&dataType=0' },
  { id: 'care', title: '厚生労働省・指定居宅介護支援等の事業の人員及び運営に関する基準', url: 'https://www.mhlw.go.jp/web/t_doc?dataId=82999405' },
  { id: 'nintei', title: '厚生労働省・要介護認定に係る法令', url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/nintei/gaiyo4.html' },
];

export const officialNotice = '問題の著作権：公益財団法人 社会福祉振興・試験センター。独自の分類・解説・ゲーム機能は同センターと関係がありません。';
