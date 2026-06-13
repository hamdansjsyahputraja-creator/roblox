const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const PORT = process.env.PORT || 3000;
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || "username_tiktok_kamu";
const TIKTOK_SESSION_ID = process.env.TIKTOK_SESSION_ID || "";

// Queue monster untuk di-poll Roblox
let monsterQueue = [];

// ============================================================
// KONEKSI TIKTOK
// ============================================================
let tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME, {
  sessionId: TIKTOK_SESSION_ID,
  enableWebsocketUpgrade: true,
  requestPollingIntervalMs: 2000,
});

function connectTikTok() {
  tiktokConnection
    .connect()
    .then(() => {
      console.log("[TikTok] Terhubung ke live:", TIKTOK_USERNAME);
    })
    .catch((err) => {
      console.error("[TikTok] Gagal konek:", err.message);
      setTimeout(connectTikTok, 5000); // retry 5 detik
    });
}

// Event: Gift
tiktokConnection.on("gift", (data) => {
  // Skip streak gift yang belum selesai
  if (data.giftType === 1 && !data.repeatEnd) return;

  const count = data.repeatCount || 1;

  // 1 gift = 1 monster, bisa di-adjust
  for (let i = 0; i < count; i++) {
    monsterQueue.push({
      type: "gift",
      username: data.uniqueId,
      giftName: data.giftName,
      giftCount: count,
      spawnedAt: Date.now(),
    });
  }

  console.log(`[GIFT] ${data.uniqueId} kirim ${data.giftName} x${count}`);
});

// Event: Follow
tiktokConnection.on("follow", (data) => {
  monsterQueue.push({
    type: "follow",
    username: data.uniqueId,
    spawnedAt: Date.now(),
  });

  console.log(`[FOLLOW] ${data.uniqueId} follow`);
});

// Reconnect kalau disconnect
tiktokConnection.on("disconnected", () => {
  console.warn("[TikTok] Disconnect, reconnecting...");
  setTimeout(connectTikTok, 5000);
});

connectTikTok();

// ============================================================
// ENDPOINTS
// ============================================================

// Roblox poll endpoint — ambil semua monster dari queue
app.get("/monsters", (req, res) => {
  const events = [...monsterQueue];
  monsterQueue = []; // clear setelah diambil
  res.json({ events });
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    queueLength: monsterQueue.length,
    tiktokUser: TIKTOK_USERNAME,
  });
});

// Manual test spawn (untuk testing tanpa TikTok)
app.get("/test/gift", (req, res) => {
  monsterQueue.push({
    type: "gift",
    username: "TestUser",
    giftName: "Rose",
    giftCount: 1,
    spawnedAt: Date.now(),
  });
  res.json({ ok: true, message: "Test gift monster ditambahkan" });
});

app.get("/test/follow", (req, res) => {
  monsterQueue.push({
    type: "follow",
    username: "TestFollower",
    spawnedAt: Date.now(),
  });
  res.json({ ok: true, message: "Test follow monster ditambahkan" });
});

app.listen(PORT, () => {
  console.log(`[Server] Jalan di port ${PORT}`);
});