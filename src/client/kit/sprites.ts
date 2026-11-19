// The shared sprite sheet, as text. One character is one pixel:
//   .  empty      k  outline     w W  whites     d D x  greys
//   A a L         the sprite's tone (main, shade, light): recolour with { tone }
//   y Y gold   o O orange   r R red   g G green   b B blue   p P purple
//   n N brown  c cyan  m pink  s skin  t teal
// A game may add its own with defineSprite(); keep rows the same length.
import { defineSprite } from './px';

const S = defineSprite;

// ---------------------------------------------------------------- forum bits
S('up', `
.....k.....
....kLk....
...kLAAk...
..kLAAAAk..
.kLAAAAAAk.
kAAAAAAAAAk
kkkkAAAkkkk
...kAAAk...
...kAAAk...
...kAAak...
...kaaak...
...kkkkk...`);

S('heart', `
..kk...kk..
.krrk.krrk.
krWrrkrrrrk
krWrrrrrrrk
krrrrrrrrRk
.krrrrrrRk.
..krrrrRk..
...krrRk...
....kRk....
.....k.....`);

S('star', `
.....k.....
....kyk....
....kYk....
.kkkyYykkk.
kyyyyYyyyyk
.kyyyyyyok.
..kyyyyok..
..kyyyyok..
.kyyokyyok.
.kyok.kyok.
.kk.....kk.`);

S('coin', `
...kkkk...
..kyyyyk..
.kyYYyyok.
kyYyyyyyok
kyYyykyyok
kyyyykyyok
kyyyyyyyok
.kyyyyook.
..kooook..
...kkkk...`);

S('comment', `
.kkkkkkkkkk.
kwwwwwwwwwwk
kwwwwwwwwwwk
kwwkwwkwwkwk
kwwwwwwwwwwk
kwwwwwwwwddk
.kkkwwkkkkk.
...kwk......
...kk.......`);

S('shield', `
.kkkkkkkkk.
kLLAAAAAAAk
kLAAAAAAwAk
kAAAAAAwwAk
kAwAAAwwAAk
kAwwAwwAAak
kAAwwwAAAak
kAAAwAAAaak
.kAAAAAAak.
..kAAAaak..
...kaaak...
....kkk....`);

S('hammer', `
.kkkkkkkkkk...
kddddddddddk..
kdDDDDDDDDDk..
kdDDDDDDDDxk..
kxxxxxxxxxxk..
.kkkknnkkkk...
....knNk......
....knNk......
....knNk......
....knNk......
....knNk......
....kkkk......`);

S('lock', `
...kkkk...
..kddddk..
.kdk..kdk.
.kdk..kdk.
kkkkkkkkkk
kyyyyyyyyk
kyyykkyyok
kyyykkyyok
kyyyyyyook
kkkkkkkkkk`);

S('trash', `
...kkkk...
kkkkddkkkk
kddddddddk
kkkkkkkkkk
.kdDdDdDk.
.kdDdDdDk.
.kdDdDdDk.
.kdDdDdDk.
.kdDdDdxk.
..kkkkkk..`);

S('check', `
........kk
.......kgk
......kgGk
.kk..kgGk.
kggkkgGk..
kgggGGk...
.kgGGk....
..kGk.....
...k......`);

S('cross', `
kk.....kk
krk...krk
.krk.krk.
..krkrk..
...krk...
..krkRk..
.krk.kRk.
krk...kRk
kk.....kk`);

S('envelope', `
kkkkkkkkkkkk
kwwwwwwwwwwk
kdwwwwwwwwdk
kwdwwwwwwdwk
kwwdwwwwdwwk
kwwwddddwwwk
kwwwwwwwwwwk
kwwwwwwwwwdk
kkkkkkkkkkkk`);

S('crown', `
.k....kk....k.
kyk..kyyk..kyk
kyykkyyyykkyyk
kyyyyyyyyyyyyk
kyryyybyyygyyk
kyyyyyyyyyyyok
kkkkkkkkkkkkkk`);

// ------------------------------------------------------------------ effects
S('flame1', `
....k.....
...kok....
...kook...
..kooyok..
.kooyyok..
.koyyyook.
kooyYyyok.
koyyYYyook
koyYYYyyok
koyyYYyyok
.koyyyyok.
..kkkkkk..`);

S('flame2', `
.....k....
....kok...
...kook...
..koyook..
..koyyook.
.kooyyyok.
.koyyYyook
kooyYYyyok
koyyYYYyok
koyyYYyyok
.koyyyyok.
..kkkkkk..`);

S('poof1', `
............
............
....kkkk....
...kwwwwk...
..kwwwwwwk..
..kwwwwwdk..
...kwwddk...
....kkkk....
............
............`);

S('poof2', `
...kk..kkk..
..kwwkkwwwk.
.kwwwwwwwwk.
kwwwwwwwwwdk
kwwwwwwwwwdk
.kwwwwwwwdk.
..kwwwwddk..
.kwwkkddk...
.kddk.kk....
..kk........`);

