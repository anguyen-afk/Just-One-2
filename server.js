const path = require("path");
const os = require("os");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const PORT = process.env.PORT || 3000;
const MAX_ROUNDS = 13;
const MAX_PLAYERS = 20;
const CLUE_GRACE_MS = 1500; // lets a clue typed at the buzzer still arrive
const LOBBY_GRACE_MS = 60 * 1000; // offline lobby players are removed after this
const ROOM_GRACE_MS = 10 * 60 * 1000; // empty rooms are deleted after this
const TIMER_CHOICES = [0, 30, 45, 60, 90]; // 0 = no timer
const WORD_MODES = ["builtin", "custom", "both"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

const CATEGORIES = {
  "General": [
    "Apple", "Bridge", "Cloud", "Dragon", "Eclipse", "Forest", "Ghost", "Harbor",
    "Island", "Jungle", "Kettle", "Lantern", "Mirror", "Nebula", "Ocean", "Pirate",
    "Quartz", "Rocket", "Shadow", "Tornado", "Umbrella", "Volcano", "Whistle", "Yacht",
    "Zebra", "Castle", "Diamond", "Engine", "Feather", "Glacier", "Hammock", "Igloo",
    "Jigsaw", "Kite", "Magnet", "Needle", "Orchard", "Parrot", "Robot", "Saddle",
    "Anchor", "Balloon", "Candle", "Desert", "Elephant", "Fountain", "Guitar", "Honey",
    "Iceberg", "Jacket", "Knight", "Ladder", "Mountain", "Napkin", "Octopus", "Piano",
    "Queen", "Rainbow", "Sandwich", "Telescope", "Unicorn", "Violin", "Waterfall", "Xylophone",
    "Yogurt", "Zeppelin", "Bakery", "Compass", "Dolphin", "Envelope", "Flamingo", "Garden",
    "Helmet", "Insect", "Jellyfish", "Kangaroo", "Library", "Mushroom", "Notebook", "Olive",
    "Penguin", "Quilt", "River", "Scissors", "Treasure", "Pyramid", "Vampire", "Windmill",
    "Satellite", "Lighthouse", "Skeleton", "Carnival", "Blizzard", "Avalanche", "Submarine", "Scarecrow",
    "Pancake", "Marathon", "Passport", "Thunder",
  ],
  "Animals": [
    "Lion", "Tiger", "Giraffe", "Monkey", "Hippo", "Rhino", "Koala", "Panda",
    "Otter", "Badger", "Beaver", "Walrus", "Moose", "Bison", "Camel", "Donkey",
    "Goat", "Sheep", "Rabbit", "Hamster", "Squirrel", "Raccoon", "Hedgehog", "Skunk",
    "Possum", "Weasel", "Ferret", "Llama", "Alpaca", "Gorilla", "Chimp", "Lemur",
    "Sloth", "Meerkat", "Cheetah", "Leopard", "Jaguar", "Cobra", "Python", "Turtle",
    "Tortoise", "Frog", "Toad", "Lizard", "Gecko", "Iguana", "Salmon", "Shark",
    "Whale", "Seal", "Crab", "Lobster", "Starfish", "Seahorse", "Hawk", "Eagle",
    "Owl", "Vulture", "Pigeon", "Crow", "Swan", "Peacock", "Toucan", "Ostrich",
    "Emu", "Bee", "Ant", "Beetle", "Butterfly", "Moth", "Spider", "Scorpion",
    "Dragonfly",
  ],
  "Food & Drink": [
    "Pizza", "Burger", "Taco", "Sushi", "Pasta", "Noodle", "Waffle", "Bagel",
    "Donut", "Muffin", "Cookie", "Brownie", "Cupcake", "Pretzel", "Popcorn", "Nacho",
    "Burrito", "Curry", "Dumpling", "Ramen", "Lasagna", "Omelet", "Biscuit", "Cheese",
    "Butter", "Mustard", "Ketchup", "Pepper", "Garlic", "Onion", "Carrot", "Potato",
    "Tomato", "Broccoli", "Pickle", "Avocado", "Banana", "Mango", "Lemon", "Cherry",
    "Peach", "Grape", "Melon", "Coconut", "Pineapple", "Coffee", "Espresso", "Latte",
    "Cocoa", "Lemonade", "Soda", "Smoothie", "Milkshake", "Cider", "Wine", "Whiskey",
    "Vodka", "Cocktail", "Champagne", "Soup", "Salad", "Steak", "Bacon", "Sausage",
    "Meatball", "Toast", "Cereal",
  ],
  "Places & Travel": [
    "Airport", "Hotel", "Hostel", "Beach", "Canyon", "Cavern", "Village", "Palace",
    "Museum", "Stadium", "Theater", "Market", "Subway", "Station", "Cabin", "Tent",
    "Suitcase", "Backpack", "Ticket", "Luggage", "Cruise", "Ferry", "Railway", "Tunnel",
    "Monument", "Temple", "Mosque", "Cathedral", "Safari", "Resort", "Campground", "Lobby",
    "Balcony", "Terrace", "Plaza", "Boulevard", "Alley", "Highway", "Crossroads", "Metropolis",
    "Capital", "Province", "Continent", "Peninsula", "Archipelago", "Hilltop", "Waterfront", "Lodge",
    "Souvenir",
  ],
  "Sports & Games": [
    "Soccer", "Baseball", "Basketball", "Tennis", "Golf", "Hockey", "Boxing", "Wrestling",
    "Fencing", "Archery", "Bowling", "Darts", "Chess", "Checkers", "Poker", "Dominoes",
    "Jenga", "Charades", "Puzzle", "Trophy", "Medal", "Referee", "Goalie", "Striker",
    "Dribble", "Sprint", "Hurdle", "Javelin", "Discus", "Relay", "Snowboard", "Surfing",
    "Skiing", "Skating", "Kayak", "Canoe", "Rowing", "Sailing", "Cycling", "Triathlon",
    "Gymnast", "Jockey", "Racket", "Paddle", "Bullseye", "Umpire", "Champion", "Playbook",
    "Huddle", "Penalty", "Overtime", "Dugout", "Podium", "Slalom",
  ],
  "Music": [
    "Drum", "Trumpet", "Trombone", "Saxophone", "Clarinet", "Flute", "Harp", "Cello",
    "Banjo", "Ukulele", "Accordion", "Harmonica", "Tuba", "Bagpipes", "Synthesizer", "Microphone",
    "Speaker", "Headphones", "Vinyl", "Cassette", "Record", "Concert", "Festival", "Orchestra",
    "Chorus", "Melody", "Rhythm", "Harmony", "Chord", "Tempo", "Lyric", "Ballad",
    "Anthem", "Encore", "Opera", "Jazz", "Blues", "Reggae", "Polka", "Waltz",
    "Tango", "Disco", "Karaoke", "Mixtape", "Playlist", "Album", "Remix", "Sitar",
    "Bongo", "Tambourine", "Metronome", "Conductor", "Baton", "Stage", "Spotlight",
  ],
  "Science & Space": [
    "Atom", "Molecule", "Electron", "Proton", "Neutron", "Gravity", "Laser", "Prism",
    "Microscope", "Lens", "Astronaut", "Asteroid", "Comet", "Meteor", "Galaxy", "Orbit",
    "Planet", "Moon", "Saturn", "Mars", "Jupiter", "Venus", "Mercury", "Pluto",
    "Quasar", "Supernova", "Vacuum", "Fossil", "Dinosaur", "Lab", "Experiment", "Hypothesis",
    "Formula", "Chemistry", "Physics", "Biology", "Genome", "Cell", "Bacteria", "Virus",
    "Vaccine", "Enzyme", "Fusion", "Plasma", "Crystal", "Circuit", "Battery", "Voltage",
    "Quantum", "Photon", "Radar", "Sonar", "Oxygen", "Nitrogen", "Carbon", "Helium",
    "Hydrogen",
  ],
  "Jobs & Careers": [
    "Doctor", "Nurse", "Teacher", "Pilot", "Chef", "Farmer", "Lawyer", "Judge",
    "Plumber", "Electrician", "Carpenter", "Mechanic", "Dentist", "Surgeon", "Firefighter", "Soldier",
    "Sailor", "Miner", "Barber", "Tailor", "Baker", "Butcher", "Librarian", "Janitor",
    "Cashier", "Waiter", "Bartender", "Actor", "Singer", "Dancer", "Painter", "Sculptor",
    "Architect", "Engineer", "Scientist", "Detective", "Spy", "Magician", "Clown", "Juggler",
    "Cowboy", "Ranger", "Diplomat", "Mayor", "Accountant", "Banker", "Journalist", "Editor",
    "Photographer", "Programmer", "Veterinarian", "Pharmacist",
  ],
  "Home & Household": [
    "Sofa", "Couch", "Chair", "Table", "Lamp", "Pillow", "Blanket", "Curtain",
    "Carpet", "Shelf", "Drawer", "Closet", "Attic", "Basement", "Kitchen", "Bathroom",
    "Bedroom", "Garage", "Porch", "Fridge", "Oven", "Toaster", "Blender", "Microwave",
    "Dishwasher", "Vacuum", "Broom", "Mop", "Bucket", "Sponge", "Soap", "Shampoo",
    "Towel", "Faucet", "Sink", "Bathtub", "Toilet", "Doorbell", "Keyhole", "Hinge",
    "Hammer", "Wrench", "Screwdriver", "Toolbox", "Clock", "Calendar", "Stapler", "Eraser",
    "Ruler", "Crayon", "Marker", "Paperclip",
  ],
  "Fantasy & Myth": [
    "Wizard", "Witch", "Goblin", "Troll", "Elf", "Dwarf", "Giant", "Mermaid",
    "Centaur", "Griffin", "Phoenix", "Kraken", "Yeti", "Bigfoot", "Werewolf", "Zombie",
    "Ghoul", "Banshee", "Gremlin", "Sphinx", "Minotaur", "Cyclops", "Hydra", "Pegasus",
    "Gargoyle", "Sorcerer", "Enchanter", "Potion", "Spell", "Wand", "Sword", "Shield",
    "Armor", "Dungeon", "Quest", "Prophecy", "Oracle", "Kingdom", "Throne", "Crown",
    "Scepter", "Amulet", "Relic", "Curse", "Riddle", "Labyrinth", "Familiar", "Grimoire",
  ],
  "Vehicles": [
    "Car", "Truck", "Bus", "Van", "Taxi", "Tractor", "Bulldozer", "Ambulance",
    "Scooter", "Motorcycle", "Bicycle", "Tricycle", "Skateboard", "Sled", "Wagon", "Carriage",
    "Rickshaw", "Tram", "Train", "Locomotive", "Airplane", "Helicopter", "Glider", "Blimp",
    "Hovercraft", "Yacht", "Raft", "Tugboat", "Spaceship", "Jetpack", "Limousine", "Convertible",
    "Minivan", "Forklift", "Snowmobile", "Segway", "Monorail", "Gondola", "Hearse", "Trailer",
    "Caravan", "Jeep", "Pickup", "Sedan", "Hatchback",
  ],
  "Holidays & Celebrations": [
    "Birthday", "Wedding", "Christmas", "Halloween", "Easter", "Hanukkah", "Diwali", "Thanksgiving",
    "Valentine", "Parade", "Fireworks", "Costume", "Pinata", "Confetti", "Party", "Picnic",
    "Barbecue", "Reunion", "Anniversary", "Graduation", "Ceremony", "Feast", "Gift", "Ribbon",
    "Present", "Cake", "Sparkler", "Tinsel", "Wreath", "Stocking", "Pumpkin", "Turkey",
    "Eggnog", "Mistletoe", "Snowman", "Bonfire", "Garland", "Cheers", "Masquerade",
  ],
  "Nature & Weather": [
    "Rain", "Snow", "Sleet", "Hail", "Fog", "Mist", "Lightning", "Hurricane",
    "Monsoon", "Drought", "Breeze", "Gale", "Storm", "Sunshine", "Sunset", "Sunrise",
    "Dew", "Frost", "Icicle", "Meadow", "Prairie", "Tundra", "Savanna", "Swamp",
    "Marsh", "Valley", "Cliff", "Boulder", "Pebble", "Sand", "Dune", "Lagoon",
    "Geyser", "Stream", "Creek", "Pond", "Lake", "Reef", "Coral", "Moss",
    "Fern", "Bamboo", "Cactus", "Pine", "Maple", "Willow", "Oak", "Blossom",
    "Petal", "Acorn", "Pinecone",
  ],
};

// Extra categories: every wordlists/<name>.txt becomes a category called <name>.
// One word per line. Lines starting with # are comments. Restart the server after editing.
const fs = require("fs");
const WORDLIST_DIR = path.join(__dirname, "wordlists");
const OPT_IN = new Set(["mature"]); // categories left out of "All words" (host must pick them)
if (fs.existsSync(WORDLIST_DIR)) {
  for (const file of fs.readdirSync(WORDLIST_DIR).sort()) {
    if (!file.endsWith(".txt")) continue;
    const name = path.basename(file, ".txt");
    const words = fs.readFileSync(path.join(WORDLIST_DIR, file), "utf8")
      .split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
    if (words.length) CATEGORIES[name] = words;
  }
}

const ALL_WORDS = (() => {
  const seen = new Set();
  return Object.entries(CATEGORIES).filter(([name]) => !OPT_IN.has(name)).flatMap(([, w]) => w).filter((w) => {
    const k = w.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
})();
const CATEGORY_KEYS = ["all", ...Object.keys(CATEGORIES)];

const app = express();
app.use(express.static(path.join(__dirname, "public")));
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}
// Set PUBLIC_URL when hosting online so QR codes point at the public address.
const BASE_URL = process.env.PUBLIC_URL || `http://${lanAddress()}:${PORT}`;

const clean = (s, max = 20) => String(s ?? "").trim().slice(0, max);
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
// Two clues count as the same idea when they match exactly, or when one is a
// word-start of the other (gas/gasoline, girl/girlfriend). The shorter word must
// be at least 4 letters so short words don't swallow unrelated ones.
const MIN_STEM = 4;
// Short roots that the rule above would miss. Each entry is [root, derived form].
const EXTRA_ROOTS = [["gas", "gasoline"], ["gas", "gases"]];
const sameIdea = (a, b) => {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= MIN_STEM && long.startsWith(short)) return true;
  return EXTRA_ROOTS.some(([r, d]) => (a === r && b === d) || (a === d && b === r));
};
const cleanPid = (v) => (/^[\w-]{8,64}$/.test(String(v)) ? String(v) : null);
const getRoom = (code) => rooms.get(String(code || "").trim().toUpperCase());
const find = (room, pid) => room.players.find((p) => p.id === pid);
const active = (room) => room.players.filter((p) => p.connected);
// Players who take part in rounds. Late joiners are "waiting" until the next round starts.
const seated = (room) => active(room).filter((p) => !p.waiting);
const givers = (room) => seated(room).filter((p) => p.id !== room.guesserId);
const votersOf = (room) => givers(room).filter((p) => room.clues.has(p.id));

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}

