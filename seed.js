import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'cardifly.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Keep Kot, nuke everything else ───────────────────────────────────────────
const kot = db.prepare('SELECT * FROM users WHERE username = ?').get('Kot');
if (!kot) { console.error('Kot not found!'); process.exit(1); }

db.exec('DELETE FROM reply_reactions');
db.exec('DELETE FROM rechirps');
db.exec('DELETE FROM reactions');
db.exec('DELETE FROM replies');
db.exec('DELETE FROM follows');
db.exec('DELETE FROM posts');
db.prepare('DELETE FROM users WHERE username != ?').run('Kot');

// Reset autoincrement sequences (except for Kot's id)
db.exec("DELETE FROM sqlite_sequence WHERE name != 'users'");

console.log('✓ Cleared all data except Kot');

// ── 21 new users ──────────────────────────────────────────────────────────────
const PASSWORD = await bcrypt.hash('password123', 10);

const USERS = [
  // Power users — lots of posts & followers
  { username: 'CardinalMike',  email: 'mike@cardifly.app',    bio: 'Bird watcher & coffee drinker ☕' },
  { username: 'PixelPusher',   email: 'pixel@cardifly.app',   bio: 'Design nerd. CSS is my canvas.' },
  { username: 'NightOwlDev',   email: 'owl@cardifly.app',     bio: 'Making things on the web since 2003' },
  { username: 'RetroRobin',    email: 'robin@cardifly.app',   bio: 'Vintage tech collector & synth fan 🎹' },
  { username: 'SwiftSarah',    email: 'sarah@cardifly.app',   bio: 'iOS dev. Running enthusiast. Cat mom 🐱' },

  // Mid-tier — decent activity
  { username: 'DuskCoder',     email: 'dusk@cardifly.app',    bio: 'Writing code at odd hours' },
  { username: 'MorningJay',    email: 'jay@cardifly.app',     bio: 'Early riser. Coffee first, then bugs.' },
  { username: 'TypoKing',      email: 'typo@cardifly.app',    bio: 'I mena to typo. Always.' },
  { username: 'ZenDevOps',     email: 'zen@cardifly.app',     bio: 'kubectl apply -f life.yaml' },
  { username: 'HashTagQueen',  email: 'htq@cardifly.app',     bio: '#everything #always #nonstop' },

  // Casual — few posts, some connections
  { username: 'QuietFinch',    email: 'finch@cardifly.app',   bio: null },
  { username: 'LunaWatcher',   email: 'luna@cardifly.app',    bio: 'Moon phases & bad weather forecasts 🌙' },
  { username: 'GrumpyStack',   email: 'grumpy@cardifly.app',  bio: 'Everything was better in 2010.' },
  { username: 'CryptoSparrow', email: 'crypto@cardifly.app',  bio: 'Not financial advice. Ever.' },
  { username: 'PastaEngineer', email: 'pasta@cardifly.app',   bio: 'Turning spaghetti code into lasagna' },

  // Low activity — 1–2 posts or lurkers
  { username: 'SilentWren',    email: 'wren@cardifly.app',    bio: null },
  { username: 'JustBrowsing',  email: 'browse@cardifly.app',  bio: 'Just here to lurk tbh' },
  { username: 'NewbieNest',    email: 'newbie@cardifly.app',  bio: 'First week on CardiFly 🐣' },

  // No followers at all
  { username: 'GhostFlicker',  email: 'ghost@cardifly.app',   bio: 'Boo.' },
  { username: 'VoidSender',    email: 'void@cardifly.app',    bio: null },

  // Following nobody, nobody follows them
  { username: 'IsolatedEagle', email: 'eagle@cardifly.app',   bio: 'Solo flight only.' },
];

const insertUser = db.prepare(
  'INSERT INTO users (username, email, password_hash, bio) VALUES (?, ?, ?, ?)'
);

const userIds = {};
for (const u of USERS) {
  const info = insertUser.run(u.username, u.email, PASSWORD, u.bio ?? null);
  userIds[u.username] = info.lastInsertRowid;
}
// Also register Kot
userIds['Kot'] = kot.id;

console.log(`✓ Created ${USERS.length} users (all password: password123)`);

// ── Posts ─────────────────────────────────────────────────────────────────────
const insertPost = db.prepare(
  'INSERT INTO posts (user_id, content, created_at) VALUES (?, ?, ?)'
);

function ago(hours) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

