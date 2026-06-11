import { composeSentence } from '../compose/sentence';
import { encodeSentence } from '../encoder/sentence';
import { encodeWord } from '../encoder/word';
import { routeWord } from '../layout/router';
import { sentenceSvg } from '../render/sentence';
import { wordSvg } from '../render/word';
import { downloadPng, downloadSvg } from './export';
import './style.css';

type Mode = 'sentence' | 'words';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="titleblock">
    <div class="tb-mark">
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="17" cy="20" r="9" fill="none" stroke="var(--signal)" stroke-width="2.4"/>
        <circle cx="17" cy="20" r="13.5" fill="none" stroke="var(--signal)" stroke-width="1.2"/>
        <line x1="30.5" y1="20" x2="40" y2="20" stroke="var(--signal)" stroke-width="2.4"/>
        <circle cx="34" cy="20" r="2.4" fill="var(--signal)" stroke="none"/>
      </svg>
    </div>
    <div class="tb-title">
      <h1>KOHD<span class="slash">//</span>GEN</h1>
      <p>NODAL CIRCUIT-SCRIPT TRANSLATOR — ECHO VALE RECOVERY UNIT</p>
    </div>
    <dl class="tb-field"><dt>SUBROUTINE</dt><dd id="tb-mode">SENTENCE</dd></dl>
    <dl class="tb-field"><dt>CIRCUITS</dt><dd id="tb-count">0</dd></dl>
    <dl class="tb-field"><dt>SOURCE</dt><dd><a href="https://github.com/aronjanosch/kohd-gen">github</a></dd></dl>
  </header>

  <div class="console">
    <input id="text" type="text" autocomplete="off" spellcheck="false"
      placeholder="type a message to encode…"
      value="The network carries communication from city to city." />
    <div class="modes" role="group" aria-label="mode">
      <button id="mode-sentence" aria-pressed="true">SENTENCE</button>
      <button id="mode-words" aria-pressed="false">WORDS</button>
    </div>
    <div class="exports">
      <button id="dl-svg">SVG</button>
      <button id="dl-png">PNG</button>
    </div>
  </div>

  <div class="plate-frame">
    <span class="crop"></span>
    <div class="plate" id="plate"></div>
  </div>

  <footer>
    <p>
      Kohd language designed by Chris Willett for the <em>Motherboard</em> campaign frame,
      <em>Daggerheart</em> © Darrington Press. This is an unofficial fan tool under the
      <a href="https://darringtonpress.com/license/">Darrington Press Community Gaming License</a>;
      no book text or imagery is reproduced. Words flow from charge to ground — punctuation, articles,
      lexicon shortforms, from–to and if–then couplers are applied per the frame's rules.
    </p>
  </footer>
`;

const input = document.querySelector<HTMLInputElement>('#text')!;
const plate = document.querySelector<HTMLDivElement>('#plate')!;
const tbMode = document.querySelector<HTMLElement>('#tb-mode')!;
const tbCount = document.querySelector<HTMLElement>('#tb-count')!;
const modeButtons: Record<Mode, HTMLButtonElement> = {
  sentence: document.querySelector('#mode-sentence')!,
  words: document.querySelector('#mode-words')!,
};

let mode: Mode = 'sentence';
let currentSvg = '';

function slug(): string {
  const words = input.value.replace(/[^a-z\s]/gi, '').trim().split(/\s+/).slice(0, 4);
  return `kohd-${(words.join('-') || 'empty').toLowerCase()}`;
}

function render() {
  const text = input.value.trim();
  currentSvg = '';
  if (!/[a-z]/i.test(text)) {
    plate.innerHTML = '<p class="hint">awaiting transmission — type a word or sentence above</p>';
    tbCount.textContent = '0';
    return;
  }
  try {
    if (mode === 'sentence') {
      const plan = encodeSentence(text);
      currentSvg = sentenceSvg(composeSentence(plan));
      plate.innerHTML = currentSvg;
      tbCount.textContent = String(plan.items.filter((i) => i.kind !== 'comma').length);
    } else {
      const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
      const grid = document.createElement('div');
      grid.className = 'wordgrid';
      for (const word of words) {
        const fig = document.createElement('figure');
        fig.innerHTML = wordSvg(routeWord(encodeWord(word)));
        const cap = document.createElement('figcaption');
        cap.textContent = word.replace(/[^a-z]/gi, '').toUpperCase();
        fig.appendChild(cap);
        grid.appendChild(fig);
      }
      plate.innerHTML = '';
      plate.appendChild(grid);
      // Export bundles the first word in words mode.
      currentSvg = words.length ? wordSvg(routeWord(encodeWord(words[0]!))) : '';
      tbCount.textContent = String(words.length);
    }
  } catch (e) {
    plate.innerHTML = `<p class="error">${String(e)}</p>`;
    tbCount.textContent = '—';
  }
}

function setMode(m: Mode) {
  mode = m;
  tbMode.textContent = m.toUpperCase();
  for (const [k, btn] of Object.entries(modeButtons)) {
    btn.setAttribute('aria-pressed', String(k === m));
  }
  render();
}

let debounce: number | undefined;
input.addEventListener('input', () => {
  window.clearTimeout(debounce);
  debounce = window.setTimeout(render, 120);
});
modeButtons.sentence.addEventListener('click', () => setMode('sentence'));
modeButtons.words.addEventListener('click', () => setMode('words'));

document.querySelector('#dl-svg')!.addEventListener('click', () => {
  if (currentSvg) downloadSvg(currentSvg, slug());
});
document.querySelector('#dl-png')!.addEventListener('click', () => {
  if (currentSvg) downloadPng(currentSvg, slug());
});

render();
