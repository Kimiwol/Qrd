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
    "https://quoridor-online.netlify.app",  // 다른 가능한 URL
    ...(process.env.NODE_ENV === 'development' ? ["http://localhost:3000"] : [])
];

if (process.env.CLIENT_URL && !allowedOrigins.includes(process.env.CLIENT_URL)) {
    allowedOrigins.push(process.env.CLIENT_URL);
}

console.log('Allowed CORS origins:', allowedOrigins);

const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            // 개발 환경에서는 모든 origin 허용
            if (process.env.NODE_ENV === 'development') {
                callback(null, true);
                return;
            }
            
            // origin이 없는 경우 (모바일 앱 등) 허용
            if (!origin) {
                callback(null, true);
                return;
            }
            
            // Netlify 도메인 패턴 확인
            if (origin.includes('netlify.app') || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.log('Blocked origin:', origin);
                callback(new Error('CORS policy violation'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling']
});

app.use(cors({
    origin: (origin, callback) => {
        // 개발 환경에서는 모든 origin 허용
        if (process.env.NODE_ENV === 'development') {
            callback(null, true);
            return;
        }
        
        // origin이 없는 경우 (모바일 앱 등) 허용
        if (!origin) {
            callback(null, true);
            return;
        }
        
        // Netlify 도메인 패턴 확인
        if (origin.includes('netlify.app') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            callback(new Error('CORS policy violation'));
        }
    },
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`, {
        origin: req.get('Origin'),
        userAgent: req.get('User-Agent'),
        body: req.method === 'POST' ? { ...req.body, password: req.body.password ? '***' : undefined } : undefined
    });
    next();
});

// MongoDB 연결
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('✅ MongoDB 연결 성공!');
        })
        .catch(err => {
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
});
