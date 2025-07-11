import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { GameLogic } from './GameLogic';
import { RatingSystem } from './RatingSystem';
import { MatchmakingSystem } from './MatchmakingSystem';
import { GameState, Position, Wall, GameMode, GameResult, MatchmakingRequest } from '../types';

interface Room {
    id: string;
    mode: GameMode;
    players: Map<string, { socket: Socket; userId: string; playerId: string; rating?: number; username?: string }>;
    gameState: GameState;
    turnTimer: NodeJS.Timeout | null;
    isGameActive: boolean;
    startTime: number;
}

export class GameManager {
    private io: Server;
    private rooms = new Map<string, Room>();
    private waitingPlayers: Socket[] = [];
    private matchmakingSystem = new MatchmakingSystem();
    private readonly TURN_TIME_LIMIT = 60;
    
    // 간단한 매칭 대기열
    private simpleQueue: Socket[] = [];

    constructor(io: Server) {
        this.io = io;
        this.setupSocketHandlers();
        // 간단한 매칭 루프 시작
        this.startSimpleMatchmakingLoop();
    }

    private setupSocketHandlers() {
        // Socket.io 인증 미들웨어
        this.io.use(async (socket, next) => {
            try {
                console.log('🔐 소켓 인증 시작:', socket.id);
                
                const token = socket.handshake.auth.token;
                console.log('📝 토큰 존재 여부:', !!token);
                
                if (!token) {
                    throw new Error('인증이 필요합니다.');
                }

                console.log('🔍 JWT 검증 시작...');
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'temp_secret') as { _id: string };
                console.log('✅ JWT 검증 성공:', decoded._id);
                
                // MongoDB 연결이 없을 때는 토큰만 검증
                if (mongoose.connection.readyState !== 1) {
                    console.log('📦 MongoDB 연결 없음, 토큰만 검증');
                    (socket as any).userId = decoded._id;
                    next();
                    return;
                }
                
                console.log('🔍 사용자 조회 중...');
                const user = await User.findById(decoded._id);
                
                if (!user) {
                    console.log('❌ 사용자를 찾을 수 없음:', decoded._id);
                    throw new Error('사용자를 찾을 수 없습니다.');
                }

                console.log('✅ 사용자 찾음:', user._id);
                (socket as any).userId = user._id;
                next();
            } catch (error) {
                console.error('❌ 소켓 인증 실패:', error instanceof Error ? error.message : error);
                next(new Error('인증이 필요합니다.'));
            }
        });

