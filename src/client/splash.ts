import { connectRealtime, requestExpandedMode } from '@devvit/web/client';
import { feedChannel, type FeedMessage, type InitResponse } from '../shared/api';
import { GAME_META, MAX_TOTAL, prettyDay, roundsFromIds, untilNextDay } from '../shared/daily';
import { api, fmt } from './api';
import { avatar } from './avatar';
import { h } from './games/common';
import { track } from './track';

const $ = (id: string) => document.getElementById(id)!;

function board(init: InitResponse) {
  const list = $('s-board');
  list.replaceChildren();
  if (!init.leaderboard.length) {
    list.append(h('li', 'empty', 'Nobody has played yet. Set the score to beat!'));
    return;
  }
  init.leaderboard.slice(0, 5).forEach((e) => {
    const li = h('li', e.name === init.username ? 'you' : '');
    const bar = h('i');
    bar.style.width = `${Math.max(2, (e.score / MAX_TOTAL) * 100)}%`;
    const who = h('span', 'who', `${e.rank}. ${e.name}`);
    who.prepend(avatar(e.name, { url: e.avatar }));
    li.append(bar, who, h('span', 'pts', fmt(e.score)));
    list.append(li);
  });
}

function render(init: InitResponse) {
  $('s-day').textContent = `${prettyDay(init.day)} · ${fmt(init.players)} played`;
  $('s-lineup').replaceChildren(
    ...roundsFromIds(init.day, init.lineup).map((r) => h('span', 'chip', GAME_META[r.id].title))
  );
  $('s-board-title').textContent = init.isToday ? 'Today’s top mashers' : `Top mashers · ${prettyDay(init.day)}`;
  board(init);
  const bits: string[] = [];
  if (init.myRun) bits.push(`You scored ${fmt(init.myRun.total)}${init.rank ? ` · #${init.rank}` : ''}`);
  if (init.streak > 0) bits.push(`${init.streak}-day streak`);
  if (init.myRun && init.isToday) bits.push(`next Rush in ${untilNextDay(init.now)}`);
  $('s-me').textContent = bits.join(' · ');
  $('s-play').textContent = init.myRun ? 'MY RESULT · KEEP PLAYING' : 'PLAY TODAY’S RUSH!';
}

async function load() {
  try {
    const init = await api.init();
    render(init);
    return init;
  } catch (err) {
    console.error(err);
    return null;
  }
}

$('s-play').addEventListener('click', (e) => {
  track.did('splash_play');
  requestExpandedMode(e as MouseEvent, 'game');
});
// Coming back from the expanded game: refresh the board.
window.addEventListener('focus', () => void load());

void load().then((init) => {
  if (!init) return;
  track.ready();
  try {
    connectRealtime<FeedMessage>({
      channel: feedChannel(init.day),
      onMessage(msg) {
        if (msg.t !== 'score') return;
        $('s-feed').textContent = `${msg.name} just scored ${fmt(msg.total)}`;
        void load();
      },
    });
  } catch (err) {
    console.error('live feed unavailable', err);
  }
});
