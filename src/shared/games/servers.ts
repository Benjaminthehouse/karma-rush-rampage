import { defineGame } from '../meta';

export default defineGame({
  id: 'servers',
  title: 'Servers Are Down',
  shout: 'MASH! NEVER THE SAME BUTTON TWICE!',
  how: 'Any buttons reboot the servers, but never the same one twice in a row.',
  labels: ['MASH', 'MASH', 'MASH'],
  duration: 6000,
  kind: 'mash',
  think: 0,
  mashable: true,
});
