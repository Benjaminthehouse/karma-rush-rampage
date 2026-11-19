import './aitaverdict.css';
import { COLOR, h, pick, pulse, ratio, shuffled, type Btn, type GameFactory } from './common';

// Indexed by who has the horns, which is also the button: 0 OP, 1 both, 2 them.
const VERDICT = ['YTA', 'ESH', 'NTA'];
const CASES = [
  [
    'for microwaving fish at the office?',
    'for replying-all to 400 people?',
    'for spoiling the finale in the group chat?',
    'for eating my roommate’s labelled leftovers?',
    'for charging my friends for tap water?',
    'for practising drums in the library?',
    'for taking the last slice AND the box?',
  ],
  [
    'for pranking the neighbour who pranked me?',
    'for stealing back the lunch he stole?',
    'for out-snoring my roommate on purpose?',
    'for winning our sticky-note war?',
    'for returning their glitter bomb, with interest?',
    'for hiding the remote she already hid?',
    'for honking back for nine minutes?',
  ],
  [
    'for wanting cake at my own birthday?',
    'for asking my roommate to pay rent?',
    'for not lending my car to a stranger?',
    'for saying no to karaoke at 4am?',
    'for keeping the dog my ex abandoned?',
    'for locking my door after he sold my bed?',
    'for not sharing my password with my boss?',
  ],
];

// A bust with both a halo and horns; the .guilty class on its seat picks which one shows.
const BUST =
  '<svg viewBox="8 0 84 136" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' +
  '<path class="torso" d="M10 136V100Q10 78 50 78Q90 78 90 100V136Z"/>' +
  '<g class="horns"><path d="M31 38Q13 24 21 3Q29 20 45 27Z"/><path d="M69 38Q87 24 79 3Q71 20 55 27Z"/></g>' +
  '<ellipse class="halo" cx="50" cy="12" rx="25" ry="7"/>' +
  '<circle class="head" cx="50" cy="52" r="27"/>' +
  '<path class="brows" d="M32 40l14 6M68 40l-14 6"/>' +
  '<circle class="eye" cx="40" cy="53" r="3.4"/><circle class="eye" cx="60" cy="53" r="3.4"/>' +
  '<path class="grin" d="M39 63Q50 72 61 63"/>' +
  '</svg>';

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 11 + level * 0.75;
  // Dealt in shuffled sixes, two of each verdict, so no single button is ever a lucky guess.
  const docket = Array.from({ length: 7 }, () => shuffled<Btn>(rng, [0, 0, 1, 1, 2, 2]))
    .flat()
    // Later rounds seat OP on the right, so the colour counts and the side does not.
    .map((verdict) => ({ verdict, text: pick(rng, CASES[verdict]), swap: rng() < level * 0.12 }));
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let nextAt = -1; // while a ruling is on screen: when the next case is called
  let adjourned = false;

  const wrap = h('div', 'g-aitaverdict');
  const card = h('div', 'case');
  const title = h('div', 'title');
  const ask = h('span');
  title.append(ask);
  const dock = h('div', 'dock');
  const seats = (['OP', 'THEM'] as const).map((name, i) => {
    const seat = h('div', `seat c-${i ? 'blue' : 'red'}`);
    seat.innerHTML = BUST;
    seat.append(h('span', 'badge', name));
    dock.append(seat);
    return seat;
  });
  const stamp = h('div', 'stamp');
  card.append(title, dock, stamp);
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'g-note');
  wrap.append(card, meter, note);
  root.append(wrap);

  const score = () => ratio(right - wrong / 2, par);

  function show() {
    const c = docket[idx % docket.length];
    card.className = 'case';
    dock.classList.toggle('swap', c.swap);
    seats[0].classList.toggle('guilty', c.verdict <= 1);
    seats[1].classList.toggle('guilty', c.verdict >= 1);
    ask.replaceChildren(h('b', '', 'AITA'), ` ${c.text}`);
    stamp.textContent = '';
    pulse(card, 'pop-in');
  }
  show();

  function advance(t: number) {
    if (nextAt < 0 || t < nextAt) return;
    nextAt = -1;
    idx++;
    show();
  }

  function progress() {
    fill.style.width = `${score() / 10}%`;
    note.textContent = right ? `VERDICTS x${right}` : 'Court is in session';
  }
  progress();

  return {
    press(b, t) {
      advance(t);
      if (nextAt >= 0) return;
      const c = docket[idx % docket.length];
      stamp.textContent = VERDICT[c.verdict];
      stamp.className = `stamp c-${COLOR[c.verdict]}`;
      if (b === c.verdict) {
        right++;
        nextAt = t + 260;
        card.classList.add('ruled');
        good(stamp);
        fx.burst(stamp, COLOR[b], 10);
        fx.sound('thud');
        if (right % 5 === 0) {
          fx.burst(card, 'gold', 18);
          fx.sound('coin');
        }
      } else {
        wrong++;
        nextAt = t + 450;
        card.classList.add('overruled');
        pulse(card, 'shake');
        bad(title, 'OVERRULED!');
      }
      progress();
      if (!adjourned && score() === 1000) {
        adjourned = true;
        fx.flash('gold');
        fx.pop(title, 'INFO: NONE NEEDED', 'gold');
        fx.sound('power');
      }
    },
    tick(t) {
      advance(t);
    },
    score,
    hint: () => (nextAt < 0 ? docket[idx % docket.length].verdict : null),
  };
};
