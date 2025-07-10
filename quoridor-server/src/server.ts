import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// 라우트 import
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';

// 게임 매니저 import
import { GameManager } from './game/GameManager';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS 설정
const allowedOrigins = [
    "https://qrdonline.netlify.app",
    ...(process.env.NODE_ENV === 'development' ? ["http://localhost:3000"] : [])
];

if (process.env.CLIENT_URL && !allowedOrigins.includes(process.env.CLIENT_URL)) {
    allowedOrigins.push(process.env.CLIENT_URL);
}

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling']
});

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// MongoDB 연결
if (process.env.MONGODB_URI) {
    console.log('MongoDB 연결 시도 중...');
    
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('✅ MongoDB 연결 성공!');
            console.log('연결 상태:', mongoose.connection.readyState);
        })
        .catch(err => {
            console.error('❌ MongoDB 연결 실패:', err.message);
            console.error('에러 코드:', err.code);
            console.error('에러 이름:', err.codeName);
            console.log('🎮 인증 기능 없이 게임만 진행 가능합니다.');
        });
} else {
    console.log('MongoDB URI가 설정되지 않았습니다. 인증 기능 없이 게임만 진행 가능합니다.');
}

// 루트 경로 핸들러
app.get('/', (req, res) => {
    res.json({
        message: '🎮 Quoridor 게임 서버',
        status: 'running',
        version: '1.0.0',
        endpoints: {
            auth: '/api/register, /api/login',
            game: '/api/profile, /api/rooms',
            websocket: 'Socket.io enabled'
        }
    });
});

// 라우트 설정
app.use('/api', authRoutes);
app.use('/api', gameRoutes);

// 게임 매니저 초기화
const gameManager = new GameManager(io);

// 서버 시작
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
    console.log(`🎮 게임 매칭 시스템이 활성화되었습니다`);
});