S('poof3', `
..kk....kk..
.kwwk..kwdk.
..kk....kk..
......kk....
.kk..kwwk...
kwwk..kk....
.kk.......kk
.........kdk
..kk......k.
.kwdk.......`);

S('spark', `
...w...
...w...
..wYw..
wwYYYww
..wYw..
...w...
...w...`);

S('zed', `
kkkkkk
kwwwwk
kkkwkk
.kwkk.
kkwkkk
kwwwwk
kkkkkk`);

S('bang', `
kkk
kyk
kyk
kyk
kyk
kkk
kyk
kkk`);

S('quest', `
.kkkk.
kyyyyk
kkkkyk
..kyyk
..kyk.
..kkk.
..kyk.
..kkk.`);

// ------------------------------------------------------------------- things
S('rocket', `
....k....
...kwk...
..kwwwk..
..kwcwk..
.kwwcwwk.
.kwwwwwk.
.kwwwwdk.
kAkwwdkAk
kAkwwdkAk
kAakkkaAk
kkkkokkkk
...kyok..
...kyk...
....k....`);

S('cloud', `
.....kkkk.......
...kkwwwwkkk....
..kwwwwwwwwwk...
.kwwwwwwwwwwwkk.
kwwwwwwwwwwwwwdk
kwwwwwwwwwwwdddk
.kddddddddddddk.
..kkkkkkkkkkkk..`);

S('banana', `
.........kk.
........knk.
.......kyyk.
......kyyyk.
.....kyyYk..
...kkyyYyk..
.kkyyyYyk...
kyyyyyyk....
.kyyykk.....
..kkk.......`);

S('cake', `
......ko......
......kyk.....
......kwk.....
..kkkkkwkkkk..
.kmmmmmmmmmmk.
kmWmmWmmWmmWmk
kwwwwwwwwwwwwk
kmmmmmmmmmmmmk
kmmmmmmmmmmmmk
kwwwwwwwwwwwdk
kmmmmmmmmmmmmk
.kkkkkkkkkkkk.`);

// ---------------------------------------------------------------- characters
// A face is stacked from layers on a 16x16 grid: ears, head, eyes, mouth, hat.
S('head', `
................
................
................
....kkkkkkkk....
..kkLLAAAAAAkk..
.kLLAAAAAAAAAAk.
.kLAAAAAAAAAAAk.
kAAAAAAAAAAAAAAk
kAAAAAAAAAAAAAAk
kAAAAAAAAAAAAAAk
kAAAAAAAAAAAAAAk
kAAAAAAAAAAAAAak
.kAAAAAAAAAAAak.
.kaAAAAAAAAAaak.
..kkaaaaaaaakk..
....kkkkkkkk....`);

S('headbot', `
................
................
................
.kkkkkkkkkkkkkk.
.kLLAAAAAAAAAAk.
.kLAAAAAAAAAAAk.
.kAAAAAAAAAAAAk.
kkAAAAAAAAAAAAkk
kdAAAAAAAAAAAAdk
kkAAAAAAAAAAAAkk
.kAAAAAAAAAAAAk.
.kAAAAAAAAAAAak.
.kAAAAAAAAAAaak.
.kaaaaaaaaaaaak.
.kkkkkkkkkkkkkk.
................`);

S('ears-cat', `
.kk..........kk.
kAAk........kAAk
kAmAk......kAmAk
kAAAAk....kAAAAk
.kAAAkk..kkAAAk.`);

S('ears-bear', `
................
.kkk........kkk.
kAAAk......kAAAk
kAaAk......kAaAk
.kAAk......kAAk.`);

S('hat-mod', `
....kkkkkkkk....
...kggggggggk...
..kgggwwggggGk..
.kkkkkkkkkkkkkk.`);

S('hat-horns', `
kk............kk
kpk..........kpk
kppk........kppk
.kppk......kppk.
..kkk......kkk..`);

S('hat-crown', `
...k...kk...k...
..kyk.kyyk.kyk..
..kyykyyyykyyk..
..kyryyybyygyk..
..kkkkkkkkkkkk..`);

S('eyes-open', `
....kk....kk....
....wk....wk....
....kk....kk....`);

S('eyes-happy', `
....kk....kk....
...k..k..k..k...`);

S('eyes-sleep', `
................
...kkkk..kkkk...`);

S('eyes-shock', `
...kkkk..kkkk...
...kwwk..kwwk...
...kwkk..kkwk...
...kkkk..kkkk...`);

S('eyes-angry', `
...kk......kk...
....kk....kk....
....kk....kk....
....kk....kk....`);

S('eyes-cool', `
..kkkkkkkkkkkk..
..kkkkk..kkkkk..
...kkk....kkk...`);

S('eyes-wink', `
....kk..........
....wk...kkkk...
....kk..........`);

S('eyes-dead', `
...k.k....k.k...
....k......k....
...k.k....k.k...`);

S('mouth-smile', `
.....k....k.....
......kkkk......`);

S('mouth-open', `
.....kkkkkk.....
......krrk......`);

S('mouth-frown', `
......kkkk......
.....k....k.....`);

S('mouth-o', `
.......kk.......
.......kk.......`);

