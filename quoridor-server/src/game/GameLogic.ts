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

    // 플레이어 이동 처리
    static makeMove(gameState: GameState, newPosition: Position): GameState {
        const currentPlayer = gameState.currentTurn;
        const playerState = gameState[currentPlayer];
        const opponentState = gameState[currentPlayer === 'player1' ? 'player2' : 'player1'];

        // 이동 유효성 검사
        if (!this.isValidMoveWithState(gameState, newPosition)) {
            throw new Error('유효하지 않은 이동입니다.');
        }

        const newGameState: GameState = {
            ...gameState,
            [currentPlayer]: {
                ...playerState,
                position: newPosition
            },
            currentTurn: currentPlayer === 'player1' ? 'player2' : 'player1'
        };

        // 승리 조건 확인
        if (this.checkWinCondition(newPosition, currentPlayer)) {
            newGameState.gameOver = {
                isOver: true,
                winner: currentPlayer,
                reason: 'goal_reached'
            };
        }

        return newGameState;
    }

    // 벽 설치 처리
    static placeWall(gameState: GameState, wall: Wall): GameState {
        const currentPlayer = gameState.currentTurn;
        const playerState = gameState[currentPlayer];

        if (playerState.walls <= 0) {
            throw new Error('남은 벽이 없습니다.');
        }

        if (!this.isValidWallPlacement(wall, gameState.walls, gameState.player1.position, gameState.player2.position)) {
            throw new Error('유효하지 않은 벽 설치입니다.');
        }

        const newGameState: GameState = {
            ...gameState,
            [currentPlayer]: {
                ...playerState,
                walls: playerState.walls - 1
            },
            walls: [...gameState.walls, wall],
            currentTurn: currentPlayer === 'player1' ? 'player2' : 'player1'
        };

        return newGameState;
    }

    // 승자 확인
    static checkWinner(gameState: GameState): 'player1' | 'player2' | null {
        if (gameState.gameOver.isOver && gameState.gameOver.winner) {
            return gameState.gameOver.winner;
        }
        return null;
    }

    // 게임 상태를 고려한 이동 유효성 검사
    static isValidMoveWithState(gameState: GameState, newPosition: Position): boolean {
        const currentPlayer = gameState.currentTurn;
        const currentPosition = gameState[currentPlayer].position;
        const opponentPosition = gameState[currentPlayer === 'player1' ? 'player2' : 'player1'].position;

        const validMoves = this.getValidMoves(currentPosition, gameState.walls, currentPlayer, opponentPosition);
        return validMoves.some(pos => pos.row === newPosition.row && pos.col === newPosition.col);
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

        // 기존 벽과의 충돌 여부 확인
        const conflicts = walls.some(existing => {
            const sameCell = existing.position.row === wall.position.row && existing.position.col === wall.position.col;
            if (sameCell) {
                return true; // 같은 위치이거나 교차하는 경우
            }

            if (existing.orientation === wall.orientation) {
                if (wall.orientation === 'horizontal') {
                    return existing.position.row === wall.position.row &&
                           Math.abs(existing.position.col - wall.position.col) === 1;
                } else {
                    return existing.position.col === wall.position.col &&
                           Math.abs(existing.position.row - wall.position.row) === 1;
                }
            }

            return false;
        });

        if (conflicts) {
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
    static getValidMoves(position: Position, walls: Wall[], playerId: 'player1' | 'player2', opponentPosition?: Position): Position[] {
        const validMoves: Position[] = [];
        const moves = [
            { row: position.row - 1, col: position.col }, // 위
            { row: position.row + 1, col: position.col }, // 아래
            { row: position.row, col: position.col - 1 }, // 왼쪽
            { row: position.row, col: position.col + 1 }  // 오른쪽
        ];

        for (const move of moves) {
            // 기본 한 칸 이동
            if (this.isValidMove(position, move, walls)) {
                // 상대방 위치가 있고, 이동하려는 위치가 상대방 위치라면 점프 이동을 시도
                if (opponentPosition && move.row === opponentPosition.row && move.col === opponentPosition.col) {
                    // 점프 방향 계산
                    const dr = opponentPosition.row - position.row;
                    const dc = opponentPosition.col - position.col;
                    const jumpRow = opponentPosition.row + dr;
                    const jumpCol = opponentPosition.col + dc;
                    // 점프 위치가 보드 내에 있고, 벽에 막혀있지 않으면 점프 이동 추가
                    if (jumpRow >= 0 && jumpRow <= 8 && jumpCol >= 0 && jumpCol <= 8 &&
                        !this.isBlockedByWall(opponentPosition, { row: jumpRow, col: jumpCol }, walls)) {
                        validMoves.push({ row: jumpRow, col: jumpCol });
                    } else {
                        // 점프가 불가능하면 대각선 이동(상대방 뒤에 벽이 있을 때)
                        const diagMoves = [];
                        if (dr === 0) { // 좌우로 마주보고 있을 때
                            if (opponentPosition.row > 0 && !this.isBlockedByWall(opponentPosition, { row: opponentPosition.row - 1, col: opponentPosition.col }, walls)) {
                                diagMoves.push({ row: opponentPosition.row - 1, col: opponentPosition.col });
                            }
                            if (opponentPosition.row < 8 && !this.isBlockedByWall(opponentPosition, { row: opponentPosition.row + 1, col: opponentPosition.col }, walls)) {
                                diagMoves.push({ row: opponentPosition.row + 1, col: opponentPosition.col });
                            }
                        } else if (dc === 0) { // 상하로 마주보고 있을 때
                            if (opponentPosition.col > 0 && !this.isBlockedByWall(opponentPosition, { row: opponentPosition.row, col: opponentPosition.col - 1 }, walls)) {
                                diagMoves.push({ row: opponentPosition.row, col: opponentPosition.col - 1 });
                            }
                            if (opponentPosition.col < 8 && !this.isBlockedByWall(opponentPosition, { row: opponentPosition.row, col: opponentPosition.col + 1 }, walls)) {
                                diagMoves.push({ row: opponentPosition.row, col: opponentPosition.col + 1 });
                            }
                        }
                        validMoves.push(...diagMoves);
                    }
                } else {
                    validMoves.push(move);
                }
            }
        }
        return validMoves;
    }
}
