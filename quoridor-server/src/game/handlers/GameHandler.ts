import { Socket, Server } from 'socket.io';
import { GameLogic } from '../GameLogic';
import { GameState, GameMode, Position, Wall, GameResult } from '../../types';
import { Room } from '../interfaces/Room';

export class GameHandler {
  private io: Server;
  private rooms: Map<string, Room>;
  private readonly TURN_TIME_LIMIT = 60;

  constructor(io: Server, rooms: Map<string, Room>) {
    this.io = io;
    this.rooms = rooms;
  }

  createGame(player1Socket: Socket, player2Socket: Socket, mode: GameMode = GameMode.CUSTOM) {
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

    // 플레이어 설정
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

    // 게임 시작 알림
    console.log(`📤 gameStarted 이벤트 전송 준비`);
    
    // 각 플레이어에게 개별적으로 전송 (playerId 포함)
    const player1Data = room.players.get(player1Socket.id)!;
    const player2Data = room.players.get(player2Socket.id)!;
    
    const gameStartData = {
      roomId,
      gameState,
      playerInfo: {
        me: {
          id: player1Data.userId,
          username: player1Data.username || 'Player1',
          wallsLeft: gameState.player1.walls
        },
        opponent: {
          id: player2Data.userId,
          username: player2Data.username || 'Player2', 
          wallsLeft: gameState.player2.walls
        }
      },
      mode
    };
    
    // Player1에게 전송
    player1Socket.emit('gameStarted', {
      ...gameStartData,
      playerId: 'player1'
    });
    
    // Player2에게 전송
    player2Socket.emit('gameStarted', {
      ...gameStartData,
      playerId: 'player2',
      playerInfo: {
        me: gameStartData.playerInfo.opponent,
        opponent: gameStartData.playerInfo.me
      }
    });
    
    console.log(`✅ gameStarted 이벤트 전송 완료:`, {
      player1Id: 'player1',
      player2Id: 'player2',
      roomId
    });

    // 턴 타이머 시작
    this.startTurnTimer(room);

    console.log(`✅ 게임 생성 완료: ${roomId}`);
    console.log(`🎯 현재 활성 방 수: ${this.rooms.size}`);
  }

  handlePlayerMove(socket: Socket, data: { position: Position }) {
    const room = this.findPlayerRoom(socket.id);
    if (!room || !room.isGameActive) {
      socket.emit('error', '활성화된 게임을 찾을 수 없습니다.');
      return;
    }

    const playerData = room.players.get(socket.id);
    if (!playerData) {
      socket.emit('error', '플레이어 정보를 찾을 수 없습니다.');
      return;
    }

    if (room.gameState.currentTurn !== playerData.playerId) {
      socket.emit('error', '당신의 턴이 아닙니다.');
      return;
    }

    console.log(`🎯 플레이어 이동 시도:`, {
      player: playerData.playerId,
      from: room.gameState[playerData.playerId].position,
      to: data.position
    });

    try {
      const newGameState = GameLogic.makeMove(room.gameState, data.position);
      room.gameState = newGameState;

      this.io.to(room.id).emit('gameStateUpdate', newGameState);

      // 승리 조건 확인
      const winner = GameLogic.checkWinner(newGameState);
      if (winner) {
        this.endGame(room, winner);
        return;
      }

      // 다음 턴으로 넘어가기
      this.resetTurnTimer(room);
    } catch (error) {
      console.error('이동 오류:', error);
      socket.emit('error', error instanceof Error ? error.message : '이동할 수 없습니다.');
    }
  }

