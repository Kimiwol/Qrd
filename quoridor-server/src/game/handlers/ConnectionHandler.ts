import { Socket, Server } from 'socket.io';
import { Room } from '../interfaces/Room';

export class ConnectionHandler {
  private io: Server;
  private rooms: Map<string, Room>;

  constructor(io: Server, rooms: Map<string, Room>) {
    this.io = io;
    this.rooms = rooms;
  }

  handleDuplicateConnection(socket: Socket, findPlayerRoom: (socketId: string) => Room | undefined, endGame: (room: Room, winnerId: 'player1' | 'player2') => void, handleLeaveQueue: (socket: Socket) => void, removeFromSimpleQueue: (socketId: string) => void) {
    const userId = (socket as any).userId;

    // 동일 userId로 이미 연결된 소켓이 있는지 확인
    const oldSocket = Array.from(this.io.sockets.sockets.values()).find(s => s !== socket && (s as any).userId === userId);

    if (oldSocket) {
      console.log(`[중복 로그인] 기존 소켓(${oldSocket.id}) 처리 시작. 새 소켓: ${socket.id}`);

      // 1. 기존 소켓이 참여중인 게임이 있다면, 해당 게임을 기권패 처리
      const room = findPlayerRoom(oldSocket.id);
      if (room && room.isGameActive) {
        const disconnectedPlayerData = room.players.get(oldSocket.id);
        if (disconnectedPlayerData) {
          const winnerId = disconnectedPlayerData.playerId === 'player1' ? 'player2' : 'player1';
          console.log(`[중복 로그인] 기존 소켓이 게임 중이므로 기권패 처리. 승자: ${winnerId}`);
          endGame(room, winnerId);
        }
      }

      // 2. 기존 소켓을 모든 큐에서 제거
      handleLeaveQueue(oldSocket);
      removeFromSimpleQueue(oldSocket.id);

      // 3. 기존 소켓에 알림을 보내고 연결 강제 종료
      console.log(`[중복 로그인] 기존 소켓(${oldSocket.id})에 알림 후 강제 종료`);
      oldSocket.emit('notification', { type: 'error', message: '다른 곳에서 로그인되어 연결이 종료됩니다.' });
      oldSocket.disconnect(true);
    }
  }

  setupEventHandlers(socket: Socket, handlers: {
    handlePlayerMove: (socket: Socket, data: any) => void;
    handleWallPlacement: (socket: Socket, data: any) => void;
    handleGameRestart: (socket: Socket) => void;
    handleTurnTimeout: (socket: Socket) => void;
    handleForfeit: (socket: Socket) => void;
    handleJoinRankedQueue: (socket: Socket) => void;
    handleJoinCustomQueue: (socket: Socket) => void;
    handleLeaveQueue: (socket: Socket) => void;
    handleGetLeaderboard: (callback: any) => void;
    handleGetRating: (socket: Socket, callback: any) => void;
    handleAddTestBot: (socket: Socket) => void;
    handleCreateBotGame: (socket: Socket) => void;
    handleRequestInitialGameState: (socket: Socket, data: { roomId: string }) => void;
    handlePlayerDisconnect: (socket: Socket) => void;
  }) {
    const userId = (socket as any).userId;

    // 게임 이벤트 핸들러 설정
    socket.on('move', (data) => handlers.handlePlayerMove(socket, data));
    socket.on('placeWall', (data) => handlers.handleWallPlacement(socket, data));
    socket.on('restartGame', () => handlers.handleGameRestart(socket));
    socket.on('turnTimeout', () => handlers.handleTurnTimeout(socket));
    socket.on('forfeit', () => handlers.handleForfeit(socket));
    
    // 랭크 시스템 이벤트 핸들러
    socket.on('joinRankedQueue', () => handlers.handleJoinRankedQueue(socket));
    socket.on('joinCustomQueue', () => handlers.handleJoinCustomQueue(socket));
    socket.on('leaveQueue', () => handlers.handleLeaveQueue(socket));
    socket.on('getLeaderboard', (callback) => handlers.handleGetLeaderboard(callback));
    socket.on('getRating', (callback) => handlers.handleGetRating(socket, callback));
    
    // 테스트용 이벤트 핸들러
    socket.on('addTestBot', () => {
      console.log(`🤖 addTestBot 이벤트 받음 (from ${userId})`);
      handlers.handleAddTestBot(socket);
    });
    socket.on('createBotGame', () => {
      console.log(`🤖 createBotGame 이벤트 받음 (from ${userId})`);
      handlers.handleCreateBotGame(socket);
    });
    
    socket.on('requestInitialGameState', (data) => handlers.handleRequestInitialGameState(socket, data));
    
    socket.on('disconnect', () => handlers.handlePlayerDisconnect(socket));

    console.log(`플레이어 ${userId} 매칭 대기 중...`);
  }
}
