# KOHD//GEN

Generator for **kohd**, the nodal circuit-script of the *Motherboard* campaign frame for
[Daggerheart](https://www.daggerheart.com/). Type a word or sentence; get the circuit,
charge to ground.

**Live:** https://aronjanosch.github.io/kohd-gen/

## What it implements

The full word and sentence construction rules from the campaign frame:

- **Word glyphs** — 3×3 node grid (`ABC DEF GHI / JKL MNO PQR / STU VWX YZ`), one circuit
  per word: charge indicator (resistor) at the first letter's node, trace lines between
  nodes, subnode dots encoding each letter's position (1–3) on the trace leaving its node,
  concentric rings for node revisits, and a ground indicator carrying the final letter's dots.
- **Null modifier** — added when a word's node pattern doesn't pin down its position on
  the grid (e.g. FELLED, MOUNT, HOMING).
- **Sentences** — coupler, left-to-right word chaining via bar-terminated connector traces,
  articles slotted into the charge node, lexicon shortforms (and, or, is/true, not/false,
  because, so, if, there-is, unique, pronouns), `from X to Y` / `if X then Y` collapsed
  around their binary symbols, commas dividing connectors, and `.` `!` `?` affixed to the
  final ground.

## Why another one?

Existing tools either overlap trace edges or stop at single words. This generator routes
traces the way the book plates do: collinear runs bundle into parallel lanes with even
spacing, blocked runs shift sideways past nodes, long blocked hops go around the perimeter
with 45° corners — and a geometric invariant suite (no parallel overlap, node keep-outs,
deterministic output) runs in CI over a dictionary of stress words.

## Development

```sh
npm install
npm run dev     # vite dev server
npm test        # vitest: encoder goldens, router invariants, sentence composer
npm run build   # typecheck + production build
```

Pipeline: `text → encoder (semantic circuit IR) → router (geometry) → composer (sentence
layout) → SVG`. Every stage is pure and deterministic — the same input always yields
byte-identical SVG.

## Credits & license

Code is [MIT](LICENSE). The kohd language was designed by **Chris Willett** for the
*Motherboard* campaign frame in *Daggerheart* © Darrington Press. This is an unofficial
fan tool created under the
[Darrington Press Community Gaming License](https://darringtonpress.com/license/);
no book text or imagery is reproduced.
