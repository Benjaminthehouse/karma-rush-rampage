import { defineGame } from '../meta';

export default defineGame({
  id: 'automodsays',
  title: 'AutoMod Says',
  shout: 'ONLY OBEY THE REAL AUTOMOD!',
  how: 'Obey the grey robot with the green shield. Anyone else in a costume: ignore them.',
  labels: ['RED', 'GREEN', 'BLUE'],
  duration: 7000,
  kind: 'brain',
  think: 450,
});
