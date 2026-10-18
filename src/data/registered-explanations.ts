import { matchingRegisteredExplanations, parseRegisteredExplanation, type RegisteredExplanation } from '../domain/registeredExplanation';
import { cardTarget, type ExplanationTarget } from '../domain/appExplanation';
import { swipeCardById } from './swipe-provider';

// A registration adds exactly one file. No index or application edit is needed.
const files = import.meta.glob<unknown>('../../data/explanations/entries/**/*.json', { eager:true, import:'default' });
export const registeredExplanations: RegisteredExplanation[] = [];
export const registrationErrors: string[] = [];
const seen = new Set<string>();
for (const [path,value] of Object.entries(files)) {
  try {
    const entry = parseRegisteredExplanation(value,path);
    if (seen.has(entry.registrationId)) throw new Error('registrationIdが重複しています');
    seen.add(entry.registrationId); registeredExplanations.push(entry);
  } catch (error) { registrationErrors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`); }
}
export const registeredExplanationHistory = (target: ExplanationTarget) => matchingRegisteredExplanations(registeredExplanations,target);
export const registeredExplanationFor = (target: ExplanationTarget) => registeredExplanationHistory(target)[0];
export function registeredQuestionChoices(questionId: string) {
  return ['1','2','3','4','5'].flatMap(choiceId => {
    const card = swipeCardById.get(`${questionId}:${choiceId}`);
    if (!card) return [];
    const target = cardTarget(card);
    return registeredExplanationFor(target) ? [{ choiceId, truth:card.truth, target }] : [];
  });
}
