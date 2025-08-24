import { Socket } from 'socket.io';

export interface ExtendedSocket extends Socket {
    userId?: string;
    rating?: number;
    username?: string;
}

export interface Position {
    row: number;
    col: number;
}

export interface PlayerState {
    position: Position;
    walls: number;
}

export interface Wall {
    position: Position;
    orientation: 'horizontal' | 'vertical';
}

export interface GameState {
    player1: PlayerState;
    player2: PlayerState;
    walls: Wall[];
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

// 방 상태
export enum RoomStatus {
    WAITING = 'waiting',
    IN_PROGRESS = 'in_progress',
    FINISHED = 'finished'
}

// 사용자 프로필
export interface UserProfile {
    id: string;
    username: string;
    email: string;
    rating: number;
    gamesPlayed: number;
    gamesWon: number;
    createdAt: Date;
}

// 방 정보
export interface RoomInfo {
    id: string;
    code: string;
    mode: GameMode;
    host: string;
    players: string[];
    status: RoomStatus;
    maxPlayers: number;
    createdAt: Date;
}

// 매칭 요청
export interface MatchmakingRequest {
    socket: Socket;
    userId: string;
    rating: number;
    mode: GameMode;
    timestamp?: number; // 큐에 추가된 시간
}

// 랭크 등급
export enum Rank {
    BRONZE = 'bronze',
    SILVER = 'silver', 
    GOLD = 'gold',
    PLATINUM = 'platinum',
    DIAMOND = 'diamond',
    MASTER = 'master',
    GRANDMASTER = 'grandmaster'
}

// 레이팅 계산 결과
export interface RatingCalculation {
    oldRating: number;
    newRating: number;
    change: number;
    rank: Rank;
}

// 게임 결과
export interface GameResult {
    winner: 'player1' | 'player2';
    duration: number;
    mode: GameMode;
}

// 리더보드 엔트리
export interface LeaderboardEntry {
    userId: string;
    username: string;
    rating: number;
    rank: Rank;
    gamesPlayed: number;
    gamesWon: number;
    winRate: number;
}