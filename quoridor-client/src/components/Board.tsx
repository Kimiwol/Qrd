import React, { useState } from 'react';
import styled from 'styled-components';
import { GameState, Position } from '../types';

const BoardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 60px);
  grid-template-rows: repeat(9, 60px);
  gap: 8px;
  background-color: #f5f5f5;
  padding: 20px;
  position: relative;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(9, 35px);
    grid-template-rows: repeat(9, 35px);
    gap: 6px;
    padding: 15px;
    margin: 0 auto;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(9, 30px);
    grid-template-rows: repeat(9, 30px);
    gap: 5px;
    padding: 10px;
  }
`;

const Cell = styled.div<{ isCurrentTurn: boolean; isValidMove: boolean; showValidMove: boolean }>`
  background-color: ${props => props.showValidMove ? '#e8f5e9' : '#ffffff'};
  border: 2px solid ${props => props.showValidMove ? '#4CAF50' : '#e0e0e0'};
  width: 60px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  @media (max-width: 768px) {
    width: 35px;
    height: 35px;
    font-size: 14px;
    border-radius: 6px;
  }
  
  @media (max-width: 480px) {
    width: 30px;
    height: 30px;
    font-size: 12px;
    border-radius: 4px;
  }

  &:hover {
    background-color: ${props => props.isValidMove ? '#c8e6c9' : '#ffebee'};
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const WallPlacementArea = styled.div<{ type: 'horizontal' | 'vertical' }>`
  position: absolute;
  background-color: transparent;
  transition: all 0.2s ease;
  cursor: pointer;
  z-index: 2;
  border-radius: 3px;

  ${props => props.type === 'horizontal' ? `
    width: 128px;
    height: 16px;
    left: -4px;
    top: 64px;

    &:hover {
      background-color: rgba(76, 175, 80, 0.3);
      border: 2px dashed #4CAF50;
    }
  ` : `
    width: 16px;
    height: 128px;
    left: 64px;
    top: -4px;

    &:hover {
      background-color: rgba(76, 175, 80, 0.3);
      border: 2px dashed #4CAF50;
    }
  `}

  @media (max-width: 768px) {
    ${props => props.type === 'horizontal' ? `
      width: 76px;
      height: 12px;
      left: -3px;
      top: 38px;
    ` : `
      width: 12px;
      height: 76px;
      left: 38px;
      top: -3px;
    `}
  }
  
  @media (max-width: 480px) {
    ${props => props.type === 'horizontal' ? `
      width: 65px;
      height: 10px;
      left: -2.5px;
      top: 32.5px;
    ` : `
      width: 10px;
      height: 65px;
      left: 32.5px;
      top: -2.5px;
    `}
  }
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
  background: linear-gradient(135deg, #8b4513, #a0522d);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  z-index: 3;
  border-radius: 2px;

  ${props => props.isHorizontal ? `
    width: 128px;
    height: 12px;
    left: -4px;
    top: 62px;
  ` : `
    width: 12px;
    height: 128px;
    left: 62px;
    top: -4px;
  `}

  @media (max-width: 768px) {
    ${props => props.isHorizontal ? `
      width: 76px;
      height: 8px;
      left: -3px;
      top: 36.5px;
    ` : `
      width: 8px;
      height: 76px;
      left: 36.5px;
      top: -3px;
    `}
  }
  
  @media (max-width: 480px) {
    ${props => props.isHorizontal ? `
      width: 65px;
      height: 6px;
      left: -2.5px;
      top: 31px;
    ` : `
      width: 6px;
      height: 65px;
      left: 31px;
      top: -2.5px;
    `}
  }
`;

const WallPreview = styled.div<{ isHorizontal: boolean }>`
  position: absolute;
  background: transparent;
  border: 2px dashed #4CAF50;
  z-index: 3;
  border-radius: 2px;
  pointer-events: none;

  ${props => props.isHorizontal ? `
    width: 128px;
    height: 12px;
    left: -4px;
    top: 62px;
  ` : `
    width: 12px;
    height: 128px;
    left: 62px;
    top: -4px;
  `}

  @media (max-width: 768px) {
    ${props => props.isHorizontal ? `
      width: 76px;
      height: 8px;
      left: -3px;
      top: 36.5px;
    ` : `
      width: 8px;
      height: 76px;
      left: 36.5px;
      top: -3px;
    `}
  }
  
  @media (max-width: 480px) {
    ${props => props.isHorizontal ? `
      width: 65px;
      height: 6px;
      left: -2.5px;
      top: 31px;
    ` : `
      width: 6px;
      height: 65px;
      left: 31px;
      top: -2.5px;
    `}
  }
`;

interface BoardProps {
  gameState: GameState;
  onCellClick: (position: Position) => void;
  onWallPlace: (position: Position, isHorizontal: boolean) => void;
}

const Board: React.FC<BoardProps> = ({ gameState, onCellClick, onWallPlace }) => {
  const [wallPreview, setWallPreview] = useState<{position: Position, isHorizontal: boolean} | null>(null);

  // 간단한 이동 가능성 체크 (UI 힌트용)
  const isValidMove = (position: Position): boolean => {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurn);
    if (!currentPlayer) return false;

    const dx = Math.abs(position.x - currentPlayer.position.x);
    const dy = Math.abs(position.y - currentPlayer.position.y);

    // 다른 플레이어가 있는 위치인지 확인
    const hasPlayer = gameState.players.some(p => 
      p.position.x === position.x && p.position.y === position.y
    );

    if (hasPlayer) return false;

    // 기본 이동 (1칸)
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      return true;
    }

    // 점프 이동 (2칸) - 중간에 상대방이 있을 때만 허용
    if ((dx === 2 && dy === 0) || (dx === 0 && dy === 2)) {
      const midX = (position.x + currentPlayer.position.x) / 2;
      const midY = (position.y + currentPlayer.position.y) / 2;
      
      // 중간 위치에 상대방이 있는지 확인
      const hasPlayerInMiddle = gameState.players.some(p =>
        p.id !== currentPlayer.id &&
        p.position.x === midX &&
        p.position.y === midY
      );

      return hasPlayerInMiddle;
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
              <WallPreview 
                isHorizontal={wallPreview.isHorizontal}
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