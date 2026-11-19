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

  // The scene: open sky, a FRONT PAGE banner at the top, and a post that climbs to it.
  const wrap = h('div', 'g-upvote scene-sky');
  const goal = h('div', 'goal');
  goal.append(sprite('crown', { px: 0.16 }), h('span', '', 'FRONT PAGE'), sprite('crown', { px: 0.16 }));
  const shaft = h('div', 'shaft');
  [18, 46, 74].forEach((top, i) => {
    const cloud = sprite('cloud', { px: 0.22 + i * 0.05, flip: i === 1 }, `cloud c${i}`);
    cloud.style.top = `${top}%`;
    shaft.append(cloud);
  });
  const lift = h('div', 'lift');
  const op = person({ tone: 'gold', kind: 'cat', px: 0.2 });
  const tag = h('div', 'tag');
  const rank = h('span');
  const dots = h('span', 'which');
  tag.append(rank, dots);
  const card = postCard({ sub: '', title: '', big: true, avatar: op.el });
  const puff = h('i', 'puff');
  lift.append(tag, card.el, puff);
  shaft.append(lift);
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
    lift.style.setProperty('--climb', String(climb));
    rank.textContent = `#${Math.max(1, Math.round(99 - climb * 98))} in HOT`;
    if (climb > 0.6) op.mood('happy');
    tally.textContent = fronts ? `${fronts} on the front page` : 'Pump it to the top!';
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
        pulse(goal, 'bump');
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
