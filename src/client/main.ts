import { connectRealtime, context } from '@devvit/web/client';
import {
  partyChannel,
  type InitResponse,
  type LbEntry,
  type PartyMessage,
  type PartyState,
  type Rival,
} from '../shared/api';
import { GAME_IDS, GAME_META, GO_MS, MAX_TOTAL, TIMING, botRounds, dayKey, lineupFor, partyClock, prettyDay, roundsFromIds, untilNextDay, type Round } from '../shared/daily';
import { api, fmt } from './api';
import { avatar, shortName } from './avatar';
import { rating, runMatch, standings, type Match } from './engine';
import { createFx } from './fx';
import { h, type Btn } from './games/common';
import { settings } from './settings';
import { sfx } from './sfx';
import { track } from './track';
import { voice } from './voice';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type Screen = 'menu' | 'arcade' | 'lobby' | 'play' | 'final';
let screen: Screen = 'menu';
let init: InitResponse | null = null;
let match: Match | null = null;
/** Server clock minus local clock, so party players share one timeline. */
let skew = 0;
const serverNow = () => Date.now() + skew;

const guest = Math.random().toString(36).slice(2, 8);
/** True when there is no game server (a static demo): everything runs on this device. */
let offline = false;
const myName = () => init?.username ?? (offline ? 'you' : `guest-${guest}`);

/** What the server would have said, for a build with no server behind it. */
function offlineInit(): InitResponse {
  const day = dayKey();
  // The demo never locks the daily run: it is for trying the game, so it can be replayed.
  const myRun: InitResponse['myRun'] = null;
  return {
    username: null,
    day,
    isToday: true,
    lineup: lineupFor(day).map((r) => r.id),
    myRun,
    streak: 0,
    best: 0,
    leaderboard: [],
    rank: null,
    players: 0,
    rivals: botRounds(day).map((b) => ({ ...b, bot: true })),
    now: Date.now(),
  };
}

// ------------------------------------------------------------------- pads

const padEls = [...document.querySelectorAll<HTMLButtonElement>('#pads .pad')];
let padActions: ((() => void) | null)[] = [null, null, null];

function setPads(labels: [string, string, string], actions?: ((() => void) | null)[]) {
  padEls.forEach((el, i) => {
    el.querySelector('span')!.textContent = labels[i];
    el.classList.toggle('idle', screen !== 'play' && !actions?.[i]);
  });
  padActions = actions ?? [null, null, null];
}

const held = [false, false, false];
/** Shown on the menu so a tester can tell which build they are looking at. */
const BUILD = 68;
let dayLine = '';
/** The menu's status line, with the audio state so "no sound" can be told apart by cause. */
function paintStatus() {
  // The audio state only shows when something is wrong with it.
  const audio = sfx.debug();
  const text = `${dayLine} · build ${BUILD}${/stalled|suspended|interrupted|audio:|session:/.test(audio) ? ` · ${audio}` : ''}`;
  const el = document.getElementById('menu-day');
  if (el && el.textContent !== text) el.textContent = text;
  // The "next Rush in…" countdown on the Rush card ticks down while the menu is open.
  if (screen === 'menu' && onMainMenu && init?.myRun) {
    const small = document.querySelector('.choice[data-pad="1"] small');
    const sub = dailySub();
    if (small && small.textContent !== sub) small.textContent = sub;
  }
}
window.setInterval(() => {
  if (screen !== 'play') paintStatus();
}, 500);

// Mobile browsers only let sound and speech start from an "activation" gesture, and a
// finger landing is not one: a finger lifting, a click or a key press is.
// iPhones play speech but mute game sounds while the ring switch is on silent, and a web
// page cannot see the switch, so the settings row carries a one-line hint there.
if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.body.classList.add('ios');
  $('mute-hint').hidden = false;
}

