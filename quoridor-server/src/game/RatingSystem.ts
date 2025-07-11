import { User } from '../models/User';
import { GameResult, Rank, RatingCalculation } from '../types';

export class RatingSystem {
    // K-factor (레이팅 변화율)
    private static readonly K_FACTOR = 32;
    
    // 랭크 경계값
    private static readonly RANK_THRESHOLDS = {
        [Rank.BRONZE]: { min: 0, max: 1099 },
        [Rank.SILVER]: { min: 1100, max: 1299 },
        [Rank.GOLD]: { min: 1300, max: 1499 },
        [Rank.PLATINUM]: { min: 1500, max: 1699 },
        [Rank.DIAMOND]: { min: 1700, max: 1899 },
        [Rank.MASTER]: { min: 1900, max: 2099 },
        [Rank.GRANDMASTER]: { min: 2100, max: Infinity }
    };

    /**
     * ELO 레이팅 시스템을 사용하여 레이팅 계산
     * @param winnerRating 승자의 현재 레이팅
     * @param loserRating 패자의 현재 레이팅
     * @returns 승자와 패자의 새로운 레이팅
     */
    static calculateRating(winnerRating: number, loserRating: number): {
        winner: RatingCalculation;
        loser: RatingCalculation;
    } {
        // 예상 승률 계산
        const expectedWinner = this.getExpectedScore(winnerRating, loserRating);
        const expectedLoser = this.getExpectedScore(loserRating, winnerRating);

        // 새로운 레이팅 계산
        const newWinnerRating = Math.round(winnerRating + this.K_FACTOR * (1 - expectedWinner));
        const newLoserRating = Math.round(loserRating + this.K_FACTOR * (0 - expectedLoser));

        // 최소 레이팅 보정 (0 이하로 떨어지지 않음)
        const finalWinnerRating = Math.max(newWinnerRating, 0);
        const finalLoserRating = Math.max(newLoserRating, 0);

        return {
            winner: {
                oldRating: winnerRating,
                newRating: finalWinnerRating,
                change: finalWinnerRating - winnerRating,
                rank: this.getRankByRating(finalWinnerRating)
            },
            loser: {
                oldRating: loserRating,
                newRating: finalLoserRating,
                change: finalLoserRating - loserRating,
                rank: this.getRankByRating(finalLoserRating)
            }
        };
    }

    /**
     * 예상 승률 계산 (ELO 공식)
     * @param playerRating 플레이어 레이팅
     * @param opponentRating 상대방 레이팅
     * @returns 예상 승률 (0-1)
     */
    private static getExpectedScore(playerRating: number, opponentRating: number): number {
        return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    }

    /**
     * 레이팅에 따른 랭크 결정
     * @param rating 레이팅
     * @returns 랭크
     */
    static getRankByRating(rating: number): Rank {
        for (const [rank, threshold] of Object.entries(this.RANK_THRESHOLDS)) {
            if (rating >= threshold.min && rating <= threshold.max) {
                return rank as Rank;
            }
        }
        return Rank.BRONZE; // 기본값
    }

    /**
     * 랭크의 최소/최대 레이팅 가져오기
     * @param rank 랭크
     * @returns 최소, 최대 레이팅
     */
    static getRankThresholds(rank: Rank): { min: number; max: number } {
        return this.RANK_THRESHOLDS[rank];
    }

    /**
     * 게임 결과에 따라 사용자들의 레이팅을 업데이트합니다.
     * @param gameResult 게임 결과
     */
    static async updateRatings(gameResult: GameResult): Promise<void> {
        if (gameResult.draw || !gameResult.winner || !gameResult.loser) {
            console.log('[RatingSystem] 무승부 또는 플레이어 정보 부족으로 레이팅을 업데이트하지 않습니다.');
            return;
        }

        const winner = await User.findById(gameResult.winner);
        const loser = await User.findById(gameResult.loser);

        if (!winner || !loser) {
            console.error('[RatingSystem] ❌ 승자 또는 패자 유저를 DB에서 찾을 수 없습니다.');
            return;
        }

        const winnerRating = winner.rating;
        const loserRating = loser.rating;

        // ELO 레이팅 계산
        const expectedWinner = this.getExpectedScore(winnerRating, loserRating);
        const expectedLoser = this.getExpectedScore(loserRating, winnerRating);

        const newWinnerRating = Math.round(winnerRating + this.K_FACTOR * (1 - expectedWinner));
        const newLoserRating = Math.round(loserRating + this.K_FACTOR * (0 - expectedLoser));

        // DB 업데이트
        winner.rating = Math.max(newWinnerRating, 0);
        winner.gamesWon += 1;
        winner.gamesPlayed += 1;

        loser.rating = Math.max(newLoserRating, 0);
        loser.gamesPlayed += 1;

        await winner.save();
        await loser.save();

        console.log(`[RatingSystem] 📈 레이팅 업데이트: ${winner.username} (${winnerRating} -> ${winner.rating}), ${loser.username} (${loserRating} -> ${loser.rating})`);
    }

    /**
     * 리더보드 정보를 가져옵니다.
     * @returns 상위 100명의 사용자 정보
     */
    static async getLeaderboard(): Promise<any[]> {
        try {
            const topUsers = await User.find({})
                .sort({ rating: -1 })
                .limit(100)
                .select('username rating gamesWon gamesPlayed'); // 필요한 필드만 선택

            return topUsers;
        } catch (error) {
            console.error('[RatingSystem] ❌ 리더보드 조회 실패:', error);
            return [];
        }
    }

    /**
     * 랭크 색상 가져오기 (UI용)
     * @param rank 랭크
     * @returns 색상 코드
     */
    static getRankColor(rank: Rank): string {
        const colors = {
            [Rank.BRONZE]: '#CD7F32',
            [Rank.SILVER]: '#C0C0C0',
            [Rank.GOLD]: '#FFD700',
            [Rank.PLATINUM]: '#E5E4E2',
            [Rank.DIAMOND]: '#B9F2FF',
            [Rank.MASTER]: '#9966CC',
            [Rank.GRANDMASTER]: '#FF6B6B'
        };
        return colors[rank];
    }

    /**
     * 매칭을 위한 레이팅 범위 계산
     * @param rating 기준 레이팅
     * @param tolerance 허용 범위 (기본 200)
     * @returns 최소, 최대 레이팅
     */
    static getMatchmakingRange(rating: number, tolerance: number = 200): { min: number; max: number } {
        return {
            min: Math.max(0, rating - tolerance),
            max: rating + tolerance
        };
    }
}