S('mouth-flat', `
......kkkk......`);

S('mouth-grit', `
.....kkkkkk.....
.....kwkwkk.....`);

S('blush', `
..mm........mm..`);

// ------------------------------------------------------------- more things
S('bell', `
.....kk.....
....kyyk....
...kyYyyk...
..kyYyyyyk..
..kyyyyyok..
..kyyyyyok..
.kyyyyyyyok.
kyyyyyyyyook
kkkkkkkkkkkk
....kook....
.....kk.....`);

S('trophy', `
.kkkkkkkkkk.
kkyyyyyyyykk
kykyYyyyokyk
kykyYyyyokyk
.kkyYyyyokk.
..kyyyyyok..
...kyyyok...
....kyok....
....kyok....
..kkkyokkk..
..kyyyyyok..
..kkkkkkkk..`);

S('bug', `
..k......k..
...k....k...
..kkkkkkkk..
.kggkggkggk.
kkgGgggggGkk
..kggkkggk..
kkgGggggGgkk
..kggkkggk..
kkgGGGGGGgkk
..kkkkkkkk..`);

S('phone', `
.kkkkkkkk.
kxxxxxxxxk
kxccccccxk
kxccccccxk
kxccwcccxk
kxccccccxk
kxccccccxk
kxccccccxk
kxccccccxk
kxxxxxxxxk
kxxxkkxxxk
.kkkkkkkk.`);

S('laptop', `
..kkkkkkkkkkkk..
..kxxxxxxxxxxk..
..kxccccccccxk..
..kxcwccccccxk..
..kxccccccccxk..
..kxccccccccxk..
..kxxxxxxxxxxk..
.kkkkkkkkkkkkkk.
kddddddddddddddk
kdDDDDDDDDDDDDdk
kkkkkkkkkkkkkkkk`);

S('server', `
kkkkkkkkkkkk
kxxxxxxxxxxk
kxgxrxdddddk
kxxxxxxxxxxk
kkkkkkkkkkkk
kxxxxxxxxxxk
kxgxgxdddddk
kxxxxxxxxxxk
kkkkkkkkkkkk
kxxxxxxxxxxk
kxrxgxdddddk
kxxxxxxxxxxk
kkkkkkkkkkkk`);

S('cookie', `
...kkkkk...
.kknnnnnkk.
knnnNnnnnnk
knNnnnnNnnk
knnnnnnnnnk
knnnNnnnnNk
knnnnnnNnnk
.knNnnnnnk.
..kknnnkk..
....kkk....`);

S('megaphone', `
.........kk.
.......kkrk.
.kkkkkkrrrk.
kwwwwkrrrrk.
kwwwwkrrrrkk
kwwwwkrrrrkk
kwwwwkrrrrk.
.kkkkkkrrrk.
..kdk..kkrk.
..kdk....kk.
..kkk.......`);

S('skull', `
..kkkkkkk..
.kwwwwwwwk.
kwwwwwwwwwk
kwkkwwwkkwk
kwkkwwwkkwk
kwwwwkwwwwk
.kwwwwwwwk.
..kwkwkwk..
..kkkkkkk..`);

S('bomb', `
.......kk..
......kyok.
.....kk.k..
...kkkkk...
..kxxxxxk..
.kxwxxxxxk.
kxwxxxxxxxk
kxxxxxxxxxk
kxxxxxxxxxk
.kxxxxxxxk.
..kxxxxxk..
...kkkkk...`);

S('gift', `
...kk.kk...
..krrkrrk..
.kkkkkkkkk.
kbbbbybbbbk
kkkkkkkkkkk
.kbbbybbbk.
.kbbbybbbk.
.kbbbybbbk.
.kbbbybbBk.
.kkkkkkkkk.`);

S('thumb', `
....kk......
...kLAk.....
...kAAk.....
..kAAAkkkkk.
kkkAAAAAAAAk
kwkAAAAAAAAk
kwkAAAAAAAak
kwkAAAAAAAak
kwkAAAAAAak.
kkkkaaaaak..
...kkkkkk...`);

S('moon', `
....kkkkk...
..kkYYYYykk.
.kYYYYyyyyk.
kYYYYykkyyyk
kYYYYykkyyyk
kYYyyyyyyyok
kYykkyyyyyok
kyykkyyykyok
.kyyyyyyyok.
..kkyyyookk.
....kkkkk...`);

S('eye', `
...kkkkkk...
.kkwwwwwwkk.
kwwwkkkkwwwk
kwwkbbbBkwwk
kwwkbkkBkwwk
kwwkbbBBkwwk
kwwwkkkkwwwk
.kkwwwwwwkk.
...kkkkkk...`);

S('window', `
kkkkkkkkkkkkkk
kbbbbbbbbbkrrk
kkkkkkkkkkkkkk
kwwwwwwwwwwwwk
kwddddddddddwk
kwwwwwwwwwwwwk
kwddddddwwwwwk
kwwwwwwwwwwwwk
kwddddddddwwwk
kwwwwwwwwwwwwk
kkkkkkkkkkkkkk`);