// ---------- words & settings ----------
function parseWords(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || "").split(/[\n,;]+/)) {
    const w = raw.trim().replace(/\s+/g, " ").slice(0, 30);
    const k = norm(w);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= 300) break;
  }
  return out;
}

const categoryWords = (key) => (key === "all" ? ALL_WORDS : CATEGORIES[key] || []);

const CATEGORY_LIST = CATEGORY_KEYS.map((key) => ({
  key,
  label: key === "all" ? "All words" : key,
  count: categoryWords(key).length,
}));

function buildPool(room) {
  const { wordMode, customWords, category } = room.settings;
  const built = categoryWords(category);
  const list = wordMode === "custom" ? customWords : wordMode === "both" ? [...built, ...customWords] : built;
  const seen = new Set();
  return list.filter((w) => {
    const k = norm(w);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function applySettings(room, s) {
  if (!s || typeof s !== "object") return;
  const secs = Number(s.clueSeconds);
  if (TIMER_CHOICES.includes(secs)) room.settings.clueSeconds = secs;
  if (WORD_MODES.includes(s.wordMode)) room.settings.wordMode = s.wordMode;
  if (CATEGORY_KEYS.includes(s.category)) room.settings.category = s.category;
  if (typeof s.customWords === "string") room.settings.customWords = parseWords(s.customWords);
  if (typeof s.live === "boolean") room.settings.live = s.live;
}

// Returns the clue a player wrote this round (and whether it survived the duplicate check).
// Player IDs are secrets used for rejoining, so they are never sent to clients.
function myClueOf(room, pid) {
  if (!room.finalClues) return null;
  const idx = [...room.clues.keys()].indexOf(pid);
  const c = idx >= 0 ? room.finalClues[idx] : null;
  if (!c) return null;
  const hidden = room.hidden.has(idx);
  const revealed = room.revealAnyway.has(idx);
  return {
    text: c.text, valid: c.valid, hidden, revealed,
    canReveal: room.status === "guess" && !c.valid && hidden && !revealed,
    canChange: room.status === "guess" && (!hidden || revealed),
  };
}

// What each viewer sees of the clues. The guesser never sees clues during voting,
// and hidden clues are removed before guessing and marked after the reveal.
function clueListFor(room, isGuesser) {
  const list = room.finalClues || [];
  const revealed = room.status === "reveal" || room.status === "over";
  if (room.status === "vote") {
    if (isGuesser) return null;
    return list.map((c, i) => ({ index: i, text: c.text, valid: c.valid, name: null, hidden: false }));
  }
  if (room.status === "guess" && !room.settings.live) {
    return list
      .map((c, i) => ({ text: c.text, valid: c.valid, name: null, hidden: false, revealed: room.revealAnyway.has(i), i }))
      .filter((c) => !room.hidden.has(c.i) || c.revealed)
      .map(({ i, ...c }) => c);
  }
  if (revealed) {
    return list.map((c, i) => ({
      text: c.text, valid: c.valid, name: c.name,
      hidden: room.hidden.has(i) && !room.revealAnyway.has(i),
      revealed: room.revealAnyway.has(i),
    }));
  }
  return null;
}

// Vote panel state for one viewer during the voting stage.
function voteInfo(room, pid) {
  if (room.status !== "vote") return null;
  const voters = votersOf(room);
  return {
    isVoter: voters.some((p) => p.id === pid),
    mine: [...(room.votes.get(pid) || [])],
    locked: room.locked.has(pid),
    lockedCount: voters.filter((p) => room.locked.has(p.id)).length,
    voterCount: voters.length,
  };
}

// ---------- state sent to each player ----------
function view(room, pid) {
  const lobby = room.status === "lobby";
  const revealed = room.status === "reveal" || room.status === "over";
  const isGuesser = pid === room.guesserId;
  const isHost = pid === room.hostId;
  const s = room.settings;
  const pool = lobby ? buildPool(room) : null;
  return {
    code: room.code,
    qr: room.qr,
    status: room.status,
    round: room.round,
    maxRounds: lobby ? Math.min(MAX_ROUNDS, pool.length) : room.maxRounds,
    poolSize: pool ? pool.length : null,
    score: room.score,
    meId: pid,
    waiting: !!find(room, pid)?.waiting,
    poll: room.poll ? pollInfo(room, pid) : null,
    isHost,
    hostId: room.hostId,
    guesserId: room.guesserId,
    guesserName: find(room, room.guesserId)?.name || null,
    isGuesser,
    word: isGuesser && !revealed ? null : room.word,
    live: s.live,
    // In person mode, clue texts stay on the clue givers' phones until the round is revealed.
    clues: clueListFor(room, isGuesser),
    vote: voteInfo(room, pid),
    myClue: room.status === "guess" && !isGuesser ? myClueOf(room, pid) : null,
    result: room.result,
    clueSeconds: s.clueSeconds,
    msLeft: room.status === "clue" && room.deadline ? Math.max(0, room.deadline - Date.now()) : null,
    categories: CATEGORY_LIST,
    settings: {
      clueSeconds: s.clueSeconds,
      wordMode: s.wordMode,
      category: s.category,
      customWords: isHost ? s.customWords : [],
      customCount: s.customWords.length,
      live: s.live,
    },
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      waiting: !!p.waiting,
      locked: room.locked.has(p.id),
      submitted: room.clues.has(p.id),
    })),
  };
}

