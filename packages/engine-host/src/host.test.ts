import { describe, expect, it } from 'vitest';
import { MemorySaveStore } from '@lean-angle/persistence';
import { createInProcessEngine } from './memoryTransport.ts';

describe('engine host + client', () => {
  it('flusso completo: anteprima → scelta squadra → nuova carriera → avanzamento → salvataggio → caricamento', async () => {
    const store = new MemorySaveStore();
    const client = createInProcessEngine(store, () => 42);
    const versions: number[] = [];
    client.onChange((v) => versions.push(v));

    await client.previewWorld('host-seed');
    const cats = await client.query('categories');
    const premier = cats.find((c) => c.tier === 'premier')!;
    const cards = await client.query('teamCards', premier.id);
    const lupo = cards.find((c) => c.name === 'Scuderia Lupo Blu')!;
    expect(await client.availableCommands()).toEqual([]);

    await client.newCareer('host-seed', 'La mia carriera', lupo.id);
    expect((await client.query('careerSummary')).team!.name).toBe('Scuderia Lupo Blu');
    expect(await client.availableCommands()).toContain('MakeOffer');

    const events = await client.dispatch({ type: 'ContinueToNextEvent' });
    expect(events.map((e) => e.type)).toContain('RoundReached');
    const after = await client.query('careerSummary');
    expect(after.roundsDone).toBe(1);

    const meta = await client.save('slot-1');
    expect(meta).toMatchObject({ slot: 'slot-1', teamName: 'Scuderia Lupo Blu', savedAt: 42 });
    await client.dispatch({ type: 'AdvanceDays', days: 5 });
    await client.load('slot-1');
    expect((await client.query('careerSummary')).date).toBe(after.date);
    expect(await client.listSaves()).toHaveLength(1);
    expect(versions.length).toBeGreaterThanOrEqual(4);
  });

  it('gli errori del motore arrivano come Promise rifiutate', async () => {
    const client = createInProcessEngine(new MemorySaveStore());
    await expect(client.query('careerSummary')).rejects.toThrow('Nessuna carriera caricata');
    await client.newCareer('err-seed', 'x');
    await expect(client.dispatch({ type: 'AdvanceDays', days: 3 })).rejects.toThrow(
      'Scegli prima una squadra',
    );
    await expect(client.load('non-esiste')).rejects.toThrow('non trovato');
  });
});