function unlockSound() {
  sfx.unlock();
  // Speech is unlocked a moment after audio, not in the same instant: on iPhones the two
  // compete for the audio device, and starting both at once can leave the game silent.
  if (sfx.state() === 'running') voice.unlock();
  else void sfx.ready()?.then(() => voice.unlock(), () => undefined);
}
for (const type of ['pointerup', 'touchend', 'click', 'keydown'] as const) {
  document.addEventListener(type, unlockSound, { passive: true });
}
// A mouse button going down counts as a gesture too (a finger landing does not).
document.addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && unlockSound(), { passive: true });
window.setInterval(() => sfx.watch(), 500);

/** A short buzz on phones that support it. */
function buzz(ms: number) {
  if (!settings.get('fx')) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported, or not allowed in this frame */
  }
}

function press(b: Btn) {
  if (held[b]) return;
  held[b] = true;
  const el = padEls[b];
  el.classList.remove('ripple');
  void el.offsetWidth;
  el.classList.add('down', 'ripple');
  buzz(8);
  if (screen === 'play') {
    // The engine plays the tap: each game has its own sound for it.
    match?.press(b);
  } else if (padActions[b]) {
    sfx.press(b);
    // A menu pad is a tap, not a hold: let go at once, so a lost "finger up" event
    // (web views drop them) can never leave the pad stuck down and deaf.
    const action = padActions[b]!;
    window.setTimeout(() => {
      for (const [id, pad] of fingers) if (pad === b) fingers.delete(id);
      release(b);
    }, 120);
    try {
      action();
    } catch (err) {
      console.error('menu action failed', err);
    }
  }
}

function release(b: Btn) {
  if (!held[b]) return;
  held[b] = false;
  padEls[b].classList.remove('down');
  if (screen === 'play') match?.release(b);
}

function pulsePad(b: Btn) {
  const el = padEls[b];
  el.classList.remove('ripple', 'glow');
  void el.offsetWidth;
  el.classList.add('ripple', 'glow');
}

// Each finger holds the pad it landed on until it lifts, so chords and holds work on touch.
const fingers = new Map<number, Btn>();
const stageEl = $('stage');

/** Which pad a pointer event means: a pad or menu card, or (mid-round) a third of the stage. */
function padAt(e: PointerEvent): Btn | null {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pad]');
  if (el) return Number(el.dataset.pad) as Btn;
  // Things on the stage look tappable, so let them be: left, middle and right
  // thirds of the stage are the red, green and blue pads.
  if (screen !== 'play' || !stageEl.contains(e.target as Node)) return null;
  const r = stageEl.getBoundingClientRect();
  return Math.max(0, Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3))) as Btn;
}

document.addEventListener('pointerdown', (e) => {
  const b = padAt(e);
  if (b === null) return;
  e.preventDefault();
  fingers.set(e.pointerId, b);
  press(b);
});
for (const type of ['pointerup', 'pointercancel'] as const) {
  document.addEventListener(type, (e) => {
    const b = fingers.get(e.pointerId);
    if (b === undefined) return;
    fingers.delete(e.pointerId);
    if (![...fingers.values()].includes(b)) release(b);
  });
}
// Safety net: once no finger is on the glass, nothing is held, whatever events went missing.
for (const type of ['touchend', 'touchcancel'] as const) {
  window.addEventListener(
    type,
    (e) => {
      if (e.touches.length) return;
      fingers.clear();
      ([0, 1, 2] as Btn[]).forEach(release);
    },
    { passive: true }
  );
}
window.addEventListener('blur', () => {
  fingers.clear();
  ([0, 1, 2] as Btn[]).forEach(release);
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

const KEYS: Record<string, Btn> = {
  a: 0, s: 1, d: 2, j: 0, k: 1, l: 2, '1': 0, '2': 1, '3': 2,
  arrowleft: 0, arrowdown: 1, arrowup: 1, arrowright: 2,
};
document.addEventListener('keydown', (e) => {
  const b = KEYS[e.key.toLowerCase()];
  if (b === undefined || e.repeat || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  press(b);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (screen === 'arcade' || screen === 'lobby' || screen === 'final')) menu();
});
document.addEventListener('keyup', (e) => {
  const b = KEYS[e.key.toLowerCase()];
  // Several keys map to one pad; only release when none of them is still down.
  if (b !== undefined) release(b);
});

function show(next: Screen) {
  screen = next;
  for (const id of ['menu', 'arcade', 'lobby', 'play', 'final'] as const) $(id).hidden = id !== next;
}

let toastTimer = 0;
function toast(text: string) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 2600);
}