const POSTS = [
  // CardinalMike — power user
  [userIds['CardinalMike'], 'Just spotted a red cardinal outside my window. Peak morning. #CardinalSeason', ago(2)],
  [userIds['CardinalMike'], 'Coffee > sleep. Change my mind.', ago(18)],
  [userIds['CardinalMike'], 'Why does every "quick fix" take 3 hours? Asking for a friend.', ago(36)],
  [userIds['CardinalMike'], 'The best code is no code. The second best is code someone else maintains.', ago(60)],

  // PixelPusher
  [userIds['PixelPusher'], 'New design system dropped. 47 shades of beige. You\'re welcome.', ago(1)],
  [userIds['PixelPusher'], 'Clients: "make the logo bigger" Me: *makes it 1px bigger* Clients: "perfect"', ago(14)],
  [userIds['PixelPusher'], 'Dark mode is a personality now and I\'m here for it. #MorningVibes', ago(40)],

  // NightOwlDev
  [userIds['NightOwlDev'], '3am and I just fixed a bug that\'s been haunting me since 2019. Sleep is overrated.', ago(3)],
  [userIds['NightOwlDev'], 'The internet was more fun when it was ugly. #OldInternet', ago(22)],
  [userIds['NightOwlDev'], 'TypeScript saved my marriage. Don\'t ask. #TypeScript', ago(48)],
  [userIds['NightOwlDev'], 'Built my first website on Geocities. Still runs better than most SPAs.', ago(72)],

  // RetroRobin
  [userIds['RetroRobin'], 'Restored a 1987 Macintosh SE today. She boots. I cried a little. #RetroTech', ago(5)],
  [userIds['RetroRobin'], 'Physical media will outlive all of us. Vinyl, VHS, whatever. #RetroTech', ago(30)],

  // SwiftSarah
  [userIds['SwiftSarah'], 'Swift concurrency is beautiful until it isn\'t. Same as running tbh. #TypeScript', ago(4)],
  [userIds['SwiftSarah'], 'My cat sat on my keyboard and shipped a feature. Promoted.', ago(26)],
  [userIds['SwiftSarah'], 'PRs that only move files around should count as cardio.', ago(50)],

  // DuskCoder
  [userIds['DuskCoder'], 'Midnight: the only time when Stack Overflow answers make sense.', ago(8)],
  [userIds['DuskCoder'], 'Wrote 200 lines of code. Deleted 210. Net positive. #OldInternet', ago(55)],

  // MorningJay
  [userIds['MorningJay'], '5am club reporting. Cold brew in hand. Bug queue empty. Briefly.', ago(6)],
  [userIds['MorningJay'], 'The best standup is no standup. #MorningVibes', ago(32)],

  // TypoKing
  [userIds['TypoKing'], 'I forgor to push my chagnes agian. Classic.', ago(9)],
  [userIds['TypoKing'], 'Sned tweet. Sned. SNED. you know what i mena.', ago(44)],

  // ZenDevOps
  [userIds['ZenDevOps'], 'The pipeline is green. I don\'t trust it. #CardinalSeason', ago(7)],
  [userIds['ZenDevOps'], 'Rolling restart at 2am. Namaste. 🙏', ago(28)],

  // HashTagQueen
  [userIds['HashTagQueen'], 'Good morning! #GoodMorning #Morning #AM #Vibes #MorningVibes #CardinalSeason', ago(10)],
  [userIds['HashTagQueen'], 'Just had coffee #Coffee #Caffeine #Morning #MorningVibes #Blessed', ago(34)],

  // QuietFinch — just one post
  [userIds['QuietFinch'], 'Hi.', ago(15)],

  // LunaWatcher
  [userIds['LunaWatcher'], 'Full moon tonight. My code will either work perfectly or explode. No in-between.', ago(12)],
  [userIds['LunaWatcher'], 'Mercury retrograde blamed for my merge conflict. Seems valid.', ago(58)],

  // GrumpyStack
  [userIds['GrumpyStack'], 'We didn\'t have Kubernetes in 2010 and somehow the internet still worked.', ago(20)],
  [userIds['GrumpyStack'], 'Another JS framework dropped. I have chosen to ignore it.', ago(66)],

  // CryptoSparrow
  [userIds['CryptoSparrow'], 'Not financial advice: water is wet. #OldInternet', ago(16)],

  // PastaEngineer
  [userIds['PastaEngineer'], 'Turned 900 lines of spaghetti into 900 lines of well-commented spaghetti. Progress.', ago(24)],
  [userIds['PastaEngineer'], 'Legacy code is just features with a history degree.', ago(70)],

  // SilentWren — one post
  [userIds['SilentWren'], 'Testing testing 1 2 3', ago(100)],

  // JustBrowsing — one post
  [userIds['JustBrowsing'], 'everyone seems really busy here', ago(48)],

  // NewbieNest — one post
  [userIds['NewbieNest'], 'Hello CardiFly! Just joined. Is this thing on? 🐣', ago(3)],

  // GhostFlicker — no posts
  // VoidSender — no posts
  // IsolatedEagle — one post
  [userIds['IsolatedEagle'], 'Flying solo since day one.', ago(200)],

  // Kot
  [userIds['Kot'], 'Back on CardiFly. What did I miss?', ago(1)],
];

const postIds = {};
for (const [uid, content, created_at] of POSTS) {
  const info = insertPost.run(uid, content, created_at);
  // store first post per user for reactions
  const uname = Object.keys(userIds).find(k => userIds[k] === uid);
  if (uname && !postIds[uname]) postIds[uname] = info.lastInsertRowid;
}

console.log(`✓ Created ${POSTS.length} posts`);

// ── Follows ───────────────────────────────────────────────────────────────────
const insertFollow = db.prepare(
  'INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)'
);

