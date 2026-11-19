import { defineGame } from '../meta';

export default defineGame({
  id: 'automodsays',
  title: 'AutoMod Says',
  shout: 'ONLY OBEY THE REAL AUTOMOD!',
  how: 'Green shield means do it. No shield means an impostor: ignore them.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 7000,
  kind: 'brain',
  think: 450,
});
