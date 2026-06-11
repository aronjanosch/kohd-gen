import { describe, expect, it } from 'vitest';
import { composeSentence } from '../src/compose/sentence';
import { encodeSentence } from '../src/encoder/sentence';

describe('encodeSentence (book example)', () => {
  const plan = encodeSentence('The network carries communication from city to city.');

  it('folds the article into network and collapses from-to', () => {
    const kinds = plan.items.map((i) =>
      i.kind === 'word' ? i.circuit.word : i.kind === 'lexicon' ? `<${i.symbol}>` : ',',
    );
    expect(kinds).toEqual(['NETWORK', 'CARRIES', 'COMMUNICATION', 'CITY', '<fromTo>', 'CITY']);
    const network = plan.items[0]!;
    expect(network.kind === 'word' && network.circuit.charge.article).toBe('the');
  });

  it('puts the period on the final word ground', () => {
    const last = [...plan.items].reverse().find((i) => i.kind === 'word');
    expect(last!.kind === 'word' && last!.circuit.ground.punctuation).toBe('.');
  });
});

describe('encodeSentence lexicon and patterns', () => {
  it('maps lexicon words to symbols', () => {
    const plan = encodeSentence('you and me');
    expect(plan.items.map((i) => (i.kind === 'lexicon' ? i.symbol : i.kind))).toEqual([
      'you',
      'and',
      'iMe',
    ]);
  });

  it('collapses if-then', () => {
    const plan = encodeSentence('if signal then run');
    const kinds = plan.items.map((i) => (i.kind === 'word' ? i.circuit.word : i.kind === 'lexicon' ? i.symbol : ','));
    expect(kinds).toEqual(['SIGNAL', 'ifThen', 'RUN']);
  });

  it('handles there is', () => {
    const plan = encodeSentence('there is hope');
    const kinds = plan.items.map((i) => (i.kind === 'word' ? i.circuit.word : i.kind === 'lexicon' ? i.symbol : ','));
    expect(kinds).toEqual(['thereIs', 'HOPE']);
  });

  it('records commas as items', () => {
    const plan = encodeSentence('run, hide');
    expect(plan.items.map((i) => i.kind)).toEqual(['word', 'comma', 'word']);
  });
});

describe('composeSentence', () => {
  it('lays out the book sentence with finite geometry and one connector per gap', () => {
    const s = composeSentence(encodeSentence('The network carries communication from city to city.'));
    expect(s.words.length).toBe(5);
    // coupler connector + 5 inter-item connectors (6 slots)
    expect(s.connectors.length).toBe(6);
    const all = JSON.stringify(s);
    expect(all.includes('null')).toBe(false);
    expect(all.includes('NaN')).toBe(false);
    expect(s.bbox.max.x).toBeGreaterThan(s.bbox.min.x);
  });

  it('is deterministic', () => {
    const a = JSON.stringify(composeSentence(encodeSentence('echo vale remnant')));
    const b = JSON.stringify(composeSentence(encodeSentence('echo vale remnant')));
    expect(a).toBe(b);
  });

  it('places a comma mark on the connector after a comma', () => {
    const s = composeSentence(encodeSentence('run, hide'));
    expect(s.connectors.some((c) => c.comma)).toBe(true);
  });
});