const SETTING_LABEL = { sound: 'SOUND', voice: 'VOICE', fx: 'FLASH' } as const;
const settingEls = [...document.querySelectorAll<HTMLButtonElement>('#settings button')];
function paintSettings() {
  for (const el of settingEls) {
    const key = el.dataset.set as keyof typeof SETTING_LABEL;
    const on = settings.get(key);
    el.textContent = `${SETTING_LABEL[key]} ${on ? 'ON' : 'OFF'}`;
    el.classList.toggle('off', !on);
    el.hidden = key === 'voice' && !voice.available();
  }
  document.body.classList.toggle('fx-low', !settings.get('fx'));
}
for (const el of settingEls) {
  el.addEventListener('click', () => {
    const key = el.dataset.set as keyof typeof SETTING_LABEL;
    const on = settings.toggle(key);
    if (!on && key !== 'fx') voice.hush();
    paintSettings();
    if (on && key === 'voice') voice.say('Voice on!');
    if (on && key === 'sound') sfx.named('coin');
  });
}
paintSettings();

const globalFx = createFx($('app'), $('fxg'));

// ------------------------------------------------------------------- menu

function menu() {
  stopParty();
  show('menu');
  $('menu-count').textContent = `Today’s five, out of ${GAME_IDS.length} mini-games`;
  const played = !!init?.myRun;
  if (init) {
    dayLine = `${prettyDay(init.day)} · ${fmt(init.players)} played`;
    paintStatus();
    $('menu-lineup').replaceChildren(
      ...dailyLineup().map((r) => h('span', 'chip', GAME_META[r.id].title))
    );
    $('menu-me').textContent = init.streak > 0 ? `${init.streak}-day streak · best ${fmt(init.best)}` : '';
  }
  onMainMenu = true;
  setChoices([
    played
      ? ['KEEP PLAYING', 'Practice: a random five, or any game you like']
      : ['PRACTICE', 'A random five or any single game. Nothing at stake'],
    [played ? 'TODAY’S RUSH: DONE' : 'TODAY’S RUSH', dailySub()],
    ['LIVE PARTY', 'Race everyone on this post, in sync'],
  ]);
  setPads(['PRACTICE', played ? 'MY RESULT' : 'RUSH!', 'PARTY'], [practiceMenu, daily, lobby]);
  // One Rush a day: once it is played the card is ticked off and practice becomes the thing to press.
  const rush = document.querySelector('.choice[data-pad="1"]');
  rush?.classList.toggle('primary', !played);
  rush?.classList.toggle('done', played);
  document.querySelector('.choice[data-pad="0"]')?.classList.toggle('primary', played);
}

/** The line under the Rush card: what is at stake, or the score and when the next Rush starts. */
function dailySub(): string {
  if (!init) return 'Counts for today’s leaderboard';
  if (init.myRun) {
    const place = init.rank ? ` · #${init.rank} of ${fmt(init.players)}` : '';
    const next = init.isToday ? ` · next Rush in ${untilNextDay(serverNow())}` : '';
    return `${fmt(init.myRun.total)} points${place}${next}`;
  }
  if (offline) return 'Today’s five games. Replay as often as you like';
  return init.username ? 'One run a day. Counts for today’s leaderboard' : 'Log in to get on the leaderboard';
}
let onMainMenu = false;

/** The three menu cards mirror the pads: index 0 red, 1 green, 2 blue. */
function setChoices(cards: [string, string][]) {
  cards.forEach(([title, sub], b) => {
    const el = document.querySelector<HTMLElement>(`.choice[data-pad="${b}"]`)!;
    el.querySelector('b')!.textContent = title;
    el.querySelector('small')!.textContent = sub;
    // The row's picture goes with what it does now, not with its colour.
    (el as HTMLElement).dataset.icon = ROW_ICON[title] ?? ROW_ICON[title.split(':')[0]] ?? '';
  });
}

