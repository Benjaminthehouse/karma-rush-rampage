import { connectRealtime, context } from '@devvit/web/client';
import {
  partyChannel,
  type InitResponse,
  type LbEntry,
  type PartyMessage,
  type PartyState,
  type Rival,
} from '../shared/api';
import { GAME_IDS, GAME_META, MAX_TOTAL, TIMING, botRounds, lineupFor, prettyDay, roundsFromIds, type Round } from '../shared/daily';
import { api, fmt } from './api';
import { rating, runMatch, standings, type Match } from './engine';
import { createFx } from './fx';
import { h, type Btn } from './games/common';
import { settings } from './settings';
import { sfx } from './sfx';
import { voice } from './voice';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type Screen = 'menu' | 'lobby' | 'play' | 'final';
let screen: Screen = 'menu';
let init: InitResponse | null = null;
let match: Match | null = null;
/** Server clock minus local clock, so party players share one timeline. */
let skew = 0;
const serverNow = () => Date.now() + skew;

const guest = Math.random().toString(36).slice(2, 8);
const myName = () => init?.username ?? `guest-${guest}`;

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

function press(b: Btn) {
  // First gesture unlocks audio and speech on mobile browsers.
  sfx.unlock();
  voice.unlock();
  if (held[b]) return;
  held[b] = true;
  const el = padEls[b];
  el.classList.remove('ripple');
  void el.offsetWidth;
  el.classList.add('down', 'ripple');
  if (screen === 'play') {
    sfx.press(b);
    match?.press(b);
  } else if (padActions[b]) {
    sfx.press(b);
    padActions[b]!();
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
document.addEventListener('pointerdown', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pad]');
  if (!el) return;
  e.preventDefault();
  const b = Number(el.dataset.pad) as Btn;
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
document.addEventListener('keyup', (e) => {
  const b = KEYS[e.key.toLowerCase()];
  // Several keys map to one pad; only release when none of them is still down.
  if (b !== undefined) release(b);
});

function show(next: Screen) {
  screen = next;
  for (const id of ['menu', 'lobby', 'play', 'final'] as const) $(id).hidden = id !== next;
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
    $('menu-day').textContent = `${prettyDay(init.day)} · ${fmt(init.players)} played`;
    $('menu-lineup').replaceChildren(
      ...dailyLineup().map((r) => h('span', 'chip', GAME_META[r.id].title))
    );
    $('menu-daily').textContent = played ? 'YOUR RESULT' : 'DAILY RUN';
    $('menu-daily-sub').textContent = played
      ? `${fmt(init.myRun!.total)} points${init.rank ? ` · #${init.rank} of ${fmt(init.players)}` : ''}`
      : init.username
        ? 'Counts for today’s leaderboard'
        : 'Log in to get on the leaderboard';
    $('menu-me').textContent = init.streak > 0 ? `${init.streak}-day streak · best ${fmt(init.best)}` : '';
  }
  setPads(['PRACTICE', played ? 'RESULT' : 'DAILY RUN', 'PARTY'], [practice, daily, lobby]);
}

// ------------------------------------------------------------- solo modes

async function solo(kind: 'daily' | 'practice', lineup: Round[], rivals: Rival[]) {
  show('play');
  const startAt = Date.now() + TIMING.countdown;
  match = runMatch({
    lineup,
    clock: () => Date.now() - startAt,
    me: myName(),
    rivals: () => rivals,
    setPads,
    pulsePad,
  });
  const mine = match;
  const rounds = await mine.done;
  if (match !== mine) return;
  match = null;
  const total = rounds.reduce((a, b) => a + b, 0);

  if (kind === 'practice') {
    final({ kind: 'PRACTICE RUN', lineup, rounds, total, boardTitle: 'This run', board: standings(myName(), rounds, rivals, rounds.length) });
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
    if (!init?.username) badges.push('Log in to save your score');
  } catch (err) {
    console.error(err);
    toast('Could not save your score. Check your connection.');
  }
  final({ kind: `DAILY RUN · ${prettyDay(init?.day ?? '')}`, lineup, rounds, total, badges, boardTitle: 'Leaderboard', board: leaderboard(board) });
}

const dailyLineup = (): Round[] => (init ? roundsFromIds(init.day, init.lineup) : []);

function daily() {
  if (!init) return;
  const lineup = dailyLineup();
  if (init.myRun) {
    const badges = [];
    if (init.rank) badges.push(`#${init.rank} of ${fmt(init.players)}`);
    if (init.streak > 0) badges.push(`${init.streak}-day streak`);
    final({
      kind: `DAILY RUN · ${prettyDay(init.day)}`,
      lineup,
      rounds: init.myRun.rounds,
      total: init.myRun.total,
      badges,
      boardTitle: 'Leaderboard',
      board: leaderboard(init.leaderboard),
      announce: false,
    });
    return;
  }
  void solo('daily', lineup, init.rivals);
}

function practice() {
  const seed = `practice-${Math.random().toString(36).slice(2)}`;
  const rivals: Rival[] = botRounds(seed).map((b) => ({ ...b, bot: true }));
  // Dev aid: `?games=upvote,dodge` forces the practice lineup.
  const forced = (new URLSearchParams(location.search).get('games') ?? '').split(',').filter((g) => GAME_META[g]);
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
    li.append(bar, h('span', 'who', `${e.rank}. ${e.name}`), h('span', 'pts', fmt(e.score)));
    list.append(li);
  });
  return list;
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
}) {
  show('final');
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
  (party?.players ?? []).filter((p) => p.inMatch && p.name !== party?.you).map((p) => ({ name: p.name, rounds: p.rounds }));

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
    // Joinable until the first game actually starts.
    if (party.now < party.startAt + TIMING.intro - 400) return void joinParty(party);
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
  match = runMatch({
    lineup,
    clock: () => serverNow() - state.startAt,
    me: myName(),
    rivals: partyRivals,
    setPads,
    pulsePad,
    onRound: (rounds) => {
      api.partyScore({ guest, matchId: id, rounds }).then(takeParty, console.error);
    },
  });
  const mine = match;
  const rounds = await mine.done;
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
    board: standings(myName(), rounds, rivals, rounds.length),
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
    if (screen === 'menu') menu();
  },
  (err) => {
    console.error(err);
    toast('Could not reach the server. Practice still works.');
  }
);