function broadcast(room) {
  for (const p of room.players) {
    if (p.connected && p.sock) io.to(p.sock).emit("state", view(room, p.id));
  }
}

// ---------- round flow ----------
// The next guesser is the next seated player after the previous guesser, in seat order.
// Newcomers take their place at the end of the seat order, so nobody guesses twice in a row.
function nextGuesser(room) {
  const ready = seated(room);
  if (ready.length === 0) return null;
  const i = room.players.findIndex((p) => p.id === room.guesserId);
  for (let k = 1; k <= room.players.length; k++) {
    const p = room.players[(i + k) % room.players.length];
    if (ready.includes(p)) return p;
  }
  return ready[0];
}

// reroll: the guesser picked a different word. Same round, same guesser, and the clues are
// sent again for the new word.
function startRound(room, { reroll = false } = {}) {
  const pool = buildPool(room).filter((w) => !room.usedWords.has(w));
  room.word = pool[Math.floor(Math.random() * pool.length)];
  room.usedWords.add(room.word);
  if (!reroll) room.round += 1;
  room.clues = new Map();
  room.finalClues = null;
  room.result = null;
  room.votes = new Map();
  room.locked = new Set();
  room.hidden = new Set();
  room.revealAnyway = new Set();
  // Everyone who joined mid-game is seated from this round on.
  room.players.forEach((p) => { p.waiting = false; });
  if (!reroll) room.guesserId = nextGuesser(room)?.id ?? null;
  room.status = "clue";
  startClueTimer(room);
  broadcast(room);
}

