import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Post from './models/Post.js';
import Follow from './models/Follow.js';
import Reaction from './models/Reaction.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cardifly';
await mongoose.connect(MONGODB_URI);
console.log('MongoDB connected for seeding');

// Clear all data
await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Follow.deleteMany({}),
    Reaction.deleteMany({}),
    mongoose.connection.collection('replies').drop().catch(() => {}),
    mongoose.connection.collection('rechirps').drop().catch(() => {}),
    mongoose.connection.collection('replyreactions').drop().catch(() => {}),
    mongoose.connection.collection('notifications').drop().catch(() => {}),
    mongoose.connection.collection('polls').drop().catch(() => {}),
    mongoose.connection.collection('pollvotes').drop().catch(() => {}),
    mongoose.connection.collection('postmedias').drop().catch(() => {}),
]);
console.log('✓ Cleared all data');

const PASSWORD = await bcrypt.hash('password123', 10);

const USERS_DATA = [
    { username: 'Kot',            email: 'kot@kot.com',          bio: '🐱' },
    { username: 'CardinalMike',   email: 'mike@cardifly.app',    bio: 'Bird watcher & coffee drinker ☕' },
    { username: 'PixelPusher',    email: 'pixel@cardifly.app',   bio: 'Design nerd. CSS is my canvas.' },
    { username: 'NightOwlDev',    email: 'owl@cardifly.app',     bio: 'Making things on the web since 2003' },
    { username: 'RetroRobin',     email: 'robin@cardifly.app',   bio: 'Vintage tech collector & synth fan 🎹' },
    { username: 'SwiftSarah',     email: 'sarah@cardifly.app',   bio: 'iOS dev. Running enthusiast. Cat mom 🐱' },
    { username: 'DuskCoder',      email: 'dusk@cardifly.app',    bio: 'Writing code at odd hours' },
    { username: 'MorningJay',     email: 'jay@cardifly.app',     bio: 'Early riser. Coffee first, then bugs.' },
    { username: 'TypoKing',       email: 'typo@cardifly.app',    bio: 'I mena to typo. Always.' },
    { username: 'ZenDevOps',      email: 'zen@cardifly.app',     bio: 'kubectl apply -f life.yaml' },
    { username: 'HashTagQueen',   email: 'htq@cardifly.app',     bio: '#everything #always #nonstop' },
    { username: 'QuietFinch',     email: 'finch@cardifly.app',   bio: null },
    { username: 'LunaWatcher',    email: 'luna@cardifly.app',    bio: 'Moon phases & bad weather forecasts 🌙' },
    { username: 'GrumpyStack',    email: 'grumpy@cardifly.app',  bio: 'Everything was better in 2010.' },
    { username: 'CryptoSparrow',  email: 'crypto@cardifly.app',  bio: 'Not financial advice. Ever.' },
    { username: 'PastaEngineer',  email: 'pasta@cardifly.app',   bio: 'Turning spaghetti code into lasagna' },
    { username: 'SilentWren',     email: 'wren@cardifly.app',    bio: null },
    { username: 'JustBrowsing',   email: 'browse@cardifly.app',  bio: 'Just here to lurk tbh' },
    { username: 'NewbieNest',     email: 'newbie@cardifly.app',  bio: 'First week on CardiFly 🐣' },
    { username: 'GhostFlicker',   email: 'ghost@cardifly.app',   bio: 'Boo.' },
    { username: 'VoidSender',     email: 'void@cardifly.app',    bio: null },
    { username: 'IsolatedEagle',  email: 'eagle@cardifly.app',   bio: 'Solo flight only.' },
];

const users = await User.insertMany(
    USERS_DATA.map(u => ({ ...u, password_hash: PASSWORD }))
);
const uid = {};
users.forEach(u => { uid[u.username] = u._id; });
console.log(`✓ Created ${users.length} users (all password: password123)`);

// Posts
function ago(hours) {
    return new Date(Date.now() - hours * 3600000);
}

