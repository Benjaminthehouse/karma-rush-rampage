import './bananascale.css';
import { COLOR, clamp1000, h, pick, pulse, randInt, shuffled, type Btn, type GameFactory } from './common';

const OUTLINE = '<g stroke="#0b1020" stroke-width="2" stroke-linejoin="round">';

// Every drawing touches the top and the bottom of its viewBox, so heights compare exactly.
const BANANA =
  `<svg class="nana" viewBox="6 0 44 100" aria-hidden="true">${OUTLINE}<path d="M16 11 18 1h7l1 9z" fill="#8a6a1c"/>` +
  '<path d="M17 11 25 9C51 30 49 82 20 99L14 95C32 74 32 36 17 11Z" fill="#ffd23f"/></g>' +
  '<path d="M31 26c8 15 8 36 0 52" fill="none" stroke="#fff6c2" stroke-width="2.5" stroke-linecap="round"/></svg>';

// `w` is the drawing's width when its height is 100.
const THINGS = [
  {
    w: 70,
    caps: ['Roommate came home with this', 'Found a cone. It is mine now.'],
    art: '<path d="M28 2h14l16 84H12z" fill="#ff8a2a"/><path d="M22.7 30h24.6l3.1 16H19.6zM17 60h36l2.3 12H14.7z" fill="#fff"/><rect x="2" y="86" width="66" height="12" rx="3" fill="#e2670f"/>',
  },
  {
    w: 54,
    caps: ['New fridge day!', 'My fridge, magnets included'],
    art: '<rect x="2" y="2" width="50" height="92" rx="5" fill="#e3e9f7"/><path d="M2 34h50" fill="none"/><path d="M41 12h4v14h-4zM41 42h4v22h-4zM7 94h8v5H7zM39 94h8v5h-8z" fill="#8d97b8"/><rect x="9" y="44" width="13" height="11" fill="#ffcf3f"/><circle cx="24" cy="64" r="4" fill="#b14bff"/>',
  },
  {
    w: 96,
    caps: ['Suspiciously large rock', 'Is this a good rock?'],
    art: '<path d="M5 98 2 68 14 36 36 10 60 2 82 12 94 44 91 98z" fill="#8a93ad"/><path d="M36 10 60 2 82 12 66 32 44 34z" fill="#aab3cc"/><circle cx="40" cy="58" r="7" fill="#fff"/><circle cx="64" cy="58" r="7" fill="#fff"/><circle cx="37" cy="59" r="3" fill="#0b1020"/><circle cx="61" cy="59" r="3" fill="#0b1020"/>',
  },
  {
    w: 68,
    caps: ['He just sits like this', 'Orange cat, one brain cell'],
    art: '<path d="M52 93c14 0 12-22 4-29" fill="none" stroke="#f0a13c" stroke-width="7" stroke-linecap="round"/><path d="M12 98C4 70 14 46 32 46s28 24 20 52zM11 24 13 2 30 14zM53 24 51 2 34 14z" fill="#f0a13c"/><ellipse cx="32" cy="30" rx="23" ry="19" fill="#f0a13c"/><circle cx="23" cy="29" r="3.2" fill="#0b1020"/><circle cx="41" cy="29" r="3.2" fill="#0b1020"/><path d="M29 36h6l-3 3z" fill="#0b1020"/><path d="M24 98V80M40 98V80" fill="none"/>',
  },
  {
    w: 50,
    caps: ['First build! Rate my rig', 'It runs hot. Very hot.'],
    art: '<rect x="2" y="2" width="46" height="93" rx="4" fill="#e3e9f7"/><rect x="8" y="10" width="34" height="64" rx="2" fill="#0b1020"/><g fill="none" stroke-width="3"><circle cx="25" cy="22" r="7.5" stroke="#b14bff"/><circle cx="25" cy="42" r="7.5" stroke="#ffcf3f"/><circle cx="25" cy="62" r="7.5" stroke="#7ee7ff"/></g><circle cx="25" cy="84" r="3" fill="#7ee7ff"/><path d="M6 95h9v4H6zM35 95h9v4h-9z" fill="#8d97b8"/>',
  },
  {
    w: 60,
    caps: ["The mod's gaming chair", 'Have not left it since 2019'],
    art: '<path d="M18 2h24a7 7 0 0 1 7 7v47H11V9a7 7 0 0 1 7-7z" fill="#8d5cf0"/><path d="M23 2v54M37 2v54" fill="none"/><rect x="5" y="54" width="50" height="13" rx="5" fill="#8d5cf0"/><path d="M2 40h7v15H2zM51 40h7v15h-7z" fill="#3b4470"/><rect x="27" y="67" width="6" height="17" fill="#8d97b8"/><path d="M8 93 30 84l22 9" fill="none" stroke="#8d97b8" stroke-width="5" stroke-linecap="round"/><circle cx="8" cy="95.5" r="3.5" fill="#e3e9f7"/><circle cx="30" cy="95.5" r="3.5" fill="#e3e9f7"/><circle cx="52" cy="95.5" r="3.5" fill="#e3e9f7"/>',
  },
  {
    w: 84,
    caps: ['Dinner for one', 'Leftovers, day nine'],
    art: '<path d="M6 2h72v16H6zM2 18h72v16H2zM9 34h72v16H9zM4 50h72v16H4zM8 66h72v16H8zM3 82h72v16H3z" fill="#d8b47c"/><path d="M6 7h72M2 23h72M9 39h72M4 55h72M8 71h72M3 87h72" fill="none"/>',
  },
  {
    w: 50,
    caps: ['Thrifted this lamp for $3', 'Lamp. Moths love it.'],
    art: '<path d="M14 2h22l10 30H4z" fill="#ffcf3f"/><rect x="23" y="32" width="4" height="60" fill="#8d97b8"/><ellipse cx="25" cy="94" rx="17" ry="4" fill="#8d97b8"/>',
  },
  {
    w: 100,
    caps: ['Free couch from the kerb', "Grandpa's haunted armchair"],
    art: '<rect x="16" y="2" width="68" height="64" rx="12" fill="#b9825a"/><rect x="22" y="52" width="56" height="26" rx="5" fill="#d29c72"/><rect x="2" y="34" width="22" height="56" rx="9" fill="#b9825a"/><rect x="76" y="34" width="22" height="56" rx="9" fill="#b9825a"/><path d="M24 78h52v12H24z" fill="#a06d48"/><path d="M8 90h8v8H8zM84 90h8v8h-8z" fill="#5b4030"/>',
  },
];

