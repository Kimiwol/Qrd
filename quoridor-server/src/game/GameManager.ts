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
    players: Map<string, { socket: Socket; userId: string; playerId: string; rating?: number }>;
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

    constructor(io: Server) {
        this.io = io;
        this.setupSocketHandlers();
        this.startMatchmakingLoop();
    }

    private setupSocketHandlers() {
        // Socket.io 인증 미들웨어
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    throw new Error('인증이 필요합니다.');
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'temp_secret') as { _id: string };
                
                // MongoDB 연결이 없을 때는 토큰만 검증
                if (mongoose.connection.readyState !== 1) {
                    (socket as any).userId = decoded._id;
                    next();
                    return;
                }
                
                const user = await User.findById(decoded._id);
                
                if (!user) {
                    throw new Error('사용자를 찾을 수 없습니다.');
                }

                (socket as any).userId = user._id;
                next();
            } catch (error) {
                next(new Error('인증이 필요합니다.'));
            }
        });

        this.io.on('connection', async (socket) => {
            // 사용자 레이팅 정보 로드
            await this.loadUserRating(socket);
            
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
        const roomId = `room_${Date.now()}`;
        const gameState = GameLogic.getInitialGameState();

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

        console.log(`🎲 플레이어 순서 랜덤 결정: ${(firstPlayer as any).userId} = player1, ${(secondPlayer as any).userId} = player2`);

        // 플레이어 설정
        room.players.set(firstPlayer.id, {
            socket: firstPlayer,
            userId: (firstPlayer as any).userId,
            playerId: 'player1',
            rating: (firstPlayer as any).rating
        });

        room.players.set(secondPlayer.id, {
            socket: secondPlayer,
            userId: (secondPlayer as any).userId,
            playerId: 'player2',
            rating: (secondPlayer as any).rating
        });

        // 방에 참가
        firstPlayer.join(roomId);
        secondPlayer.join(roomId);

        this.rooms.set(roomId, room);

        // 플레이어에게 게임 시작 알림 (게임 상태도 함께 전송)
        firstPlayer.emit('gameStarted', { 
            playerId: 'player1', 
            roomId,
            gameState 
        });
        secondPlayer.emit('gameStarted', { 
            playerId: 'player2', 
            roomId,
            gameState 
        });

        // 게임 상태 전송
        this.io.to(roomId).emit('gameState', gameState);

        // 턴 타이머 시작
        this.startTurnTimer(roomId);

        console.log(`게임 시작: ${roomId} (Player1: ${(firstPlayer as any).userId}, Player2: ${(secondPlayer as any).userId})`);
    }

    private handlePlayerMove(socket: Socket, newPosition: Position) {
        const room = this.findPlayerRoom(socket.id);
        if (!room || !room.isGameActive) return;

        const playerData = room.players.get(socket.id);
        if (!playerData) return;

        const { playerId } = playerData;
        const { gameState } = room;

        // 현재 턴인지 확인
        if (playerId !== gameState.currentTurn) return;

        const currentPlayer = gameState.players.find(p => p.id === playerId);
        if (!currentPlayer) return;

        // 이동 유효성 검사
        if (GameLogic.isValidMove(currentPlayer, newPosition, gameState)) {
            currentPlayer.position = newPosition;
            
            // 승리 조건 확인
            if (GameLogic.checkWinCondition(currentPlayer)) {
                this.endGame(room, playerId);
                return;
            }

            // 턴 변경
            gameState.currentTurn = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
            
            // 게임 상태 업데이트 전송
            this.io.to(room.id).emit('gameState', gameState);
            
            // 새로운 턴 타이머 시작
            this.startTurnTimer(room.id);
        }
    }

    private handleWallPlacement(socket: Socket, { position, isHorizontal }: { position: Position; isHorizontal: boolean }) {
        const room = this.findPlayerRoom(socket.id);
        if (!room || !room.isGameActive) return;

        const playerData = room.players.get(socket.id);
        if (!playerData) return;

        const { playerId } = playerData;
        const { gameState } = room;

        // 현재 턴인지 확인
        if (playerId !== gameState.currentTurn) return;

        const currentPlayer = gameState.players.find(p => p.id === playerId);
        if (!currentPlayer) return;

        const newWall: Wall = { position, isHorizontal };

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
            }
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
        
        // 대기열에서 제거
        const waitingIndex = this.waitingPlayers.findIndex(p => p.id === socket.id);
        if (waitingIndex !== -1) {
            this.waitingPlayers.splice(waitingIndex, 1);
            return;
        }

        // 게임 중인 방에서 제거
        const room = this.findPlayerRoom(socket.id);
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
                // 턴 시간 초과
                room.gameState.currentTurn = room.gameState.currentTurn === 'player1' ? 'player2' : 'player1';
                this.io.to(roomId).emit('gameState', room.gameState);
                this.io.to(roomId).emit('turnTimeout', '시간 초과로 턴이 넘어갔습니다.');
                
                // 새로운 타이머 시작
                this.startTurnTimer(roomId);
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
                }
            } else {
                (socket as any).rating = 1200; // 기본 레이팅
                (socket as any).rank = RatingSystem.getRankByRating(1200);
            }
        } catch (error) {
            console.error('레이팅 로드 실패:', error);
            (socket as any).rating = 1200;
            (socket as any).rank = RatingSystem.getRankByRating(1200);
        }
    }

    private async handleJoinRankedQueue(socket: Socket): Promise<void> {
        const userId = (socket as any).userId;
        const rating = (socket as any).rating || 1200;

        const request: MatchmakingRequest = {
            userId,
            rating,
            gameMode: GameMode.RANKED
        };

        this.matchmakingSystem.addToQueue(request);
        socket.emit('queueJoined', { 
            mode: GameMode.RANKED, 
            queueSize: this.matchmakingSystem.getQueueSize(GameMode.RANKED) 
        });
        socket.emit('notification', { 
            type: 'info', 
            message: '랭크 게임 매칭을 시작합니다...', 
            duration: 3000 
        });
    }

    private async handleJoinCustomQueue(socket: Socket): Promise<void> {
        const userId = (socket as any).userId;
        const rating = (socket as any).rating || 1200;

        const request: MatchmakingRequest = {
            userId,
            rating,
            gameMode: GameMode.CUSTOM
        };

        this.matchmakingSystem.addToQueue(request);
        socket.emit('queueJoined', { 
            mode: GameMode.CUSTOM, 
            queueSize: this.matchmakingSystem.getQueueSize(GameMode.CUSTOM) 
        });
        socket.emit('notification', { 
            type: 'info', 
            message: '일반 게임 매칭을 시작합니다...', 
            duration: 3000 
        });
    }

    private handleLeaveQueue(socket: Socket): void {
        const userId = (socket as any).userId;
        this.matchmakingSystem.removeFromQueue(userId, GameMode.RANKED);
        this.matchmakingSystem.removeFromQueue(userId, GameMode.CUSTOM);
        socket.emit('queueLeft');
        socket.emit('notification', { 
            type: 'info', 
            message: '매칭 대기를 취소했습니다.', 
            duration: 2000 
        });
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
        setInterval(() => {
            // 랭크 매칭 처리
            this.matchmakingSystem.processMatching(GameMode.RANKED, (match) => {
                this.createRankedGame(match.player1, match.player2);
            });

            // 커스텀 매칭 처리
            this.matchmakingSystem.processMatching(GameMode.CUSTOM, (match) => {
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
        for (const [socketId, socket] of this.io.sockets.sockets) {
            if ((socket as any).userId === userId) {
                return socket;
            }
        }
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
            console.log(`⏰ 턴 타임아웃: ${playerId} in room ${room.id}`);
            
            // 턴 변경
            gameState.currentTurn = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
            
            // 클라이언트에 알림
            this.io.to(room.id).emit('gameState', gameState);
            this.io.to(room.id).emit('turnTimedOut', `${playerId} 시간 초과로 턴이 넘어갔습니다.`);
            
            // 새로운 턴 타이머 시작
            this.startTurnTimer(room.id);
        }
    }
}
