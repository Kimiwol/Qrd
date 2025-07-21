import { Socket, Server } from 'socket.io';
import { Room } from '../interfaces/Room';
import { getExtendedSocket, findPlayerRoom } from '../utils/socketUtils';

export class DisconnectHandler {
  private io: Server;
  private rooms: Map<string, Room>;

  constructor(io: Server, rooms: Map<string, Room>) {
    this.io = io;
    this.rooms = rooms;
  }

  handlePlayerDisconnect(socket: Socket, endGame: (room: Room, winnerId: 'player1' | 'player2') => void, handleLeaveQueue: (socket: Socket) => void, removeFromSimpleQueue: (socketId: string) => void) {
    const userId = getExtendedSocket(socket).userId;
    console.log(`🔌 플레이어 연결 해제: ${socket.id} (유저: ${userId})`);

    // 큐에서 제거
    handleLeaveQueue(socket);
    removeFromSimpleQueue(socket.id);

    // 게임 중이었다면 게임 종료 처리
    const room = findPlayerRoom(socket.id, this.rooms);
    if (room && room.isGameActive) {
      const disconnectedPlayerData = room.players.get(socket.id);
      if (disconnectedPlayerData) {
        const winnerId = disconnectedPlayerData.playerId === 'player1' ? 'player2' : 'player1';
        console.log(`🚪 연결 해제로 인한 게임 종료. 승자: ${winnerId}`);
        endGame(room, winnerId);
      }
    }

    console.log(`👋 플레이어 ${userId} 연결 해제 처리 완료`);
  }
}
