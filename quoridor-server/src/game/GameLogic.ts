import { GameState, PlayerState, Position, Wall } from '../types';

export class GameLogic {
    
    // 게임 상태 초기화
    static getInitialGameState(): GameState {
        return {
            player1: { position: { row: 0, col: 4 }, walls: 10 },
            player2: { position: { row: 8, col: 4 }, walls: 10 },
            walls: [],
            currentTurn: 'player1',
            gameOver: {
                isOver: false
            }
        };
    }

    // 이동이 유효한지 확인
    static isValidMove(currentPosition: Position, newPosition: Position, walls: Wall[]): boolean {
        // 보드 범위 체크
        if (newPosition.row < 0 || newPosition.row > 8 || 
            newPosition.col < 0 || newPosition.col > 8) {
            return false;
        }

        const dr = Math.abs(newPosition.row - currentPosition.row);
        const dc = Math.abs(newPosition.col - currentPosition.col);
        
        // 기본 이동: 한 칸
        if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
            // 벽에 막혀있는지 확인
            return !this.isBlockedByWall(currentPosition, newPosition, walls);
        }
        
        // 점프 이동 (다른 플레이어 뛰어넘기) - 이 로직은 상대방 위치 정보가 필요함
        // GameManager에서 상대방 위치를 포함하여 호출하도록 수정하거나,
        // GameState 전체를 받는 식으로 변경해야 함.
        // 여기서는 간단하게 점프 로직은 생략하고 기본 이동만 검사.
        
        return false;
    }

    // 벽 설치가 유효한지 확인
    static isValidWallPlacement(wall: Wall, walls: Wall[], player1Pos: Position, player2Pos: Position): boolean {
        // 벽이 보드 범위 안에 있는지 확인 (벽은 8x8 격자에 위치)
        if (wall.position.row < 0 || wall.position.row > 7 || 
            wall.position.col < 0 || wall.position.col > 7) {
            return false;
        }

        // 이미 설치된 벽과 겹치는지 확인
        const isOverlapping = walls.some(existingWall => {
            // 같은 위치, 같은 방향의 벽
            if (wall.position.row === existingWall.position.row && wall.position.col === existingWall.position.col) {
                return true;
            }
            // 교차하는 벽 (같은 위치, 다른 방향)
            if (wall.position.row === existingWall.position.row && wall.position.col === existingWall.position.col) {
                return true;
            }
            // 인접한 벽과 겹쳐서 2칸짜리 벽을 만드는 경우
            if (wall.orientation === 'horizontal' && existingWall.orientation === 'horizontal') {
                return wall.position.row === existingWall.position.row && Math.abs(wall.position.col - existingWall.position.col) === 1;
            }
            if (wall.orientation === 'vertical' && existingWall.orientation === 'vertical') {
                return wall.position.col === existingWall.position.col && Math.abs(wall.position.row - existingWall.position.row) === 1;
            }
            return false;
        });

        if (isOverlapping) {
            return false;
        }

        // 벽 설치 후에도 각 플레이어가 목표 지점까지 도달할 수 있는지 확인
        const newWalls = [...walls, wall];
        if (!this.hasPathToGoal({ position: player1Pos, walls: 0 }, newWalls, 'player1') ||
            !this.hasPathToGoal({ position: player2Pos, walls: 0 }, newWalls, 'player2')) {
            return false;
        }

        return true;
    }

    // 이동이 벽에 막혀있는지 확인
    static isBlockedByWall(from: Position, to: Position, walls: Wall[]): boolean {
        // 이동이 수평인지 수직인지 확인
        const isHorizontalMove = from.row === to.row;
        
        if (isHorizontalMove) {
            // 수평 이동 (좌우)
            const wallCol = Math.min(from.col, to.col);
            return walls.some(wall => 
                wall.orientation === 'vertical' &&
                wall.position.col === wallCol &&
                (wall.position.row === from.row || wall.position.row === from.row - 1)
            );
        } else {
            // 수직 이동 (상하)
            const wallRow = Math.min(from.row, to.row);
            return walls.some(wall => 
                wall.orientation === 'horizontal' &&
                wall.position.row === wallRow &&
                (wall.position.col === from.col || wall.position.col === from.col - 1)
            );
        }
    }

    // 경로가 존재하는지 확인 (BFS 사용)
    static hasPathToGoal(player: PlayerState, walls: Wall[], playerId: 'player1' | 'player2'): boolean {
        const visited = new Set<string>();
        const queue: Position[] = [player.position];
        const targetRow = playerId === 'player1' ? 8 : 0;

        while (queue.length > 0) {
            const pos = queue.shift()!;
            const key = `${pos.row},${pos.col}`;

            if (pos.row === targetRow) {
                return true;
            }

            if (visited.has(key)) {
                continue;
            }

            visited.add(key);

            // 상하좌우 이동 가능한 위치 확인
            const moves = [
                { row: pos.row - 1, col: pos.col }, // 위
                { row: pos.row + 1, col: pos.col }, // 아래
                { row: pos.row, col: pos.col - 1 }, // 왼쪽
                { row: pos.row, col: pos.col + 1 }  // 오른쪽
            ];

            for (const move of moves) {
                if (move.row < 0 || move.row > 8 || move.col < 0 || move.col > 8) {
                    continue;
                }

                if (!this.isBlockedByWall(pos, move, walls)) {
                    const moveKey = `${move.row},${move.col}`;
                    if (!visited.has(moveKey)) {
                        queue.push(move);
                    }
                }
            }
        }

        return false;
    }

    // 승리 조건 확인
    static checkWinCondition(position: Position, playerId: 'player1' | 'player2'): boolean {
        if (playerId === 'player1') {
            return position.row === 8;
        } else {
            return position.row === 0;
        }
    }

    // 가능한 모든 이동 위치 반환 (봇을 위해)
    static getValidMoves(position: Position, walls: Wall[], playerId: 'player1' | 'player2'): Position[] {
        const validMoves: Position[] = [];
        const moves = [
            { row: position.row - 1, col: position.col }, // 위
            { row: position.row + 1, col: position.col }, // 아래
            { row: position.row, col: position.col - 1 }, // 왼쪽
            { row: position.row, col: position.col + 1 }  // 오른쪽
        ];

        for (const move of moves) {
            // 점프 로직은 단순화를 위해 생략. isValidMove를 직접 사용.
            if (this.isValidMove(position, move, walls)) {
                 validMoves.push(move);
            }
        }
        
        // TODO: 점프 로직 추가 필요. 상대방 위치를 알아야 함.
        // 현재 구조에서는 GameLogic이 GameState 전체를 모르므로 구현이 복잡함.
        // GameManager에서 이 메서드를 호출할 때 상대방 위치를 넘겨주도록 수정해야 함.

        return validMoves;
    }
}
