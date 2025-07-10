import React, { useState } from 'react';
import styled from 'styled-components';
import { GameState, Position } from '../types';

const BoardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 60px);
  grid-template-rows: repeat(9, 60px);
  gap: 2px;
  background-color: #cccccc;
  padding: 10px;
  position: relative;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(9, 40px);
    grid-template-rows: repeat(9, 40px);
    gap: 1px;
    padding: 5px;
    margin: 0 auto;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(9, 35px);
    grid-template-rows: repeat(9, 35px);
  }
`;

const Cell = styled.div<{ isCurrentTurn: boolean; isValidMove: boolean; showValidMove: boolean }>`
  background-color: ${props => props.showValidMove ? '#e0e0e0' : '#ffffff'};
  border: 1px solid #999999;
  width: 60px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s;

  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
    font-size: 14px;
  }
  
  @media (max-width: 480px) {
    width: 35px;
    height: 35px;
    font-size: 12px;
  }

  &:hover {
    background-color: ${props => props.isValidMove ? '#e6ffe6' : '#ffe6e6'};
  }
`;

const WallPlacementArea = styled.div<{ type: 'horizontal' | 'vertical' }>`
  position: absolute;
  background-color: transparent;
  transition: background-color 0.2s;
  cursor: pointer;
  z-index: 2;

  ${props => props.type === 'horizontal' ? `
    width: 122px;
    height: 10px;
    left: -1px;
    top: 55px;  /* 셀 아래쪽 중앙에 위치하도록 수정 */

    &:hover {
      background-color: #4CAF5066;
    }
  ` : `
    width: 10px;
    height: 122px;
    left: 55px;  /* 셀 오른쪽 중앙에 위치하도록 수정 */
    top: -1px;

    &:hover {
      background-color: #4CAF5066;
    }
  `}
`;

const Player = styled.div<{ isPlayer1: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: ${props => props.isPlayer1 ? '#ff4444' : '#4444ff'};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
  z-index: 10;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 3px solid #ffffff;

  @media (max-width: 768px) {
    width: 32px;
    height: 32px;
    border: 2px solid #ffffff;
  }
  
  @media (max-width: 480px) {
    width: 28px;
    height: 28px;
    border: 2px solid #ffffff;
  }

  &:hover {
    transform: translate(-50%, -50%) scale(1.1);
  }
`;

const Wall = styled.div<{ isHorizontal: boolean }>`
  position: absolute;
  background-color: #8b4513;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 3;

  ${props => props.isHorizontal ? `
    width: 122px;
    height: 10px;
    left: -1px;
    top: 55px;  /* 셀 아래쪽 중앙에 위치하도록 수정 */
  ` : `
    width: 10px;
    height: 122px;
    left: 55px;  /* 셀 오른쪽 중앙에 위치하도록 수정 */
    top: -1px;
  `}
`;

interface BoardProps {
  gameState: GameState;
  onCellClick: (position: Position) => void;
  onWallPlace: (position: Position, isHorizontal: boolean) => void;
}