function startClueTimer(room) {
  clearTimeout(room.timer);
  room.deadline = null;
  const secs = room.settings.clueSeconds;
  if (!secs) return;
  room.deadline = Date.now() + secs * 1000;
  room.timer = setTimeout(() => {
    finishClues(room, true);
    broadcast(room);
  }, secs * 1000 + CLUE_GRACE_MS);
}

// Runs when every active clue-giver has submitted, or (force) when time is up.
function finishClues(room, force = false) {
  if (room.status !== "clue") return;
  const g = givers(room);
  const allIn = g.length > 0 && g.every((p) => room.clues.has(p.id));
  if (!allIn && !force) return;

  clearTimeout(room.timer);
  room.deadline = null;

  if (room.clues.size === 0) {
    room.result = { correct: false, guess: null, skipped: true };
    room.status = "reveal";
    return;
  }

  const entries = [...room.clues.entries()].map(([pid, text]) => ({ pid, text, k: norm(text) }));
  room.finalClues = entries.map((e) => {
    const dupe = entries.some((o) => o !== e && sameIdea(e.k, o.k));
    return {
      name: find(room, e.pid)?.name || "?",
      text: e.text,
      valid: !dupe && e.k !== norm(room.word),
    };
  });
  room.status = "vote";
  checkVotes(room);
}

