import './sortbytop.css';
import { COLOR, dealer, h, padDots, person, pick, postCard, pulse, randBtn, ratio, setSprite, sprite, type Btn, type GameFactory, type Mood, type Tone } from './common';

/** Community and title of every post the feed can deal. */
const POSTS = [
  ['r/CatJobs', 'My cat pays rent'],
  ['r/SoupFacts', 'TIL soup is a drink'],
  ['r/NapTime', 'AITA for napping?'],
  ['r/RateMyRock', 'Rate my rock'],
  ['r/Homework', 'I ate the homework'],
  ['r/DogPatents', 'Dog files a patent'],
  ['r/BirdCrimes', 'Bird stole my fries'],
  ['r/Mondays', 'ELI5: what is Monday'],
  ['r/DrinkWater', 'LPT: drink water'],
  ['r/FirstPost', 'First post, be nice'],
  ['r/ItGotWorse', 'Update: it got worse'],
  ['r/BeanReview', 'Is this a good bean?'],
];
/** Author colours: none that could pass for a red, green or blue button. */
const FACES: Tone[] = ['gold', 'brown', 'ink', 'grey', 'pink', 'purple'];
const KINDS = ['cat', 'plain', 'bear'] as const;
const ASKS = ['TAP THE HIGHEST', 'NOW THE NEXT HIGHEST', 'THEN THE LAST ONE', 'SORTED!'];
/** How an author takes coming first, second and last. */
const PLACED: Mood[] = ['cool', 'happy', 'sad'];
const BTNS: Btn[] = [0, 1, 2];
const ARROW = 0.15; // sprite pixel size of a post's vote arrow, in em

/** A score the way a feed shows it: 847, 1.2k, 12.4k. */
function label(n: number): string {
  const size = Math.abs(n);
  return (n < 0 ? '−' : '') + (size < 1000 ? size : `${(size / 1000).toFixed(1)}k`);
}
/** Rounds to what the label can show, so two posts never look tied. */
const snap = (v: number) => (v < 1000 ? Math.round(v) : Math.round(v / 100) * 100);

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = Math.round(27 + level * 1.5); // a flawless set is worth 5
  const spread = 1.1 - level * 0.22; // how many powers of ten the three scores may sit apart
  const post = dealer(rng, POSTS);
  const face = dealer(rng, FACES);
  const sets = Array.from({ length: 24 }, () => {
    // From level 3 some sets are downvoted: small numbers, two of them below zero.
    const sunk = level >= 3 && rng() < 0.3;
    let vals: number[];
    do {
      // Later rounds huddle around 1k and 10k, where 999 meets 1.0k.
      const mid = sunk ? 1.3 : rng() < level * 0.15 ? pick(rng, [3, 4]) : 2 + rng() * 2.2;
      vals = BTNS.map(() => snap(10 ** Math.min(4.95, mid + spread * (rng() * 2 - 1))));
    } while (new Set(vals).size < 3);
    if (sunk) {
      const keep = randBtn(rng);
      vals = vals.map((v, i) => (i === keep ? v : -v));
    }
    const order = [...BTNS].sort((a, b) => vals[b] - vals[a]);
    return { vals, order, posts: BTNS.map(() => post()), faces: BTNS.map(() => face()) };
  });
  let idx = 0;
  let picked: Btn[] = [];
  let clean = true; // no wrong press in this set yet
  let points = 0;
  let done = 0;
  let flawless = 0;
  let lockedUntil = 0;
  let dealAt = 0; // when the next set arrives; 0 while a set is in play

  // The scene: a feed of three posts under a banner that says which one to tap next.
  // Each post's vote rail is painted in its button's colour. A ranked post is stamped
  // and its author reacts; a finished feed snaps into order and puts a trophy on the shelf.
  const wrap = h('div', 'g-sortbytop scene-feed');
  const bar = h('div', 'bar');
  const ask = h('span');
  bar.append(sprite('trophy', { px: 0.12 }), ask, sprite('trophy', { px: 0.12 }));
  const feed = h('div', 'feed');
  const posts = BTNS.map((b) => {
    const author = person({ kind: KINDS[b], px: 0.17 });
    const card = postCard({ sub: '', title: '', tone: COLOR[b], avatar: author.el });
    card.el.classList.add(`c-${COLOR[b]}`);
    card.arrow.before(padDots(b));
    const badge = h('b', 'badge');
    card.el.append(badge);
    feed.append(card.el);
    return { card, author, badge };
  });
  const shelf = h('div', 'shelf');
  const note = h('div', 'count');
  wrap.append(bar, feed, shelf, note);
  root.append(wrap);

  const current = () => sets[idx % sets.length];

  /**
   * Posts hold still while a set is in play, so top, middle and bottom always mean
   * red, green and blue. Only a finished set jumps into rank order.
   */
  function place() {
    const sorted = picked.length === 3;
    BTNS.forEach((b) => posts[b].card.el.style.setProperty('--shift', String(sorted ? picked.indexOf(b) - b : 0)));
    ask.textContent = ASKS[picked.length];
    note.textContent = done ? `${done} sorted, ${flawless} perfect` : 'Front page needs sorting!';
  }

  function deal() {
    const s = current();
    posts.forEach((p, i) => {
      p.card.el.classList.remove('ranked');
      p.card.set({ sub: s.posts[i][0], title: s.posts[i][1] });
      p.card.votes(label(s.vals[i]));
      // White arrow up for upvoted, dark arrow down for downvoted: both read on any rail colour.
      setSprite(p.card.arrow, 'up', s.vals[i] < 0 ? { tone: 'night', flipY: true, px: ARROW } : { tone: 'ink', px: ARROW });
      p.author.tone(s.faces[i]);
      p.author.mood('idle');
    });
    pulse(feed, 'pop-in');
    place();
  }
  deal();

  return {
    press(b, t) {
      if (t < lockedUntil || dealAt) return;
      const s = current();
      const p = posts[b];
      if (picked.includes(b)) {
        fx.sound('tick');
        return pulse(p.card.el, 'shake');
      }
      const want = s.order[picked.length];
      if (b !== want) {
        points--;
        clean = false;
        lockedUntil = t + 400;
        p.author.mood('shock');
        pulse(p.card.el, 'shake');
        bad(p.card.el, `${label(s.vals[want])} > ${label(s.vals[b])}`);
        return;
      }
      p.author.mood(PLACED[picked.length]);
      picked.push(b);
      points++;
      p.badge.textContent = `#${picked.length}`;
      p.card.el.classList.add('ranked');
      good(p.card.arrow);
      if (picked.length === 3) {
        done++;
        dealAt = t + 250;
        // Smoke where a post jumps from as the feed snaps into order.
        BTNS.forEach((i) => picked[i] !== i && fx.poof(posts[i].card.el));
        fx.pop(feed, clean ? 'PERFECT SORT! +2' : 'SORTED', clean ? 'gold' : 'white');
        fx.sound(clean ? 'coin' : 'ding');
        if (shelf.childElementCount < 9) shelf.append(sprite(clean ? 'trophy' : 'check', { px: 0.14 }));
        if (clean) {
          points += 2;
          flawless++;
          fx.burst(shelf.lastElementChild, 'gold', 20);
        }
      }
      place();
    },
    tick(t) {
      feed.classList.toggle('locked', t < lockedUntil);
      if (!dealAt || t < dealAt) return;
      dealAt = 0;
      idx++;
      picked = [];
      clean = true;
      deal();
      fx.sound('whoosh');
    },
    score: () => ratio(points, par),
    hint: (t) => (t < lockedUntil || dealAt ? null : current().order[picked.length]),
  };
};
