import type { ConceptProgress, PlayerState, Question } from './models';
import { reflect } from './game';

// Reproject saved answers onto today's drawers; retain the stored attempts and XP.
// Old reflections are not inferred to mean mastery of newly split knowledge.
export function knowledgeProgress(player: PlayerState, questions: readonly Question[]) {
  const byId = new Map(questions.map(q => [q.id, q]));
  const progress: Record<string, ConceptProgress> = {};
  for (const attempt of player.attempts) {
    const q = byId.get(attempt.questionId);
    if (!q || q.version !== attempt.questionVersion) continue;
    for (const id of q.conceptIds) {
      const p = progress[id] ??= { seenQuestionIds: [], correctQuestionIds: [], reflected: (player.concepts[id]?.reflected ?? false) || (player.knowledgeReflections?.includes(id) ?? false) };
      if (!p.seenQuestionIds.includes(q.id)) p.seenQuestionIds.push(q.id);
      if (attempt.correct && !p.correctQuestionIds.includes(q.id)) p.correctQuestionIds.push(q.id);
    }
  }
  return progress;
}
export function reflectKnowledge(player: PlayerState, ids: string[], questions: readonly Question[]): PlayerState {
  const progress = knowledgeProgress(player, questions);
  const learned = ids.filter(id => progress[id]?.seenQuestionIds.length);
  return { ...reflect(player, learned), knowledgeReflections: [...new Set([...(player.knowledgeReflections ?? []), ...learned])] };
}
