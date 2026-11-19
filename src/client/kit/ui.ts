// Forum furniture: the pieces of a post and a comment thread, drawn chunky.
// An affectionate generic forum look; no logos or brand assets.
import './sprites';
import { sprite, setSprite, type Tone } from './px';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export type PostCard = {
  el: HTMLElement;
  /** The up arrow on the vote rail: aim sparks and poofs at it. */
  arrow: HTMLElement;
  score: HTMLElement;
  title: HTMLElement;
  votes(n: number | string): void;
  /** Recolours the vote arrow and the card's accent. */
  tone(t: Tone): void;
  set(o: { sub?: string; user?: string; title?: string; comments?: number | string }): void;
};

/**
 * A post as it looks in a feed: vote rail on the left, community and author
 * on top, the title, and a row of comment / award counters underneath.
 */
export function postCard(o: { sub: string; user?: string; title: string; votes?: number | string; comments?: number | string; tone?: Tone; avatar?: HTMLElement; big?: boolean }): PostCard {
  let tone: Tone = o.tone ?? 'orange';
  const root = el('div', `rx-post tone-${tone}${o.big ? ' big' : ''}`);
  const apx = o.big ? 0.3 : 0.15;
  const rail = el('div', 'rx-rail');
  const arrow = sprite('up', { tone, px: apx }, 'rx-up');
  const score = el('b', 'rx-score', String(o.votes ?? 1));
  const down = sprite('up', { tone: 'grey', flipY: true, px: o.big ? 0.13 : 0.11 }, 'rx-down');
  rail.append(arrow, score, down);
  const body = el('div', 'rx-body');
  const meta = el('div', 'rx-meta');
  const sub = el('b', '', o.sub);
  const user = el('span', '', o.user ? ` · u/${o.user}` : '');
  meta.append(sub, user);
  const title = el('div', 'rx-title', o.title);
  const bar = el('div', 'rx-bar');
  const comments = el('span', '', String(o.comments ?? 0));
  bar.append(sprite('comment', { px: 0.11 }), comments, sprite('star', { px: 0.11 }), el('span', '', 'Award'));
  body.append(meta, title, bar);
  root.append(rail, body);
  if (o.avatar) {
    o.avatar.classList.add('rx-avatar');
    root.append(o.avatar);
  }
  return {
    el: root,
    arrow,
    score,
    title,
    votes: (n) => (score.textContent = String(n)),
    tone(t) {
      root.classList.remove(`tone-${tone}`);
      tone = t;
      root.classList.add(`tone-${tone}`);
      setSprite(arrow, 'up', { tone, px: apx });
    },
    set(v) {
      if (v.sub !== undefined) sub.textContent = v.sub;
      if (v.user !== undefined) user.textContent = ` · u/${v.user}`;
      if (v.title !== undefined) title.textContent = v.title;
      if (v.comments !== undefined) comments.textContent = String(v.comments);
    },
  };
}

/** One comment in a thread: avatar slot, author line, text. `depth` indents replies. */
export function comment(o: { user: string; text: string; depth?: number; avatar?: HTMLElement; op?: boolean; mod?: boolean }) {
  const root = el('div', 'rx-comment');
  root.style.marginLeft = `${(o.depth ?? 0) * 0.9}em`;
  if (o.avatar) root.append(o.avatar);
  const body = el('div', 'rx-cbody');
  const who = el('div', 'rx-who', `u/${o.user}`);
  if (o.op) who.append(el('i', 'rx-tag op', 'OP'));
  if (o.mod) who.append(el('i', 'rx-tag mod', 'MOD'));
  const text = el('div', 'rx-text', o.text);
  body.append(who, text);
  root.append(body);
  return { el: root, text, who };
}
