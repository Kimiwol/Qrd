"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("./models/User");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const allowedOrigins = ["https://qrdonline.netlify.app"];
if (process.env.CLIENT_URL) {
    allowedOrigins.push(process.env.CLIENT_URL);
}
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express_1.default.json());
// MongoDB 연결
mongoose_1.default.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB 연결 성공'))
    .catch(err => console.error('MongoDB 연결 실패:', err));
// 인증 라우트
app.post('/api/register', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, email, password } = req.body;
        const user = new User_1.User({ username, email, password });
        yield user.save();
        const token = jsonwebtoken_1.default.sign({ _id: user._id }, process.env.JWT_SECRET);
        res.status(201).send({ user, token });
    }
    catch (error) {
        res.status(400).send(error);
    }
}));
app.post('/api/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const user = yield User_1.User.findOne({ email });
        if (!user || !(yield user.comparePassword(password))) {
            throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
        }
        const token = jsonwebtoken_1.default.sign({ _id: user._id }, process.env.JWT_SECRET);
        res.send({ user, token });
    }
    catch (error) {
        res.status(400).send({ error: error.message });
    }
}));
// 게임 상태 초기화를 반환하는 함수
const getInitialGameState = () => ({
    players: [
        { id: 'player1', position: { x: 4, y: 0 }, wallsLeft: 10 },
        { id: 'player2', position: { x: 4, y: 8 }, wallsLeft: 10 }
    ],
    walls: [],
    currentTurn: 'player1'
});
let gameState = getInitialGameState();
let isGamePaused = false;
const TURN_TIME_LIMIT = 60;
let turnTimer = null;
// 접속한 플레이어들을 추적하기 위한 맵
const connectedPlayers = new Map();
const startTurnTimer = () => {
    if (turnTimer) {
        clearTimeout(turnTimer);
    }
    turnTimer = setTimeout(() => {
        if (!isGamePaused && gameState.currentTurn) {
            gameState.currentTurn = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
            io.emit('gameState', gameState);
            io.emit('turnTimedOut');
            startTurnTimer();
        }
    }, TURN_TIME_LIMIT * 1000);
};
// Socket.io 연결 처리
io.use((socket, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            throw new Error('인증이 필요합니다.');
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = yield User_1.User.findById(decoded._id);
        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }
        socket.userId = user._id;
        next();
    }
    catch (error) {
        next(new Error('인증이 필요합니다.'));
    }
}));
io.on('connection', (socket) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('사용자 연결됨');
    const userId = socket.userId;
    const user = yield User_1.User.findById(userId);
    if (!user) {
        socket.disconnect();
        return;
    }
    // 새로운 플레이어 할당
    let playerId = null;
    if (!connectedPlayers.has('player1')) {
        playerId = 'player1';
        connectedPlayers.set('player1', { socketId: socket.id, userId });
    }
    else if (!connectedPlayers.has('player2')) {
        playerId = 'player2';
        connectedPlayers.set('player2', { socketId: socket.id, userId });
    }
    // 플레이어 ID와 현재 게임 상태 전송
    socket.emit('playerAssigned', playerId);
    socket.emit('gameState', gameState);
    if (isGamePaused) {
        io.emit('gamePaused', '상대 플레이어의 재접속을 기다리는 중...');
    }
    // 게임 재시작 요청 처리
    socket.on('restartGame', () => {
        if (connectedPlayers.size === 2) {
            if (turnTimer) {
                clearTimeout(turnTimer);
            }
            gameState = getInitialGameState();
            io.emit('gameState', gameState);
            io.emit('gameRestarted');
            startTurnTimer();
        }
    });
    // 플레이어 이동 처리
    socket.on('move', (newPosition) => {
        const playerEntry = Array.from(connectedPlayers.entries())
            .find(([_, data]) => data.socketId === socket.id);
        const socketPlayerId = playerEntry === null || playerEntry === void 0 ? void 0 : playerEntry[0];
        if (socketPlayerId !== gameState.currentTurn || isGamePaused) {
            return;
        }
        const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn);
        if (currentPlayer && isValidMove(currentPlayer, newPosition, gameState)) {
            // 이동이 유효하면 위치 업데이트
            currentPlayer.position = newPosition;
            // 승리 조건 확인
            if ((currentPlayer.id === 'player1' && newPosition.y === 8) ||
                (currentPlayer.id === 'player2' && newPosition.y === 0)) {
                if (turnTimer) {
                    clearTimeout(turnTimer);
                }
                io.emit('gameOver', currentPlayer.id);
                gameState = getInitialGameState();
            }
            else {
                // 턴 변경
                gameState.currentTurn = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
                startTurnTimer(); // 새로운 턴의 타이머 시작
            }
            io.emit('gameState', gameState);
        }
    });
    // 벽 설치 처리
    socket.on('placeWall', ({ position, isHorizontal }) => {
        const playerEntry = Array.from(connectedPlayers.entries())
            .find(([_, data]) => data.socketId === socket.id);
        const socketPlayerId = playerEntry === null || playerEntry === void 0 ? void 0 : playerEntry[0];
        if (socketPlayerId !== gameState.currentTurn || isGamePaused) {
            return;
        }
        const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn);
        const newWall = { position, isHorizontal };
        if (currentPlayer && isValidWallPlacement(newWall, gameState, currentPlayer)) {
            const tempWalls = [...gameState.walls, newWall];
            const allPlayersHavePath = gameState.players.every(p => hasPathToGoal(p, tempWalls));
            if (allPlayersHavePath) {
                gameState.walls.push(newWall);
                currentPlayer.wallsLeft--;
                gameState.currentTurn = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
                startTurnTimer(); // 새로운 턴의 타이머 시작
                io.emit('gameState', gameState);
            }
        }
    });
    socket.on('disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
        for (const [playerId, data] of connectedPlayers.entries()) {
            if (data.socketId === socket.id) {
                connectedPlayers.delete(playerId);
                console.log(`플레이어 ${playerId} 연결 끊김`);
                if (connectedPlayers.size < 2) {
                    isGamePaused = true;
                    if (turnTimer) {
                        clearTimeout(turnTimer);
                    }
                    io.emit('gamePaused', '상대 플레이어의 재접속을 기다리는 중...');
                }
                break;
            }
        }
    }));
    // 게임 재개 처리
    if (connectedPlayers.size === 2 && isGamePaused) {
        isGamePaused = false;
        io.emit('gameResumed');
        startTurnTimer();
    }
    // 두 플레이어가 모두 접속했을 때 타이머 시작
    if (connectedPlayers.size === 2 && !turnTimer && !isGamePaused) {
        startTurnTimer();
    }
}));
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
});
// 이동이 벽에 막혀있는지 확인하는 함수
const isBlockedByWall = (from, to, walls) => {
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    const minY = Math.min(from.y, to.y);
    const maxY = Math.max(from.y, to.y);
    return walls.some(wall => {
        if (wall.isHorizontal) {
            // 수평 벽은 위아래 이동을 막음
            return wall.position.y === minY &&
                wall.position.x <= maxX &&
                from.y !== to.y;
        }
        else {
            // 수직 벽은 좌우 이동을 막음
            return wall.position.x === minX &&
                wall.position.y <= maxY &&
                from.x !== to.x;
        }
    });
};
// 이동이 유효한지 확인하는 함수
const isValidMove = (player, newPosition, gameState) => {
    // 보드 범위 체크
    if (newPosition.x < 0 || newPosition.x > 8 ||
        newPosition.y < 0 || newPosition.y > 8) {
        return false;
    }
    const dx = Math.abs(newPosition.x - player.position.x);
    const dy = Math.abs(newPosition.y - player.position.y);
    // 다른 플레이어의 위치 확인
    const otherPlayer = gameState.players.find(p => p.id !== player.id);
    if (!otherPlayer)
        return false;
    // 기본 이동: 한 칸
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        // 이동하려는 칸에 다른 플레이어가 있는지 확인
        if (otherPlayer.position.x === newPosition.x &&
            otherPlayer.position.y === newPosition.y) {
            return false;
        }
        // 벽에 막혀있는지 확인
        return !isBlockedByWall(player.position, newPosition, gameState.walls);
    }
    // 플레이어 뛰어넘기
    if ((dx === 2 && dy === 0) || (dx === 0 && dy === 2)) {
        const midX = (player.position.x + newPosition.x) / 2;
        const midY = (player.position.y + newPosition.y) / 2;
        // 중간에 다른 플레이어가 있는지 확인
        if (otherPlayer.position.x === midX && otherPlayer.position.y === midY) {
            // 뛰어넘으려는 방향에 벽이 없는지 확인
            return !isBlockedByWall(player.position, { x: midX, y: midY }, gameState.walls) &&
                !isBlockedByWall({ x: midX, y: midY }, newPosition, gameState.walls);
        }
    }
    return false;
};
// 벽 설치가 유효한지 확인하는 함수
const isValidWallPlacement = (wall, gameState, player) => {
    // 벽이 남아있는지 확인
    if (player.wallsLeft <= 0) {
        return false;
    }
    // 벽이 보드 범위 안에 있는지 확인
    // 가로벽은 y < 8, x < 7
    // 세로벽은 y < 7, x < 8
    if (wall.isHorizontal) {
        if (wall.position.x < 0 || wall.position.x > 7 ||
            wall.position.y < 0 || wall.position.y > 7) {
            return false;
        }
    }
    else {
        if (wall.position.x < 0 || wall.position.x > 7 ||
            wall.position.y < 0 || wall.position.y > 7) {
            return false;
        }
    }
    // 이미 설치된 벽과 겹치는지 확인
    const isOverlapping = gameState.walls.some(existingWall => {
        if (wall.isHorizontal === existingWall.isHorizontal) {
            return wall.position.x === existingWall.position.x &&
                wall.position.y === existingWall.position.y;
        }
        // 교차 지점에서 벽이 겹치는 경우 체크
        if (wall.isHorizontal) {
            return existingWall.position.x === wall.position.x &&
                existingWall.position.y === wall.position.y;
        }
        else {
            return existingWall.position.x === wall.position.x &&
                existingWall.position.y === wall.position.y;
        }
    });
    if (isOverlapping) {
        return false;
    }
    return true;
};
// 경로가 존재하는지 확인하는 함수 (BFS 사용)
const hasPathToGoal = (player, walls) => {
    const visited = new Set();
    const queue = [player.position];
    const targetY = player.id === 'player1' ? 8 : 0;
    while (queue.length > 0) {
        const pos = queue.shift();
        const key = `${pos.x},${pos.y}`;
        if (pos.y === targetY) {
            return true;
        }
        if (visited.has(key)) {
            continue;
        }
        visited.add(key);
        // 상하좌우 이동 가능한 위치 확인
        const moves = [
            { x: pos.x, y: pos.y - 1 }, // 위
            { x: pos.x, y: pos.y + 1 }, // 아래
            { x: pos.x - 1, y: pos.y }, // 왼쪽
            { x: pos.x + 1, y: pos.y } // 오른쪽
        ];
        for (const move of moves) {
            if (move.x < 0 || move.x > 8 || move.y < 0 || move.y > 8) {
                continue;
            }
            // 벽에 막혀있는지 확인
            const isBlocked = walls.some(wall => {
                if (wall.isHorizontal) {
                    return wall.position.y === Math.min(pos.y, move.y) &&
                        pos.x === move.x &&
                        wall.position.x <= pos.x;
                }
                else {
                    return wall.position.x === Math.min(pos.x, move.x) &&
                        pos.y === move.y &&
                        wall.position.y <= pos.y;
                }
            });
            if (!isBlocked) {
                queue.push(move);
            }
        }
    }
    return false;
};
