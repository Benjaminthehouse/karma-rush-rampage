import { defineGame } from '../meta';

export default defineGame({
  id: 'fridaydeploy',
  title: 'Read-Only Friday',
  shout: 'SHIP IT! NEVER ON FRIDAY!',
  how: 'Press the DEPLOY button’s colour. If the page says FRIDAY, touch nothing.',
  labels: ['DEPLOY', 'DEPLOY', 'DEPLOY'],
  duration: 7000,
  kind: 'react',
  think: 480,
});