const POSTS_DATA = [
    [uid['CardinalMike'], 'Just spotted a red cardinal outside my window. Peak morning. #CardinalSeason', ago(2)],
    [uid['CardinalMike'], 'Coffee > sleep. Change my mind.', ago(18)],
    [uid['CardinalMike'], 'Why does every "quick fix" take 3 hours? Asking for a friend.', ago(36)],
    [uid['CardinalMike'], 'The best code is no code. The second best is code someone else maintains.', ago(60)],
    [uid['PixelPusher'], 'New design system dropped. 47 shades of beige. You\'re welcome.', ago(1)],
    [uid['PixelPusher'], 'Clients: "make the logo bigger" Me: *makes it 1px bigger* Clients: "perfect"', ago(14)],
    [uid['PixelPusher'], 'Dark mode is a personality now and I\'m here for it. #MorningVibes', ago(40)],
    [uid['NightOwlDev'], '3am and I just fixed a bug that\'s been haunting me since 2019. Sleep is overrated.', ago(3)],
    [uid['NightOwlDev'], 'The internet was more fun when it was ugly. #OldInternet', ago(22)],
    [uid['NightOwlDev'], 'TypeScript saved my marriage. Don\'t ask. #TypeScript', ago(48)],
    [uid['NightOwlDev'], 'Built my first website on Geocities. Still runs better than most SPAs.', ago(72)],
    [uid['RetroRobin'], 'Restored a 1987 Macintosh SE today. She boots. I cried a little. #RetroTech', ago(5)],
    [uid['RetroRobin'], 'Physical media will outlive all of us. Vinyl, VHS, whatever. #RetroTech', ago(30)],
    [uid['SwiftSarah'], 'Swift concurrency is beautiful until it isn\'t. Same as running tbh. #TypeScript', ago(4)],
    [uid['SwiftSarah'], 'My cat sat on my keyboard and shipped a feature. Promoted.', ago(26)],
    [uid['SwiftSarah'], 'PRs that only move files around should count as cardio.', ago(50)],
    [uid['DuskCoder'], 'Midnight: the only time when Stack Overflow answers make sense.', ago(8)],
    [uid['DuskCoder'], 'Wrote 200 lines of code. Deleted 210. Net positive. #OldInternet', ago(55)],
    [uid['MorningJay'], '5am club reporting. Cold brew in hand. Bug queue empty. Briefly.', ago(6)],
    [uid['MorningJay'], 'The best standup is no standup. #MorningVibes', ago(32)],
    [uid['TypoKing'], 'I forgor to push my chagnes agian. Classic.', ago(9)],
    [uid['TypoKing'], 'Sned tweet. Sned. SNED. you know what i mena.', ago(44)],
    [uid['ZenDevOps'], 'The pipeline is green. I don\'t trust it. #CardinalSeason', ago(7)],
    [uid['ZenDevOps'], 'Rolling restart at 2am. Namaste. 🙏', ago(28)],
    [uid['HashTagQueen'], 'Good morning! #GoodMorning #Morning #AM #Vibes #MorningVibes #CardinalSeason', ago(10)],
    [uid['HashTagQueen'], 'Just had coffee #Coffee #Caffeine #Morning #MorningVibes #Blessed', ago(34)],
    [uid['QuietFinch'], 'Hi.', ago(15)],
    [uid['LunaWatcher'], 'Full moon tonight. My code will either work perfectly or explode. No in-between.', ago(12)],
    [uid['LunaWatcher'], 'Mercury retrograde blamed for my merge conflict. Seems valid.', ago(58)],
    [uid['GrumpyStack'], 'We didn\'t have Kubernetes in 2010 and somehow the internet still worked.', ago(20)],
    [uid['GrumpyStack'], 'Another JS framework dropped. I have chosen to ignore it.', ago(66)],
    [uid['CryptoSparrow'], 'Not financial advice: water is wet. #OldInternet', ago(16)],
    [uid['PastaEngineer'], 'Turned 900 lines of spaghetti into 900 lines of well-commented spaghetti. Progress.', ago(24)],
    [uid['PastaEngineer'], 'Legacy code is just features with a history degree.', ago(70)],
    [uid['SilentWren'], 'Testing testing 1 2 3', ago(100)],
    [uid['JustBrowsing'], 'everyone seems really busy here', ago(48)],
    [uid['NewbieNest'], 'Hello CardiFly! Just joined. Is this thing on? 🐣', ago(3)],
    [uid['IsolatedEagle'], 'Flying solo since day one.', ago(200)],
    [uid['Kot'], 'Back on CardiFly. What did I miss?', ago(1)],
];

