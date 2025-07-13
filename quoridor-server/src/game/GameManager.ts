import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { GameLogic } from './GameLogic';
import { RatingSystem } from './RatingSystem';
import { MatchmakingSystem } from './MatchmakingSystem';
import { GameState, Position, Wall, GameMode, GameResult, MatchmakingRequest } from '../types';
import { Room } from './interfaces/Room';

// Import handlers
import { AuthHandler } from './handlers/AuthHandler';
import { QueueHandler } from './handlers/QueueHandler';
import { ConnectionHandler } from './handlers/ConnectionHandler';
import { GameHandler } from './handlers/GameHandler';
import { DisconnectHandler } from './handlers/DisconnectHandler';

export class GameManager {
    private io: Server;
    private rooms = new Map<string, Room>();
    private waitingPlayers: Socket[] = [];
    private matchmakingSystem = new MatchmakingSystem();
    private readonly TURN_TIME_LIMIT = 60;
    
    // Handler instances
    private queueHandler: QueueHandler;
    private connectionHandler: ConnectionHandler;
    private gameHandler: GameHandler;
    private disconnectHandler: DisconnectHandler;

    constructor(io: Server) {
        this.io = io;
        
        // Initialize handlers
        this.queueHandler = new QueueHandler(io, this.matchmakingSystem);
        this.connectionHandler = new ConnectionHandler(io, this.rooms);
        this.gameHandler = new GameHandler(io, this.rooms);
        this.disconnectHandler = new DisconnectHandler(io, this.rooms);
        
        this.setupSocketHandlers();
    }

    private setupSocketHandlers() {
        // Socket.io 인증 미들웨어
        this.io.use(AuthHandler.authenticateSocket);

        this.io.on('connection', async (socket) => {
            // 사용자 레이팅 정보 로드
            await AuthHandler.loadUserRating(socket);

            // 중복 연결 처리
            this.connectionHandler.handleDuplicateConnection(
                socket, 
                this.findPlayerRoom.bind(this), 
                this.gameHandler.endGame.bind(this.gameHandler),
                this.queueHandler.handleLeaveQueue.bind(this.queueHandler),
                this.queueHandler.removeFromSimpleQueue.bind(this.queueHandler)
            );
            
            console.log(`🔌 새 소켓 연결: ${socket.id}`);
            console.log(`✅ 플레이어 연결 완료: ${(socket as any).userId}`);
            
            this.handlePlayerConnection(socket);
        });
    }

    private handlePlayerConnection(socket: Socket) {
        const userId = (socket as any).userId;

        // 이벤트 핸들러 설정
        this.connectionHandler.setupEventHandlers(socket, {
            handlePlayerMove: this.gameHandler.handlePlayerMove.bind(this.gameHandler),
            handleWallPlacement: this.gameHandler.handleWallPlacement.bind(this.gameHandler),
            handleGameRestart: this.gameHandler.handleGameRestart.bind(this.gameHandler),
            handleTurnTimeout: this.gameHandler.handleTurnTimeout.bind(this.gameHandler),
            handleForfeit: this.gameHandler.handleForfeit.bind(this.gameHandler),
            handleJoinRankedQueue: (socket: Socket) => this.queueHandler.handleJoinRankedQueue(socket, this.tryMatchmaking.bind(this)),
            handleJoinCustomQueue: (socket: Socket) => this.queueHandler.handleJoinCustomQueue(socket, this.tryMatchmaking.bind(this)),
            handleLeaveQueue: this.queueHandler.handleLeaveQueue.bind(this.queueHandler),
            handleGetLeaderboard: this.handleGetLeaderboard.bind(this),
            handleGetRating: this.handleGetRating.bind(this),
            handleAddTestBot: this.queueHandler.handleAddTestBot.bind(this.queueHandler),
            handleCreateBotGame: this.handleCreateBotGame.bind(this),
            handleRequestInitialGameState: this.handleRequestInitialGameState.bind(this),
            handleDebugMatchmaking: this.handleDebugMatchmaking.bind(this),
            handlePlayerDisconnect: (socket: Socket) => this.disconnectHandler.handlePlayerDisconnect(
                socket,
                this.findPlayerRoom.bind(this),
                this.gameHandler.endGame.bind(this.gameHandler),
                this.queueHandler.handleLeaveQueue.bind(this.queueHandler),
                this.queueHandler.removeFromSimpleQueue.bind(this.queueHandler)
            )
        });

        console.log(`플레이어 ${userId} 매칭 대기 중...`);
    }

    private tryMatchmaking(mode: GameMode) {
        console.log(`🔍 [GameManager] ${mode} 게임 매칭 시도...`);
        const match = this.matchmakingSystem.findMatch(mode);
        if (match) {
            console.log(`✅ [GameManager] 매칭 성공!`, {
                player1: { userId: match.player1.userId, socketId: match.player1.socket.id },
                player2: { userId: match.player2.userId, socketId: match.player2.socket.id },
                mode
            });
            this.confirmAndCreateGame(match.player1.socket, match.player2.socket, mode);
        } else {
            console.log(`❌ [GameManager] 매칭할 상대를 찾지 못했습니다. (${mode})`);
        }
    }