/** Which drawn icon a menu row shows, by its title. */
const ROW_ICON: Record<string, string> = {
  'TODAY’S RUSH': 'rush',
  'LIVE PARTY': 'party',
  PRACTICE: 'practice',
  'KEEP PLAYING': 'practice',
  BACK: 'back',
  'RANDOM FIVE': 'dice',
  ARCADE: 'arcade',
};

/** PRACTICE opens a choice: a random five, or the arcade to pick one game. */
function practiceMenu() {
  show('menu');
  setChoices([
    ['BACK', 'To the main menu'],
    ['RANDOM FIVE', 'Five surprise games in a row'],
    ['ARCADE', `Pick any of the ${GAME_IDS.length} games and practise it`],
  ]);
  setPads(['BACK', 'RANDOM 5', 'ARCADE'], [menu, practice, arcade]);
  onMainMenu = false;
  for (const el of document.querySelectorAll('.choice')) el.classList.remove('primary', 'done');
  $('menu-count').textContent = 'Practice never touches the leaderboard';
}

// ----------------------------------------------------------------- arcade

let arcadeAt = 0;
const best: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem('km_best') ?? '{}') ?? {};
  } catch {
    return {};
  }
})();

function arcade() {
  show('arcade');
  const ids = [...GAME_IDS].sort((a, b) => GAME_META[a].title.localeCompare(GAME_META[b].title));
  arcadeAt = (arcadeAt + ids.length) % ids.length;
  const id = ids[arcadeAt];
  const meta = GAME_META[id];
  $('arcade-pos').textContent = `${arcadeAt + 1} / ${ids.length} · ${meta.kind.toUpperCase()}`;
  $('arcade-title').textContent = meta.title;
  $('arcade-shout').replaceChildren(...meta.shout.split(/\s+/).map((w, i) => h('span', `c${i % 3}`, w)));
  $('arcade-how').textContent = meta.how;
  $('arcade-legend').replaceChildren(...meta.labels.map((l, i) => h('span', `c-${['red', 'green', 'blue'][i]}`, l)));
  $('arcade-best').textContent = best[id] !== undefined ? `Your best: ${fmt(best[id])}` : 'Not played yet';
  const step = (d: number) => () => {
    arcadeAt += d;
    arcade();
  };
  setPads(['◀ PREV', 'PLAY', 'NEXT ▶'], [step(-1), () => void arcadePlay(id), step(1)]);
}
$('arcade-back').addEventListener('click', () => menu());

async function arcadePlay(id: string) {
  show('play');
  const seed = Math.floor(Math.random() * 2 ** 31);
  const startAt = Date.now() + TIMING.countdown;
  match = runMatch({
    lineup: [{ id, level: 2, seed }],
    clock: () => Date.now() - startAt,
    me: myName(),
    avatar: init?.avatar,
    rivals: () => [],
    setPads,
    pulsePad,
    held: () => held,
    autoplay: params.has('autoplay') ? { press, release } : undefined,
    paced: !params.has('autoplay'),
  });
  const mine = match;
  const [score] = await mine.done;
  if (match !== mine) return;
  match = null;
  if (score > (best[id] ?? -1)) {
    best[id] = score;
    try {
      localStorage.setItem('km_best', JSON.stringify(best));
    } catch {
      /* ignore */
    }
  }
  arcade();
}

// ------------------------------------------------------------- solo modes

const params = new URLSearchParams(location.search);

