const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ROBLOX_SECRET = process.env.ROBLOX_SECRET || 'roblox123';
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || '';
const TIKTOK_SESSION_ID = process.env.TIKTOK_SESSION_ID || '';

// ============================================================
// GIFT CONFIG
// ============================================================

const GIFT_RULES = {
  'rose':   { type: 'jail',   seconds: 10  },
  'mawar':  { type: 'jail',   seconds: 10  },
  'rosa':   { type: 'jail',   seconds: 100 },
  'coffee': { type: 'reduce', seconds: 5   },
  'kopi':   { type: 'reduce', seconds: 5   },
};

// ============================================================
// EVENT QUEUE
// ============================================================

const eventQueue = [];

function pushEvent(event) {
  event.timestamp = Date.now();
  eventQueue.push(event);
  console.log('[EVENT]', JSON.stringify(event));
}

// ============================================================
// TIKTOK CONNECTION
// ============================================================

let tiktokConnection = null;

function connectTikTok(username) {
  if (tiktokConnection) {
    tiktokConnection.disconnect();
  }

  tiktokConnection = new WebcastPushConnection(username, {
    sessionId: TIKTOK_SESSION_ID,
    enableExtendedGiftInfo: true,
  });

  tiktokConnection.connect()
    .then(state => console.log(`[TikTok] Connected: ${username} | Room: ${state.roomId}`))
    .catch(err => console.error('[TikTok] Connect error:', err.message));

  // --- GIFT ---
  tiktokConnection.on('gift', (data) => {
    const giftName = (data.giftName || '').toLowerCase().trim();
    const rule = GIFT_RULES[giftName];

    if (rule) {
      pushEvent({
        type: rule.type === 'reduce' ? 'reduce_jail' : 'jail',
        username: data.uniqueId,
        nickname: data.nickname,
        seconds: rule.seconds,
        giftName: data.giftName,
      });
    } else {
      // Gift lain: koin × 10 detik
      const coins = data.diamondCount || data.giftCost || 1;
      pushEvent({
        type: 'jail',
        username: data.uniqueId,
        nickname: data.nickname,
        seconds: coins * 10,
        giftName: data.giftName,
        coins: coins,
      });
    }
  });

  // --- FOLLOW ---
  tiktokConnection.on('follow', (data) => {
    pushEvent({
      type: 'respawn',
      username: data.uniqueId,
      nickname: data.nickname,
    });
  });

  tiktokConnection.on('disconnected', () => {
    console.warn('[TikTok] Disconnected. Reconnecting in 5s...');
    setTimeout(() => connectTikTok(username), 5000);
  });

  tiktokConnection.on('error', (err) => {
    console.error('[TikTok] Error:', err.message);
  });
}

if (TIKTOK_USERNAME) {
  connectTikTok(TIKTOK_USERNAME);
}

// ============================================================
// MIDDLEWARE AUTH
// ============================================================

function authMiddleware(req, res, next) {
  const secret = req.headers['x-secret'];
  if (secret !== ROBLOX_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ============================================================
// ENDPOINTS
// ============================================================

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    connected: tiktokConnection?.isConnected || false,
    queueLength: eventQueue.length,
  });
});

app.get('/roblox-events', authMiddleware, (req, res) => {
  const events = [...eventQueue];
  eventQueue.length = 0;
  res.json({ events });
});

app.post('/connect', authMiddleware, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  connectTikTok(username);
  res.json({ status: 'connecting', username });
});

app.post('/disconnect', authMiddleware, (req, res) => {
  if (tiktokConnection) tiktokConnection.disconnect();
  res.json({ status: 'disconnected' });
});

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});