import './rant.css';
import { COLOR, h, padDots, person, pulse, ratio, shuffled, type Btn, type GameFactory } from './common';

const RANTS = [
  'Okay I need to vent. Who keeps microwaving fish in the office kitchen? It has been THREE DAYS and the smell pays rent now. I left a polite note. Somebody ate the note. I am not saying it was Greg but Greg owns a fish. Do better, Greg. EDIT: it was not Greg. I am so sorry, Greg.',
  'Unpopular opinion and I do not care about the downvotes. Cereal is a soup. A hot dog is a sandwich. The middle seat gets BOTH armrests. I have thought about this for nine years and I will not be taking questions. EDIT: stop sending me questions.',
  'To whoever keeps reposting the same cat picture: I have seen this cat forty times. I know this cat better than my own family. I have upvoted it every single time and I am FURIOUS about it. Post a new cat. Any cat. I am begging you.',
  'My upstairs neighbour is either bowling or moving a piano every night at 3am. I have named the piano. Its name is Kevin. Kevin never sleeps. I knocked once and a man said they do not own a piano. Then what is Kevin? WHAT IS KEVIN?',
  'I just want ONE recipe that is not hidden under a nine paragraph story about a summer in Tuscany. I do not care about your aunt. I do not care about the light. How many eggs? HOW MANY EGGS, DEBORAH? I have been scrolling since Tuesday.',
  'The mods removed my post for being low effort. LOW EFFORT? I spent four whole minutes on that meme. I picked a font. I moved the text twice. That is craftsmanship. This sub was better in the old days, which I joined last week.',
  'Why does every single app need an account now? I wanted to turn on a lamp. A LAMP. It asked for my email, my birthday and my favourite planet. The lamp sends me a newsletter. I have never read it. The lamp knows.',
  'Day 12 of asking my group chat where we are eating. Everyone says I do not mind. Everyone minds. We have rejected nine restaurants and one food truck. I am eating cereal over the sink. Do not text me. I mean it. Okay you can text me.',
];
const PER_TAP = 3; // characters typed by one press
const GRACE = 300; // ms after a colour change in which presses on the old colour are forgiven

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // More rant than anyone can type; 1000 points means hitting the par character count.
  const par = Math.round((duration / 1000) * (5.6 + level * 0.2)) * PER_TAP;
  // The rant is cut into runs of words, each in one colour. Later rounds switch more often.
  const runLen = 26 - level * 3;
  const words = shuffled(rng, RANTS).slice(0, 3).join(' ').split(' ');
  const runs: { text: string; btn: Btn }[] = [];
  let prev = -1;
  for (let i = 0; i < words.length; ) {
    let text = words[i++];
    while (i < words.length && text.length < runLen) text += ` ${words[i++]}`;
    let btn = Math.floor(rng() * 3) as Btn;
    while (btn === prev) btn = Math.floor(rng() * 3) as Btn;
    prev = btn;
    runs.push({ text: `${text} `, btn });
  }
  let run = 0;
  let typed = 0; // characters typed in the current run
  let total = 0;
  let lockedUntil = 0;
  let lastBtn = -1;
  let graceEnd = 0;

  const wrap = h('div', 'g-rant scene-feed');
  const bar = h('div', 'bar');
  const face = person({ tone: 'pink', kind: 'cat', mood: 'angry', px: 0.16 });
  const next = h('span', 'next');
  bar.append(face.el, h('b', '', 'r/rant · new post'), next);
  const view = h('div', 'view');
  view.dataset.scroll = ''; // the page scrolls under this window on purpose
  const page = h('div', 'page');
  const spans = runs.map((r) => {
    const s = h('span', `run c-${COLOR[r.btn]}`);
    const done = h('b');
    const rest = h('i', '', r.text);
    s.append(done, rest);
    page.append(s);
    return { s, done, rest };
  });
  view.append(page);
  const count = h('div', 'count');
  wrap.append(bar, view, count);
  root.append(wrap);

  function show() {
    const r = runs[run];
    const sp = spans[run];
    sp.done.textContent = r.text.slice(0, typed);
    sp.rest.textContent = r.text.slice(typed);
    spans.forEach((x, i) => x.s.classList.toggle('now', i === run));
    next.replaceChildren(padDots(r.btn));
    // Keep the line being typed about a third of the way down the page.
    const top = sp.s.offsetTop - view.clientHeight * 0.3;
    page.style.transform = `translateY(${-Math.max(0, top)}px)`;
    count.textContent = `${total} characters of pure rage`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil || run >= runs.length) return;
      const r = runs[run];
      if (b !== r.btn) {
        // Nobody stops mashing the instant the colour changes.
        if (b === lastBtn && t < graceEnd) return;
        // A wrong colour buzzes and jams the keys for a moment. Nothing typed is ever lost.
        lockedUntil = t + 220;
        face.mood('shock');
        pulse(view, 'shake');
        bad(spans[run].done, 'TYPO!');
        return;
      }
      const n = Math.min(PER_TAP, r.text.length - typed);
      typed += n;
      total += n;
      face.mood('angry');
      good(spans[run].done);
      if (typed >= r.text.length) {
        spans[run].done.textContent = r.text;
        spans[run].rest.textContent = '';
        fx.poof(spans[run].s);
        fx.sound('pop');
        lastBtn = b;
        graceEnd = t + GRACE;
        run = Math.min(runs.length - 1, run + 1);
        typed = 0;
      }
      show();
    },
    tick() {},
    score: () => ratio(total, par),
    hint: (t) => (t >= lockedUntil ? runs[run].btn : null),
  };
};