async function solo(kind: 'daily' | 'practice', lineup: Round[], rivals: Rival[]) {
  show('play');
  const startAt = Date.now() + TIMING.countdown;
  match = runMatch({
    lineup,
    clock: () => Date.now() - startAt,
    me: myName(),
    avatar: init?.avatar,
    rivals: () => rivals,
    setPads,
    pulsePad,
    held: () => held,
    // Demo mode for practice runs only: `?autoplay=1` lets a bot play.
    autoplay: kind === 'practice' && params.has('autoplay') ? { press, release } : undefined,
    paced: !(kind === 'practice' && params.has('autoplay')),
    onRound: (done) => kind === 'daily' && track.round(done.length, lineup.length, lineup[done.length - 1].id, done[done.length - 1]),
  });
  if (kind === 'daily') track.start();
  else track.did('practice_start');
  const mine = match;
  const rounds = await mine.done;
  if (match !== mine) return;
  match = null;
  const total = rounds.reduce((a, b) => a + b, 0);
  if (kind === 'daily') track.end(total, total >= 2800);

  if (kind === 'practice') {
    final({ kind: 'PRACTICE RUN', lineup, rounds, total, raced: rivals, boardTitle: 'This run', board: standings(myName(), rounds, rivals, rounds.length, init?.avatar) });
    return;
  }
  if (offline && init) {
    final({ kind: `TODAY’S RUSH · ${prettyDay(init.day)}`, lineup, rounds, total, badges: ['Demo: play it again any time'], raced: rivals, boardTitle: 'You vs the house bots', board: standings(myName(), rounds, rivals, rounds.length, init?.avatar) });
    return;
  }
  let board: LbEntry[] = init?.leaderboard ?? [];
  const badges: string[] = [];
  try {
    const res = await api.submit({ rounds });
    board = res.leaderboard;
    if (init) {
      Object.assign(init, { leaderboard: res.leaderboard, rank: res.rank, players: res.players, streak: res.streak, best: res.best });
      if (res.saved) init.myRun = { rounds, total };
    }
    if (res.rank) badges.push(`#${res.rank} of ${fmt(res.players)}`);
    if (res.streak > 0) badges.push(`${res.streak}-day streak`);
    if (init?.isToday && res.saved) badges.push(`Next Rush in ${untilNextDay(serverNow())}`);
    if (!init?.username) badges.push('Log in to save your score');
  } catch (err) {
    console.error(err);
    toast('Could not save your score. Check your connection.');
  }
  final({ kind: `TODAY’S RUSH · ${prettyDay(init?.day ?? '')}`, lineup, rounds, total, badges, raced: rivals, boardTitle: 'Leaderboard', board: leaderboard(board), social: !!init?.myRun });
}

const dailyLineup = (): Round[] => (init ? roundsFromIds(init.day, init.lineup) : []);

function daily() {
  if (!init) return;
  const lineup = dailyLineup();
  if (init.myRun) {
    const badges = [];
    if (init.rank) badges.push(`#${init.rank} of ${fmt(init.players)}`);
    if (init.streak > 0) badges.push(`${init.streak}-day streak`);
    if (init.isToday) badges.push(`Next Rush in ${untilNextDay(serverNow())}`);
    final({
      kind: `TODAY’S RUSH · ${prettyDay(init.day)}`,
      lineup,
      rounds: init.myRun.rounds,
      total: init.myRun.total,
      badges,
      boardTitle: offline ? 'You vs the house bots' : 'Leaderboard',
      board: offline ? standings(myName(), init.myRun.rounds, init.rivals, 5, init.avatar) : leaderboard(init.leaderboard),
      announce: false,
      social: true,
      raced: init.rivals,
    });
    return;
  }
  void solo('daily', lineup, init.rivals);
}

function practice() {
  const seed = `practice-${Math.random().toString(36).slice(2)}`;
  const rivals: Rival[] = botRounds(seed).map((b) => ({ ...b, bot: true }));
  // Dev aid: `?games=upvote,dodge` forces the practice lineup.
  const forced = (params.get('games') ?? '').split(',').filter((g) => GAME_META[g]);
  const lineup = lineupFor(seed).map((r, i) => (forced[i] ? { ...r, id: forced[i] } : r));
  void solo('practice', lineup, rivals);
}

function leaderboard(entries: LbEntry[]): HTMLElement {
  const list = h('ol', 'standings');
  if (!entries.length) list.append(h('li', 'empty', 'No scores yet.'));
  entries.forEach((e) => {
    const li = h('li', e.name === init?.username ? 'you' : '');
    const bar = h('i');
    bar.style.width = `${Math.max(2, (e.score / MAX_TOTAL) * 100)}%`;
    const who = h('span', 'who', `${e.rank}. ${e.name}`);
    who.prepend(avatar(e.name, { url: e.avatar }));
    li.append(bar, who, h('span', 'pts', fmt(e.score)));
    list.append(li);
  });
  return list;
}

