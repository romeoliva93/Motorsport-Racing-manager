/** Notizie generate da ciò che accade nel gioco (gare, mercato, campionato, finanze). */
import type { IdFactory } from '@lean-angle/core';
import type { GameState, NewsId, NewsItem } from '@lean-angle/data';

export function addNews(s: GameState, ids: IdFactory, item: Omit<NewsItem, 'id'>): void {
  const id = ids.next('nws') as NewsId;
  s.tables.news[id] = { id, ...item };
}