const posts = await Post.insertMany(
    POSTS_DATA.map(([user_id, content, created_at]) => ({ user_id, content, created_at }))
);
const postByUser = {};
posts.forEach(p => {
    const uname = Object.keys(uid).find(k => String(uid[k]) === String(p.user_id));
    if (uname && !postByUser[uname]) postByUser[uname] = p._id;
});
console.log(`✓ Created ${posts.length} posts`);

// Follows
const followPairs = [];
function follow(a, b) { followPairs.push({ follower_id: uid[a], following_id: uid[b] }); }

for (const u of ['NightOwlDev','RetroRobin','SwiftSarah','DuskCoder','MorningJay','ZenDevOps',
                  'HashTagQueen','LunaWatcher','GrumpyStack','CryptoSparrow','TypoKing','Kot']) {
    follow(u, 'CardinalMike');
}
for (const u of ['CardinalMike','NightOwlDev','SwiftSarah','DuskCoder','ZenDevOps','RetroRobin','Kot']) {
    follow(u, 'PixelPusher');
}
follow('CardinalMike', 'NightOwlDev');
follow('SwiftSarah',   'NightOwlDev');
follow('DuskCoder',    'NightOwlDev');
follow('MorningJay',   'NightOwlDev');
follow('TypoKing',     'NightOwlDev');
follow('NightOwlDev',  'RetroRobin');
follow('NightOwlDev',  'SwiftSarah');
follow('NightOwlDev',  'ZenDevOps');
follow('NightOwlDev',  'DuskCoder');
follow('CardinalMike', 'SwiftSarah');
follow('RetroRobin',   'SwiftSarah');
follow('MorningJay',   'SwiftSarah');
follow('SwiftSarah',   'MorningJay');
follow('SwiftSarah',   'ZenDevOps');
follow('SwiftSarah',   'DuskCoder');
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
follow('Kot', 'CardinalMike');
follow('Kot', 'PixelPusher');
follow('Kot', 'SwiftSarah');
follow('Kot', 'NightOwlDev');

// Deduplicate
const seen = new Set();
const uniqueFollows = followPairs.filter(f => {
    const key = `${f.follower_id}_${f.following_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});
await Follow.insertMany(uniqueFollows);
console.log(`✓ Created ${followPairs.length} follows`);

// Reactions
const reactions = [];
function like(user, post) { if (postByUser[post]) reactions.push({ user_id: uid[user], post_id: postByUser[post], type: 'like' }); }
function dislike(user, post) { if (postByUser[post]) reactions.push({ user_id: uid[user], post_id: postByUser[post], type: 'dislike' }); }

for (const u of ['PixelPusher','NightOwlDev','SwiftSarah','Kot','MorningJay','ZenDevOps','LunaWatcher']) {
    like(u, 'CardinalMike');
}
for (const u of ['CardinalMike','SwiftSarah','DuskCoder','TypoKing','Kot']) {
    like(u, 'NightOwlDev');
}
for (const u of ['CardinalMike','NightOwlDev','SwiftSarah','RetroRobin']) {
    like(u, 'PixelPusher');
}
for (const u of ['NightOwlDev','LunaWatcher','GrumpyStack','Kot']) {
    like(u, 'RetroRobin');
}
dislike('GrumpyStack', 'HashTagQueen');
dislike('NightOwlDev', 'HashTagQueen');
dislike('GrumpyStack', 'CryptoSparrow');

await Reaction.insertMany(reactions);
console.log(`✓ Created ${reactions.length} reactions`);

await mongoose.disconnect();
console.log('\n🎉 Seed complete! All passwords: password123');
