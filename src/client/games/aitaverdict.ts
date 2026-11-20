import './aitaverdict.css';
import { actor, COLOR, defineSprite, h, padDots, pulse, ratio, shuffled, sprite, type Btn, type GameFactory } from './common';

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

// Horns sprout on the guilty, in their side's colour; the innocent get a halo.
defineSprite('aitaverdict-horns', `
k..............k
kk............kk
kAk..........kAk
kAAk........kAAk
.kAAk......kAAk.
.kLAAk....kAALk.
..kkkk....kkkk..`);
defineSprite('aitaverdict-halo', `
...kkkkkkkkkk...
..kyyyyyyyyyyk..
.kyYkkkkkkkkyyk.
..kyyyyyyyyyyk..
...kkkkkkkkkk...`);
// The judge's wooden gavel.
defineSprite('aitaverdict-gavel', `
..kkkkkkkkkk..
.knnnnnnnnnnk.
.kyyyyyyyyyyk.
.knnnnnnnnnnk.
.kNNNNNNNNNNk.
..kkkkkkkkkk..
.....knNk.....
.....knNk.....
.....knNk.....
.....knNk.....
.....knNk.....
.....kkkk.....`);

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 11 + level * 0.75;
  // Each verdict's cases come off their own shuffled pile, so none is heard twice before all seven are.
  const piles = CASES.map((pile) => shuffled(rng, pile));
  const heard = [0, 0, 0];
  // Dealt in shuffled sixes, two of each verdict, so no single button is ever a lucky guess.
  const docket = Array.from({ length: 7 }, () => shuffled<Btn>(rng, [0, 0, 1, 1, 2, 2]))
    .flat()
    // Later rounds seat OP on the right, so the colour counts and the side does not.
    .map((verdict) => ({ verdict, text: piles[verdict][heard[verdict]++ % piles[verdict].length], swap: rng() < level * 0.12 }));
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let nextAt = -1; // while a ruling is on screen: when the next case is called
  let adjourned = false;

  // The scene: the courtroom. Judge Mod Bear sits high behind the bench with a gavel;
  // the case is read from the docket sheet; OP and THEM stand in the dock below.
  const wrap = h('div', 'g-aitaverdict scene-court');
  const top = h('div', 'top');
  const judge = actor('modbear', { mood: 'peep', px: 0.46 });
  judge.el.classList.add('judge');
  const bench = h('div', 'bench');
  const gavel = sprite('aitaverdict-gavel', { px: 0.22 }, 'gavel');
  const plate = h('div', 'plate', 'HON. MOD BEAR');
  bench.append(gavel, plate);
  top.append(judge.el, bench);

  const sheet = h('div', 'sheet');
  const ask = h('span');
  sheet.append(ask);

  const court = h('div', 'court');
  const dock = h('div', 'dock');
  const seats = (['OP', 'THEM'] as const).map((name, i) => {
    const seat = h('div', `seat c-${i ? 'blue' : 'red'}`);
    const crown = h('div', 'crown');
    const horns = sprite('aitaverdict-horns', { tone: i ? 'blue' : 'red', px: 0.32 }, 'horns');
    const halo = sprite('aitaverdict-halo', { px: 0.27 }, 'halo');
    crown.append(horns, halo);
    const who = actor(i ? 'npc' : 'op', { px: 0.34 });
    const tag = h('div', 'tag');
    tag.append(h('span', '', name), padDots(i ? 2 : 0));
    seat.append(crown, who.el, tag);
    dock.append(seat);
    return { el: seat, who };
  });
  const rail = h('div', 'rail');
  const stamp = h('div', 'stamp');
  court.append(dock, rail);
  sheet.append(stamp);

  const foot = h('div', 'foot');
  const bar = h('div', 'bar');
  const fill = h('i');
  bar.append(fill);
  const note = h('div', 'note');
  foot.append(bar, note);
  wrap.append(top, sheet, court, foot);
  root.append(wrap);

  const score = () => ratio(right - wrong / 2, par);

  function show() {
    const c = docket[idx % docket.length];
    court.className = 'court';
    judge.mood('peep');
    dock.classList.toggle('swap', c.swap);
    const guilty = [c.verdict <= 1, c.verdict >= 1];
    seats.forEach((s, i) => {
      s.el.classList.toggle('guilty', guilty[i]);
      // The guilty look smug; the innocent just stand there.
      s.who.mood(guilty[i] ? 'wink' : 'idle');
    });
    ask.replaceChildren(h('b', '', 'AITA'), ` ${c.text}`);
    stamp.textContent = '';
    pulse(sheet, 'pop-in');
    for (const s of seats) pulse(s.who.el, 'pop-in');
  }
  show();

  function advance(t: number) {
    if (nextAt < 0 || t < nextAt) return;
    nextAt = -1;
    idx++;
    show();
  }

  function progress() {
    fill.style.transform = `scaleX(${score() / 1000})`;
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
      // Every ruling brings the gavel down.
      pulse(gavel, 'slam');
      if (b === c.verdict) {
        right++;
        nextAt = t + 260;
        court.classList.add('ruled');
        judge.mood('angry');
        seats.forEach((s) => s.who.mood(s.el.classList.contains('guilty') ? 'shock' : 'happy'));
        good(stamp);
        fx.burst(stamp, COLOR[b], 10);
        fx.poof(gavel);
        fx.sound('thud');
        if (right % 5 === 0) {
          fx.burst(top, 'gold', 18);
          fx.sound('coin');
        }
      } else {
        wrong++;
        nextAt = t + 450;
        court.classList.add('overruled');
        judge.mood('shock');
        // The guilty get away with it, and love it.
        seats.forEach((s) => s.who.mood(s.el.classList.contains('guilty') ? 'happy' : 'sad'));
        pulse(bench, 'shake');
        bad(sheet, 'OVERRULED!');
      }
      progress();
      if (!adjourned && score() === 1000) {
        adjourned = true;
        fx.flash('gold');
        fx.pop(sheet, 'INFO: NONE NEEDED', 'gold');
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
