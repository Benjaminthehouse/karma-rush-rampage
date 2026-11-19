import { defineGame } from '../meta';

export default defineGame({
  id: 'regenerate',
  title: 'Absolutely Right',
  shout: 'REPROMPT THE FAILS! DON’T TOUCH PASSES!',
  say: 're-prompt the fails! don’t touch passes!',
  how: 'Each button rerolls the check above it. Once it says PASS, hands off or it breaks.',
  labels: ['REPROMPT', 'REPROMPT', 'REPROMPT'],
  duration: 7000,
  kind: 'react',
  think: 350,
});
