import truth from '../../data/choice-tf/choice-answers-2005-2025.json';
import { concepts, categories, choiceClassifications, classificationRevision } from './knowledge';
import { questions } from './provider';
import { buildSwipeCards, type TopicRecord, type TruthRecord } from '../domain/swipe';

export const swipeConcepts = concepts;
export const swipeCategories = categories;
export const swipeCatalog = buildSwipeCards(questions, truth.questions as Record<string, TruthRecord>, choiceClassifications as Record<string, TopicRecord>, new Set(swipeConcepts.map(c => c.id)), classificationRevision);
export const swipeCards = swipeCatalog.cards;
export const swipeCardById = new Map(swipeCards.map(card => [card.id, card]));
