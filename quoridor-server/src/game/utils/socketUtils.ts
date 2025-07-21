// 소켓 관련 공통 유틸 함수
import { Socket } from 'socket.io';
import { Room } from '../interfaces/Room';

export function getExtendedSocket(socket: Socket): any {
  // 서버 전체에서 확장 소켓 타입 캐스팅을 일관되게 처리
  return socket as any;
}

export function findPlayerRoom(socketId: string, rooms: Map<string, Room>): Room | undefined {
  // 모든 방에서 해당 소켓ID를 가진 플레이어가 있는 방을 찾음
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) {
      return room;
    }
  }
  return undefined;
}