const Board: React.FC<BoardProps> = ({ gameState, onCellClick, onWallPlace }) => {
  const [wallPreview, setWallPreview] = useState<{position: Position, isHorizontal: boolean} | null>(null);

  const isValidMove = (position: Position): boolean => {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn);
    if (!currentPlayer) return false;

    const dx = Math.abs(position.x - currentPlayer.position.x);
    const dy = Math.abs(position.y - currentPlayer.position.y);

    // 기본 이동 체크
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      const hasPlayer = gameState.players.some(p => 
        p.id !== currentPlayer.id &&
        p.position.x === position.x &&
        p.position.y === position.y
      );

      if (hasPlayer) return false;

      // 벽에 막혀있는지 확인
      const isBlocked = gameState.walls.some(wall => {
        if (wall.isHorizontal) {
          // 수평 벽이 위아래 이동을 막는 경우
          return wall.position.y === Math.min(currentPlayer.position.y, position.y) &&
                 wall.position.x <= currentPlayer.position.x &&
                 currentPlayer.position.x < wall.position.x + 2;
        } else {
          // 수직 벽이 좌우 이동을 막는 경우
          return wall.position.x === Math.min(currentPlayer.position.x, position.x) &&
                 wall.position.y <= currentPlayer.position.y &&
                 currentPlayer.position.y < wall.position.y + 2;
        }
      });

      return !isBlocked;
    }

    // 플레이어 뛰어넘기 체크
    if ((dx === 2 && dy === 0) || (dx === 0 && dy === 2)) {
      const midX = (position.x + currentPlayer.position.x) / 2;
      const midY = (position.y + currentPlayer.position.y) / 2;
      
      const hasPlayerInMiddle = gameState.players.some(p =>
        p.id !== currentPlayer.id &&
        p.position.x === midX &&
        p.position.y === midY
      );

      if (!hasPlayerInMiddle) return false;

      // 뛰어넘을 때 벽에 막혀있는지 확인
      const isBlockedToMiddle = gameState.walls.some(wall => {
        if (wall.isHorizontal) {
          return wall.position.y === Math.min(currentPlayer.position.y, midY) &&
                 wall.position.x <= currentPlayer.position.x &&
                 currentPlayer.position.x < wall.position.x + 2;
        } else {
          return wall.position.x === Math.min(currentPlayer.position.x, midX) &&
                 wall.position.y <= currentPlayer.position.y &&
                 currentPlayer.position.y < wall.position.y + 2;
        }
      });

      const isBlockedFromMiddle = gameState.walls.some(wall => {
        if (wall.isHorizontal) {
          return wall.position.y === Math.min(midY, position.y) &&
                 wall.position.x <= midX &&
                 midX < wall.position.x + 2;
        } else {
          return wall.position.x === Math.min(midX, position.x) &&
                 wall.position.y <= midY &&
                 midY < wall.position.y + 2;
        }
      });

      return !isBlockedToMiddle && !isBlockedFromMiddle;
    }

    return false;
  };

  const renderBoard = () => {
    const cells = [];
    
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const position = { x, y };
        const player = gameState.players.find(p => 
          p.position.x === x && p.position.y === y
        );
        const isCurrentTurn = player?.id === gameState.currentTurn;
        const validMove = isValidMove(position);

        const horizontalWall = gameState.walls.find(w => 
          w.isHorizontal && w.position.x === x && w.position.y === y
        );
        const verticalWall = gameState.walls.find(w => 
          !w.isHorizontal && w.position.x === x && w.position.y === y
        );

        // 벽 설치 가능 여부 확인 (수정)
        const canPlaceHorizontalWall = x < 8;  // 가로벽은 마지막 열 제외
        const canPlaceVerticalWall = y < 8;    // 세로벽은 마지막 행 제외

        cells.push(
          <Cell 
            key={`${x}-${y}`}
            isCurrentTurn={isCurrentTurn}
            isValidMove={validMove}
            showValidMove={validMove}
            onClick={() => onCellClick(position)}
          >
            {player && <Player isPlayer1={player.id === 'player1'} />}
            {horizontalWall && <Wall isHorizontal={true} />}
            {verticalWall && <Wall isHorizontal={false} />}
            {canPlaceHorizontalWall && !horizontalWall && (
              <WallPlacementArea
                type="horizontal"
                onMouseEnter={() => setWallPreview({ position, isHorizontal: true })}
                onMouseLeave={() => setWallPreview(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onWallPlace(position, true);
                }}
              />
            )}
            {canPlaceVerticalWall && !verticalWall && (
              <WallPlacementArea
                type="vertical"
                onMouseEnter={() => setWallPreview({ position, isHorizontal: false })}
                onMouseLeave={() => setWallPreview(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onWallPlace(position, false);
                }}
              />
            )}
            {wallPreview && wallPreview.position.x === x && wallPreview.position.y === y && (
              <Wall 
                isHorizontal={wallPreview.isHorizontal} 
                style={{ backgroundColor: '#4CAF5066', pointerEvents: 'none' }}
              />
            )}
          </Cell>
        );
      }
    }
    
    return cells;
  };

  return (
    <BoardContainer>
      {renderBoard()}
    </BoardContainer>
  );
};

export default Board;