export type LbEntry = { name: string; score: number; rank: number };

/**
 * Someone you race: a recorded run from today, a house bot, or a live party player.
 * `live` is a party player's score so far in the round being played.
 */
export type Rival = { name: string; bot?: boolean; rounds: number[]; live?: number };

export type InitResponse = {
  username: string | null;
  /** The day this post belongs to (its lineup + leaderboard). */
  day: string;
  /** True when `day` is the current UTC day, i.e. the run counts for the streak. */
  isToday: boolean;
  /** Game ids of this day's five rounds, fixed the first time the day is opened. */
  lineup: string[];
  myRun: { rounds: number[]; total: number } | null;
  streak: number;
  best: number;
  leaderboard: LbEntry[];
  rank: number | null;
  players: number;
  rivals: Rival[];
  now: number;
  /** The community this post lives in, without the r/ prefix. Absent in the demo. */
  subreddit?: string;
  /** True once the player has posted this day's score as a comment. */
  shared?: boolean;
  /** True once the player chose to wear their streak as flair here. */
  flair?: boolean;
};

/** Result of one of the result card's community actions. */
export type SocialResponse = { ok: boolean; message: string };

export type SubmitRequest = { rounds: number[] };
export type SubmitResponse = {
  saved: boolean;
  total: number;
  streak: number;
  best: number;
  leaderboard: LbEntry[];
  rank: number | null;
  players: number;
};

export type PartyPlayer = { name: string; rounds: number[]; inMatch: boolean; live: number };
export type PartyState = {
  /** Match id; also the seed of its lineup. Empty before the first match. */
  id: string;
  status: 'lobby' | 'running';
  startAt: number;
  now: number;
  you: string;
  players: PartyPlayer[];
};
export type PartyBeat = { guest?: string; matchId?: string };
export type PartyScore = { guest?: string; matchId: string; rounds: number[]; live?: number };

export type FeedMessage = { t: 'score'; name: string; total: number };
export type PartyMessage = { t: 'sync' };

export const feedChannel = (day: string) => `feed_${day.replace(/-/g, '_')}`;
export const partyChannel = (postId: string) => `party_${postId}`;
