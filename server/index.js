import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── Balance editor (dev tool) ─────────────────────────────────────────────────

const CARDS_PATH = join(__dirname, '../src/cards.js');

function parseCardDefs() {
  const src = readFileSync(CARDS_PATH, 'utf-8');
  const code = src
    .replace(/^import\s+.*?;\s*$/gm, '')
    .replace(/^export\s+(const|let|var)\s+/gm, '$1 ')
    .replace(/^export\s+function\s+/gm, 'function ');
  return new Function(code + '\nreturn CARD_DEFS;')();
}

function serVal(v, depth = 0) {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v.toString();
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toString();
    return parseFloat(v.toFixed(2)).toString();
  }
  if (typeof v === 'string') return `'${v}'`;
  if (Array.isArray(v)) return `[${v.map(x => typeof x === 'string' ? `'${x}'` : x).join(', ')}]`;
  if (typeof v === 'object') {
    const pad = depth === 0 ? '      ' : '        ';
    const inner = Object.entries(v).map(([k, val]) => `${pad}${k}: ${serVal(val, depth + 1)},`).join('\n');
    return `{\n${inner}\n${pad.slice(2)}}`;
  }
  return JSON.stringify(v);
}

function writeCardDefs(defs) {
  const src = readFileSync(CARDS_PATH, 'utf-8');
  const units = Object.entries(defs).map(([id, def]) => {
    const fields = Object.entries(def).map(([k, v]) => `    ${k}: ${serVal(v)},`).join('\n');
    return `  ${id}: {\n${fields}\n  }`;
  }).join(',\n');
  const block = `export const CARD_DEFS = {\n${units},\n};`;
  const updated = src.replace(/export const CARD_DEFS = \{[\s\S]*?\n\};/, block);
  if (updated === src) throw new Error('Не найден блок CARD_DEFS в cards.js');
  writeFileSync(CARDS_PATH, updated, 'utf-8');
}

app.get('/dev-balance', (_req, res) => {
  res.sendFile(join(__dirname, '../dev-balance.html'));
});

app.get('/api/dev/units', (_req, res) => {
  try { res.json({ ok: true, data: parseCardDefs() }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/dev/units', express.json(), (req, res) => {
  try { writeCardDefs(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Serve built client in production
app.use(express.static(join(__dirname, '../dist')));
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// ── Room storage (in-memory) ──────────────────────────────────────────────────

const rooms = new Map(); // roomId → room

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomId() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function buildRoomState(room) {
  return {
    roomId:       room.roomId,
    host:         room.host  ? { ready: room.host.ready,  name: room.host.name  } : null,
    guest:        room.guest ? { ready: room.guest.ready, name: room.guest.name } : null,
    matchStarted: room.matchStarted,
  };
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  let myRoomId = null;
  let myRole   = null; // 'host' | 'guest'

  console.log(`[WS] +${socket.id}`);

  // ── create_room ─────────────────────────────────────────────────────────────
  socket.on('create_room', () => {
    const roomId = generateRoomId();
    const room = {
      roomId,
      host:         { socketId: socket.id, ready: false, name: 'Host' },
      guest:        null,
      matchStarted: false,
      createdAt:    Date.now(),
    };
    rooms.set(roomId, room);
    myRoomId = roomId;
    myRole   = 'host';

    socket.join(roomId);
    socket.emit('room_created', { roomId, role: 'host' });
    socket.emit('room_state',   buildRoomState(room));
    console.log(`[Room] created ${roomId}`);
  });

  // ── join_room ────────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId }) => {
    const id   = (roomId ?? '').toUpperCase();
    const room = rooms.get(id);

    if (!room) {
      socket.emit('room_error', { code: 'room_not_found', message: 'Комната не найдена' });
      return;
    }
    if (room.guest) {
      socket.emit('room_error', { code: 'room_full', message: 'Комната уже заполнена' });
      return;
    }

    room.guest = { socketId: socket.id, ready: false, name: 'Guest' };
    myRoomId   = id;
    myRole     = 'guest';

    socket.join(id);
    socket.emit('room_joined', { roomId: id, role: 'guest' });
    io.to(id).emit('room_state',    buildRoomState(room));
    io.to(id).emit('player_joined', { role: 'guest' });
    console.log(`[Room] joined ${id} by guest`);
  });

  // ── player_ready ─────────────────────────────────────────────────────────────
  socket.on('player_ready', ({ roomId, ready }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = myRole === 'host' ? room.host : room.guest;
    if (player) player.ready = !!ready;

    io.to(roomId).emit('room_state', buildRoomState(room));

    if (room.host?.ready && room.guest?.ready) {
      io.to(roomId).emit('both_ready', {});
    }
  });

  // ── start_match ──────────────────────────────────────────────────────────────
  socket.on('start_match', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || myRole !== 'host') return;
    if (!room.host?.ready || !room.guest?.ready) return;

    room.matchStarted = true;
    const seed = Math.floor(Math.random() * 1_000_000);

    io.to(roomId).emit('match_start', {
      roomId,
      seed,
      hostSide:  'bottom',
      guestSide: 'top',
      startedAt: Date.now(),
    });
    console.log(`[Room] match started ${roomId} seed=${seed}`);
  });

  // ── play_card ────────────────────────────────────────────────────────────────
  socket.on('play_card', (command) => {
    const room = rooms.get(command?.roomId);
    if (!room) return;
    // Relay to the other player only
    socket.to(command.roomId).emit('opponent_action', command);
  });

  // ── host_snapshot ────────────────────────────────────────────────────────────
  socket.on('host_snapshot', (snapshot) => {
    const room = rooms.get(snapshot?.roomId);
    if (!room || myRole !== 'host') return;
    socket.to(snapshot.roomId).emit('host_snapshot', snapshot);
  });

  // ── surrender ────────────────────────────────────────────────────────────────
  socket.on('surrender', ({ roomId }) => {
    socket.to(roomId).emit('opponent_surrendered', { role: myRole });
  });

  // ── ping_room ────────────────────────────────────────────────────────────────
  socket.on('ping_room', ({ roomId }) => {
    const state = buildRoomState(rooms.get(roomId));
    if (state) socket.emit('room_state', state);
  });

  // ── leave_room ────────────────────────────────────────────────────────────────
  socket.on('leave_room', ({ roomId }) => _leave(roomId));

  // ── disconnect ────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[WS] -${socket.id}`);
    if (myRoomId) _leave(myRoomId);
  });

  function _leave(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    socket.to(roomId).emit('opponent_disconnected', { role: myRole });
    socket.leave(roomId);

    if (myRole === 'host') {
      // Host left — delete room
      rooms.delete(roomId);
    } else if (myRole === 'guest') {
      room.guest = null;
      if (!room.matchStarted) {
        io.to(roomId).emit('room_state', buildRoomState(room));
      }
    }
    myRoomId = null;
    myRole   = null;
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\n🏜  Дома Пустыни — онлайн-сервер');
  console.log(`   Порт       : ${PORT}`);
  console.log(`   Локально   : http://localhost:${PORT}`);
  console.log(`   Для коллеги: http://ВАШ_IP:${PORT}/room/XXXXXX\n`);
});
