import { Socket } from 'socket.io';
import { GameMode, ServerGameState } from 'shared/types/game';

export interface Room {
  id: string;
  mode: GameMode;
  players: Map<string, { socket: Socket; userId: string; playerId: 'player1' | 'player2'; rating?: number; username?: string }>;
  gameState: ServerGameState;
  turnTimer: NodeJS.Timeout | null;
  isGameActive: boolean;
  startTime: number;
}
