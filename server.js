// === ROBLOX MONSTER QUEUE ===
let monsterQueue = [];

// TikTok event listener — tambahkan di dalam fungsi connectTikTok
tiktokConnection.on('gift', (data) => {
  if (data.giftType === 1 && !data.repeatEnd) return; // skip streak gift yg belum selesai
  
  monsterQueue.push({
    type: 'gift',
    username: data.uniqueId,
    giftName: data.giftName,
    giftCount: data.repeatCount || 1,
    timestamp: Date.now()
  });
  
  console.log(`[MONSTER] Gift dari ${data.uniqueId}: ${data.giftName}`);
});

tiktokConnection.on('follow', (data) => {
  monsterQueue.push({
    type: 'follow',
    username: data.uniqueId,
    timestamp: Date.now()
  });
  
  console.log(`[MONSTER] Follow dari ${data.uniqueId}`);
});

// Endpoint yang di-poll oleh Roblox
app.get('/roblox/monsters', (req, res) => {
  const events = [...monsterQueue];
  monsterQueue = []; // clear setelah diambil
  res.json({ events });
});
