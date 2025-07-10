export interface Position {
    x: number;
    y: number;
}

export interface Player {
    id: string;
    position: Position;
    wallsLeft: number;
}

export interface Wall {
    position: Position;
    isHorizontal: boolean;
}

export interface GameState {
    players: Player[];
    walls: Wall[];
    currentTurn: string;
}