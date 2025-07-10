import { GameMode, MatchmakingRequest } from '../types';
import { RatingSystem } from './RatingSystem';

interface MatchmakingQueue {
    [GameMode.RANKED]: MatchmakingRequest[];
    [GameMode.CUSTOM]: MatchmakingRequest[];
}

export class MatchmakingSystem {
    private queue: MatchmakingQueue = {
        [GameMode.RANKED]: [],
        [GameMode.CUSTOM]: []
    };

    // 매칭 대기 시간 (밀리초)
    private static readonly MATCH_TIMEOUT = 30000; // 30초
    
    // 매칭 허용 레이팅 차이 (시간에 따라 확장)
    private static readonly BASE_RATING_TOLERANCE = 100;
    private static readonly MAX_RATING_TOLERANCE = 500;

    /**
     * 매칭 큐에 플레이어 추가
     * @param request 매칭 요청
     */
    addToQueue(request: MatchmakingRequest): void {
        // 이미 큐에 있는지 확인
        const existingIndex = this.queue[request.gameMode].findIndex(
            req => req.userId === request.userId
        );
        
        if (existingIndex !== -1) {
            // 이미 있다면 업데이트
            this.queue[request.gameMode][existingIndex] = request;
        } else {
            // 새로 추가
            this.queue[request.gameMode].push({
                ...request,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 매칭 큐에서 플레이어 제거
     * @param userId 사용자 ID
     * @param gameMode 게임 모드
     */
    removeFromQueue(userId: string, gameMode: GameMode): void {
        const index = this.queue[gameMode].findIndex(req => req.userId === userId);
        if (index !== -1) {
            this.queue[gameMode].splice(index, 1);
        }
    }

    /**
     * 매칭 시도
     * @param gameMode 게임 모드
     * @returns 매칭된 플레이어 쌍 또는 null
     */
    findMatch(gameMode: GameMode): { player1: MatchmakingRequest; player2: MatchmakingRequest } | null {
        const queue = this.queue[gameMode];
        
        if (queue.length < 2) {
            return null;
        }

        // 랭크 모드의 경우 레이팅 기반 매칭
        if (gameMode === GameMode.RANKED) {
            return this.findRankedMatch(queue);
        }

        // 커스텀 모드의 경우 선착순 매칭
        const player1 = queue.shift()!;
        const player2 = queue.shift()!;
        
        return { player1, player2 };
    }

    /**
     * 랭크 매칭 로직
     * @param queue 매칭 큐
     * @returns 매칭된 플레이어 쌍 또는 null
     */
    private findRankedMatch(queue: MatchmakingRequest[]): { player1: MatchmakingRequest; player2: MatchmakingRequest } | null {
        const now = Date.now();

        for (let i = 0; i < queue.length; i++) {
            const player1 = queue[i];
            const waitTime = now - (player1.timestamp || now);
            
            // 대기 시간에 따른 허용 레이팅 차이 계산
            const tolerance = Math.min(
                MatchmakingSystem.BASE_RATING_TOLERANCE + (waitTime / 1000) * 10,
                MatchmakingSystem.MAX_RATING_TOLERANCE
            );

            const ratingRange = RatingSystem.getMatchmakingRange(player1.rating, tolerance);

            for (let j = i + 1; j < queue.length; j++) {
                const player2 = queue[j];
                
                // 레이팅 범위 내에 있는지 확인
                if (player2.rating >= ratingRange.min && player2.rating <= ratingRange.max) {
                    // 매칭 성공 - 큐에서 제거
                    queue.splice(j, 1); // j가 더 큰 인덱스이므로 먼저 제거
                    queue.splice(i, 1);
                    
                    return { player1, player2 };
                }
            }

            // 타임아웃 체크
            if (waitTime > MatchmakingSystem.MATCH_TIMEOUT) {
                queue.splice(i, 1);
                i--; // 인덱스 조정
            }
        }

        return null;
    }

    /**
     * 현재 큐 상태 조회
     * @param gameMode 게임 모드
     * @returns 큐에 있는 플레이어 수
     */
    getQueueSize(gameMode: GameMode): number {
        return this.queue[gameMode].length;
    }

    /**
     * 플레이어의 큐 상태 확인
     * @param userId 사용자 ID
     * @param gameMode 게임 모드
     * @returns 큐에 있는지 여부
     */
    isInQueue(userId: string, gameMode: GameMode): boolean {
        return this.queue[gameMode].some(req => req.userId === userId);
    }

    /**
     * 정기적인 매칭 처리
     * @param gameMode 게임 모드
     * @param callback 매칭 성공 시 호출될 콜백
     */
    processMatching(gameMode: GameMode, callback: (match: { player1: MatchmakingRequest; player2: MatchmakingRequest }) => void): void {
        const match = this.findMatch(gameMode);
        if (match) {
            callback(match);
        }
    }

    /**
     * 모든 큐 초기화
     */
    clearAllQueues(): void {
        this.queue[GameMode.RANKED] = [];
        this.queue[GameMode.CUSTOM] = [];
    }
}
