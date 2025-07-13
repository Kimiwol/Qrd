import { GameState, GameMode } from '../../types';
import { Socket } from 'socket.io';

export interface Room {
    id: string;
    mode: GameMode;
    players: Map<string, PlayerData>;
    gameState: GameState;
    turnTimer: NodeJS.Timeout | null;
    isGameActive: boolean;
    startTime: number;
}

export interface PlayerData {
    socket: Socket;
    userId: string;
    playerId: 'player1' | 'player2';
    rating?: number;
    username?: string;
}