const STACK_MS = 240; // the bananas climb to the top in this long
const RIGHT_MS = 520; // then the verdict stays up until the next thing
const WRONG_MS = 800;

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 7 + level * 0.25;
  const things = shuffled(rng, THINGS);
  let bag: Btn[] = [];
  // More things than anyone can measure; the right answer sits on each button equally often.
  const rounds = Array.from({ length: 27 }, (_, i) => {
    if (i % 3 === 0) bag = shuffled(rng, [0, 1, 2] as Btn[]);
    const thing = things[i % things.length];
    // Guesses two apart are easy to eyeball; later levels mix in consecutive ones.
    const step = rng() < level * 0.2 ? 1 : 2;
    const low = randInt(rng, 2, 3 + Math.floor(level / 3));
    const win = bag[i % 3];
    return { thing, cap: pick(rng, thing.caps), guesses: [low, low + step, low + 2 * step], win, tall: low + win * step };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let reveal: { from: number; until: number; ok: boolean; shown: number } | null = null;
  const score = () => clamp1000((1000 * (right - wrong / 2)) / par);

  const wrap = h('div', 'g-bananascale');
  const meter = h('div', 'meter');
  const fill = h('i');
  meter.append(fill);
  const title = h('div', 'title');
  const scene = h('div', 'scene');
  const pair = h('div', 'pair');
  const stack = h('div', 'stack');
  const thing = h('div', 'thing');
  const stamp = h('div', 'stamp');
  pair.append(stack, thing);
  scene.append(pair, stamp);
  const picks = h('div', 'picks');
  const chips = [0, 1, 2].map((i) => {
    const chip = h('div', `pick c-${COLOR[i]}`);
    chip.innerHTML = `<b></b>${BANANA}`;
    picks.append(chip);
    return chip;
  });
  wrap.append(meter, title, scene, picks);
  root.append(wrap);

  function show() {
    const r = rounds[idx % rounds.length];
    reveal = null;
    title.className = 'title';
    title.textContent = r.cap;
    pair.className = 'pair';
    pair.style.setProperty('--ar', String(r.thing.w / 100));
    pair.style.setProperty('--k', String(r.tall));
    // The bottom banana is the one for scale; the rest stay hidden until the reveal.
    stack.innerHTML = BANANA.repeat(r.tall);
    thing.innerHTML = `<svg viewBox="0 0 ${r.thing.w} 100" aria-hidden="true">${OUTLINE}${r.thing.art}</g></svg>`;
    stamp.className = 'stamp';
    chips.forEach((chip, i) => {
      chip.className = `pick c-${COLOR[i]}`;
      chip.firstElementChild!.textContent = String(r.guesses[i]);
    });
    pulse(pair, 'pop-in');
  }
  show();

  return {
    press(b, t) {
      if (reveal) return;
      const r = rounds[idx % rounds.length];
      const ok = b === r.win;
      if (ok) {
        right++;
        good(chips[b], `${r.tall}!`);
      } else {
        wrong++;
        bad(chips[b], `IT'S ${r.tall}`);
      }
      reveal = { from: t, until: t + (ok ? RIGHT_MS : WRONG_MS), ok, shown: 1 };
      chips.forEach((chip, i) => chip.classList.add(i === r.win ? 'yes' : 'no'));
      pulse(chips[b], 'bump');
      title.className = 'title count';
      title.textContent = '1';
      fill.style.width = `${score() / 10}%`;
    },
    tick(t) {
      if (!reveal) return;
      const r = rounds[idx % rounds.length];
      const upTo = Math.min(r.tall, 1 + Math.floor(((t - reveal.from) * (r.tall - 1)) / STACK_MS));
      while (reveal.shown < upTo) {
        stack.children[reveal.shown++].classList.add('on');
        title.textContent = String(reveal.shown);
        fx.sound('tick');
        if (reveal.shown < r.tall) continue;
        // The stack reaches the top: the verdict.
        title.textContent = `${r.tall} BANANAS TALL`;
        stamp.textContent = reveal.ok ? 'APPROVED UNIT' : 'NOT TO SCALE';
        stamp.className = `stamp on${reveal.ok ? '' : ' no'}`;
        pair.classList.add('done');
        if (reveal.ok) {
          pair.classList.add('spin');
          fx.burst(thing, 'gold', 14);
          fx.sound('coin');
        } else fx.sound('thud');
      }
      if (t >= reveal.until) {
        idx++;
        show();
      }
    },
    score,
    hint: () => (reveal ? null : rounds[idx % rounds.length].win),
  };
};
