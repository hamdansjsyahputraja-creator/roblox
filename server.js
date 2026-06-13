const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');
const express = require('express');

const app = express();
const HTTP_PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 19131;

// ── Kotak Config ─────────────────────────────────────
const BOX = {
  x1: 0,  y1: 64, z1: 0,
  x2: 9,  y2: 78, z2: 9,
  totalBlocks: 10 * 10 * 15
};

// ── State Mini Game ───────────────────────────────────
let countdownInterval = null;
let countdownSeconds = 0;
let checkInterval = null;

// ── TikTok ───────────────────────────────────────────
const tiktokLive = new WebcastPushConnection('leodandicaprio');

// ── WebSocket Server ──────────────────────────────────
const wss = new WebSocket.Server({ port: WS_PORT });
let minecraftSocket = null;

wss.on('connection', (ws) => {
  console.log('✅ Minecraft terhubung!');
  minecraftSocket = ws;

  const subscribe = JSON.stringify({
    header: {
      version: 1,
      requestId: '00000000-0000-0000-0000-000000000001',
      messagePurpose: 'subscribe',
      messageType: 'commandRequest'
    },
    body: { eventName: 'PlayerMessage' }
  });
  ws.send(subscribe);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      if (data?.body?.statusCode !== undefined && data?.body?.successCount !== undefined) {
        handleBlockCheckResponse(data.body.successCount);
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    console.log('❌ Minecraft disconnect');
    minecraftSocket = null;
    stopCountdown();
    stopChecking();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  setTimeout(() => {
    buildBox();
    startChecking();
  }, 1000);
});

// ── Kirim Command ─────────────────────────────────────
let cmdId = 1;

function sendCommand(command) {
  if (!minecraftSocket || minecraftSocket.readyState !== WebSocket.OPEN) return;

  const msg = JSON.stringify({
    header: {
      version: 1,
      requestId: `00000000-0000-0000-${String(cmdId).padStart(4, '0')}-${String(cmdId++).padStart(12, '0')}`,
      messagePurpose: 'commandRequest',
      messageType: 'commandRequest'
    },
    body: {
      origin: { type: 'player' },
      commandLine: command,
      version: 1
    }
  });

  minecraftSocket.send(msg);
}

// ── Buat Kotak Bedrock ────────────────────────────────
function buildBox() {
  console.log('🏗️ Membangun kotak bedrock...');

  sendCommand(`fill ${BOX.x1 + 1} ${BOX.y1} ${BOX.z1 + 1} ${BOX.x2 - 1} ${BOX.y2} ${BOX.z2 - 1} air`);
  sendCommand(`fill ${BOX.x1} ${BOX.y1} ${BOX.z1} ${BOX.x2} ${BOX.y1} ${BOX.z2} bedrock`);
  sendCommand(`fill ${BOX.x1} ${BOX.y1} ${BOX.z1} ${BOX.x2} ${BOX.y2} ${BOX.z1} bedrock`);
  sendCommand(`fill ${BOX.x1} ${BOX.y1} ${BOX.z2} ${BOX.x2} ${BOX.y2} ${BOX.z2} bedrock`);
  sendCommand(`fill ${BOX.x1} ${BOX.y1} ${BOX.z1} ${BOX.x1} ${BOX.y2} ${BOX.z2} bedrock`);
  sendCommand(`fill ${BOX.x2} ${BOX.y1} ${BOX.z1} ${BOX.x2} ${BOX.y2} ${BOX.z2} bedrock`);

  console.log('✅ Kotak bedrock selesai!');
  sendCommand(`tellraw @a {"rawtext":[{"text":"§b🏗️ Kotak bedrock siap! Mulai isi dengan block!"}]}`);
}

// ── Cek Isi Kotak ─────────────────────────────────────
function startChecking() {
  if (checkInterval) return;
  checkInterval = setInterval(() => {
    if (!minecraftSocket) return;
    sendCommand(
      `testforblocks ${BOX.x1} ${BOX.y1} ${BOX.z1} ${BOX.x2} ${BOX.y2} ${BOX.z2} ${BOX.x1} ${BOX.y1} ${BOX.z1} masked`
    );
  }, 2000);
}

function stopChecking() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

function handleBlockCheckResponse(successCount) {
  const isFull = successCount >= BOX.totalBlocks;

  if (isFull && !countdownInterval) {
    startCountdown();
  } else if (!isFull && countdownInterval) {
    cancelCountdown();
  }
}

// ── Countdown ─────────────────────────────────────────
function startCountdown() {
  console.log('🟢 Kotak penuh! Countdown dimulai...');
  countdownSeconds = 10;

  sendCommand(`tellraw @a {"rawtext":[{"text":"§a§lKOTAK PENUH! Countdown 10 detik dimulai!"}]}`);

  countdownInterval = setInterval(() => {
    if (countdownSeconds > 0) {
      sendCommand(`title @a title §e§l${countdownSeconds}`);
      sendCommand(`title @a subtitle §7Jangan sampai ada block yang hancur!`);
      console.log(`⏱ Countdown: ${countdownSeconds}`);
      countdownSeconds--;
    } else {
      winGame();
    }
  }, 1000);
}

function cancelCountdown() {
  console.log('🔴 Block hancur! Countdown dibatalkan.');
  stopCountdown();
  sendCommand(`title @a title §c§lGAGAL!`);
  sendCommand(`title @a subtitle §7Block hancur! Isi lagi kotaknya.`);
  sendCommand(`tellraw @a {"rawtext":[{"text":"§cCountdown dibatalkan! Ada block yang hancur."}]}`);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  countdownSeconds = 0;
}

// ── Menang ────────────────────────────────────────────
function winGame() {
  stopCountdown();
  stopChecking();

  console.log('🎉 MENANG!');

  sendCommand(`title @a title §6§lMENANG! 🎉`);
  sendCommand(`title @a subtitle §e§lViewer gagal hancurin kotak!`);
  sendCommand(`tellraw @a {"rawtext":[{"text":"§6§l🎉 SELAMAT! Kamu berhasil mempertahankan kotak!"}]}`);

  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      sendCommand(`summon fireworks_rocket ~ ~ ~`);
      sendCommand(`summon fireworks_rocket ~2 ~ ~`);
      sendCommand(`summon fireworks_rocket ~-2 ~ ~`);
      sendCommand(`summon fireworks_rocket ~ ~ ~2`);
      sendCommand(`summon fireworks_rocket ~ ~ ~-2`);
    }, i * 600);
  }

  setTimeout(() => {
    console.log('🔄 Game reset, siap main lagi');
    buildBox();
    sendCommand(`tellraw @a {"rawtext":[{"text":"§7Game reset. Isi kotak lagi untuk main!"}]}`);
    startChecking();
  }, 10000);
}

