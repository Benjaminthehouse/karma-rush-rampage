import './servers.css';
import { actor, defineSprite, h, pulse, ratio, shuffled, sprite, type Btn, type GameFactory } from './common';

const HOSTS = ['us-east-karma', 'eu-meme-1', 'cat-pics-cdn', 'ap-south-lurk', 'upvote-db', 'mod-queue-7', 'flair-cache', 'award-shard', 'reply-guy-2', 'front-page'];

// A grey puff of smoke that curls up off a broken rack.
defineSprite('servers-smoke', `
....kkkk....
..kkddddkk..
.kddddwdddk.
kddwwddddddk
kdddddddDddk
.kdDddddDdk.
..kkDDDDkk..
....kkkk....`);

const ROWS = 5; // units per rack; a row lights across all three racks at each fifth of the target

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // 7.2 presses a second at level 0 up to 8 at level 4: a top score has to stay within reach of two thumbs.
  const target = Math.round((duration / 1000) * (7.2 + level * 0.2));
  let n = 0;
  let last = -1;
  let complained = -1000;
  let lit = 0;
  let moodUntil = 0;
  let mood = 'shock';

  // The scene: the server room. Three racks smoke and spark along the back wall; the
  // Dev runs to whichever rack you press and kicks it back to life.
  const wrap = h('div', 'g-servers scene-devcave');
  const sign = h('div', 'sign');
  const rule = h('div', 'rule');
  rule.innerHTML = 'Switch buttons <b>every press</b>';
  const board = h('div', 'board');
  const bar = h('i', 'bar');
  const track = h('b', 'track');
  track.append(bar);
  const up = h('span', 'up');
  board.append(h('span', 'lbl', 'UPTIME'), track, up);
  sign.append(rule, board);

  const room = h('div', 'room');
  const racks = h('div', 'racks');
  const hosts = shuffled(rng, HOSTS); // dealt, not picked, so no host is listed twice
  const rows: HTMLElement[][] = Array.from({ length: ROWS }, () => []);
  const kit = [0, 1, 2].map((i) => {
    const col = h('div', 'col');
    const rack = h('div', 'rack');
    for (let r = 0; r < ROWS; r++) {
      const u = h('div', 'unit');
      u.append(h('i'), h('i'), h('b'));
      rack.append(u);
      rows[ROWS - 1 - r].push(u); // light from the bottom unit up
    }
    const smoke = h('div', 'smoke');
    smoke.append(sprite('servers-smoke', { px: 0.2 }, 'puff a'), sprite('servers-smoke', { px: 0.16 }, 'puff b'));
    const spark = sprite('spark', { px: 0.22 }, 'zap');
    rack.prepend(h('span', 'host', hosts[i]));
    rack.append(spark, smoke);
    col.append(rack);
    racks.append(col);
    return { col, rack };
  });
  // The runner spans the racks; sliding it by a third puts the Dev in front of the next rack.
  const runner = h('div', 'runner at-1');
  const dev = actor('dev', { mood: 'shock', px: 0.44 });
  const body = h('div', 'devbox');
  body.append(dev.el, h('div', 'hoodie'));
  runner.append(body);
  room.append(racks, runner);
  wrap.append(sign, room);
  root.append(wrap);

  function show() {
    const p = Math.min(1, n / target);
    bar.style.transform = `scaleX(${p})`;
    const on = Math.floor(p * ROWS);
    if (on > lit) {
      for (let r = lit; r < on; r++) for (const u of rows[r]) u.classList.add('up');
      lit = on;
      wrap.classList.add(`r${on}`);
      fx.burst(kit[1].rack, 'green', 12);
      if (on === ROWS) {
        // The last row is the win: make it land harder than the four before it.
        wrap.classList.add('online');
        fx.flash('green');
        fx.pop(rule, 'BACK ONLINE!', 'green');
        fx.sound('coin');
      } else fx.sound('ding');
    }
    up.textContent = n >= target ? `${Math.floor((n / target) * 100)}%!` : `${Math.floor(p * 100)}%`;
  }
  show();

  function face(m: 'happy' | 'angry' | 'shock' | 'cool' | 'idle', t: number, hold: number) {
    moodUntil = t + hold;
    if (m === mood) return;
    mood = m;
    dev.mood(m);
  }

  return {
    press(b, t) {
      if (b === last) {
        if (t - complained > 400) {
          complained = t;
          pulse(kit[b].col, 'shake');
          pulse(body, 'shake');
          face('angry', t, 450);
          bad(kit[b].rack, 'ALTERNATE!');
        }
        return;
      }
      last = b;
      n++;
      runner.className = `runner at-${b}`;
      const k = kit[b];
      k.col.classList.remove('kicked');
      void k.col.offsetWidth;
      k.col.classList.add('kicked');
      body.classList.toggle('flip', b === 0);
      face(n >= target ? 'cool' : 'happy', t, 220);
      good(k.rack);
      show();
    },
    tick(t) {
      if (mood && t >= moodUntil) {
        const rest = n >= target ? 'cool' : n === 0 ? 'shock' : 'idle';
        if (rest !== mood) {
          mood = rest;
          dev.mood(rest);
        }
      }
    },
    score: () => ratio(n, target),
    hint: () => ((last + 1) % 3) as Btn,
  };
};