// Once every voter has locked in, hide clues that a strict majority voted to hide.
function checkVotes(room) {
  if (room.status !== "vote") return;
  const voters = votersOf(room);
  if (!voters.every((p) => room.locked.has(p.id))) return;
  room.hidden = new Set();
  (room.finalClues || []).forEach((_, i) => {
    const count = voters.filter((p) => room.votes.get(p.id)?.has(i)).length;
    if (count * 2 > voters.length) room.hidden.add(i);
  });
  room.status = "guess";
}

// Ends the current game but keeps the scores on screen until someone starts again.
function endGame(room) {
  clearTimeout(room.timer);
  room.deadline = null;
  room.poll = null;
  room.status = "over";
}

// Back to the lobby with everyone still connected. Offline players are dropped.
function resetToLobby(room) {
  clearTimeout(room.timer);
  room.players = active(room);
  room.players.forEach((p) => { p.waiting = false; });
  Object.assign(room, {
    status: "lobby", round: 0, score: 0, guesserId: null, word: null,
    usedWords: new Set(), clues: new Map(), finalClues: null, result: null, deadline: null,
    votes: new Map(), locked: new Set(), hidden: new Set(), revealAnyway: new Set(), poll: null,
  });
}

// A proposal passes once more than half of connected players agree, and fails once
// a majority can no longer agree.
function checkPoll(room) {
  const poll = room.poll;
  if (!poll) return;
  const voters = active(room);
  const n = voters.length;
  const yes = voters.filter((p) => poll.votes.get(p.id) === true).length;
  const no = voters.filter((p) => poll.votes.get(p.id) === false).length;
  if (yes * 2 > n) {
    if (poll.type === "end") endGame(room);
    else resetToLobby(room);
    return;
  }
  if (no * 2 >= n) room.poll = null;
}

