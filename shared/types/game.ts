// 서버 전용 타입
export interface ServerPosition {
    row: number;
    col: number;
}

export interface ServerPlayerState {
    position: ServerPosition;
    walls: number;
}

export interface ServerWall {
    position: ServerPosition;
    orientation: 'horizontal' | 'vertical';
}

export interface ServerGameState {
    player1: ServerPlayerState;
    player2: ServerPlayerState;
    walls: ServerWall[];
    currentTurn: 'player1' | 'player2';
    gameOver: {
        isOver: boolean;
        winner?: 'player1' | 'player2';
        reason?: string;
    };
}
// 게임 모드 타입
export enum GameMode {
    RANKED = 'ranked',
    CUSTOM = 'custom'
}

// 매칭 요청
export interface MatchmakingRequest {
    socket: any; // 실제로는 Socket, 서버에서만 타입 강제 필요
    userId: string;
    rating: number;
    mode: GameMode;
    timestamp?: number; // 큐에 추가된 시간
}

// 게임 결과
export interface GameResult {
    winner: 'player1' | 'player2';
    duration: number;
    mode: GameMode;
}
// 서버와 클라이언트에서 공통으로 사용하는 타입 정의

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