/** The race, settled: each rival's face with a tick if you beat their total, and what that means. */
function raceRecap(total: number, rivals: Rival[]): HTMLElement {
  const box = h('div', 'recap');
  const them = rivals.slice(0, 3);
  if (!them.length) return box;
  const sum = (r: Rival) => r.rounds.reduce((a, b) => a + b, 0);
  const beaten = them.filter((r) => total > sum(r));
  const line = h('div', 'vs-line');
  for (const r of them) {
    const won = total > sum(r);
    const cell = h('div', `vs-cell ${won ? 'won' : 'lost'}`);
    cell.append(avatar(r.name, { url: r.avatar, bot: r.bot }), h('b', '', shortName(r.name, 12)), h('small', '', `${won ? 'beaten' : 'ahead'} · ${fmt(sum(r))}`));
    line.append(cell);
  }
  // The rivals are the day's leader and the middle of the board, so the race says where you stand.
  const leader = them.find((r) => r.rank === 1);
  const text =
    beaten.length === them.length
      ? leader ? 'You beat everyone you raced, the day’s leader included!' : 'You beat everyone you raced!'
      : beaten.length ? `You beat ${beaten.length} of the ${them.length} you raced` : 'They all stayed ahead this time';
  box.append(h('span', 'vs-title', text), line);
  return box;
}

// ------------------------------------------------------------------ final

const VERDICTS = [
  { min: 4600, text: 'LEGENDARY!' },
  { min: 3800, text: 'FRONT PAGE MATERIAL!' },
  { min: 2800, text: 'SOLID RUN!' },
  { min: 1800, text: 'MID.' },
  { min: 800, text: 'SKILL ISSUE.' },
  { min: 0, text: 'TOUCH GRASS.' },
];

function final(o: {
  kind: string;
  lineup: Round[];
  rounds: number[];
  total: number;
  badges?: string[];
  boardTitle: string;
  board: HTMLElement;
  again?: () => void;
  /** False when re-opening an old result: no need to shout it again. */
  announce?: boolean;
  /** True for a saved daily run on Reddit: offer to comment the score, wear flair, join. */
  social?: boolean;
  /** Who was raced, to show how the race came out. */
  raced?: Rival[];
}) {
  show('final');
  paintSocial(!!o.social);
  $('final-kind').textContent = o.kind;
  countUp($('final-total'), o.total);
  sfx.fanfare();
  if (o.total >= 2000) globalFx.confetti(o.total >= 4000 ? 120 : 60);
  const verdict = VERDICTS.find((v) => o.total >= v.min)!;
  const stamp = $('final-verdict');
  stamp.textContent = verdict.text;
  stamp.className = `verdict v${VERDICTS.indexOf(verdict)}`;
  if (o.announce !== false) window.setTimeout(() => screen === 'final' && voice.say(verdict.text, { rate: 1.05, pitch: 1.2 }), 950);
  $('final-badges').replaceChildren(...(o.badges ?? []).map((b) => h('span', 'chip', b)));
  $('final-recap').replaceChildren(...(o.raced?.length ? [raceRecap(o.total, o.raced)] : []));
  $('final-rounds').replaceChildren(
    ...o.lineup.map((r, i) => {
      const li = h('li');
      li.append(
        h('span', '', GAME_META[r.id].title),
        h('em', '', rating(o.rounds[i] ?? 0)),
        h('b', '', fmt(o.rounds[i] ?? 0))
      );
      return li;
    })
  );
  $('final-board-title').textContent = o.boardTitle;
  const old = $('final-board');
  o.board.id = 'final-board';
  old.replaceWith(o.board);
  setPads(['MENU', o.again ? 'REMATCH' : 'PRACTICE', 'PARTY'], [menu, o.again ?? practice, lobby]);
}

