// Recompute proposition counts for all normalized concept IDs; same resolver as the app.
// node --experimental-strip-types scripts/report-issue32-concept-counts.mjs --check
// node --experimental-strip-types scripts/report-issue32-concept-counts.mjs --write
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildIndex, ROOTS, canonicalPropositionId } from './normalize-issue32-ids.mjs';
const dir = new URL('../docs/taxonomy/issue-32-experiment/', import.meta.url);
const target = new URL('PR68_CONCEPT_PROPOSITION_COUNTS.csv', dir);
const {index,drawer_registry,summary} = buildIndex();
const drawers = new Map(drawer_registry.map(d => [d.id,d]));
const conceptCounts = new Map(), propositions = new Map();
for (const entry of index) {
  assert.ok(!propositions.has(entry.proposition_id), 'duplicate proposition: '+entry.proposition_id);
  propositions.set(entry.proposition_id,entry);
  const drawer=drawers.get(entry.primary_drawer_id);
  assert.ok(drawer,'missing drawer '+entry.proposition_id);
  const key=drawer.root+'|'+drawer.concept_id;
  let item=conceptCounts.get(key);
  if (!item) {
    item={root:drawer.root,label:ROOTS[drawer.root],id:drawer.concept_id,name:drawer.concept_label,n:0};
    conceptCounts.set(key,item);
  }
  assert.equal(item.name,drawer.concept_label,'concept label mismatch: '+key);
  item.n++;
}
let explicit=0,scanned=0;
for (let year=2005;year<=2025;year++) {
  const data=readFileSync(new URL('propositions/'+year+'.jsonl',dir),'utf8').trim();
  for (const line of data.split(/\r?\n/).filter(Boolean)) {
    const row=JSON.parse(line),id=canonicalPropositionId(row);
    const normalized=propositions.get(id);
    assert.ok(normalized,'missing normalized proposition: '+id);
    if (row.drawer_assignment) {
      explicit++;
      assert.equal(drawers.get(normalized.primary_drawer_id).concept_id,row.drawer_assignment.concept_id,
        'drawer review/normalizer mismatch: '+id);
    }
    scanned++;
  }
}
assert.equal(index.length,6346);
assert.equal(summary.proposition_count,6346);
assert.equal(scanned,6346);
assert.equal(conceptCounts.size,490);
assert.equal(summary.concept_count,490);
assert.equal(explicit,1629);
assert.equal([...conceptCounts.values()].reduce((sum,item)=>sum+item.n,0),6346);
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const quote=x=>{const s=String(x);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
const sorted=[...conceptCounts.values()].sort((a,b)=>cmp(a.root,b.root)||cmp(a.id,b.id));
const csv='旧大分類ID,旧大分類,概念ID,概念名,命題数\n'
  +sorted.map(r=>[r.root,r.label,r.id,r.name,r.n].map(quote).join(',')).join('\n')+'\n';
if (process.argv.includes('--check')) assert.equal(readFileSync(target,'utf8'),csv,'CSV out of date: use --write');
if (process.argv.includes('--write')) writeFileSync(target,csv);
console.log(JSON.stringify({propositions:scanned,concepts:conceptCounts.size,explicit_concept_ids:explicit,
  normalized_without_explicit_id:scanned-explicit},null,2));
