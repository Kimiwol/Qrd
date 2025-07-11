import { GameState, Player, Position, Wall } from '../types';

export class GameLogic {
    
    // 게임 상태 초기화
    static getInitialGameState(): GameState {
        return {
            players: [
                { id: 'player1', position: { x: 4, y: 0 }, wallsLeft: 10 },
                { id: 'player2', position: { x: 4, y: 8 }, wallsLeft: 10 }
            ],
            walls: [],
            currentTurn: 'player1'
        };
    }

    // 이동이 유효한지 확인
    static isValidMove(player: Player, newPosition: Position, gameState: GameState): boolean {
        // 보드 범위 체크
        if (newPosition.x < 0 || newPosition.x > 8 || 
            newPosition.y < 0 || newPosition.y > 8) {
            return false;
        }

        const dx = Math.abs(newPosition.x - player.position.x);
        const dy = Math.abs(newPosition.y - player.position.y);
        
        // 다른 플레이어의 위치 확인
        const otherPlayer = gameState.players.find(p => p.id !== player.id);
        
        if (!otherPlayer) return false;

        // 기본 이동: 한 칸
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
            // 이동하려는 칸에 다른 플레이어가 있는지 확인
            if (otherPlayer.position.x === newPosition.x && 
                otherPlayer.position.y === newPosition.y) {
                return false;
            }
            // 벽에 막혀있는지 확인
            return !this.isBlockedByWall(player.position, newPosition, gameState.walls);
        }
        
        // 플레이어 뛰어넘기
        if ((dx === 2 && dy === 0) || (dx === 0 && dy === 2)) {
            const midX = (player.position.x + newPosition.x) / 2;
            const midY = (player.position.y + newPosition.y) / 2;
            
            // 중간에 다른 플레이어가 있는지 확인
            if (otherPlayer.position.x === midX && otherPlayer.position.y === midY) {
                // 뛰어넘으려는 방향에 벽이 없는지 확인
                return !this.isBlockedByWall(player.position, {x: midX, y: midY}, gameState.walls) &&
                       !this.isBlockedByWall({x: midX, y: midY}, newPosition, gameState.walls);
            }
        }
        
        return false;
    }

    // 벽 설치가 유효한지 확인
    static isValidWallPlacement(wall: Wall, gameState: GameState, player: Player): boolean {
        // 벽이 남아있는지 확인
        if (player.wallsLeft <= 0) {
            return false;
        }

        // 벽이 보드 범위 안에 있는지 확인
        if (wall.position.x < 0 || wall.position.x > 7 || 
            wall.position.y < 0 || wall.position.y > 7) {
            return false;
        }

        // 이미 설치된 벽과 겹치는지 확인
        const isOverlapping = gameState.walls.some(existingWall => {
            // 같은 위치, 같은 방향의 벽이 있는지 확인
            if (wall.position.x === existingWall.position.x && wall.position.y === existingWall.position.y && wall.orientation === existingWall.orientation) {
                return true;
            }

            // 교차하는 벽이 있는지 확인 (중앙 교차점)
            if (wall.position.x === existingWall.position.x && wall.position.y === existingWall.position.y) {
                return true;
            }

            // 인접한 벽과 겹치는지 확인
            if (wall.orientation === 'horizontal' && existingWall.orientation === 'horizontal') {
                return Math.abs(wall.position.x - existingWall.position.x) < 2 && wall.position.y === existingWall.position.y;
            }
            if (wall.orientation === 'vertical' && existingWall.orientation === 'vertical') {
                return Math.abs(wall.position.y - existingWall.position.y) < 2 && wall.position.x === existingWall.position.x;
            }

            return false;
        });

        if (isOverlapping) {
            return false;
        }

        // 벽이 경로를 완전히 막는지 확인
        const tempGameState = {
            ...gameState,
            walls: [...gameState.walls, wall]
        };

        for (const p of tempGameState.players) {
            if (!this.hasPathToGoal(p, tempGameState.walls)) {
                return false;
            }
        }

        return true;
    }

    // 이동이 벽에 막혀있는지 확인
    static isBlockedByWall(from: Position, to: Position, walls: Wall[]): boolean {
        // 이동이 수평인지 수직인지 확인
        const isHorizontalMove = from.y === to.y;
        
        if (isHorizontalMove) {
            // 수평 이동 (좌우)
            const wallX = Math.min(from.x, to.x);
            return walls.some(wall => 
                wall.orientation === 'vertical' &&
                wall.position.x === wallX &&
                (wall.position.y === from.y || wall.position.y === from.y - 1)
            );
        } else {
            // 수직 이동 (상하)
            const wallY = Math.min(from.y, to.y);
            return walls.some(wall => 
                wall.orientation === 'horizontal' &&
                wall.position.y === wallY &&
                (wall.position.x === from.x || wall.position.x === from.x - 1)
            );
        }
    }

    // 경로가 존재하는지 확인 (BFS 사용)
    static hasPathToGoal(player: Player, walls: Wall[]): boolean {
        const visited = new Set<string>();
        const queue: Position[] = [player.position];
        const targetY = player.id === 'player1' ? 8 : 0;

        while (queue.length > 0) {
            const pos = queue.shift()!;
            const key = `${pos.x},${pos.y}`;

            if (pos.y === targetY) {
                return true;
            }

            if (visited.has(key)) {
                continue;
            }

            visited.add(key);

            // 상하좌우 이동 가능한 위치 확인
            const moves = [
                { x: pos.x, y: pos.y - 1 }, // 위
                { x: pos.x, y: pos.y + 1 }, // 아래
                { x: pos.x - 1, y: pos.y }, // 왼쪽
                { x: pos.x + 1, y: pos.y }  // 오른쪽
            ];

            for (const move of moves) {
                if (move.x < 0 || move.x > 8 || move.y < 0 || move.y > 8) {
                    continue;
                }

                if (!this.isBlockedByWall(pos, move, walls)) {
                    const moveKey = `${move.x},${move.y}`;
                    if (!visited.has(moveKey)) {
                        queue.push(move);
                    }
                }
            }
        }

        return false;
    }

    // 승리 조건 확인
    static checkWinCondition(player: Player): boolean {
        return (player.id === 'player1' && player.position.y === 8) ||
               (player.id === 'player2' && player.position.y === 0);
    }
}