// The result card's next steps: say it in the comments, wear the streak, join the community.
const socialDone = { share: false, flair: false, join: false };
try {
  socialDone.join = localStorage.getItem('km_joined') === '1';
} catch {
  /* ask again */
}
function paintSocial(on: boolean) {
  const row = $('final-social');
  row.hidden = !on || offline || !init?.username;
  if (row.hidden) return;
  const share = $<HTMLButtonElement>('social-share');
  share.textContent = init?.shared || socialDone.share ? 'SCORE POSTED' : 'POST MY SCORE';
  share.disabled = !!init?.shared || socialDone.share;
  const flair = $<HTMLButtonElement>('social-flair');
  const flairOn = socialDone.flair || !!init?.flair;
  flair.textContent = flairOn ? 'FLAIR ON' : 'WEAR STREAK FLAIR';
  flair.disabled = flairOn;
  const join = $<HTMLButtonElement>('social-join');
  join.textContent = socialDone.join ? 'JOINED' : `JOIN r/${init?.subreddit ?? 'this community'}`;
  join.disabled = socialDone.join;
}
for (const key of ['share', 'flair', 'join'] as const) {
  $(`social-${key}`).addEventListener('click', async () => {
    if (socialDone[key]) return;
    socialDone[key] = true; // no double posts while the request is out
    paintSocial(true);
    try {
      const res = await api[key]();
      socialDone[key] = res.ok;
      if (res.ok) track.did(`result_${key}`);
      toast(res.message);
      if (res.ok) {
        sfx.named('coin');
        if (key === 'join') localStorage.setItem('km_joined', '1');
      }
    } catch (err) {
      console.error(err);
      socialDone[key] = false;
      toast('That did not go through. Try again.');
    }
    paintSocial(true);
  });
}

let countRaf = 0;
function countUp(el: HTMLElement, to: number) {
  cancelAnimationFrame(countRaf);
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 900);
    el.textContent = fmt(Math.round(to * (1 - (1 - k) ** 3)));
    if (k < 1) countRaf = requestAnimationFrame(step);
  };
  countRaf = requestAnimationFrame(step);
}

// ------------------------------------------------------------------ party

let party: PartyState | null = null;
let partyTimer = 0;
let partyLive = false;
/** Matches this client already played or chose to sit out. */
const seen = new Set<string>();

const partyRivals = (): Rival[] =>
  (party?.players ?? []).filter((p) => p.inMatch && p.name !== party?.you).map((p) => ({ name: p.name, rounds: p.rounds, live: p.live }));

function takeParty(state: PartyState) {
  skew = state.now - Date.now();
  party = state;
  match?.refresh();
  if (screen === 'lobby') paintLobby();
}

async function beat(matchId?: string) {
  try {
    takeParty(await api.partyBeat({ guest, matchId }));
  } catch (err) {
    console.error(err);
    if (screen === 'lobby') $('lobby-status').textContent = 'Connection lost. Retrying…';
  }
}

function stopParty() {
  clearInterval(partyTimer);
  partyTimer = 0;
}

function lobby() {
  if (offline) return toast('Live Party needs a Reddit post. It is switched off in this demo.');
  show('lobby');
  setPads(['BACK', 'START', ''], [menu, startParty, null]);
  $('lobby-status').textContent = 'Finding the lobby…';
  if (!partyLive && context.postId) {
    partyLive = true;
    try {
      connectRealtime<PartyMessage>({
        channel: partyChannel(context.postId),
        onMessage: () => {
          if (partyTimer) void beat();
        },
      });
    } catch (err) {
      console.error('realtime unavailable, falling back to polling', err);
    }
  }
  stopParty();
  // Realtime nudges us instantly; this poll is the heartbeat and the fallback.
  partyTimer = window.setInterval(() => void beat(), 2000);
  void beat();
}

async function startParty() {
  track.did('party_start');
  try {
    takeParty(await api.partyStart({ guest }));
  } catch (err) {
    console.error(err);
    toast('Could not start the match.');
  }
}

