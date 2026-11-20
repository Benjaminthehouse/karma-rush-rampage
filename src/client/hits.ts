// Which hit sound each mini-game makes: the sound of the thing the player is doing.
// A game not listed here uses the default blip. All of them climb with the streak (sfx.ts).
import type { HitVoice } from './sfx';

export const HIT_VOICE: Record<string, HitVoice> = {
  aitaverdict: 'stamp', // the gavel
  anypercent: 'step', // running feet
  automodsays: 'blip', // a robot's order obeyed
  bananascale: 'snap', // the photo
  banevasion: 'stamp', // the ban hammer
  cakeday: 'bell', // a candle lit, a birthday chime
  chartcrime: 'stamp', // slamming the true number
  commentchain: 'pluck', // each reply is a note in the chain
  controversial: 'vote',
  cookiewall: 'snap', // a cookie snapped
  copypasta: 'pop', // pasta dropped in the pot
  crosspost: 'swipe', // post delivered
  deepfry: 'sizzle',
  dodge: 'vote', // an upvote caught
  doomscroll: 'swipe', // the feed scrolls
  dumpsterfire: 'water', // the hose
  firstcomment: 'snap', // off the blocks
  flair: 'snap', // a tag clipped on
  fridaydeploy: 'zap', // shipped
  haikubot: 'pluck', // a zen string per syllable
  hypeballoon: 'coin', // hype banked
  jackpot: 'coin',
  maincharacter: 'snap', // cameras flash on the pose
  microwave: 'bell', // ding
  modmail: 'key', // typing the appeal
  modqueue: 'stamp', // the rubber stamp
  ninetynine: 'bell', // done at 100
  notarobot: 'pop', // a tile ticked
  npccheck: 'bell', // spotted
  oddlystack: 'stamp', // the slab lands
  peak: 'vote',
  poll: 'vote',
  popuppanic: 'pop', // an ad closed
  rant: 'key', // typing
  regenerate: 'zap', // rerolled
  repostradar: 'snap', // caught on camera
  rugpull: 'coin', // sold
  selfpromo: 'horn', // the megaphone
  servers: 'zap', // kicked back to life
  settleit: 'stamp', // the throw lands
  sideeye: 'swipe', // scrolling memes
  sixfingers: 'snap',
  slashs: 'blip',
  sortbynew: 'bell', // the bakery bell
  sortbytop: 'vote',
  stonks: 'coin',
  tothemoon: 'coin',
  upvote: 'vote',
  voidcanvas: 'water', // paint splashed on
  votemath: 'key', // chalk on the board
  worksonmine: 'bell', // it boots
};
