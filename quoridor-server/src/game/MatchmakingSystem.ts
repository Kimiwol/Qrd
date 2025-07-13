import { Socket } from 'socket.io';
import { GameMode, MatchmakingRequest } from '../types';

interface MatchmakingQueue {
    [GameMode.RANKED]: MatchmakingRequest[];
    [GameMode.CUSTOM]: MatchmakingRequest[];
}

export class MatchmakingSystem {
    private queue: MatchmakingQueue = {
        [GameMode.RANKED]: [],
        [GameMode.CUSTOM]: []
    };

    // 매칭 허용 레이팅 차이 (시간에 따라 확장)
    private static readonly BASE_RATING_TOLERANCE = 100;
    private static readonly MAX_RATING_TOLERANCE = 500;

    /**
     * 매칭 큐에 플레이어 추가
     * @param request 매칭 요청
     */
    addPlayer(request: MatchmakingRequest): void {
        // 이미 다른 큐에 있는지 확인하고 제거
        this.removePlayer(request.socket.id);

        const gameMode = request.mode;
        const queue = this.queue[gameMode];

        // 이미 해당 큐에 있는지 확인
        const existingIndex = queue.findIndex(
            req => req.socket.id === request.socket.id
        );
        
        if (existingIndex !== -1) {
            // 이미 있다면 업데이트 (필요 시)
            queue[existingIndex] = { ...request, timestamp: Date.now() };
            console.log(`[Matchmaking] 큐 업데이트: ${request.userId} (${gameMode})`);
        } else {
            // 새로 추가
            queue.push({ ...request, timestamp: Date.now() });
            console.log(`[Matchmaking] 큐 추가: ${request.userId} (${gameMode}) - 현재 큐 크기: ${queue.length}`);
            // request.socket.emit('notification', { type: 'info', message: `${gameMode === GameMode.RANKED ? '랭크' : '일반'} 게임 대기열에 참가했습니다.` });
            request.socket.emit('queueJoined', { mode: gameMode, queueSize: queue.length });
        }
    }

    /**
     * 모든 큐에서 플레이어 제거
     * @param socketId 소켓 ID
     * @returns 제거되었는지 여부
     */
    removePlayer(socketId: string): boolean {
        let removed = false;
        for (const mode in this.queue) {
            const gameMode = mode as GameMode;
            const index = this.queue[gameMode].findIndex(req => req.socket.id === socketId);
            if (index !== -1) {
                this.queue[gameMode].splice(index, 1);
                removed = true;
                console.log(`[Matchmaking] 큐에서 제거: ${socketId} (${gameMode})`);
            }
        }
        return removed;
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

        console.log(`매칭 시도: ${gameMode} 모드, 큐 크기: ${queue.length}`);

        // 랭크 모드의 경우 레이팅 기반 매칭
        if (gameMode === GameMode.RANKED) {
            return this.findRankedMatch(queue);
        }

        // 커스텀 모드의 경우 선착순 매칭
        if (gameMode === GameMode.CUSTOM) {
            // 단순히 큐의 맨 앞 두 명을 매칭
            const player1 = queue.shift()!;
            const player2 = queue.shift()!;
            
            console.log(`[Matchmaking] 커스텀 매칭 성공: ${player1.userId} vs ${player2.userId}`);
            return { player1, player2 };
        }

        return null;
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

            for (let j = i + 1; j < queue.length; j++) {
                const player2 = queue[j];
                
                if (Math.abs(player1.rating - player2.rating) <= tolerance) {
                    // 매칭 성공
                    // 큐에서 두 플레이어 제거 (인덱스가 큰 것부터 제거해야 순서가 맞음)
                    queue.splice(j, 1);
                    queue.splice(i, 1);
                    
                    console.log(`[Matchmaking] 랭크 매칭 성공: ${player1.userId} (R:${player1.rating}) vs ${player2.userId} (R:${player2.rating})`);
                    return { player1, player2 };
                }
            }
        }

        return null;
    }
}
