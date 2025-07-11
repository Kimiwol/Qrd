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
    players: Map<string, { socket: Socket; userId: string; playerId: 'player1' | 'player2'; rating?: number; username?: string }>;
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
        // 간단한 매칭 루프는 경합 상태를 유발할 수 있으므로 우선 비활성화
        // this.startSimpleMatchmakingLoop();
    }

    private async loadUserRating(socket: Socket) {
        try {
            const userId = (socket as any).userId;
            if (!userId || mongoose.connection.readyState !== 1) {
                (socket as any).rating = 1200; // 기본값
                (socket as any).username = `Guest_${userId?.toString().slice(-4) ?? '????'}`;
                return;
            }
            const user = await User.findById(userId);
            if (user) {
                (socket as any).rating = user.rating;
                (socket as any).username = user.username;
                console.log(`[GameManager] 🙋‍♂️ 사용자 정보 로드: ${user.username} (레이팅: ${user.rating})`);
            } else {
                (socket as any).rating = 1200;
                (socket as any).username = `User_${userId.toString().slice(-4)}`;
                console.log(`[GameManager] 🤷‍♂️ DB에 없는 사용자, 기본값 설정: ${(socket as any).username}`);
            }
        } catch (error) {
            console.error('[GameManager] ❌ 레이팅 로드 실패:', error);
            (socket as any).rating = 1200;
            (socket as any).username = `User_${(socket as any).userId?.toString().slice(-4) ?? '????'}`;
        }
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
        
        socket.on('requestInitialGameState', (roomId) => this.handleRequestInitialGameState(socket, roomId));
        
        socket.on('disconnect', () => this.handlePlayerDisconnect(socket));

        console.log(`플레이어 ${userId} 매칭 대기 중...`);
    }

    private handleJoinRankedQueue(socket: Socket) {
        const request: MatchmakingRequest = {
            socket,
            userId: (socket as any).userId,
            rating: (socket as any).rating,
            mode: GameMode.RANKED,
        };
        console.log(`[GameManager] เข้าร่วมคิวจัดอันดับ: ${request.userId} (Rating: ${request.rating})`);
        this.matchmakingSystem.addPlayer(request);
        this.tryMatchmaking(GameMode.RANKED);
    }

    private handleJoinCustomQueue(socket: Socket) {
        const request: MatchmakingRequest = {
            socket,
            userId: (socket as any).userId,
            rating: (socket as any).rating, // Custom 게임에서는 rating이 중요하지 않을 수 있음
            mode: GameMode.CUSTOM,
        };
        console.log(`[GameManager] カスタムキューに参加: ${request.userId}`);
        this.matchmakingSystem.addPlayer(request);
        this.tryMatchmaking(GameMode.CUSTOM);
    }

    private handleLeaveQueue(socket: Socket) {
        const userId = (socket as any).userId;
        console.log(`[GameManager] 큐에서 나가기: ${userId}`);
        this.matchmakingSystem.removePlayer(socket.id);
        socket.emit('notification', { type: 'info', message: '매칭 대기열에서 나왔습니다.' });
    }

    private tryMatchmaking(mode: GameMode) {
        console.log(`[GameManager] ${mode} 게임 매칭 시도...`);
        const match = this.matchmakingSystem.findMatch(mode);
        if (match) {
            console.log(`[GameManager] ✅ 매치 발견! 플레이어 확인 및 게임 생성 준비...`, {
                player1: (match.player1.socket as any).userId,
                player2: (match.player2.socket as any).userId,
            });
            // 바로 createGame을 호출하는 대신, 확인 절차를 거칩니다.
            this.confirmAndCreateGame(match.player1.socket, match.player2.socket, mode);
        } else {
            console.log(`[GameManager] 🤷‍♂️ 아직 매칭할 상대가 없습니다.`);
        }
    }

    private confirmAndCreateGame(player1Socket: Socket, player2Socket: Socket, mode: GameMode) {
        // 1. 두 소켓이 여전히 연결되어 있는지 확인합니다.
        if (!player1Socket.connected || !player2Socket.connected) {
            console.error('[GameManager] ❌ 매치된 플레이어 중 한 명의 연결이 끊어져 게임을 생성할 수 없습니다.', {
                p1_connected: player1Socket.connected,
                p2_connected: player2Socket.connected,
            });
            // 여기서 연결이 끊긴 플레이어를 큐에서 다시 제거하는 로직을 추가할 수 있습니다.
            // 예: if (!player1Socket.connected) this.matchmakingSystem.removePlayer(player1Socket.id);
            return;
        }

        console.log('[GameManager] ✅ 두 플레이어 모두 연결 확인됨. matchFound 이벤트 전송.');

        // 2. 각 플레이어에게 매치 상대를 찾았음을 알립니다.
        const player1Username = (player1Socket as any).username || 'Player 1';
        const player2Username = (player2Socket as any).username || 'Player 2';

        player1Socket.emit('matchFound', { opponent: player2Username });
        player2Socket.emit('matchFound', { opponent: player1Username });

        // 3. 짧은 지연 후 게임을 생성하여 클라이언트가 UI를 업데이트할 시간을 줍니다.
        setTimeout(() => {
            console.log('[GameManager] 🚀 지연 후 createGame 호출.');
            this.createGame(player1Socket, player2Socket, mode);
        }, 500); // 500ms 지연
    }

    private async handleGetLeaderboard(callback: (leaderboard: any) => void) {
        try {
            const leaderboard = await RatingSystem.getLeaderboard();
            callback(leaderboard);
        } catch (error) {
            console.error('[GameManager] 리더보드 조회 오류:', error);
            callback([]);
        }
    }

    private handleGetRating(socket: Socket, callback: (rating: any) => void) {
        const rating = (socket as any).rating;
        const username = (socket as any).username;
        callback({ rating, username });
    }

    private handleAddTestBot(socket: Socket) {
        // This is a simplified bot for testing.
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
        (botSocket as any).username = 'TestBot';
        (botSocket as any).rating = 1200;

        const request: MatchmakingRequest = {
            socket: botSocket as Socket,
            userId: (botSocket as any).userId,
            rating: (botSocket as any).rating,
            mode: GameMode.CUSTOM,
        };

        this.matchmakingSystem.addPlayer(request);
        console.log(`[GameManager] 🤖 테스트 봇 [${(botSocket as any).username}]을(를) 커스텀 큐에 추가했습니다.`);
        this.tryMatchmaking(GameMode.CUSTOM);
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
        this.createGame(socket, botSocket as Socket, GameMode.CUSTOM);
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

    private createGame(player1Socket: Socket, player2Socket: Socket, mode: GameMode = GameMode.CUSTOM) {
        console.log(`🎮 createGame 함수 시작:`, {
            player1: { userId: (player1Socket as any).userId, socketId: player1Socket.id, connected: player1Socket.connected },
            player2: { userId: (player2Socket as any).userId, socketId: player2Socket.id, connected: player2Socket.connected },
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

        // 플레이어 설정 (랜덤 지정 대신, 인자로 들어온 순서대로 P1, P2 지정)
        room.players.set(player1Socket.id, {
            socket: player1Socket,
            userId: (player1Socket as any).userId,
            playerId: 'player1',
            rating: (player1Socket as any).rating,
            username: (player1Socket as any).username
        });

        room.players.set(player2Socket.id, {
            socket: player2Socket,
            userId: (player2Socket as any).userId,
            playerId: 'player2',
            rating: (player2Socket as any).rating,
            username: (player2Socket as any).username
        });

        console.log(`👥 플레이어 룸 설정 완료:`, {
            player1: room.players.get(player1Socket.id),
            player2: room.players.get(player2Socket.id)
        });

        // 방에 참가
        player1Socket.join(roomId);
        player2Socket.join(roomId);

        this.rooms.set(roomId, room);
        console.log(`🗂️ 룸 맵에 저장 완료. 총 방 개수: ${this.rooms.size}`);

        // 플레이어 정보 수집
        const player1Info = {
            id: 'player1',
            username: (player1Socket as any).username || `User_${(player1Socket as any).userId?.toString().slice(-6)}`
        };
        
        const player2Info = {
            id: 'player2', 
            username: (player2Socket as any).username || `User_${(player2Socket as any).userId?.toString().slice(-6)}`
        };

        console.log('📤 전송할 플레이어 정보:', { player1Info, player2Info });

        // 각 플레이어에게 역할을 지정하여 게임 시작 알림
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
        
        console.log(`📤 Player1 (${player1Socket.id})에게 'gameStarted' 전송`);
        player1Socket.emit('gameStarted', gameStartData1);
        
        console.log(`📤 Player2 (${player2Socket.id})에게 'gameStarted' 전송`);
        player2Socket.emit('gameStarted', gameStartData2);
        
        // 게임 상태는 gameStarted 이벤트에 포함되어 있으므로 중복 전송 제거
        // this.io.to(roomId).emit('gameState', gameState);

        console.log(`🎯 게임 초기 턴 정보: currentTurn: ${gameState.currentTurn}`);

        // 턴 타이머 시작
        this.startTurnTimer(roomId);
        
        console.log(`🎉 게임 생성 완료: ${roomId} (Player1: ${(player1Socket as any).userId}, Player2: ${(player2Socket as any).userId})`);
        
        // 봇 관련 로직 (필요 시)
        this.checkAndStartBotMove(room);
    }

    private makeBotMove(roomId: string, botSocket: Socket) {
        const room = this.rooms.get(roomId);
        if (!room || !room.isGameActive || room.gameState.currentTurn !== (room.players.get(botSocket.id)?.playerId)) {
            return;
        }

        console.log(`[GameManager] 🤖 봇 [${(botSocket as any).username}]의 턴, 움직임 계산 중...`);

        // 매우 간단한 봇 로직: 가능한 움직임 중 하나를 무작위로 선택
        const { gameState } = room;
        const botPlayerId = room.players.get(botSocket.id)!.playerId;
        const botPlayerState = botPlayerId === 'player1' ? gameState.player1 : gameState.player2;

        const validMoves = GameLogic.getValidMoves(botPlayerState.position, gameState.walls, botPlayerId);

        if (validMoves.length > 0) {
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            console.log(`[GameManager] 🤖 봇이 [${move.row}, ${move.col}]로 이동합니다.`);
            this.handlePlayerMove(botSocket, move);
        } else {
            // 움직일 수 없을 경우 (이론상 발생하면 안됨)
            console.log(`[GameManager] 🤖 봇이 움직일 곳이 없습니다!`);
            const winner = botPlayerId === 'player1' ? 'player2' : 'player1';
            this.endGame(room, winner, 'stuck');
        }
    }

    private checkAndStartBotMove(room: Room) {
        const currentTurnPlayerId = room.gameState.currentTurn;
        const currentPlayer = Array.from(room.players.values()).find(p => p.playerId === currentTurnPlayerId);

        if (currentPlayer && currentPlayer.userId.startsWith('bot_')) {
            console.log(`[GameManager] 🤖 봇의 턴입니다: ${currentPlayer.username}. 1초 후 움직입니다.`);
            setTimeout(() => {
                this.makeBotMove(room.id, currentPlayer.socket);
            }, 1000);
        }
    }

    // 공통 게임 상태 검증 메서드
    private validateGameAction(socket: Socket): { room: Room; playerData: any; playerId: 'player1' | 'player2' } | null {
        const room = this.findPlayerRoom(socket.id);
        if (!room || !room.isGameActive) {
            socket.emit('error', '유효하지 않은 게임이거나 이미 종료되었습니다.');
            return null;
        }

        const playerData = room.players.get(socket.id);
        if (!playerData) {
            socket.emit('error', '플레이어 정보를 찾을 수 없습니다.');
            return null;
        }

        const { playerId } = playerData;
        const { gameState } = room;

        // 현재 턴인지 확인
        if (playerId !== gameState.currentTurn) {
            socket.emit('error', '당신의 턴이 아닙니다.');
            return null;
        }

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

        const playerState = playerId === 'player1' ? gameState.player1 : gameState.player2;

        if (GameLogic.isValidMove(playerState.position, newPosition, gameState.walls)) {
            console.log(`[GameManager] ✅ 유효한 움직임: ${playerId} at [${newPosition.row}, ${newPosition.col}]`);
            playerState.position = newPosition;

            // 승리 조건 확인
            if (GameLogic.checkWinCondition(playerState.position, playerId)) {
                this.endGame(room, playerId, 'win');
                return;
            }

            // 턴 전환
            gameState.currentTurn = playerId === 'player1' ? 'player2' : 'player1';
            this.io.to(room.id).emit('gameState', gameState);
            this.startTurnTimer(room.id);
            this.checkAndStartBotMove(room);
        } else {
            console.log(`[GameManager] ❌ 유효하지 않은 움직임입니다.`);
            socket.emit('error', '유효하지 않은 움직임입니다.');
        }
    }

    private handleWallPlacement(socket: Socket, wall: Wall) {
        console.log(`[GameManager] 🧱 handleWallPlacement 호출됨 from socket ${socket.id}`, { wall });
        const validation = this.validateGameAction(socket);
        if (!validation) return;

        const { room, playerId } = validation;
        const { gameState } = room;
        const playerState = playerId === 'player1' ? gameState.player1 : gameState.player2;

        if (playerState.walls > 0 && GameLogic.isValidWallPlacement(wall, gameState.walls, gameState.player1.position, gameState.player2.position)) {
            console.log(`[GameManager] ✅ 유효한 벽 설치`);
            gameState.walls.push(wall);
            playerState.walls--;

            // 턴 전환
            gameState.currentTurn = playerId === 'player1' ? 'player2' : 'player1';
            this.io.to(room.id).emit('gameState', gameState);
            this.startTurnTimer(room.id);
            this.checkAndStartBotMove(room);
        } else {
            console.log(`[GameManager] ❌ 유효하지 않은 벽 설치`);
            socket.emit('error', '유효하지 않은 벽 설치입니다.');
        }
    }

    private handleGameRestart(socket: Socket) {
        // 재시작 로직은 보통 양측의 동의가 필요하지만, 여기서는 단순화하여 한쪽이 요청하면 바로 재시작
        const room = this.findPlayerRoom(socket.id);
        if (room) {
            console.log(`[GameManager] 🔄 게임 재시작 요청: ${room.id}`);
            const players = Array.from(room.players.values());
            if (players.length === 2) {
                // 기존 게임 종료 처리 (레이팅 변화 없음)
                if (room.turnTimer) clearTimeout(room.turnTimer);
                this.rooms.delete(room.id);

                // 새 게임 생성
                this.createGame(players[0].socket, players[1].socket, room.mode);
            }
        }
    }

    private handleTurnTimeout(socket: Socket) {
        const room = this.findPlayerRoom(socket.id);
        if (!room || !room.isGameActive) return;

        const playerData = room.players.get(socket.id);
        if (!playerData || playerData.playerId !== room.gameState.currentTurn) {
            // 타임아웃을 보고한 플레이어가 현재 턴이 아니면 무시 (클라이언트의 잘못된 보고일 수 있음)
            return;
        }

        console.log(`[GameManager] ⏰ 클라이언트로부터 턴 타임아웃 보고 받음: ${room.id}`);
        const loserPlayerId = room.gameState.currentTurn;
        const winnerPlayerId = loserPlayerId === 'player1' ? 'player2' : 'player1';
        this.endGame(room, winnerPlayerId, 'timeout');
    }

    private handleForfeit(socket: Socket) {
        const room = this.findPlayerRoom(socket.id);
        if (room && room.isGameActive) {
            const loserData = room.players.get(socket.id);
            if (loserData) {
                console.log(`[GameManager] 🏳️ 플레이어 기권: ${loserData.userId}`);
                const winnerPlayerId = loserData.playerId === 'player1' ? 'player2' : 'player1';
                this.endGame(room, winnerPlayerId, 'forfeit');
            }
        }
    }

    private handlePlayerDisconnect(socket: Socket) {
        const userId = (socket as any).userId;
        console.log(`[GameManager] 🔌 플레이어 연결 끊김: ${userId} (${socket.id})`);

        // 매칭 대기열에서 제거
        this.handleLeaveQueue(socket);

        // 게임 중이었다면 기권패 처리
        const room = this.findPlayerRoom(socket.id);
        if (room && room.isGameActive) {
            const disconnectedPlayerData = room.players.get(socket.id);
            if (disconnectedPlayerData) {
                // 잠시 대기 후 재연결이 없으면 패배 처리 (여기서는 즉시 처리)
                console.log(`[GameManager] 🎮 게임 중 연결 끊김, 기권패 처리`);
                const winnerId = disconnectedPlayerData.playerId === 'player1' ? 'player2' : 'player1';
                this.endGame(room, winnerId, 'disconnect');
            }
        }
    }

    private findPlayerRoom(socketId: string): Room | undefined {
        for (const room of this.rooms.values()) {
            if (room.players.has(socketId)) {
                return room;
            }
        }
        return undefined;
    }

    private startTurnTimer(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room || !room.isGameActive) return;

        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
        }

        room.turnTimer = setTimeout(() => {
            this.handleTurnTimeoutByTimer(roomId);
        }, this.TURN_TIME_LIMIT * 1000);
    }

    private handleTurnTimeoutByTimer(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room || !room.isGameActive) return;

        console.log(`[GameManager] ⏰ 서버 타이머에 의한 턴 시간 초과: ${room.id}`);
        const loserPlayerId = room.gameState.currentTurn;
        const winnerPlayerId = loserPlayerId === 'player1' ? 'player2' : 'player1';
        this.endGame(room, winnerPlayerId, 'timeout');
    }

    private async endGame(room: Room, winnerPlayerId: 'player1' | 'player2' | 'draw', reason: string = 'win') {
        if (!room.isGameActive) return;

        room.isGameActive = false;
        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
            room.turnTimer = null;
        }

        console.log(`[GameManager] 🏁 게임 종료: ${room.id}, 승자: ${winnerPlayerId}, 이유: ${reason}`);

        const players = Array.from(room.players.values());
        const player1 = players.find(p => p.playerId === 'player1');
        const player2 = players.find(p => p.playerId === 'player2');

        if (!player1 || !player2) {
            console.error(`[GameManager] ❌ 플레이어 정보를 찾을 수 없어 게임 종료 처리를 중단합니다. Room ID: ${room.id}`);
            this.rooms.delete(room.id);
            return;
        }

        let gameResult: GameResult;
        let winnerData: any = null;

        if (winnerPlayerId === 'draw') {
            gameResult = { winner: null, loser: null, draw: true };
        } else {
            const winner = winnerPlayerId === 'player1' ? player1 : player2;
            const loser = winnerPlayerId === 'player1' ? player2 : player1;
            gameResult = { winner: winner.userId, loser: loser.userId, draw: false };
            winnerData = {
                playerId: winner.playerId,
                username: winner.username
            };
        }
        
        this.io.to(room.id).emit('gameEnded', { winner: winnerData, draw: gameResult.draw, reason });


        // 랭크 게임일 경우, 레이팅 업데이트
        if (room.mode === GameMode.RANKED && mongoose.connection.readyState === 1) {
            try {
                await RatingSystem.updateRatings(gameResult);
                console.log(`[GameManager] 📈 레이팅 업데이트 완료`);
                // 업데이트된 레이팅 정보 전송
                for (const player of [player1, player2]) {
                    // 봇이 아닌 실제 유저인 경우에만 DB에서 조회
                    if (!player.userId.startsWith('bot_')) {
                        const user = await User.findById(player.userId);
                        if (user) {
                            player.socket.emit('ratingUpdate', { rating: user.rating, username: user.username });
                        }
                    }
                }
            } catch (error) {
                console.error('[GameManager] ❌ 레이팅 업데이트 실패:', error);
            }
        }

        // 플레이어들을 룸에서 나가게 함
        players.forEach(p => p.socket.leave(room.id));

        // 룸 삭제
        this.rooms.delete(room.id);
        console.log(`[GameManager] 🧹 룸 삭제됨: ${room.id}. 현재 방 개수: ${this.rooms.size}`);
    }

    private handleRequestInitialGameState(socket: Socket, roomId: string) {
        console.log(`[GameManager] 🔄 ${socket.id}가 방 ${roomId}의 초기 게임 상태를 요청합니다.`);
        const room = this.rooms.get(roomId);
        const userId = (socket as any).userId;
    
        if (!room) {
            console.error(`[GameManager] ❌ 요청된 방(${roomId})을 찾을 수 없습니다.`);
            socket.emit('notification', { type: 'error', message: '참여하려는 게임을 찾을 수 없습니다.' });
            return;
        }
    
        const playerData = Array.from(room.players.values()).find(p => p.socket.id === socket.id);
    
        if (!playerData) {
            console.error(`[GameManager] ❌ 방(${roomId})에서 플레이어(${userId}, ${socket.id})를 찾을 수 없습니다.`);
            socket.emit('notification', { type: 'error', message: '게임의 플레이어가 아닙니다.' });
            return;
        }
    
        const player1Data = Array.from(room.players.values()).find(p => p.playerId === 'player1');
        const player2Data = Array.from(room.players.values()).find(p => p.playerId === 'player2');
    
        if (!player1Data || !player2Data) {
            console.error(`[GameManager] ❌ 플레이어 데이터를 찾을 수 없어 상태 전송에 실패했습니다.`);
            return;
        }
    
        const myData = playerData.playerId === 'player1' ? player1Data : player2Data;
        const opponentData = playerData.playerId === 'player1' ? player2Data : player1Data;
    
        const gameStartData = {
            playerId: myData.playerId,
            roomId: room.id,
            gameState: room.gameState,
            playerInfo: {
                me: { id: myData.playerId, username: myData.username },
                opponent: { id: opponentData.playerId, username: opponentData.username }
            }
        };
    
        console.log(`[GameManager] 📤 플레이어(${userId})에게 초기 게임 상태를 다시 전송합니다.`);
        socket.emit('gameStarted', gameStartData);
    }
}
