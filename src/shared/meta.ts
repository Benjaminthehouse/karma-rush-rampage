/** Broad feel of a mini-game; a daily lineup mixes kinds so no day is five mash games. */
export type GameKind = 'mash' | 'react' | 'sort' | 'memory' | 'timing' | 'brain';

export type GameMeta = {
  /** Lowercase letters only. Also the file name and the CSS scope `.g-<id>`. */
  id: string;
  title: string;
  /** The announcer's command: 2-6 words, ALL CAPS, dictated word by word before the round. */
  shout: string;
  /** Optional spelling for the speech voice when `shout` would be mispronounced. */
  say?: string;
  /** One short sentence shown under the shout. */
  how: string;
  /** What each button does: red, green, blue. */
  labels: [string, string, string];
  /** Round length in ms, 6000-8000. */
  duration: number;
  kind: GameKind;
  /**
   * Ms a typical player needs between seeing a new prompt and pressing: about
   * 250 for a visible sequence, 400 for a three-way choice, 550+ for a trick
   * rule, 700+ when there is text to read, 1000+ for counting. Use 0 for pure
   * mashing and for timing games where the player sees the moment coming.
   * The play-tester models a casual player with it. Default 380.
   */
  think?: number;
  /** True when pressing anything fast is the intended way to score (exempts the anti-mash check). */
  mashable?: boolean;
};

export const defineGame = (m: GameMeta): GameMeta => m;