    private confirmAndCreateGame(player1Socket: Socket, player2Socket: Socket, mode: GameMode) {
        const player1Username = (player1Socket as any).username || 'Unknown';
        const player2Username = (player2Socket as any).username || 'Unknown';

        console.log(`매칭 확인 알림 전송:`, {
            player1: { id: player1Socket.id, username: player1Username },
            player2: { id: player2Socket.id, username: player2Username }
        });
        
        if (!player1Socket.connected || !player2Socket.connected) {
            console.log('한 명 이상의 플레이어가 연결 해제됨. 매칭 취소.');
            return;
        }

        player1Socket.emit('matchFound', { opponent: player2Username });
        player2Socket.emit('matchFound', { opponent: player1Username });

        setTimeout(() => {
            this.gameHandler.createGame(player1Socket, player2Socket, mode);
        }, 500); // 500ms 지연
    }

    private async handleGetLeaderboard(callback: any) {
        try {
            const leaderboard = await RatingSystem.getLeaderboard();
            callback({ success: true, leaderboard });
        } catch (error) {
            console.error('리더보드 로드 실패:', error);
            callback({ success: false, error: '리더보드를 로드할 수 없습니다.' });
        }
    }

    private handleGetRating(socket: Socket, callback: any) {
        const rating = (socket as any).rating || 1200;
        const username = (socket as any).username || 'Unknown';
        callback({ rating, username });
    }

    private handleCreateBotGame(socket: Socket) {
        const botSocket: Partial<Socket> = {
            id: `bot_${Date.now()}`,
            handshake: { auth: {} } as any,
            emit: (event, ...args) => {
                console.log(`🤖 Bot emits: ${event}`, args);
                return true;
            },
            join: (roomId) => { 
                console.log(`🤖 Bot joins room: ${roomId}`);
            },
            leave: (roomId) => { 
                console.log(`🤖 Bot leaves room: ${roomId}`);
            },
            on: (event, listener) => { 
                return botSocket as Socket;
            },
            disconnect: (close) => { 
                console.log('🤖 Bot disconnects'); 
                return botSocket as Socket;
            }
        };
        (botSocket as any).userId = (botSocket as any).id;
        (botSocket as any).username = 'EasyBot';
        (botSocket as any).rating = 1000;

        console.log(`[GameManager] 🤖 ${socket.id}와 봇의 게임을 생성합니다.`);
        this.gameHandler.createGame(socket, botSocket as Socket, GameMode.CUSTOM);
    }

    private handleRequestInitialGameState(socket: Socket, data: { roomId: string }) {
        console.log(`🔄 초기 게임 상태 요청:`, {
            socketId: socket.id,
            userId: (socket as any).userId,
            roomId: data.roomId
        });
        
        const room = this.rooms.get(data.roomId);
        if (!room) {
            console.error(`❌ 방을 찾을 수 없음: ${data.roomId}`);
            socket.emit('error', '방을 찾을 수 없습니다.');
            return;
        }

        const playerData = room.players.get(socket.id);
        if (!playerData) {
            console.error(`❌ 플레이어 데이터를 찾을 수 없음: ${socket.id}`);
            socket.emit('error', '플레이어 정보를 찾을 수 없습니다.');
            return;
        }

        // 플레이어 정보 구성
        const players = Array.from(room.players.values());
        const me = playerData;
        const opponent = players.find(p => p.socket.id !== socket.id);

        const gameStartData = {
            playerId: me.playerId,
            roomId: data.roomId,
            gameState: room.gameState,
            playerInfo: {
                me: {
                    id: me.userId,
                    username: me.username || `Player${me.playerId === 'player1' ? '1' : '2'}`,
                    wallsLeft: room.gameState[me.playerId].walls
                },
                opponent: {
                    id: opponent?.userId || 'unknown',
                    username: opponent?.username || `Player${opponent?.playerId === 'player1' ? '1' : '2'}`,
                    wallsLeft: room.gameState[opponent?.playerId || 'player1'].walls
                }
            }
        };

        console.log(`✅ 초기 게임 상태 전송:`, gameStartData);
        socket.emit('gameStarted', gameStartData);
    }

    private handleDebugMatchmaking(socket: Socket) {
        const userId = (socket as any).userId;
        const rating = (socket as any).rating;
        const username = (socket as any).username;
        
        console.log(`🐛 [Debug] 매칭 디버그 정보:`, {
            userId,
            username,
            rating,
            socketId: socket.id,
            socketConnected: socket.connected
        });
        
        // 현재 큐 상태 확인
        const rankedQueue = this.matchmakingSystem.getQueueInfo(GameMode.RANKED);
        const customQueue = this.matchmakingSystem.getQueueInfo(GameMode.CUSTOM);
        
        const debugInfo = {
            player: { userId, username, rating, socketId: socket.id },
            queues: {
                ranked: rankedQueue,
                custom: customQueue
            },
            totalRooms: this.rooms.size
        };
        
        console.log(`🐛 [Debug] 전체 상태:`, debugInfo);
        socket.emit('debugInfo', debugInfo);
    }

    private findPlayerRoom(socketId: string): Room | undefined {
        for (const room of this.rooms.values()) {
            if (room.players.has(socketId)) {
                return room;
            }
        }
        return undefined;
    }
}
