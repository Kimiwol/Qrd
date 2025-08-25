import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import config from './config/env';
import { connectDB } from './config/database';
import { requestLogger } from './middleware/logger';
import { setupProcessHandlers } from './utils/processHandlers';

// 라우트 import
import authRoutes from './routes/auth';
import gameRoutes from './routes/game';

// 게임 매니저 import
import { GameManager } from './game/GameManager';

const app = express();
const httpServer = createServer(app);

console.log('Allowed CORS origins:', config.allowedOrigins);

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || config.allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('Blocked CORS origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ["GET", "POST"]
};

const io = new Server(httpServer, {
    cors: corsOptions,
    // Allow fallback to HTTP long-polling to reduce connection errors
    // Start with polling so the connection succeeds even if WebSocket is blocked
    transports: ['polling', 'websocket'],
    pingTimeout: 20000,
    pingInterval: 25000
});

// 게임 매니저 초기화는 라우트보다 먼저 수행해 공용 API에서 통계 접근 가능하도록 함
const gameManager = new GameManager(io);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// 요청 로깅 미들웨어
app.use(requestLogger);

// MongoDB 연결
connectDB();

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

// 공지 및 통계 API는 다른 라우터보다 먼저 설정하여 404를 방지
app.get('/api/notice', (_req, res) => {
    res.json([
        { id: '1', message: '퀘도르 온라인에 오신 것을 환영합니다!', type: 'event' }
    ]);
});

app.get('/api/stats', (_req, res) => {
    res.json(gameManager.getStats());
});

// 라우트 설정
app.use('/api', authRoutes);
app.use('/api', gameRoutes);

// 서버 시작
const PORT = config.port;
console.log('🔧 환경 변수:');
console.log('- PORT:', PORT);
console.log('- NODE_ENV:', config.nodeEnv);
console.log('- MONGODB_URI:', config.mongoURI ? '설정됨' : '미설정');

console.log('🚀 서버 시작 시도...');

// 프로세스 에러 핸들링
setupProcessHandlers();

httpServer.listen(Number(PORT), () => {
    console.log(`✅ 서버가 포트 ${PORT}에서 성공적으로 시작되었습니다!`);
    console.log(`🌐 서버 주소: ${process.env.NODE_ENV === 'production' ? 'https://quoridoronline-5ngr.onrender.com' : `http://localhost:${PORT}`}`);
});

// 서버 에러 핸들링
httpServer.on('error', (error: any) => {
    console.error('❌ 서버 에러:', error.message);
    if (error.code === 'EADDRINUSE') {
        console.error(`포트 ${PORT}가 이미 사용 중입니다.`);
    }
    process.exit(1);
});