// ── Spawn TNT ──────────────────────────────────────────
function spawnTNT(count) {
  console.log(`💣 Spawn ${count} TNT ke dalam kotak`);

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const randX = BOX.x1 + Math.floor(Math.random() * 10);
      const randZ = BOX.z1 + Math.floor(Math.random() * 10);
      const spawnY = BOX.y2 + 10;

      sendCommand(`summon tnt ${randX} ${spawnY} ${randZ}`);
    }, i * 300);
  }
}

// ── TikTok Events ──────────────────────────────────────
tiktokLive.on('connected', () => {
  console.log('🎵 TikTok Live terhubung: leodandicaprio');
});

tiktokLive.on('disconnected', () => {
  console.log('🔴 TikTok Live disconnect');
});

tiktokLive.on('error', (err) => {
  console.error('TikTok error:', err.message);
});

tiktokLive.on('follow', (data) => {
  console.log(`👤 Follow dari: ${data.uniqueId} → 1 TNT`);
  sendCommand(`tellraw @a {"rawtext":[{"text":"§e${data.uniqueId} follow! 💣 +1 TNT"}]}`);
  spawnTNT(1);
});

tiktokLive.on('gift', (data) => {
  if (data.giftType === 1 || data.repeatEnd) {
    const tntCount = data.diamondCount * data.repeatCount;
    console.log(`🎁 Gift dari: ${data.uniqueId} | ${data.giftName} x${data.repeatCount} = ${tntCount} TNT`);
    sendCommand(`tellraw @a {"rawtext":[{"text":"§6${data.uniqueId} kasih ${data.giftName} x${data.repeatCount}! 💣 +${tntCount} TNT"}]}`);
    spawnTNT(tntCount);
  }
});

// ── Connect TikTok ─────────────────────────────────────
tiktokLive.connect().catch((err) => {
  console.error('Gagal konek TikTok:', err.message);
});

// ── HTTP Server ────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    minecraft: minecraftSocket ? 'connected' : 'disconnected',
    tiktok: 'leodandicaprio',
    countdown: countdownInterval ? countdownSeconds : 'inactive'
  });
});

app.listen(HTTP_PORT, () => {
  console.log(`🌐 HTTP server jalan di port ${HTTP_PORT}`);
  console.log(`🔌 WebSocket server jalan di port ${WS_PORT}`);
});