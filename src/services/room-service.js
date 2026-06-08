// Сервис онлайн-комнат. Сейчас всё хранится локально (localStorage).
//
// В будущем здесь будет подключение к WebSocket / Socket.IO:
//   - createRoom()   → POST /api/rooms  → получить roomId с сервера
//   - joinRoom()     → socket.emit('join', roomId)
//   - leaveRoom()    → socket.emit('leave', roomId)
//   - ready()        → socket.emit('ready', roomId)
//   - onPlayerJoined → socket.on('player_joined', cb)
//   - onMatchStart   → socket.on('match_start', cb) → запуск боя
//   - sendCommand()  → socket.emit('cmd', { lane, cardId }) — игровые команды
//   - onSnapshot()   → socket.on('snapshot', cb)    — состояние матча с сервера
//
// Для подключения WebSocket: заменить localStorage-операции на socket-вызовы
// и убрать generateRoomId() на стороне клиента (ID выдаёт сервер).

const ROOM_KEY = 'dp_current_room';
const CHARS    = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomId() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export function createRoom() {
  const room = {
    id:        generateRoomId(),
    status:    'waiting',
    players:   [{ slot: 1, name: 'Игрок 1', ready: false }],
    createdAt: Date.now(),
  };
  _saveRoom(room);
  return room;
}

export function joinRoom(roomId) {
  // В будущем: socket.emit('join', roomId) и ждать ответа сервера.
  // Сейчас: если в localStorage уже есть эта комната — загружаем,
  // иначе создаём новый объект с тем же ID (имитация вхождения второго игрока).
  let room = _loadRoom();
  if (!room || room.id !== roomId.toUpperCase()) {
    room = {
      id:        roomId.toUpperCase(),
      status:    'waiting',
      players:   [{ slot: 1, name: 'Игрок 1', ready: false }],
      createdAt: Date.now(),
    };
  }
  _saveRoom(room);
  return room;
}

export function leaveRoom() {
  localStorage.removeItem(ROOM_KEY);
}

export function getRoomInviteLink(roomId) {
  return `${location.origin}/room/${roomId}`;
}

export function parseRoomIdFromUrl() {
  const match = location.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
  return match ? match[1].toUpperCase() : null;
}

function _saveRoom(room) {
  localStorage.setItem(ROOM_KEY, JSON.stringify(room));
}

function _loadRoom() {
  try {
    return JSON.parse(localStorage.getItem(ROOM_KEY));
  } catch {
    return null;
  }
}
