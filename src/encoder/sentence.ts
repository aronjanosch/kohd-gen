import type { Article, LexiconKind, Punctuation, SentenceItem, SentencePlan } from '../types';
import { encodeWord } from './word';

/**
 * Words with simplified, non-nodally constructed forms (the campaign frame
 * lexicon). These render as standalone symbols instead of node glyphs.
 */
const LEXICON: Record<string, LexiconKind> = {
  and: 'and',
  or: 'or',
  true: 'true',
  is: 'true',
  are: 'true',
  am: 'true',
  false: 'false',
  not: 'false',
  because: 'because',
  since: 'because',
  so: 'so',
  this: 'so',
  causing: 'so',
  unique: 'unique',
  you: 'you',
  i: 'iMe',
  me: 'iMe',
  we: 'we',
  us: 'we',
  them: 'themSg',
  they: 'themPl',
  their: 'theirSg',
  theirs: 'theirPl',
};

interface Token {
  word: string;
  article?: Article;
  punctuation?: Punctuation;
  comma: boolean;
}

/**
 * Parse a sentence into kohd items: nodal word circuits, lexicon symbols,
 * articles folded into the following word's charge node, `from X to Y` /
 * `if X then Y` collapsed around their binary lexicon symbol, and trailing
 * punctuation attached to the final word's ground.
 */
export function encodeSentence(text: string): SentencePlan {
  const raw = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const tokens: Token[] = [];
  let pendingArticle: Article | undefined;

  for (let i = 0; i < raw.length; i++) {
    const stripped = raw[i]!.replace(/[^a-z]/gi, '').toLowerCase();
    if (!stripped) continue;
    const punct = /[.!?]\s*$/.exec(raw[i]!)?.[0]?.trim() as Punctuation | undefined;
    const comma = /,\s*$/.test(raw[i]!);

    if ((stripped === 'the' || stripped === 'a' || stripped === 'an') && i < raw.length - 1) {
      pendingArticle = stripped === 'the' ? 'the' : 'a';
      continue;
    }
    tokens.push({ word: stripped, article: pendingArticle, punctuation: punct, comma });
    pendingArticle = undefined;
  }

  // Collapse `from X to Y` -> X fromTo Y and `if X then Y` -> X ifThen Y.
  const items: SentenceItem[] = [];
  const queue: (Token | { lexicon: LexiconKind; comma: boolean })[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const nextNext = tokens[i + 2];
    if (t.word === 'from' && tokens[i + 1] && nextNext?.word === 'to' && tokens[i + 3]) {
      queue.push(tokens[i + 1]!);
      queue.push({ lexicon: 'fromTo', comma: false });
      queue.push(tokens[i + 3]!);
      i += 3;
      continue;
    }
    if (t.word === 'if' && tokens[i + 1] && nextNext?.word === 'then' && tokens[i + 3]) {
      queue.push(tokens[i + 1]!);
      queue.push({ lexicon: 'ifThen', comma: false });
      queue.push(tokens[i + 3]!);
      i += 3;
      continue;
    }
    if (t.word === 'there' && tokens[i + 1] && ['is', 'exists', 'are'].includes(tokens[i + 1]!.word)) {
      queue.push({ lexicon: 'thereIs', comma: tokens[i + 1]!.comma });
      i += 1;
      continue;
    }
    queue.push(t);
  }

  for (const entry of queue) {
    if ('lexicon' in entry) {
      items.push({ kind: 'lexicon', symbol: entry.lexicon });
      if (entry.comma) items.push({ kind: 'comma' });
      continue;
    }
    const lex = LEXICON[entry.word];
    if (lex) {
      items.push({ kind: 'lexicon', symbol: lex });
    } else {
      items.push({
        kind: 'word',
        circuit: encodeWord(entry.word, { article: entry.article, punctuation: entry.punctuation }),
      });
    }
    if (entry.comma) items.push({ kind: 'comma' });
  }

  // Punctuation belongs on the final nodal word's ground, even when the
  // sentence ends in a lexicon word.
  const finalPunct = /[.!?]\s*$/.exec(text)?.[0]?.trim() as Punctuation | undefined;
  if (finalPunct) {
    const lastWord = [...items].reverse().find((it) => it.kind === 'word');
    if (lastWord && lastWord.kind === 'word') lastWord.circuit.ground.punctuation = finalPunct;
  }
  return { items };
}
