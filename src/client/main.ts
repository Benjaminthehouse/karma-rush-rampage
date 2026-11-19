import { connectRealtime, context } from '@devvit/web/client';
import {
  partyChannel,
  type InitResponse,
  type LbEntry,
  type PartyMessage,
  type PartyState,
  type Rival,
} from '../shared/api';
import { GAME_IDS, GAME_META, MAX_TOTAL, TIMING, botRounds, lineupFor, prettyDay, type GameId, type Round } from '../shared/daily';
import { api, fmt } from './api';
import { rating, runMatch, standings, type Match } from './engine';
import { h, type Btn } from './games/common';
import { sfx } from './sfx';

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

function press(b: Btn) {
  const el = padEls[b];
  el.classList.add('down');
  setTimeout(() => el.classList.remove('down'), 90);
  if (screen === 'play') {
    sfx.press(b);
    match?.press(b);
  } else if (padActions[b]) {
    sfx.press(b);
    padActions[b]!();
  }
}

document.addEventListener('pointerdown', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pad]');
  if (!el) return;
  e.preventDefault();
  press(Number(el.dataset.pad) as Btn);
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

const mute = $('mute');
const paintMute = () => (mute.textContent = sfx.isMuted() ? 'SOUND OFF' : 'SOUND ON');
mute.addEventListener('click', () => {
  sfx.toggle();
  paintMute();
});
paintMute();

// ------------------------------------------------------------------- menu

function menu() {
  stopParty();
  show('menu');
  const played = !!init?.myRun;
  if (init) {
    $('menu-day').textContent = `${prettyDay(init.day)} · ${fmt(init.players)} played`;
    $('menu-lineup').replaceChildren(
      ...lineupFor(init.day).map((r) => h('span', 'chip', GAME_META[r.id].title))
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

function daily() {
  if (!init) return;
  const lineup = lineupFor(init.day);
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
    });
    return;
  }
  void solo('daily', lineup, init.rivals);
}

function practice() {
  const seed = `practice-${Math.random().toString(36).slice(2)}`;
  const rivals: Rival[] = botRounds(seed).map((b) => ({ ...b, bot: true }));
  // Dev aid: `?games=upvote,dodge` forces the practice lineup.
  const forced = (new URLSearchParams(location.search).get('games') ?? '')
    .split(',')
    .filter((g): g is GameId => (GAME_IDS as readonly string[]).includes(g));
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

function final(o: {
  kind: string;
  lineup: Round[];
  rounds: number[];
  total: number;
  badges?: string[];
  boardTitle: string;
  board: HTMLElement;
  again?: () => void;
}) {
  show('final');
  $('final-kind').textContent = o.kind;
  $('final-total').textContent = fmt(o.total);
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
