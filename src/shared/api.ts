/** `avatar` is the player's Reddit avatar image, when they have one. */
export type LbEntry = { name: string; score: number; rank: number; avatar?: string };

/**
 * Someone you race: a recorded run from today, a house bot, or a live party player.
 * `live` is a party player's score so far in the round being played.
 */
export type Rival = {
  name: string;
  bot?: boolean;
  rounds: number[];
  live?: number;
  avatar?: string;
  /** Where this player stands on the day's leaderboard, for a recorded run. */
  rank?: number;
};

export type InitResponse = {
  username: string | null;
  /** The player's own Reddit avatar image, when they have one. */
  avatar?: string;
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

export type PartyPlayer = {
  name: string;
  rounds: number[];
  inMatch: boolean;
  live: number;
  avatar?: string;
  /** Has tapped READY on the instructions everyone is waiting on. */
  ready?: boolean;
};
export type PartyState = {
  /** Match id; also the seed of its lineup. Empty before the first match. */
  id: string;
  status: 'lobby' | 'running';
  startAt: number;
  /** Server time at which each round's play starts (a round still waiting shows its deadline). */
  go: number[];
  /** The round whose instructions are up and waiting for everyone's READY, or -1. */
  gate: number;
  now: number;
  you: string;
  players: PartyPlayer[];
};
export type PartyBeat = { guest?: string; matchId?: string };
export type PartyScore = { guest?: string; matchId: string; rounds: number[]; live?: number };
export type PartyReady = { guest?: string; matchId: string; round: number };

export type FeedMessage = { t: 'score'; name: string; total: number };
export type PartyMessage = { t: 'sync' };

export const feedChannel = (day: string) => `feed_${day.replace(/-/g, '_')}`;
export const partyChannel = (postId: string) => `party_${postId}`;
