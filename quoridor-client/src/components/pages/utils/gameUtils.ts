import { GameState, Player, Position, Wall } from '../../../types';

// 게임 상태를 플레이어 관점으로 변환 (각자 하단에서 시작하도록)
export function getGameState(gameState: GameState | null, playerId: string | null): (GameState & { players: Player[] }) | null {
  if (!gameState) return null;
  const gs: any = gameState;
  const defaultPositions = {
    player1: { x: 4, y: 8 },
    player2: { x: 4, y: 0 }
  };
  const players: Player[] = [
    {
      id: 'player1',
      ...gs.player1,
      position: gs.player1?.position ?? defaultPositions.player1
    },
    {
      id: 'player2',
      ...gs.player2,
      position: gs.player2?.position ?? defaultPositions.player2
    }
  ];
  const safeWalls = gs.walls ?? [];
  if (playerId === 'player2') {
    const transformedPlayers = players.map(player => ({
      ...player,
      position: {
        x: 8 - player.position.x,
        y: 8 - player.position.y
      }
    }));
    const transformedWalls = safeWalls.map((wall: any) => ({
      ...wall,
      position: {
        x: wall.orientation === 'horizontal' ? 7 - wall.position.x : 8 - wall.position.x,
        y: wall.orientation === 'horizontal' ? 8 - wall.position.y : 7 - wall.position.y
      }
    }));
    return { ...gs, players: transformedPlayers, walls: transformedWalls };
  }
  return { ...gs, players, walls: safeWalls };
}

// 최단 경로 계산 (BFS)
export function bfsShortestPath(start: Position, goalRows: number[], walls: Wall[]): number {
  const BOARD_SIZE = 9;
  const queue: {pos: Position, dist: number}[] = [{pos: start, dist: 0}];
  const visited = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(false));
  visited[start.x][start.y] = true;
  const directions = [
    {dx: 0, dy: -1}, // up
    {dx: 0, dy: 1},  // down
    {dx: -1, dy: 0}, // left
    {dx: 1, dy: 0},  // right
  ];
  const isBlocked = (x1: number, y1: number, x2: number, y2: number) => {
    for (const wall of walls) {
      if (wall.orientation === 'horizontal') {
        if ((y1 === wall.position.y && y2 === wall.position.y + 1) || (y2 === wall.position.y && y1 === wall.position.y + 1)) {
          if ((x1 === wall.position.x && x2 === wall.position.x + 1) || (x2 === wall.position.x && x1 === wall.position.x + 1)) {
            return true;
          }
        }
      } else {
        if ((x1 === wall.position.x && x2 === wall.position.x + 1) || (x2 === wall.position.x && x1 === wall.position.x + 1)) {
          if ((y1 === wall.position.y && y2 === wall.position.y + 1) || (y2 === wall.position.y && y1 === wall.position.y + 1)) {
            return true;
          }
        }
      }
    }
    return false;
  };
  while (queue.length > 0) {
    const {pos, dist} = queue.shift()!;
    if (goalRows.includes(pos.y)) return dist;
    for (const {dx, dy} of directions) {
      const nx = pos.x + dx, ny = pos.y + dy;
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
      if (visited[nx][ny]) continue;
      if (isBlocked(pos.x, pos.y, nx, ny)) continue;
      visited[nx][ny] = true;
      queue.push({pos: {x: nx, y: ny}, dist: dist + 1});
    }
  }
  return -1;
}