function follow(a, b) { insertFollow.run(userIds[a], userIds[b]); }

// Power cluster — everyone follows CardinalMike & PixelPusher
for (const u of ['NightOwlDev','RetroRobin','SwiftSarah','DuskCoder','MorningJay','ZenDevOps',
                  'HashTagQueen','LunaWatcher','GrumpyStack','CryptoSparrow','TypoKing','Kot']) {
  follow(u, 'CardinalMike');
}
for (const u of ['CardinalMike','NightOwlDev','SwiftSarah','DuskCoder','ZenDevOps','RetroRobin','Kot']) {
  follow(u, 'PixelPusher');
}

// NightOwlDev mutual with several
follow('CardinalMike', 'NightOwlDev');
follow('SwiftSarah',   'NightOwlDev');
follow('DuskCoder',    'NightOwlDev');
follow('MorningJay',   'NightOwlDev');
follow('TypoKing',     'NightOwlDev');
follow('NightOwlDev',  'RetroRobin');
follow('NightOwlDev',  'SwiftSarah');
follow('NightOwlDev',  'ZenDevOps');
follow('NightOwlDev',  'DuskCoder');

// SwiftSarah cluster
follow('CardinalMike', 'SwiftSarah');
follow('RetroRobin',   'SwiftSarah');
follow('MorningJay',   'SwiftSarah');
follow('SwiftSarah',   'MorningJay');
follow('SwiftSarah',   'ZenDevOps');
follow('SwiftSarah',   'DuskCoder');

// Mid-tier mutual pairs
follow('DuskCoder',    'MorningJay');
follow('MorningJay',   'DuskCoder');
follow('ZenDevOps',    'DuskCoder');
follow('DuskCoder',    'ZenDevOps');
follow('TypoKing',     'HashTagQueen');
follow('HashTagQueen', 'TypoKing');
follow('LunaWatcher',  'RetroRobin');
follow('RetroRobin',   'LunaWatcher');
follow('GrumpyStack',  'NightOwlDev');
follow('GrumpyStack',  'RetroRobin');
follow('CryptoSparrow','ZenDevOps');
follow('PastaEngineer','CardinalMike');
follow('PastaEngineer','NightOwlDev');
follow('PastaEngineer','PixelPusher');

// Casual/lurker follows (one-sided)
follow('QuietFinch',   'CardinalMike');
follow('QuietFinch',   'SwiftSarah');
follow('JustBrowsing', 'CardinalMike');
follow('JustBrowsing', 'PixelPusher');
follow('JustBrowsing', 'HashTagQueen');
follow('NewbieNest',   'CardinalMike');
follow('NewbieNest',   'PixelPusher');
follow('NewbieNest',   'SwiftSarah');
follow('NewbieNest',   'NightOwlDev');
follow('SilentWren',   'LunaWatcher');
follow('GhostFlicker', 'NightOwlDev');

// Kot follows some
follow('Kot', 'CardinalMike');
follow('Kot', 'PixelPusher');
follow('Kot', 'SwiftSarah');
follow('Kot', 'NightOwlDev');

// Nobody follows GhostFlicker, VoidSender, IsolatedEagle
// VoidSender follows nobody either

console.log('✓ Created follows');

// ── Reactions ────────────────────────────────────────────────────────────────
const insertReaction = db.prepare(
  'INSERT OR IGNORE INTO reactions (user_id, post_id, type) VALUES (?, ?, ?)'
);

// Like CardinalMike's first post
for (const u of ['PixelPusher','NightOwlDev','SwiftSarah','Kot','MorningJay','ZenDevOps','LunaWatcher']) {
  if (postIds['CardinalMike']) insertReaction.run(userIds[u], postIds['CardinalMike'], 'like');
}
// Like NightOwlDev's first post
for (const u of ['CardinalMike','SwiftSarah','DuskCoder','TypoKing','Kot']) {
  if (postIds['NightOwlDev']) insertReaction.run(userIds[u], postIds['NightOwlDev'], 'like');
}
// Like PixelPusher's first post
for (const u of ['CardinalMike','NightOwlDev','SwiftSarah','RetroRobin']) {
  if (postIds['PixelPusher']) insertReaction.run(userIds[u], postIds['PixelPusher'], 'like');
}
// Like RetroRobin's first post
for (const u of ['NightOwlDev','LunaWatcher','GrumpyStack','Kot']) {
  if (postIds['RetroRobin']) insertReaction.run(userIds[u], postIds['RetroRobin'], 'like');
}
// A few dislikes
if (postIds['HashTagQueen']) {
  insertReaction.run(userIds['GrumpyStack'], postIds['HashTagQueen'], 'dislike');
  insertReaction.run(userIds['NightOwlDev'], postIds['HashTagQueen'], 'dislike');
}
if (postIds['CryptoSparrow']) {
  insertReaction.run(userIds['GrumpyStack'], postIds['CryptoSparrow'], 'dislike');
}

console.log('✓ Created reactions');

db.close();
console.log('\n🎉 Seed complete! All passwords: password123');
console.log('   Kot password unchanged (kot@kot.com)');
