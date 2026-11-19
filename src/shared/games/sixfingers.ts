import { defineGame } from '../meta';

export default defineGame({
  id: 'sixfingers',
  title: 'Six Fingers',
  shout: 'SPOT THE AI HAND!',
  say: 'spot the A.I. hand!',
  how: 'Real hands have five fingers. Tap the one the AI got wrong.',
  labels: ['LEFT', 'MIDDLE', 'RIGHT'],
  duration: 8000,
  kind: 'brain',
  think: 800,
});
