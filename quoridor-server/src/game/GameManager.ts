import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { GameLogic } from './GameLogic';
import { GameState, Position, Wall } from '../types';

interface Room {
    id: string;
    players: Map<string, { socket: Socket; userId: string; playerId: string }>;
    gameState: GameState;
    turnTimer: NodeJS.Timeout | null;
    isGameActive: boolean;
}

export class GameManager {
    private io: Server;
    private rooms = new Map<string, Room>();
    private waitingPlayers: Socket[] = [];
    private readonly TURN_TIME_LIMIT = 60;

    constructor(io: Server) {
        this.io = io;
        this.setupSocketHandlers();
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

        this.io.on('connection', (socket) => {
            console.log('사용자 연결됨:', socket.id);
            this.handlePlayerConnection(socket);
        });
    }

    private handlePlayerConnection(socket: Socket) {
        const userId = (socket as any).userId;

        // 매칭 대기열에 추가
        this.addToWaitingQueue(socket);

        // 게임 이벤트 핸들러 설정
        socket.on('move', (data) => this.handlePlayerMove(socket, data));
        socket.on('placeWall', (data) => this.handleWallPlacement(socket, data));
        socket.on('restartGame', () => this.handleGameRestart(socket));
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

    private createGame(player1: Socket, player2: Socket) {
        const roomId = `room_${Date.now()}`;
        const gameState = GameLogic.getInitialGameState();

        const room: Room = {
            id: roomId,
            players: new Map(),
            gameState,
            turnTimer: null,
            isGameActive: true
        };

        // 플레이어 설정
        room.players.set(player1.id, {
            socket: player1,
            userId: (player1 as any).userId,
            playerId: 'player1'
        });

        room.players.set(player2.id, {
            socket: player2,
            userId: (player2 as any).userId,
            playerId: 'player2'
        });

        // 방에 참가
        player1.join(roomId);
        player2.join(roomId);

        this.rooms.set(roomId, room);

        // 플레이어에게 게임 시작 알림
        player1.emit('gameStarted', { playerId: 'player1', roomId });
        player2.emit('gameStarted', { playerId: 'player2', roomId });

        // 게임 상태 전송
        this.io.to(roomId).emit('gameState', gameState);

        // 턴 타이머 시작
        this.startTurnTimer(roomId);

        console.log(`게임 시작: ${roomId}`);
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

    private handlePlayerDisconnect(socket: Socket) {
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

        console.log('플레이어 연결 끊김:', socket.id);
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

    private endGame(room: Room, winnerId: string) {
        room.isGameActive = false;
        
        if (room.turnTimer) {
            clearTimeout(room.turnTimer);
        }

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
}