  handleWallPlacement(socket: Socket, data: { wall: Wall }) {
    const room = this.findPlayerRoom(socket.id);
    if (!room || !room.isGameActive) {
      socket.emit('error', '활성화된 게임을 찾을 수 없습니다.');
      return;
    }

    const playerData = room.players.get(socket.id);
    if (!playerData) {
      socket.emit('error', '플레이어 정보를 찾을 수 없습니다.');
      return;
    }

    if (room.gameState.currentTurn !== playerData.playerId) {
      socket.emit('error', '당신의 턴이 아닙니다.');
      return;
    }

    console.log(`🧱 벽 설치 시도:`, {
      player: playerData.playerId,
      wall: data.wall,
      remainingWalls: room.gameState[playerData.playerId].walls
    });

    try {
    const newGameState = GameLogic.placeWall(room.gameState, data.wall);
      room.gameState = newGameState;

      this.io.to(room.id).emit('gameStateUpdate', newGameState);

      // 다음 턴으로 넘어가기
      this.resetTurnTimer(room);
    } catch (error) {
      console.error('벽 설치 오류:', error);
      socket.emit('error', error instanceof Error ? error.message : '벽을 설치할 수 없습니다.');
    }
  }

  handleGameRestart(socket: Socket) {
    const room = this.findPlayerRoom(socket.id);
    if (!room) {
      socket.emit('error', '방을 찾을 수 없습니다.');
      return;
    }

    const newGameState = GameLogic.getInitialGameState();
    room.gameState = newGameState;
    room.isGameActive = true;

    this.io.to(room.id).emit('gameRestarted', newGameState);
    this.startTurnTimer(room);

    console.log(`🔄 게임 재시작: ${room.id}`);
  }

  handleForfeit(socket: Socket) {
    const room = this.findPlayerRoom(socket.id);
    if (!room || !room.isGameActive) {
      socket.emit('error', '활성화된 게임을 찾을 수 없습니다.');
      return;
    }

    const playerData = room.players.get(socket.id);
    if (!playerData) {
      socket.emit('error', '플레이어 정보를 찾을 수 없습니다.');
      return;
    }

    const winnerId = playerData.playerId === 'player1' ? 'player2' : 'player1';
    console.log(`🏳️ 기권: ${playerData.playerId} -> 승자: ${winnerId}`);
    
    this.endGame(room, winnerId);
  }

  handleTurnTimeout(socket: Socket) {
    const room = this.findPlayerRoom(socket.id);
    if (!room || !room.isGameActive) return;

    const playerData = room.players.get(socket.id);
    if (!playerData) return;

    if (room.gameState.currentTurn === playerData.playerId) {
      const winnerId = playerData.playerId === 'player1' ? 'player2' : 'player1';
      console.log(`⏰ 턴 타임아웃: ${playerData.playerId} -> 승자: ${winnerId}`);
      this.endGame(room, winnerId);
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

  private startTurnTimer(room: Room) {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
    }

    room.turnTimer = setTimeout(() => {
      if (room.isGameActive) {
        const currentPlayerId = room.gameState.currentTurn;
        const winnerId = currentPlayerId === 'player1' ? 'player2' : 'player1';
        console.log(`⏰ 턴 타임아웃으로 게임 종료: ${currentPlayerId} -> 승자: ${winnerId}`);
        this.endGame(room, winnerId);
      }
    }, this.TURN_TIME_LIMIT * 1000);

    this.io.to(room.id).emit('turnTimerStarted', {
      timeLimit: this.TURN_TIME_LIMIT,
      currentPlayer: room.gameState.currentTurn
    });
  }

  private resetTurnTimer(room: Room) {
    this.startTurnTimer(room);
  }

  endGame(room: Room, winnerId: 'player1' | 'player2') {
    room.isGameActive = false;
    
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    const result: GameResult = {
      winner: winnerId,
      duration: Date.now() - room.startTime,
      mode: room.mode
    };

    this.io.to(room.id).emit('gameEnded', result);

    console.log(`🏆 게임 종료: ${room.id}, 승자: ${winnerId}`);
    
    // 방 정리는 일정 시간 후에 수행
    setTimeout(() => {
      this.rooms.delete(room.id);
      console.log(`🗑️ 방 삭제: ${room.id}`);
    }, 10000); // 10초 후 방 삭제
  }

  getRooms(): Map<string, Room> {
    return this.rooms;
  }
}