        this.io.on('connection', async (socket) => {
            const userId = (socket as any).userId;

            // 동일 userId로 이미 연결된 소켓이 있는지 확인
            const oldSocket = Array.from(this.io.sockets.sockets.values()).find(s => s !== socket && (s as any).userId === userId);

            if (oldSocket) {
                console.log(`[중복 로그인] 기존 소켓(${oldSocket.id}) 처리 시작. 새 소켓: ${socket.id}`);

                // 1. 기존 소켓이 참여중인 게임이 있다면, 해당 게임을 기권패 처리
                const room = this.findPlayerRoom(oldSocket.id);
                if (room && room.isGameActive) {
                    const disconnectedPlayerData = room.players.get(oldSocket.id);
                    if (disconnectedPlayerData) {
                        const winnerId = disconnectedPlayerData.playerId === 'player1' ? 'player2' : 'player1';
                        console.log(`[중복 로그인] 기존 소켓이 게임 중이므로 기권패 처리. 승자: ${winnerId}`);
                        this.endGame(room, winnerId);
                    }
                }

                // 2. 기존 소켓을 모든 큐에서 제거
                this.handleLeaveQueue(oldSocket); // matchmakingSystem 큐에서 제거
                const simpleQueueIndex = this.simpleQueue.findIndex(s => s.id === oldSocket.id);
                if (simpleQueueIndex > -1) {
                    this.simpleQueue.splice(simpleQueueIndex, 1);
                    console.log(`[중복 로그인] 간단 매칭 큐에서 기존 소켓 제거: ${oldSocket.id}`);
                }

                // 3. 기존 소켓에 알림을 보내고 연결 강제 종료
                console.log(`[중복 로그인] 기존 소켓(${oldSocket.id})에 알림 후 강제 종료`);
                oldSocket.emit('notification', { type: 'error', message: '다른 곳에서 로그인되어 연결이 종료됩니다.' });
                oldSocket.disconnect(true);
            }
            
            console.log(`🔌 새 소켓 연결: ${socket.id}`);
            
            // 사용자 레이팅 정보 로드
            await this.loadUserRating(socket);
            
            console.log(`✅ 플레이어 연결 완료: ${(socket as any).userId}`);
            this.handlePlayerConnection(socket);
        });
    }

    private handlePlayerConnection(socket: Socket) {
        const userId = (socket as any).userId;

        // 게임 이벤트 핸들러 설정
        socket.on('move', (data) => this.handlePlayerMove(socket, data));
        socket.on('placeWall', (data) => this.handleWallPlacement(socket, data));
        socket.on('restartGame', () => this.handleGameRestart(socket));
        socket.on('turnTimeout', () => this.handleTurnTimeout(socket));
        socket.on('forfeit', () => this.handleForfeit(socket));
        
        // 랭크 시스템 이벤트 핸들러
        socket.on('joinRankedQueue', () => this.handleJoinRankedQueue(socket));
        socket.on('joinCustomQueue', () => this.handleJoinCustomQueue(socket));
        socket.on('leaveQueue', () => this.handleLeaveQueue(socket));
        socket.on('getLeaderboard', (callback) => this.handleGetLeaderboard(callback));
        socket.on('getRating', (callback) => this.handleGetRating(socket, callback));
        
        // 테스트용 이벤트 핸들러
        socket.on('addTestBot', () => {
            console.log(`🤖 addTestBot 이벤트 받음 (from ${userId})`);
            this.handleAddTestBot(socket);
        });
        socket.on('createBotGame', () => {
            console.log(`🤖 createBotGame 이벤트 받음 (from ${userId})`);
            this.handleCreateBotGame(socket);
        });
        
        socket.on('disconnect', () => this.handlePlayerDisconnect(socket));

        console.log(`플레이어 ${userId} 매칭 대기 중...`);
    }

    private addToWaitingQueue(socket: Socket) {
        // 이미 대기 중인 플레이어가 있으면 매칭
        if (this.waitingPlayers.length > 0) {
            const opponent = this.waitingPlayers.shift()!;
            this.createGame(opponent, socket);
        } else {
            // 대기열에 추가
            this.waitingPlayers.push(socket);
            socket.emit('waiting', '상대방을 찾는 중입니다...');
        }
    }

    private createGame(player1: Socket, player2: Socket, mode: GameMode = GameMode.CUSTOM) {
        console.log(`🎮 createGame 함수 시작:`, {
            player1: { userId: (player1 as any).userId, socketId: player1.id, connected: player1.connected },
            player2: { userId: (player2 as any).userId, socketId: player2.id, connected: player2.connected },
            mode
        });
        
        const roomId = `room_${Date.now()}`;
        const gameState = GameLogic.getInitialGameState();
        
        console.log(`🏠 방 생성: ${roomId}`);
        console.log(`🎲 초기 게임 상태:`, gameState);

        const room: Room = {
            id: roomId,
            mode,
            players: new Map(),
            gameState,
            turnTimer: null,
            isGameActive: true,
            startTime: Date.now()
        };

        // 랜덤으로 플레이어 순서 결정
        const isPlayer1First = Math.random() < 0.5;
        const firstPlayer = isPlayer1First ? player1 : player2;
        const secondPlayer = isPlayer1First ? player2 : player1;

        console.log(`🎲 플레이어 순서 랜덤 결정:`, {
            isPlayer1First,
            firstPlayerUserId: (firstPlayer as any).userId,
            secondPlayerUserId: (secondPlayer as any).userId
        });

        // 플레이어 설정
        room.players.set(firstPlayer.id, {
            socket: firstPlayer,
            userId: (firstPlayer as any).userId,
            playerId: 'player1',
            rating: (firstPlayer as any).rating,
            username: (firstPlayer as any).username
        });

        room.players.set(secondPlayer.id, {
            socket: secondPlayer,
            userId: (secondPlayer as any).userId,
            playerId: 'player2',
            rating: (secondPlayer as any).rating,
            username: (secondPlayer as any).username
        });

        console.log(`👥 플레이어 룸 설정 완료:`, {
            player1: room.players.get(firstPlayer.id),
            player2: room.players.get(secondPlayer.id)
        });

        // 방에 참가
        console.log(`🚪 소켓 룸 참가 시작`);
        firstPlayer.join(roomId);
        secondPlayer.join(roomId);
        console.log(`✅ 소켓 룸 참가 완료`);

        this.rooms.set(roomId, room);
        console.log(`🗂️ 룸 맵에 저장 완료. 총 방 개수: ${this.rooms.size}`);

        // 플레이어 정보 수집 - 실제 사용자명 확인
        console.log('🎮 플레이어 정보 준비:', {
            player1: {
                userId: (firstPlayer as any).userId,
                username: (firstPlayer as any).username,
                rating: (firstPlayer as any).rating
            },
            player2: {
                userId: (secondPlayer as any).userId,
                username: (secondPlayer as any).username,
                rating: (secondPlayer as any).rating
            }
        });

        const player1Info = {
            id: 'player1',
            username: (firstPlayer as any).username || `User_${(firstPlayer as any).userId?.toString().slice(-6)}`
        };
        
        const player2Info = {
            id: 'player2', 
            username: (secondPlayer as any).username || `User_${(secondPlayer as any).userId?.toString().slice(-6)}`
        };

        console.log('📤 전송할 플레이어 정보:', {
            player1Info,
            player2Info
        });

        // 플레이어에게 게임 시작 알림 (게임 상태도 함께 전송)
        console.log(`📤 gameStarted 이벤트 전송 시작`);
        
        const gameStartData1 = { 
            playerId: 'player1', 
            roomId,
            gameState,
            playerInfo: { me: player1Info, opponent: player2Info }
        };
        const gameStartData2 = { 
            playerId: 'player2', 
            roomId,
            gameState,
            playerInfo: { me: player2Info, opponent: player1Info }
        };
        
        console.log(`📤 Player1에게 전송할 데이터:`, gameStartData1);
        console.log(`📤 Player2에게 전송할 데이터:`, gameStartData2);
        
        firstPlayer.emit('gameStarted', gameStartData1);
        secondPlayer.emit('gameStarted', gameStartData2);
        
        console.log(`✅ gameStarted 이벤트 전송 완료`);

        // 게임 상태 전송
        console.log(`📤 gameState 이벤트 전송 시작`);
        this.io.to(roomId).emit('gameState', gameState);
        console.log(`✅ gameState 이벤트 전송 완료`);

        console.log(`🎯 게임 초기 턴 정보:`, {
            currentTurn: gameState.currentTurn,
            player1: `${(firstPlayer as any).userId}`,
            player2: `${(secondPlayer as any).userId}`,
            firstPlayerIsCurrentTurn: gameState.currentTurn === 'player1'
        });

        // 턴 타이머 시작
        console.log(`⏰ 턴 타이머 시작`);
        this.startTurnTimer(roomId);

        // 봇이 있으면 봇의 움직임 시작
        console.log(`🔍 봇 움직임 체크 시작`);
        room.players.forEach((playerData, socketId) => {
            console.log(`👤 플레이어 체크: ${playerData.playerId}, userId: ${playerData.userId}`);
            if (playerData.userId === 'bot_player_001') {
                console.log(`🤖 봇 발견! playerId: ${playerData.playerId}, 현재 턴: ${gameState.currentTurn}`);
                // 봇의 턴이면 즉시 움직임, 아니면 대기
                if (playerData.playerId === gameState.currentTurn) {
                    console.log(`🤖 봇의 턴임! 1초 후 움직임 시작`);
                    setTimeout(() => {
                        this.makeBotMove(roomId, playerData.socket);
                    }, 1000);
                } else {
                    console.log(`🤖 봇 대기 중 (현재 턴: ${gameState.currentTurn})`);
                }
            }
        });

        console.log(`🎉 게임 생성 완료: ${roomId} (Player1: ${(firstPlayer as any).userId}, Player2: ${(secondPlayer as any).userId})`);
        
        // 게임 시작 직후 첫 번째 턴이 봇인지 확인
        const firstTurnPlayerData = Array.from(room.players.values()).find(p => p.playerId === gameState.currentTurn);
        if (firstTurnPlayerData && (firstTurnPlayerData.userId === 'bot_player_001' || firstTurnPlayerData.userId === 'bot_player_002')) {
            console.log(`🤖 첫 번째 턴이 봇의 턴임 (${firstTurnPlayerData.userId})! 2초 후 자동 움직임 시작`);
            setTimeout(() => {
                this.makeBotMove(roomId, firstTurnPlayerData.socket);
            }, 2000);
        }
    }

    // 공통 게임 상태 검증 메서드
    private validateGameAction(socket: Socket): { room: Room; playerData: any; playerId: string } | null {
        const room = this.findPlayerRoom(socket.id);
        if (!room || !room.isGameActive) return null;

        const playerData = room.players.get(socket.id);
        if (!playerData) return null;

        const { playerId } = playerData;
        const { gameState } = room;

        // 현재 턴인지 확인
        if (playerId !== gameState.currentTurn) return null;

        return { room, playerData, playerId };
    }

    private handlePlayerMove(socket: Socket, newPosition: Position) {
        console.log(`[GameManager] ➡️ handlePlayerMove 호출됨 from socket ${socket.id}`, { newPosition });
        const validation = this.validateGameAction(socket);
        if (!validation) {
            console.log(`[GameManager] ❌ 유효하지 않은 액션입니다.`);
            return;
        }

        const { room, playerId } = validation;
        const { gameState } = room;
        console.log(`[GameManager] ✅ 액션 유효성 검사 통과. Player: ${playerId}, Room: ${room.id}`);

        const currentPlayer = gameState.players.find(p => p.id === playerId);
        if (!currentPlayer) {
            console.log(`[GameManager] ❌ 현재 플레이어를 찾을 수 없습니다: ${playerId}`);
            return;
        }
        console.log(`[GameManager] ♟️ 현재 플레이어 정보:`, { id: currentPlayer.id, pos: currentPlayer.position });

        // 이동 유효성 검사
        console.log(`[GameManager] 🧐 이동 유효성 검사 시작...`, { from: currentPlayer.position, to: newPosition });
        if (GameLogic.isValidMove(currentPlayer, newPosition, gameState)) {
            console.log(`[GameManager] ✅ 이동 유효성 검사 통과.`);
            currentPlayer.position = newPosition;
            
            // 승리 조건 확인
            if (GameLogic.checkWinCondition(currentPlayer)) {
                console.log(`[GameManager] 🏆 플레이어 ${playerId} 승리!`);
                this.endGame(room, playerId);
                return;
            }

            // 턴 변경
            const previousTurn = gameState.currentTurn;
            gameState.currentTurn = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
            console.log(`[GameManager] 🔄 턴 변경: ${previousTurn} → ${gameState.currentTurn}`);
            
            // 게임 상태 업데이트 전송
            console.log(`[GameManager] 📤 'gameState' 업데이트 전송 중...`);
            this.io.to(room.id).emit('gameState', gameState);
            
            // 턴 타이머 재시작
            this.startTurnTimer(room.id);

            // 새로운 턴이 봇의 턴인지 확인
            const nextPlayerData = Array.from(room.players.values()).find(p => p.playerId === gameState.currentTurn);
            if (nextPlayerData && (nextPlayerData.userId === 'bot_player_001' || nextPlayerData.userId === 'bot_player_002')) {
                console.log(`[GameManager] 🤖 다음 턴은 봇(${nextPlayerData.userId})의 턴, 자동 이동 시작.`);
                setTimeout(() => {
                    this.makeBotMove(room.id, nextPlayerData.socket);
                }, 500 + Math.random() * 1000); // 0.5-1.5초 후 봇 이동
            } else {
                console.log(`[GameManager] 👤 다음 턴은 인간 플레이어 (${nextPlayerData?.userId || 'unknown'})`);
            }
        } else {
            console.log(`[GameManager] ❌ 이동 유효성 검사 실패.`);
            socket.emit('notification', { type: 'error', message: '유효하지 않은 이동입니다.' });
        }
    }

    private handleWallPlacement(socket: Socket, { position, orientation }: { position: Position; orientation: 'horizontal' | 'vertical' }) {
        const validation = this.validateGameAction(socket);
        if (!validation) return;

        const { room, playerId } = validation;
        const { gameState } = room;

        const currentPlayer = gameState.players.find(p => p.id === playerId);
        if (!currentPlayer) return;

        const newWall: Wall = { position, orientation };

        // 벽 설치 유효성 검사
        if (GameLogic.isValidWallPlacement(newWall, gameState, currentPlayer)) {
            const tempWalls = [...gameState.walls, newWall];
            
            // 모든 플레이어가 목표에 도달할 수 있는지 확인
            const allPlayersHavePath = gameState.players.every(p => 
                GameLogic.hasPathToGoal(p, tempWalls)
            );

            if (allPlayersHavePath) {
                gameState.walls.push(newWall);
                currentPlayer.wallsLeft--;
                
                // 턴 변경
                gameState.currentTurn = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
                
                // 게임 상태 업데이트 전송
                this.io.to(room.id).emit('gameState', gameState);
                
                // 새로운 턴 타이머 시작
                this.startTurnTimer(room.id);

                // 다음 턴이 봇이면 봇 이동
                const nextPlayerData = Array.from(room.players.values()).find(p => p.playerId === gameState.currentTurn);
                if (nextPlayerData && (nextPlayerData.userId === 'bot_player_001' || nextPlayerData.userId === 'bot_player_002')) {
                    setTimeout(() => {
                        this.makeBotMove(room.id, nextPlayerData.socket);
                    }, 500 + Math.random() * 1000);
                }
            } else {
                socket.emit('notification', { type: 'error', message: '벽으로 상대방의 길을 막을 수 없습니다.' });
            }
        } else {
            socket.emit('notification', { type: 'error', message: '유효하지 않은 벽 위치입니다.' });
        }
    }

    private handleGameRestart(socket: Socket) {
        const room = this.findPlayerRoom(socket.id);
        if (!room) return;

        room.gameState = GameLogic.getInitialGameState();
        room.isGameActive = true;
        
        this.io.to(room.id).emit('gameState', room.gameState);
        this.io.to(room.id).emit('gameRestarted');
        
        this.startTurnTimer(room.id);
    }

    private handleForfeit(socket: Socket) {
        const room = this.findPlayerRoom(socket.id);
        if (!room || !room.isGameActive) return;

        const playerData = room.players.get(socket.id);
        if (!playerData) return;

        const { playerId } = playerData;
        
        // 상대방이 승리자가 됨
        const winnerId = playerId === 'player1' ? 'player2' : 'player1';
        
        console.log(`🏳️ 플레이어 ${playerId}가 기권했습니다. 승리자: ${winnerId}`);
        
        // 게임 종료 처리
        this.endGame(room, winnerId);
    }

    private handlePlayerDisconnect(socket: Socket) {
        const userId = (socket as any).userId;
        
        // 모든 큐에서 제거
        this.handleLeaveQueue(socket);
        
        // 간단한 큐에서도 제거
        const simpleQueueIndex = this.simpleQueue.findIndex(s => (s as any).userId === userId);
        if (simpleQueueIndex !== -1) {
            this.simpleQueue.splice(simpleQueueIndex, 1);
            console.log(`🚪 연결 해제로 간단 큐에서 제거: ${userId}`);
        }
        
        // 대기열에서 제거
        const waitingIndex = this.waitingPlayers.findIndex(p => p.id === socket.id);
        if (waitingIndex !== -1) {
            this.waitingPlayers.splice(waitingIndex, 1);
            return;
        }

        // 게임 중인 방에서 제거
        const room = this.findPlayerRoom(socket.id);
        if (room && room.isGameActive) {
            const disconnectedPlayerData = room.players.get(socket.id);
            
            if (disconnectedPlayerData) {
                const disconnectedPlayerId = disconnectedPlayerData.playerId;
                const winnerId = disconnectedPlayerId === 'player1' ? 'player2' : 'player1';
                
                console.log(`🚪 플레이어 ${disconnectedPlayerId}가 연결을 끊었습니다. 승리자: ${winnerId}`);
                
                // 상대방이 승리
                this.endGame(room, winnerId);
                return;
            }
        }
        
        if (room) {
            room.players.delete(socket.id);
            
            if (room.turnTimer) {
                clearTimeout(room.turnTimer);
            }

            // 상대방에게 알림
            this.io.to(room.id).emit('playerDisconnected', '상대방이 연결을 끊었습니다.');
            
            // 방이 비었으면 삭제
            if (room.players.size === 0) {
                this.rooms.delete(room.id);
            }
        }
    }

    private startTurnTimer(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room || !room.isGameActive) return;

        // 기존 타이머 정리
        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
        }

        room.turnTimer = setTimeout(() => {
            if (room.isGameActive) {
                // 현재 턴 플레이어 찾기
                const currentTurnPlayer = Array.from(room.players.values())
                    .find(p => p.playerId === room.gameState.currentTurn);
                
                if (currentTurnPlayer) {
                    console.log(`⏰ 시간 초과: ${room.gameState.currentTurn}이 패배`);
                    
                    // 시간 초과한 플레이어가 패배
                    const winnerId = room.gameState.currentTurn === 'player1' ? 'player2' : 'player1';
                    this.endGame(room, winnerId);
                } else {
                    // 플레이어 정보가 없으면 단순히 턴만 변경
                    room.gameState.currentTurn = room.gameState.currentTurn === 'player1' ? 'player2' : 'player1';
                    this.io.to(roomId).emit('gameState', room.gameState);
                    this.io.to(roomId).emit('turnTimedOut', '시간 초과로 턴이 넘어갔습니다.');
                    this.startTurnTimer(roomId);
                }
            }
        }, this.TURN_TIME_LIMIT * 1000);
    }

    private async endGame(room: Room, winnerId: string) {
        room.isGameActive = false;
        
        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
        }

        // 레이팅 업데이트 (랭크 게임인 경우)
        await this.handleGameEnd(room, winnerId);

        this.io.to(room.id).emit('gameOver', winnerId);
        
        // 잠시 후 게임 상태 초기화
        setTimeout(() => {
            room.gameState = GameLogic.getInitialGameState();
            this.io.to(room.id).emit('gameState', room.gameState);
        }, 3000);
    }

    private findPlayerRoom(socketId: string): Room | null {
        for (const room of this.rooms.values()) {
            if (room.players.has(socketId)) {
                return room;
            }
        }
        return null;
    }

    // 랭크 시스템 관련 메서드들
    private async loadUserRating(socket: Socket): Promise<void> {
        try {
            const userId = (socket as any).userId;
            if (mongoose.connection.readyState === 1) {
                const user = await User.findById(userId);
                if (user) {
                    (socket as any).rating = user.rating;
                    (socket as any).rank = RatingSystem.getRankByRating(user.rating);
                    (socket as any).username = user.username;
                }
            } else {
                (socket as any).rating = 1200; // 기본 레이팅
                (socket as any).rank = RatingSystem.getRankByRating(1200);
                (socket as any).username = `User_${userId?.toString().slice(-6) || 'Unknown'}`;
            }
        } catch (error) {
            console.error('레이팅 로드 실패:', error);
            const userId = (socket as any).userId;
            (socket as any).rating = 1200;
            (socket as any).rank = RatingSystem.getRankByRating(1200);
            (socket as any).username = `User_${userId?.toString().slice(-6) || 'Unknown'}`;
        }
    }

    private async handleJoinRankedQueue(socket: Socket): Promise<void> {
        const userId = (socket as any).userId;
        const username = (socket as any).username || `User_${userId?.toString().slice(-6)}`;
        
        console.log(`🎯 간단 매칭 큐 참여: ${userId} (${username}), 소켓ID: ${socket.id}`);
        console.log(`📊 참여 전 현재 큐 상태:`, this.simpleQueue.map(s => ({
            userId: (s as any).userId,
            socketId: s.id,
            connected: s.connected
        })));
        
        // 이미 큐에 있는지 확인
        const existingIndex = this.simpleQueue.findIndex(s => (s as any).userId === userId);
        if (existingIndex !== -1) {
            console.log(`⚠️ 이미 큐에 있음: ${userId}`);
            socket.emit('notification', { type: 'info', message: '이미 매칭 대기 중입니다.' });
            return;
        }
        
        // 큐에 추가
        (socket as any).queueJoinTime = Date.now(); // 큐 참가 시간 기록
        this.simpleQueue.push(socket);
        console.log(`✅ 큐 추가 완료: ${userId}, 현재 큐 크기: ${this.simpleQueue.length}`);
        console.log(`📊 참여 후 현재 큐 상태:`, this.simpleQueue.map(s => ({
            userId: (s as any).userId,
            socketId: s.id,
            connected: s.connected
        })));
        
        socket.emit('queueJoined', { 
            mode: 'ranked', 
            queueSize: this.simpleQueue.length
        });
        
        socket.emit('notification', { 
            type: 'info', 
            message: `매칭 대기 중... (${this.simpleQueue.length}명 대기)`, 
            duration: 3000 
        });
        
        // 즉시 매칭 시도
        console.log(`🔍 즉시 매칭 시도 호출 - 큐 크기: ${this.simpleQueue.length}`);
        this.trySimpleMatching();
    }

    private async handleJoinCustomQueue(socket: Socket): Promise<void> {
        // 랭크 매칭과 동일하게 처리 (테스트용)
        return this.handleJoinRankedQueue(socket);
    }

    private handleLeaveQueue(socket: Socket): void {
        const userId = (socket as any).userId;
        
        // 간단한 큐에서 제거
        const index = this.simpleQueue.findIndex(s => (s as any).userId === userId);
        if (index !== -1) {
            this.simpleQueue.splice(index, 1);
            console.log(`🚪 큐에서 제거: ${userId}, 남은 큐 크기: ${this.simpleQueue.length}`);
        }
        
        // 기존 매칭 시스템에서도 제거
        this.matchmakingSystem.removeFromQueue(userId, GameMode.RANKED);
        this.matchmakingSystem.removeFromQueue(userId, GameMode.CUSTOM);
        
        socket.emit('queueLeft');
        socket.emit('notification', { 
            type: 'info', 
            message: '매칭 대기를 취소했습니다.', 
            duration: 2000 
        });
    }

    private trySimpleMatching(): void {
        console.log(`🔍 간단 매칭 시도 시작, 현재 큐 크기: ${this.simpleQueue.length}`);
        console.log(`📊 매칭 전 큐 상태:`, this.simpleQueue.map(s => ({
            userId: (s as any).userId,
            socketId: s.id,
            connected: s.connected
        })));
        
        if (this.simpleQueue.length >= 2) {
            console.log(`🎯 매칭 조건 만족! 2명 이상 대기 중`);
            
            const player1 = this.simpleQueue.shift()!;
            const player2 = this.simpleQueue.shift()!;
            
            const userId1 = (player1 as any).userId;
            const userId2 = (player2 as any).userId;
            
            console.log(`🎮 간단 매칭 성공!`, {
                player1: { userId: userId1, socketId: player1.id, connected: player1.connected },
                player2: { userId: userId2, socketId: player2.id, connected: player2.connected }
            });
            
            // 연결 상태 확인
            if (!player1.connected) {
                console.log(`❌ Player1 연결 해제됨, 다시 큐에 Player2 추가`);
                this.simpleQueue.unshift(player2);
                return;
            }
            
            if (!player2.connected) {
                console.log(`❌ Player2 연결 해제됨, 다시 큐에 Player1 추가`);
                this.simpleQueue.unshift(player1);
                return;
            }
            
            // 매칭 성공 알림
            console.log(`📢 매칭 성공 알림 전송`);
            player1.emit('notification', { 
                type: 'success', 
                message: '상대방을 찾았습니다! 게임을 시작합니다.', 
                duration: 3000 
            });
            player2.emit('notification', { 
                type: 'success', 
                message: '상대방을 찾았습니다! 게임을 시작합니다.', 
                duration: 3000 
            });
            
            console.log(`🎮 createGame 함수 호출 시작`);
            // 즉시 게임 생성
            this.createGame(player1, player2, GameMode.RANKED);
            console.log(`✅ createGame 함수 호출 완료`);
        } else {
            console.log(`⏳ 매칭 조건 미만족: ${this.simpleQueue.length}명 대기 중 (2명 필요)`);
        }
    }

    private startSimpleMatchmakingLoop(): void {
        console.log('🔄 간단 매칭 루프 시작됨');
        
        setInterval(() => {
            if (this.simpleQueue.length >= 2) {
                console.log(`🎯 매칭 가능: ${this.simpleQueue.length}명 대기 중`);
                this.trySimpleMatching();
            } else if (this.simpleQueue.length === 1) {
                // 1명이 10초 이상 대기 중이면 봇 추가
                const waitingPlayer = this.simpleQueue[0];
                const waitTime = Date.now() - ((waitingPlayer as any).queueJoinTime || Date.now());
                
                if (waitTime > 10000) { // 10초 대기
                    console.log('⏰ 10초 대기 후 자동으로 봇 추가');
                    this.addTestBot();
                }
            }
        }, 2000); // 2초마다 확인
    }

    private async handleGetLeaderboard(callback: (data: any) => void): Promise<void> {
        try {
            if (mongoose.connection.readyState !== 1) {
                callback({ error: '데이터베이스 연결이 필요합니다.' });
                return;
            }

            const topPlayers = await User.find({})
                .sort({ rating: -1 })
                .limit(100)
                .select('username rating gamesPlayed gamesWon');

            const leaderboard = topPlayers.map((user, index) => ({
                rank: index + 1,
                username: user.username,
                rating: user.rating,
                tier: RatingSystem.getRankByRating(user.rating),
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon,
                winRate: user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0
            }));

            callback({ leaderboard });
        } catch (error) {
            console.error('리더보드 조회 실패:', error);
            callback({ error: '리더보드를 불러올 수 없습니다.' });
        }
    }

    private async handleGetRating(socket: Socket, callback: (data: any) => void): Promise<void> {
        try {
            const userId = (socket as any).userId;
            const rating = (socket as any).rating || 1200;
            const rank = RatingSystem.getRankByRating(rating);

            if (mongoose.connection.readyState === 1) {
                const user = await User.findById(userId);
                if (user) {
                    callback({
                        rating: user.rating,
                        rank: RatingSystem.getRankByRating(user.rating),
                        gamesPlayed: user.gamesPlayed,
                        gamesWon: user.gamesWon,
                        winRate: user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0
                    });
                    return;
                }
            }

            callback({
                rating,
                rank,
                gamesPlayed: 0,
                gamesWon: 0,
                winRate: 0
            });
        } catch (error) {
            console.error('레이팅 조회 실패:', error);
            callback({ error: '레이팅 정보를 불러올 수 없습니다.' });
        }
    }

    private startMatchmakingLoop(): void {
        console.log('🔄 매칭 루프 시작됨');
        
        setInterval(() => {
            // 현재 큐 상태 로그
            const rankedQueueSize = this.matchmakingSystem.getQueueSize(GameMode.RANKED);
            const customQueueSize = this.matchmakingSystem.getQueueSize(GameMode.CUSTOM);
            
            if (rankedQueueSize > 0 || customQueueSize > 0) {
                console.log(`🔍 매칭 시도 중... 랭크: ${rankedQueueSize}명, 커스텀: ${customQueueSize}명`);
            }
            
            // 랭크 매칭 처리
            this.matchmakingSystem.processMatching(GameMode.RANKED, (match) => {
                console.log(`🎮 랭크 매칭 발견! ${match.player1.userId} vs ${match.player2.userId}`);
                this.createRankedGame(match.player1, match.player2);
            });

            // 커스텀 매칭 처리
            this.matchmakingSystem.processMatching(GameMode.CUSTOM, (match) => {
                console.log(`🎮 커스텀 매칭 발견! ${match.player1.userId} vs ${match.player2.userId}`);
                this.createCustomGame(match.player1, match.player2);
            });
        }, 1000); // 1초마다 매칭 시도
    }

    private createRankedGame(player1Request: MatchmakingRequest, player2Request: MatchmakingRequest): void {
        // 소켓 찾기
        const player1Socket = this.findSocketByUserId(player1Request.userId);
        const player2Socket = this.findSocketByUserId(player2Request.userId);

        console.log(`🔍 소켓 찾기 결과:`, {
            player1: { userId: player1Request.userId, found: !!player1Socket },
            player2: { userId: player2Request.userId, found: !!player2Socket }
        });

        if (player1Socket && player2Socket) {
            // 매칭 성공 알림
            player1Socket.emit('notification', { 
                type: 'success', 
                message: '랭크 게임 상대방을 찾았습니다!', 
                duration: 3000 
            });
            player2Socket.emit('notification', { 
                type: 'success', 
                message: '랭크 게임 상대방을 찾았습니다!', 
                duration: 3000 
            });
            
            console.log(`🎮 랭크 게임 생성 시작: ${player1Request.userId} vs ${player2Request.userId}`);
            this.createGame(player1Socket, player2Socket, GameMode.RANKED);
        } else {
            console.error(`❌ 매칭 실패: 소켓을 찾을 수 없음`, {
                player1Socket: !!player1Socket,
                player2Socket: !!player2Socket
            });
            
            // 실패한 플레이어들을 다시 큐에 추가
            if (!player1Socket) {
                console.log(`🔄 플레이어1 소켓 없음, 큐에서 제거: ${player1Request.userId}`);
                this.matchmakingSystem.removeFromQueue(player1Request.userId, GameMode.RANKED);
            }
            if (!player2Socket) {
                console.log(`🔄 플레이어2 소켓 없음, 큐에서 제거: ${player2Request.userId}`);
                this.matchmakingSystem.removeFromQueue(player2Request.userId, GameMode.RANKED);
            }
        }
    }

    private createCustomGame(player1Request: MatchmakingRequest, player2Request: MatchmakingRequest): void {
        // 소켓 찾기
        const player1Socket = this.findSocketByUserId(player1Request.userId);
        const player2Socket = this.findSocketByUserId(player2Request.userId);

        console.log(`🔍 커스텀 게임 소켓 찾기 결과:`, {
            player1: { userId: player1Request.userId, found: !!player1Socket },
            player2: { userId: player2Request.userId, found: !!player2Socket }
        });

        if (player1Socket && player2Socket) {
            // 매칭 성공 알림
            player1Socket.emit('notification', { 
                type: 'success', 
                message: '일반 게임 상대방을 찾았습니다!', 
                duration: 3000 
            });
            player2Socket.emit('notification', { 
                type: 'success', 
                message: '일반 게임 상대방을 찾았습니다!', 
                duration: 3000 
            });
            
            console.log(`🎮 커스텀 게임 생성 시작: ${player1Request.userId} vs ${player2Request.userId}`);
            this.createGame(player1Socket, player2Socket, GameMode.CUSTOM);
        } else {
            console.error(`❌ 커스텀 매칭 실패: 소켓을 찾을 수 없음`, {
                player1Socket: !!player1Socket,
                player2Socket: !!player2Socket
            });
            
            // 실패한 플레이어들을 다시 큐에서 제거
            if (!player1Socket) {
                this.matchmakingSystem.removeFromQueue(player1Request.userId, GameMode.CUSTOM);
            }
            if (!player2Socket) {
                this.matchmakingSystem.removeFromQueue(player2Request.userId, GameMode.CUSTOM);
            }
        }
    }

    private findSocketByUserId(userId: string): Socket | null {
        console.log(`🔍 소켓 찾기 시작: ${userId}`);
        console.log(`📊 현재 연결된 소켓 수: ${this.io.sockets.sockets.size}`);
        
        for (const [socketId, socket] of this.io.sockets.sockets) {
            const socketUserId = (socket as any).userId;
            console.log(`🔎 소켓 확인: ${socketId} -> userId: ${socketUserId}`);
            
            if (socketUserId === userId) {
                console.log(`✅ 소켓 찾음: ${userId} -> ${socketId}`);
                return socket;
            }
        }
        
        console.log(`❌ 소켓을 찾을 수 없음: ${userId}`);
        return null;
    }

    private async handleGameEnd(room: Room, winnerId: string): Promise<void> {
        const winnerPlayer = Array.from(room.players.values()).find(p => p.playerId === winnerId);
        const loserPlayer = Array.from(room.players.values()).find(p => p.playerId !== winnerId);

        if (!winnerPlayer || !loserPlayer) return;

        // 랭크 게임인 경우 레이팅 업데이트
        if (room.mode === GameMode.RANKED && mongoose.connection.readyState === 1) {
            try {
                const winnerRating = winnerPlayer.rating || 1200;
                const loserRating = loserPlayer.rating || 1200;

                const ratingResult = RatingSystem.calculateRating(winnerRating, loserRating);
                const gameDuration = Date.now() - room.startTime;

                // 데이터베이스 업데이트
                await User.findByIdAndUpdate(winnerPlayer.userId, {
                    $inc: { gamesPlayed: 1, gamesWon: 1 },
                    rating: ratingResult.winner.newRating
                });

                await User.findByIdAndUpdate(loserPlayer.userId, {
                    $inc: { gamesPlayed: 1 },
                    rating: ratingResult.loser.newRating
                });

                // 클라이언트에 레이팅 변화 알림
                winnerPlayer.socket.emit('ratingUpdate', ratingResult.winner);
                loserPlayer.socket.emit('ratingUpdate', ratingResult.loser);

                // 승부 결과 팝업 알림
                winnerPlayer.socket.emit('notification', { 
                    type: 'success', 
                    message: `승리! 레이팅: ${ratingResult.winner.oldRating} → ${ratingResult.winner.newRating} (${ratingResult.winner.change >= 0 ? '+' : ''}${ratingResult.winner.change})`, 
                    duration: 5000 
                });
                loserPlayer.socket.emit('notification', { 
                    type: 'info', 
                    message: `패배. 레이팅: ${ratingResult.loser.oldRating} → ${ratingResult.loser.newRating} (${ratingResult.loser.change})`, 
                    duration: 5000 
                });

            } catch (error) {
                // 에러 발생 시 팝업으로 알림
                winnerPlayer.socket.emit('notification', { type: 'error', message: '레이팅 업데이트에 실패했습니다.' });
                loserPlayer.socket.emit('notification', { type: 'error', message: '레이팅 업데이트에 실패했습니다.' });
            }
        }
    }

    private handleTurnTimeout(socket: Socket) {
        const room = this.findPlayerRoom(socket.id);
        if (!room || !room.isGameActive) return;

        const playerData = room.players.get(socket.id);
        if (!playerData) return;

        const { playerId } = playerData;
        const { gameState } = room;

        // 현재 턴인 플레이어만 타임아웃 처리
        if (playerId === gameState.currentTurn) {
            console.log(`⏰ 클라이언트에서 타임아웃 신호: ${playerId} in room ${room.id}`);
            
            // 시간 초과한 플레이어가 패배
            const winnerId = playerId === 'player1' ? 'player2' : 'player1';
            console.log(`⏰ 시간 초과로 ${playerId} 패배, 승리자: ${winnerId}`);
            
            this.endGame(room, winnerId);
        }
    }

    // 테스트용 봇 플레이어를 큐에 추가하는 메서드
    private addTestBot(): void {
        console.log('🤖 테스트 봇 플레이어 생성');
        
        // 가짜 소켓 객체 생성
        const botSocket = {
            id: `bot_${Date.now()}`,
            connected: true,
            join: (roomId: string) => console.log(`🤖 봇이 방 ${roomId}에 참가`),
            emit: (event: string, data?: any) => console.log(`🤖 봇에게 이벤트 전송: ${event}`, data),
            on: () => {},
            disconnect: () => console.log('🤖 봇 연결 해제')
        } as any;
        
        // 봇 사용자 정보 설정
        (botSocket as any).userId = 'bot_player_001';
        (botSocket as any).username = 'TestBot';
        (botSocket as any).rating = 1200;
        
        // 봇을 큐에 추가
        this.simpleQueue.push(botSocket);
        console.log(`🤖 봇이 큐에 추가됨. 현재 큐 크기: ${this.simpleQueue.length}`);
        
        // 매칭 시도
        this.trySimpleMatching();
    }

    // 테스트용 명령어 핸들러 추가
    private handleAddTestBot(socket: Socket): void {
        console.log('🎯 테스트 봇 추가 요청');
        this.addTestBot();
        socket.emit('notification', { 
            type: 'info', 
            message: '테스트 봇이 추가되었습니다.', 
            duration: 3000 
        });
    }

    // 봇끼리만 매칭하는 테스트 기능 추가
    private createBotVsBotGame(): void {
        console.log('🤖 vs 🤖 봇끼리 게임 생성 시작');
        
        // 두 개의 봇 생성
        const bot1Socket = {
            id: `bot_${Date.now()}_1`,
            connected: true,
            join: (roomId: string) => console.log(`🤖 Bot1이 방 ${roomId}에 참가`),
            emit: (event: string, data?: any) => console.log(`🤖 Bot1에게 이벤트 전송: ${event}`, data),
            on: () => {},
            disconnect: () => console.log('🤖 Bot1 연결 해제')
        } as any;
        
        const bot2Socket = {
            id: `bot_${Date.now()}_2`,
            connected: true,
            join: (roomId: string) => console.log(`🤖 Bot2가 방 ${roomId}에 참가`),
            emit: (event: string, data?: any) => console.log(`🤖 Bot2에게 이벤트 전송: ${event}`, data),
            on: () => {},
            disconnect: () => console.log('🤖 Bot2 연결 해제')
        } as any;
        
        // 봇 정보 설정
        (bot1Socket as any).userId = 'bot_player_001';
        (bot1Socket as any).username = 'TestBot1';
        (bot1Socket as any).rating = 1200;
        
        (bot2Socket as any).userId = 'bot_player_002';
        (bot2Socket as any).username = 'TestBot2';
        (bot2Socket as any).rating = 1200;
        
        console.log('🤖 봇끼리 게임 생성');
        this.createGame(bot1Socket, bot2Socket, GameMode.RANKED);
    }

    // 봇끼리 게임 테스트 명령어 핸들러
    private handleCreateBotGame(socket: Socket): void {
        console.log('🎯 봇끼리 게임 생성 요청');
        this.createBotVsBotGame();
        socket.emit('notification', { 
            type: 'info', 
            message: '봇끼리 게임이 생성되었습니다. 서버 로그를 확인하세요.', 
            duration: 5000 
        });
    }

    // 봇 AI 로직 - 간단한 랜덤 움직임
    private makeBotMove(roomId: string, botSocket: any): void {
        const room = this.rooms.get(roomId);
        if (!room || !room.isGameActive) {
            console.log(`🤖 봇 움직임 중단: 방이 없거나 비활성 상태 (roomId: ${roomId})`);
            return;
        }

        console.log(`🤖 봇이 움직임을 계산 중... (방: ${roomId})`);

        // 현재 봇의 플레이어 ID 찾기
        let botPlayerId: string | null = null;
        for (const [socketId, playerData] of room.players) {
            if (playerData.socket === botSocket) {
                botPlayerId = playerData.playerId;
                break;
            }
        }

        if (!botPlayerId) {
            console.log('🤖 봇의 플레이어 ID를 찾을 수 없음');
            return;
        }

        console.log(`🤖 봇 플레이어 ID: ${botPlayerId}, 현재 턴: ${room.gameState.currentTurn}`);

        // 봇의 턴이 아니면 리턴
        if (room.gameState.currentTurn !== botPlayerId) {
            console.log(`🤖 봇의 턴이 아님. 현재 턴: ${room.gameState.currentTurn}`);
            return;
        }

        // 봇의 현재 위치 찾기
        const botPlayer = room.gameState.players.find(p => p.id === botPlayerId);
        if (!botPlayer) {
            console.log('🤖 봇 플레이어를 찾을 수 없음');
            return;
        }

        console.log(`🤖 봇 현재 위치: (${botPlayer.position.x}, ${botPlayer.position.y})`);

        // 매우 간단한 전진 로직
        const currentY = botPlayer.position.y;
        const currentX = botPlayer.position.x;
        let newPosition = { x: currentX, y: currentY };

        // Player1은 아래로 (y 증가), Player2는 위로 (y 감소)
        if (botPlayerId === 'player1') {
            newPosition.y = Math.min(8, currentY + 1);
        } else {
            newPosition.y = Math.max(0, currentY - 1);
        }

        console.log(`🤖 봇이 이동 결정: (${currentX}, ${currentY}) → (${newPosition.x}, ${newPosition.y})`);

        // 즉시 이동 실행
        console.log(`🤖 봇 실제 이동 실행 중...`);
        try {
            this.handlePlayerMove(botSocket, newPosition);
            console.log(`🤖 봇 이동 완료!`);
        } catch (error) {
            console.error(`🤖 봇 이동 중 에러:`, error);
        }
    }
}
