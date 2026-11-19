// Devvit Journeys: one journey per scored daily run, so Reddit can follow a player
// through the game loop (start, each round, the result, what they did next).
// Analytics must never get in the way of play: every call is fire-and-forget.
import { telemetry } from '@devvit/analytics/client/reddit';

let on = true;
let open = false;

const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);

export const track = {
  /** Switched off for the server-less demo, where there is nothing to report to. */
  disable: () => (on = false),
  /** The app is on screen and usable. */
  ready() {
    if (on) quiet(telemetry.appReady());
  },
  /** A scored daily run begins. */
  start() {
    if (!on) return;
    open = true;
    quiet(telemetry.startJourney());
  },
  /** A round of the run is done: `done` of `of`, in game `id`, for `score` points. */
  round(done: number, of: number, id: string, score: number) {
    if (!on || !open) return;
    quiet(telemetry.progress({ progress: Math.min(1, done / of), action: 'round_complete', actionDetails: `${id}:${score}` }));
  },
  /** The run is finished and scored. */
  end(total: number, win: boolean) {
    if (!on || !open) return;
    open = false;
    quiet(telemetry.endJourney({ complete: true, game: { win, score: total } }));
  },
  /** Something the player chose to do: post their score, join, start a party, practise. */
  did(action: string, details = '') {
    if (on) quiet(telemetry.interaction({ action, actionDetails: details }));
  },
};
