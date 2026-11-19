import type { GameId } from '../../shared/daily';
import type { GameFactory } from './common';
import { copypasta } from './copypasta';
import { dodge } from './dodge';
import { flair } from './flair';
import { modqueue } from './modqueue';
import { peak } from './peak';
import { poll } from './poll';
import { servers } from './servers';
import { upvote } from './upvote';

export const GAMES: Record<GameId, GameFactory> = {
  upvote,
  modqueue,
  copypasta,
  dodge,
  flair,
  poll,
  servers,
  peak,
};
