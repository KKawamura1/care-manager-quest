import truth from '../../data/choice-tf/choice-answers-2005-2025.json';
import taxonomy from '../../data/taxonomy/taxonomy-v2.json';
import topics from '../../data/taxonomy/question-concepts-2005-2025-combined.json';
import { questions } from './provider';
import { buildSwipeCards, type TopicRecord, type TruthRecord } from '../domain/swipe';

export const swipeConcepts = taxonomy.concepts;
export const swipeCategories = taxonomy.categories;
export const swipeCatalog = buildSwipeCards(questions, truth.questions as Record<string, TruthRecord>, topics as Record<string, TopicRecord>, new Set(swipeConcepts.map(c => c.id)));
export const swipeCards = swipeCatalog.cards;
export const swipeCardById = new Map(swipeCards.map(card => [card.id, card]));