function pollInfo(room, pid) {
  const voters = active(room);
  const n = voters.length;
  const yes = voters.filter((p) => room.poll.votes.get(p.id) === true).length;
  return {
    type: room.poll.type,
    startedBy: room.poll.startedBy,
    yes,
    total: n,
    needed: Math.floor(n / 2) + 1,
    myVote: room.poll.votes.has(pid) ? room.poll.votes.get(pid) : null,
  };
}

function afterDrop(room) {
  if (active(room).length === 0) {
    clearTimeout(room.timer);
    room.cleanup = setTimeout(() => rooms.delete(room.code), ROOM_GRACE_MS);
    return;
  }
  const host = find(room, room.hostId);
  if (!host || !host.connected) room.hostId = active(room)[0].id;
  finishClues(room);
  checkVotes(room);
  checkPoll(room);
  broadcast(room);
}

// ---------- sockets ----------
io.on("connection", (socket) => {
  let myRoom = null;
  let myPid = null;

  const attach = (room, p) => {
    p.sock = socket.id;
    p.connected = true;
    clearTimeout(p.dropTimer);
    clearTimeout(room.cleanup);
    if (p.id === room.founderId) room.hostId = p.id; // original host gets the crown back
    myRoom = room;
    myPid = p.id;
  };

  socket.on("create", async ({ name, pid } = {}, cb = () => {}) => {
    const n = clean(name);
    const id = cleanPid(pid);
    if (!n) return cb({ ok: false, error: "Enter a name first." });
    if (!id) return cb({ ok: false, error: "Couldn't set up your player ID. Reload and try again." });
    try {
      const code = makeCode();
      const qr = await QRCode.toDataURL(`${BASE_URL}/?room=${code}`, { width: 440, margin: 1 });
      const room = {
        code, qr,
        founderId: id,
        hostId: id,
        players: [{ id, name: n, sock: null, connected: true }],
        settings: { clueSeconds: 0, wordMode: "builtin", category: "all", customWords: [], live: false },
        status: "lobby",
        round: 0,
        maxRounds: MAX_ROUNDS,
        score: 0,
        guesserId: null,
        word: null,
        usedWords: new Set(),
        clues: new Map(),
        finalClues: null,
        poll: null,         // open proposal to end the game or start a new one
        votes: new Map(),   // clue giver id -> Set of clue indexes they want hidden
        locked: new Set(),  // clue givers who have locked in their vote
        hidden: new Set(),  // clue indexes hidden from the guesser by majority vote
        revealAnyway: new Set(), // hidden duplicate clues their giver chose to show anyway
        result: null,
        deadline: null,
      };
      rooms.set(code, room);
      attach(room, room.players[0]);
      cb({ ok: true, code });
      broadcast(room);
    } catch (e) {
      cb({ ok: false, error: "Couldn't create the room." });
    }
  });

  socket.on("join", ({ code, name, pid } = {}, cb = () => {}) => {
    const room = getRoom(code);
    const id = cleanPid(pid);
    const n = clean(name);
    if (!room) return cb({ ok: false, error: "No room with that code." });
    if (!id) return cb({ ok: false, error: "Couldn't set up your player ID. Reload and try again." });

    const existing = find(room, id);
    if (existing) {
      attach(room, existing);
      cb({ ok: true, code: room.code });
      return broadcast(room);
    }
    if (!n) return cb({ ok: false, error: "Enter a name first." });
    if (room.players.length >= MAX_PLAYERS) return cb({ ok: false, error: "That room is full." });
    if (room.players.some((p) => p.name.toLowerCase() === n.toLowerCase())) {
      return cb({ ok: false, error: "That name is taken." });
    }
    // Joining after the game has started: sit out until the next round begins.
    const midGame = room.status !== "lobby";
    const p = { id, name: n, sock: null, connected: true, waiting: midGame };
    room.players.push(p);
    attach(room, p);
    cb({ ok: true, code: room.code });
    broadcast(room);
  });

  socket.on("rejoin", ({ code, pid } = {}, cb = () => {}) => {
    const room = getRoom(code);
    const p = room && find(room, cleanPid(pid));
    if (!p) return cb({ ok: false });
    attach(room, p);
    cb({ ok: true, code: room.code });
    broadcast(room);
  });

  socket.on("leave", () => {
    const room = myRoom;
    const p = room && find(room, myPid);
    if (!p) return;
    clearTimeout(p.dropTimer);
    p.sock = null;
    p.connected = false;
    if (room.status === "lobby") room.players = room.players.filter((x) => x !== p);
    myRoom = null;
    myPid = null;
    afterDrop(room);
  });

  socket.on("settings", (s) => {
    const room = myRoom;
    if (!room || room.status !== "lobby" || myPid !== room.hostId) return;
    applySettings(room, s);
    broadcast(room);
  });

  socket.on("start", ({ settings } = {}, cb = () => {}) => {
    const room = myRoom;
    if (!room || room.status !== "lobby" || myPid !== room.hostId) return;
    if (active(room).length < 3) return cb({ ok: false, error: "Need at least 3 players." });
    applySettings(room, settings);
    const pool = buildPool(room);
    if (pool.length === 0) return cb({ ok: false, error: "Add some words first, or switch to the built-in list." });
    room.maxRounds = Math.min(MAX_ROUNDS, pool.length);
    room.round = 0;
    room.score = 0;
    room.guesserId = null;
    room.usedWords = new Set();
    cb({ ok: true });
    startRound(room);
  });

  socket.on("clue", ({ text } = {}) => {
    const room = myRoom;
    if (!room || room.status !== "clue") return;
    const p = find(room, myPid);
    if (!p || !p.connected || p.waiting || p.id === room.guesserId) return;
    const word = clean(text, 30).split(/\s+/)[0] || "";
    if (!norm(word)) return;
    room.clues.set(p.id, word);
    finishClues(room);
    broadcast(room);
  });

  socket.on("vote", ({ index, hide } = {}) => {
    const room = myRoom;
    if (!room || room.status !== "vote") return;
    const p = find(room, myPid);
    if (!p || !votersOf(room).includes(p) || room.locked.has(p.id)) return;
    if (!Number.isInteger(index) || index < 0 || index >= room.finalClues.length) return;
    const set = room.votes.get(p.id) || new Set();
    if (hide) set.add(index);
    else set.delete(index);
    room.votes.set(p.id, set);
    broadcast(room);
  });

  socket.on("lockVote", () => {
    const room = myRoom;
    if (!room || room.status !== "vote") return;
    const p = find(room, myPid);
    if (!p || !votersOf(room).includes(p)) return;
    room.locked.add(p.id);
    checkVotes(room);
    broadcast(room);
  });

  socket.on("guess", ({ text } = {}) => {
    const room = myRoom;
    if (!room || room.status !== "guess" || myPid !== room.guesserId) return;
    const g = clean(text, 30);
    const correct = norm(g) !== "" && norm(g) === norm(room.word);
    room.result = { correct, guess: g, skipped: false };
    if (correct) room.score += 1;
    room.status = "reveal";
    broadcast(room);
  });

  // In person mode: the guesser judges the answer themselves instead of typing it.
  socket.on("judge", ({ correct } = {}) => {
    const room = myRoom;
    if (!room || room.status !== "guess" || myPid !== room.guesserId) return;
    const ok = correct === true;
    room.result = { correct: ok, guess: null, skipped: false };
    if (ok) room.score += 1;
    room.status = "reveal";
    broadcast(room);
  });

  // A clue giver whose duplicate clue was voted hidden can choose to show it to the guesser anyway.
  socket.on("reveal", () => {
    const room = myRoom;
    if (!room || room.status !== "guess") return;
    const p = find(room, myPid);
    const idx = p ? [...room.clues.keys()].indexOf(p.id) : -1;
    const c = idx >= 0 ? room.finalClues[idx] : null;
    if (!c || c.valid || !room.hidden.has(idx)) return;
    room.revealAnyway.add(idx);
    broadcast(room);
  });

  // During the guess, a clue giver can replace their clue with a different word, unless the
  // group voted it hidden (a hidden duplicate must be revealed first). The new word must not
  // match the secret word or any other clue, so it is always valid.
  socket.on("changeClue", ({ text } = {}, cb = () => {}) => {
    const room = myRoom;
    const p = room && find(room, myPid);
    if (!room || room.status !== "guess" || !p) return cb({ ok: false, error: "Clues can only be changed during the guess." });
    const idx = [...room.clues.keys()].indexOf(p.id);
    if (idx < 0 || (room.hidden.has(idx) && !room.revealAnyway.has(idx))) {
      return cb({ ok: false, error: "This clue was voted hidden. Reveal it first." });
    }
    const word = clean(text, 30).split(/\s+/)[0] || "";
    const k = norm(word);
    if (!k) return cb({ ok: false, error: "Enter a one-word clue." });
    if (k === norm(room.word)) return cb({ ok: false, error: "That's the secret word. Try a different clue." });
    const others = [...room.clues.entries()].filter(([pid]) => pid !== p.id);
    if (others.some(([, t]) => sameIdea(k, norm(t)))) return cb({ ok: false, error: "That matches another clue. Try a different word." });
    room.clues.set(p.id, word);
    room.finalClues[idx] = { name: room.finalClues[idx].name, text: word, valid: true };
    cb({ ok: true });
    broadcast(room);
  });

  // The guesser can swap the secret word during the guess. It isn't a skipped round.
  socket.on("newWord", (_, cb = () => {}) => {
    const room = myRoom;
    if (!room || room.status !== "guess" || myPid !== room.guesserId) return cb({ ok: false, error: "Only the guesser can do this now." });
    const left = buildPool(room).filter((w) => !room.usedWords.has(w)).length;
    if (left === 0) return cb({ ok: false, error: "There are no other words left." });
    cb({ ok: true });
    startRound(room, { reroll: true });
  });

  socket.on("next", () => {
    const room = myRoom;
    if (!room || room.status !== "reveal" || myPid !== room.hostId) return;
    if (room.round >= room.maxRounds) {
      room.status = "over";
      return broadcast(room);
    }
    startRound(room);
  });

  // Host escape hatch, e.g. when the guesser has gone offline.
  socket.on("skip", () => {
    const room = myRoom;
    if (!room || myPid !== room.hostId || !["clue", "vote", "guess"].includes(room.status)) return;
    clearTimeout(room.timer);
    room.deadline = null;
    room.result = { correct: false, guess: null, skipped: true };
    room.status = "reveal";
    broadcast(room);
  });

  // Any player can propose ending the game or starting a new one. Everyone else votes.
  socket.on("poll", ({ type } = {}, cb = () => {}) => {
    const room = myRoom;
    const p = room && find(room, myPid);
    if (!room || !p || !p.connected) return cb({ ok: false, error: "Join the room first." });
    if (room.status === "lobby") return cb({ ok: false, error: "The game hasn't started yet." });
    if (!["end", "new"].includes(type)) return cb({ ok: false, error: "Unknown request." });
    if (type === "end" && room.status === "over") return cb({ ok: false, error: "The game is already over." });
    if (room.poll) return cb({ ok: false, error: "A vote is already in progress." });
    room.poll = { type, startedBy: p.name, votes: new Map([[p.id, true]]) };
    cb({ ok: true });
    checkPoll(room);
    broadcast(room);
  });

  socket.on("pollVote", ({ yes } = {}) => {
    const room = myRoom;
    const p = room && find(room, myPid);
    if (!room || !room.poll || !p || !p.connected) return;
    room.poll.votes.set(p.id, yes === true);
    checkPoll(room);
    broadcast(room);
  });

  socket.on("reset", () => {
    const room = myRoom;
    if (!room || room.status !== "over" || myPid !== room.hostId) return;
    resetToLobby(room);
    broadcast(room);
  });

  socket.on("disconnect", () => {
    const room = myRoom;
    const p = room && find(room, myPid);
    if (!p || p.sock !== socket.id) return; // a newer connection already took this seat
    p.connected = false;
    p.sock = null;
    if (room.status === "lobby") {
      p.dropTimer = setTimeout(() => {
        if (p.connected) return;
        room.players = room.players.filter((x) => x !== p);
        afterDrop(room);
      }, LOBBY_GRACE_MS);
    }
    afterDrop(room);
  });
});

server.listen(PORT, () => {
  console.log(`Just One is running. Open ${BASE_URL} on the host device.`);
  console.log("Players scan the QR code shown in the lobby.");
});
