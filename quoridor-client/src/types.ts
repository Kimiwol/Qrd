export interface Position {
    x: number;
    y: number;
}

export interface Player {
    id: string;
    position: Position;
    wallsLeft: number;
    validMoves: Position[];
}

export interface Wall {
    position: Position;
    orientation: 'horizontal' | 'vertical';
}

export interface GameState {
    players: Player[];
    walls: Wall[];
    currentTurn: string;
}

export interface PlayerInfo {
    id: string;
    username: string;
    wallsLeft: number;
}

export interface GameStartData {
    playerId: string;
    roomId: string;
    gameState: GameState;
    playerInfo: {
        me: PlayerInfo;
        opponent: PlayerInfo;
    };
}