import { describe, expect, it } from 'vitest';
import { generateWorld } from '@lean-angle/data';
import { MemorySaveStore, createSaveRecord, restoreSaveRecord } from './index.ts';

describe('salvataggi', () => {
  it('salva e ricarica lo stesso stato', async () => {
    const s = generateWorld({ seed: 'save-test', saveName: 'Carriera A' });
    const store = new MemorySaveStore();
    await store.put(createSaveRecord(s, 'slot-1', 1000));
    const list = await store.list();
    expect(list).toEqual([
      expect.objectContaining({ slot: 'slot-1', saveName: 'Carriera A', gameDate: '1 gennaio 2027' }),
    ]);
    expect(restoreSaveRecord((await store.get('slot-1'))!)).toEqual(s);
    await store.delete('slot-1');
    expect(await store.get('slot-1')).toBeNull();
  });

  it('rifiuta nomi di slot non validi', () => {
    const s = generateWorld({ seed: 'x' });
    expect(() => createSaveRecord(s, '../hack', 0)).toThrow();
  });
});
