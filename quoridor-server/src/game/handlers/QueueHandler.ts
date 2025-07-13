import { Socket, Server } from 'socket.io';
import { GameMode, MatchmakingRequest } from '../../types';
import { MatchmakingSystem } from '../MatchmakingSystem';

export class QueueHandler {
  private matchmakingSystem: MatchmakingSystem;
  private simpleQueue: Socket[] = [];
  private io: Server;

  constructor(io: Server, matchmakingSystem: MatchmakingSystem) {
    this.io = io;
    this.matchmakingSystem = matchmakingSystem;
  }

  handleJoinRankedQueue(socket: Socket, tryMatchmaking: (mode: GameMode) => void) {
    const request: MatchmakingRequest = {
      socket,
      userId: (socket as any).userId,
      rating: (socket as any).rating,
      mode: GameMode.RANKED,
    };
    console.log(`[QueueHandler] 랭크 큐 참가: ${request.userId} (Rating: ${request.rating})`);
    this.matchmakingSystem.addPlayer(request);
    tryMatchmaking(GameMode.RANKED);
  }

  handleJoinCustomQueue(socket: Socket, tryMatchmaking: (mode: GameMode) => void) {
    const request: MatchmakingRequest = {
      socket,
      userId: (socket as any).userId,
      rating: (socket as any).rating,
      mode: GameMode.CUSTOM,
    };
    console.log(`[QueueHandler] 커스텀 큐 참가: ${request.userId}`);
    this.matchmakingSystem.addPlayer(request);
    tryMatchmaking(GameMode.CUSTOM);
  }

  handleLeaveQueue(socket: Socket) {
    this.matchmakingSystem.removePlayer(socket.id);
    
    // 간단 매칭 큐에서도 제거
    const simpleQueueIndex = this.simpleQueue.findIndex(s => s.id === socket.id);
    if (simpleQueueIndex > -1) {
      this.simpleQueue.splice(simpleQueueIndex, 1);
      console.log(`[QueueHandler] 간단 매칭 큐에서 제거: ${socket.id}`);
    }
    
    socket.emit('queueLeft');
    console.log(`[QueueHandler] 큐에서 나감: ${(socket as any).userId}`);
  }

  handleAddTestBot(socket: Socket) {
    console.log(`🤖 테스트 봇 추가 요청 (from ${(socket as any).userId})`);
    this.simpleQueue.push(socket);
    console.log(`간단 매칭 큐에 추가됨. 현재 대기 중: ${this.simpleQueue.length}명`);
    
    if (this.simpleQueue.length >= 2) {
      const player1 = this.simpleQueue.shift()!;
      const player2 = this.simpleQueue.shift()!;
      console.log(`매칭 성공! Player1: ${player1.id}, Player2: ${player2.id}`);
      // 게임 생성 로직 호출 필요
    }
  }

  getSimpleQueue(): Socket[] {
    return this.simpleQueue;
  }

  addToSimpleQueue(socket: Socket) {
    this.simpleQueue.push(socket);
  }

  removeFromSimpleQueue(socketId: string) {
    const index = this.simpleQueue.findIndex(s => s.id === socketId);
    if (index > -1) {
      this.simpleQueue.splice(index, 1);
    }
  }
}
