import './upvote.css';
import { COLOR, dealer, h, padDots, person, postCard, pulse, randBtn, ratio, sprite, type GameFactory } from './common';

const TITLES = [
  'My cat filed my taxes (correctly)',
  'TIL bananas are berries',
  'I built a keyboard out of soup cans',
  'Unpopular opinion: soup is a drink',
  'My sourdough finally rose',
  'Found this rock. Is it a good rock?',
  'LPT: label your leftovers',
  'My dog thinks the vacuum is his rival',
  'I mapped every bench in my town',
  'Stairs are just angry floors',
];
const SUBS = ['r/aww', 'r/todayilearned', 'r/DIY', 'r/unpopularopinion', 'r/Breadit', 'r/rocks', 'r/LifeProTips', 'r/Showerthoughts'];
const USERS = ['cat_dad_42', 'fact_goblin', 'soup_enjoyer', 'bread_wizard', 'rock_liker', 'bench_mapper', 'big_if_true', 'lurker_no_more'];
const GRACE = 300; // ms after a post lands in which presses on its old colour are forgiven

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // Presses to lift one post from the bottom of the feed to the front page.
  const full = 8 + level;
  // More posts than anyone can lift; 1000 points means hitting the par press count.
  // The par climbs gently: a person loses a beat at every colour change.
  const par = Math.round((duration / 1000) * (6.4 + level * 0.2));
  const title = dealer(rng, TITLES);
  const sub = dealer(rng, SUBS);
  const user = dealer(rng, USERS);
  let prev = -1;
  const posts = Array.from({ length: 14 }, () => {
    let btn = randBtn(rng);
    while (btn === prev) btn = randBtn(rng);
    prev = btn;
    return { btn, title: title(), sub: sub(), user: user(), base: 1 + Math.floor(rng() * 9) };
  });
  let idx = 0;
  let votes = 0;
  let banked = 0;
  let fronts = 0;
  let lastBtn = -1;
  let graceEnd = 0;

  // The scene: a sky two screens tall, from the city at dawn up to deep space, that scrolls
  // under the post as it climbs; a FRONT PAGE banner waits at the top.
  const wrap = h('div', 'g-upvote scene-sky');
  const goal = h('div', 'goal');
  goal.append(sprite('crown', { px: 0.16 }), h('span', '', 'FRONT PAGE'), sprite('crown', { px: 0.16 }));
  const shaft = h('div', 'shaft');
  const sky = h('div', 'sky');
  shaft.append(sky);
  const lift = h('div', 'lift');
  const op = person({ tone: 'gold', kind: 'cat', px: 0.2 });
  const tag = h('div', 'tag');
  const rank = h('span');
  const dots = h('span', 'which');
  tag.append(rank, dots);
  const card = postCard({ sub: '', title: '', big: true, avatar: op.el });
  const puff = h('i', 'puff');
  lift.append(tag, card.el, puff);
  const rail = h('div', 'rail');
  rail.append(lift);
  shaft.append(rail);
  const tally = h('div', 'tally');
  wrap.append(goal, shaft, tally);
  root.append(wrap);

  let shown = -1;
  function show() {
    const p = posts[idx % posts.length];
    if (shown !== idx) {
      shown = idx;
      card.set({ sub: p.sub, user: p.user, title: p.title, comments: p.base * 3 });
      card.tone(COLOR[p.btn]);
      dots.replaceChildren(padDots(p.btn));
      lift.className = `lift c-${COLOR[p.btn]}`;
      pulse(lift, 'pop-in');
      op.mood('idle');
    }
    const climb = votes / full;
    card.votes(p.base + votes * 12);
    rail.style.setProperty('--climb', String(climb));
    sky.style.setProperty('--climb', String(climb));
    // Back on the ground (a new post, or votes lost): the sky sweeps down more slowly.
    sky.classList.toggle('drop', votes === 0);
    rank.textContent = `#${Math.max(1, Math.round(99 - climb * 98))} in HOT`;
    if (climb > 0.6) op.mood('happy');
    const line = fronts ? `${fronts} on the front page` : 'Pump it to the top!';
    if (tally.textContent !== line) tally.textContent = line;
  }
  show();

  return {
    press(b, t) {
      const p = posts[idx % posts.length];
      if (b !== p.btn) {
        // Nobody stops mashing the instant a post lands.
        if (b === lastBtn && t < graceEnd) return;
        const lost = Math.min(2, votes);
        votes -= lost;
        op.mood('shock');
        show();
        pulse(card.el, 'shake');
        bad(tag, lost ? `-${lost}` : 'WRONG COLOUR');
        return;
      }
      votes++;
      pulse(card.arrow, 'bump');
      fx.poof(puff);
      good(card.arrow);
      if (votes >= full) {
        banked += full;
        votes = 0;
        fronts++;
        idx++;
        lastBtn = b;
        graceEnd = t + GRACE;
        // Bump the crowns, not the full-width banner, which would poke out of the stage.
        pulse(goal.firstElementChild as HTMLElement, 'bump');
        pulse(goal.lastElementChild as HTMLElement, 'bump');
        fx.pop(tag, 'FRONT PAGE!', 'gold');
        fx.burst(goal, COLOR[p.btn], 24);
        fx.burst(goal, 'gold', 12);
        fx.sound('coin');
      }
      show();
    },
    tick() {},
    score: () => ratio(banked + votes, par),
    hint: () => posts[idx % posts.length].btn,
  };
};