function paintLobby() {
  if (!party) return;
  const list = $('lobby-players');
  list.replaceChildren(
    ...party.players.map((p) => {
      const li = h('li', p.name === party!.you ? 'you' : '');
      const total = p.rounds.reduce((a, b) => a + b, 0);
      const bar = h('i');
      bar.style.width = `${Math.max(2, (total / MAX_TOTAL) * 100)}%`;
      li.append(bar, h('span', 'who', p.name === party!.you ? `${p.name} (you)` : p.name), h('span', 'pts', p.inMatch ? fmt(total) : 'ready'));
      return li;
    })
  );
  const status = $('lobby-status');
  if (party.status === 'running' && !seen.has(party.id)) {
    // Joinable until the first game actually starts (so, all through its instructions).
    if (party.now < party.go[0] - 400) return void joinParty(party);
    seen.add(party.id);
  }
  if (party.status === 'running') {
    status.textContent = 'A match is in progress. You’re in the next one.';
    setPads(['BACK', 'WAIT…', ''], [menu, null, null]);
  } else {
    const n = party.players.length;
    status.textContent = n > 1 ? `${n} players here. Anyone can press START.` : 'Just you so far. Press START, or wait for company.';
    setPads(['BACK', 'START', ''], [menu, startParty, null]);
  }
}

async function joinParty(state: PartyState) {
  seen.add(state.id);
  const id = state.id;
  const lineup = lineupFor(id);
  show('play');
  void beat(id);
  // The latest word on when each round goes (it moves up once everyone is ready).
  const go = () => (party?.id === id ? party.go : state.go);
  let nudge = 0;
  match = runMatch({
    lineup,
    clock: () => partyClock(serverNow(), state.startAt, lineup, go()),
    gate: {
      ready: (round) => {
        track.did('party_ready');
        api.partyReady({ guest, matchId: id, round }).then(takeParty, console.error);
        // Until this round has its start time, ask often: the answer is the starting gun.
        clearInterval(nudge);
        nudge = window.setInterval(() => {
          if (match !== mine || party?.id !== id || party.gate !== round) return clearInterval(nudge);
          void beat(id);
        }, 600);
      },
      status: (round) => {
        const inMatch = party?.id === id ? party.players.filter((p) => p.inMatch) : [];
        // Once the round has its start time nobody is being waited for any more.
        const waiting = party?.id === id && party.gate === round;
        return {
          ready: waiting ? inMatch.filter((p) => p.ready).length : inMatch.length,
          of: inMatch.length,
          left: go()[round] - GO_MS - serverNow(),
        };
      },
    },
    me: myName(),
    avatar: init?.avatar,
    rivals: partyRivals,
    setPads,
    pulsePad,
    held: () => held,
    onRound: (rounds) => {
      api.partyScore({ guest, matchId: id, rounds }).then(takeParty, console.error);
    },
    // About once a second, tell the others how this round is going (and hear how theirs is).
    onLive: (rounds, live) => {
      api.partyScore({ guest, matchId: id, rounds, live }).then(takeParty, console.error);
    },
  });
  const mine = match;
  const rounds = await mine.done;
  clearInterval(nudge);
  if (match !== mine) return;
  match = null;
  await beat();
  const rivals = partyRivals();
  final({
    kind: rivals.length ? `LIVE PARTY · ${rivals.length + 1} PLAYERS` : 'LIVE PARTY · SOLO',
    lineup,
    rounds,
    total: rounds.reduce((a, b) => a + b, 0),
    boardTitle: 'Party standings',
    board: standings(myName(), rounds, rivals, rounds.length, init?.avatar),
    again: lobby,
  });
  stopParty();
}

// ------------------------------------------------------------------- boot

menu();
api.init().then(
  (res) => {
    init = res;
    skew = res.now - Date.now();
    track.ready();
    if (screen !== 'menu') return;
    // Already played today: open on the result card, with its next steps, not the menu.
    if (res.myRun && !params.has('menu')) daily();
    else menu();
  },
  (err) => {
    // No server behind this build: run as a self-contained demo.
    console.warn('no game server, running offline', err);
    offline = true;
    track.disable();
    init = offlineInit();
    if (screen === 'menu') menu();
    toast('Demo mode: nothing is saved.');
  }
);
