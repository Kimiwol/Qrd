import React, { useState } from 'react';
import styled from 'styled-components';
import { GameState, Position, Wall as WallType, Player as PlayerInfo } from '../types';

interface BoardProps {
  gameState: GameState;
  onCellClick: (position: Position) => void;
  onWallPlace: (wall: WallType) => void;
  playerId: string | null;
  isMyTurn: boolean;
}

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  grid-template-rows: repeat(9, 1fr);
  gap: 8px;
  position: relative;
  width: 100%;
  height: 100%;
`;

const Controls = styled.div`
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
`;

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

const ControlsContainer = styled.div`
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
`;

const WallPlacementArea = styled.div<{ type: 'horizontal' | 'vertical' }>`
  position: absolute;
  background-color: transparent;
  transition: all 0.2s ease;
  cursor: pointer;
  z-index: 2;
  border-radius: 3px;

  ${props => props.type === 'horizontal' ? `
    width: 140px;
    height: 24px;
    left: -10px;
    top: 58px;

    &:hover {
      background-color: rgba(76, 175, 80, 0.3);
      border: 2px dashed #4CAF50;
    }
  ` : `
    width: 24px;
    height: 140px;
    left: 58px;
    top: -10px;

    &:hover {
      background-color: rgba(76, 175, 80, 0.3);
      border: 2px dashed #4CAF50;
    }
  `}

  @media (max-width: 768px) {
    ${props => props.type === 'horizontal' ? `
      width: 80px;
      height: 16px;
      left: -6px;
      top: 33px;
    ` : `
      width: 16px;
      height: 80px;
      left: 33px;
      top: -6px;
    `}
  }
  
  @media (max-width: 480px) {
    ${props => props.type === 'horizontal' ? `
      width: 70px;
      height: 14px;
      left: -5px;
      top: 28px;
    ` : `
      width: 14px;
      height: 70px;
      left: 28px;
      top: -5px;
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

const Wall = styled.div<{ position: Position; isHorizontal: boolean }>`
  position: absolute;
  background: linear-gradient(135deg, #8b4513, #a0522d);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  z-index: 3;
  border-radius: 2px;
  left: ${props => props.position.x * (60 + 8)}px;
  top: ${props => props.position.y * (60 + 8)}px;

  ${props => props.isHorizontal ? `
    width: ${60 * 2 + 8}px;
    height: 8px;
    margin-top: 56px;
  ` : `
    width: 8px;
    height: ${60 * 2 + 8}px;
    margin-left: 56px;
  `}

  @media (max-width: 768px) {
    left: ${props => props.position.x * (35 + 6)}px;
    top: ${props => props.position.y * (35 + 6)}px;
    ${props => props.isHorizontal ? `
      width: ${35 * 2 + 6}px;
      height: 6px;
      margin-top: 33px;
    ` : `
      width: 6px;
      height: ${35 * 2 + 6}px;
      margin-left: 33px;
    `}
  }
  
  @media (max-width: 480px) {
    left: ${props => props.position.x * (30 + 5)}px;
    top: ${props => props.position.y * (30 + 5)}px;
    ${props => props.isHorizontal ? `
      width: ${30 * 2 + 5}px;
      height: 5px;
      margin-top: 28px;
    ` : `
      width: 5px;
      height: ${30 * 2 + 5}px;
      margin-left: 28px;
    `}
  }
`;

const PreviewWall = styled(Wall)`
  background: rgba(76, 175, 80, 0.7);
  box-shadow: 0 2px 10px rgba(76, 175, 80, 0.5);
  z-index: 5; // 다른 요소들보다 위에 보이도록 z-index 증가
  pointer-events: none; // 미리보기 벽이 마우스 이벤트를 가로채지 않도록 설정

  ${props => props.isHorizontal ? `
    height: 6px; // 두께 줄임
  ` : `
    width: 6px; // 두께 줄임
  `}

  @media (max-width: 768px) {
    ${props => props.isHorizontal ? `
      height: 5px;
    ` : `
      width: 5px;
    `}
  }
  
  @media (max-width: 480px) {
    ${props => props.isHorizontal ? `
      height: 4px;
    ` : `
      width: 4px;
    `}
  }
`;

const StyledPlayerPiece = styled.div<{ player: 'player1' | 'player2' }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: ${props => props.player === 'player1' ? '#ff4444' : '#4444ff'};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
  z-index: 10;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const Board: React.FC<BoardProps> = ({
  gameState,
  onCellClick,
  onWallPlace,
  playerId,
  isMyTurn,
}) => {
  const [previewWall, setPreviewWall] = useState<{ position: Position; isHorizontal: boolean } | null>(null);
  const [isPlacingWall, setIsPlacingWall] = useState(false);

  const playerPerspective = playerId === 'player1' ? 'player1' : 'player2';

  const transformCoordinates = (coords: Position) => {
    if (playerPerspective === 'player1') {
      return coords;
    }
    return { x: 8 - coords.x, y: 8 - coords.y };
  };

  const renderPlayer = (player: PlayerInfo, playerType: 'player1' | 'player2') => {
    if (!player || player.position.x === undefined || player.position.y === undefined) return null;
    const { x, y } = transformCoordinates(player.position);
    
    const cellStyle = {
        gridColumn: `${y + 1}`,
        gridRow: `${x + 1}`,
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    } as React.CSSProperties;

    return (
      <div style={cellStyle}>
        <StyledPlayerPiece player={playerType} />
      </div>
    );
  };

  const handleCellClick = (row: number, col: number) => {
    if (!isMyTurn) return;

    const transformedCol = playerPerspective === 'player1' ? col : 8 - col;
    const transformedRow = playerPerspective === 'player1' ? row : 8 - row;

    if (!isPlacingWall) {
        console.log(`이동 시도: (${transformedRow}, ${transformedCol})`);
        onCellClick({ x: transformedRow, y: transformedCol });
    }
  };

  const handleCellMouseMove = (e: React.MouseEvent<HTMLDivElement>, row: number, col: number) => {
    if (!isMyTurn || !isPlacingWall) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isHorizontal = Math.abs(x - rect.width / 2) > Math.abs(y - rect.height / 2);
    
    const transformedCol = playerPerspective === 'player1' ? col : 8 - col;
    const transformedRow = playerPerspective === 'player1' ? row : 8 - row;

    if (transformedCol < 8 && transformedRow < 8) {
        const newPreviewWall = { position: { x: transformedRow, y: transformedCol }, isHorizontal };
        // 불필요한 리렌더링을 막기 위해 상태가 실제로 변경될 때만 업데이트
        if (JSON.stringify(newPreviewWall) !== JSON.stringify(previewWall)) {
            setPreviewWall(newPreviewWall);
        }
    }
  };

  const handleCellMouseLeave = () => {
    setPreviewWall(null);
  };

  const handleWallPlacement = (isHorizontal: boolean) => {
    if (!isMyTurn || !previewWall) return;

    const { position } = previewWall;

    console.log(`벽 설치 확정: (${position.x}, ${position.y}), 방향: ${isHorizontal ? 'horizontal' : 'vertical'}`);
    onWallPlace({
      position,
      isHorizontal,
    });
    setPreviewWall(null);
    setIsPlacingWall(false);
  };

  const toggleWallPlacement = () => {
    setIsPlacingWall(!isPlacingWall);
    setPreviewWall(null);
  };

  const renderWall = (wall: WallType, index: number) => {
    const { position, isHorizontal } = wall;
    const transformedPosition = transformCoordinates(position);
    
    const transformedIsHorizontal = isHorizontal;

    return (
      <Wall
        key={index}
        position={transformedPosition}
        isHorizontal={transformedIsHorizontal}
      />
    );
  };

  return (
    <BoardContainer>
      <GridContainer>
        {Array.from({ length: 9 }).map((_, row) =>
          Array.from({ length: 9 }).map((_, col) => (
            <Cell
              key={`${row}-${col}`}
              isCurrentTurn={isMyTurn}
              isValidMove={false} // TODO: Add logic for valid moves
              showValidMove={false} // TODO: Add logic for showing valid moves
              onClick={() => handleCellClick(row, col)}
              onMouseMove={(e) => handleCellMouseMove(e, row, col)}
              onMouseLeave={handleCellMouseLeave}
            />
          ))
        )}
        {renderPlayer(gameState.players.find(p => p.id === 'player1')!, 'player1')}
        {renderPlayer(gameState.players.find(p => p.id === 'player2')!, 'player2')}
        {gameState.walls.map(renderWall)}
        {previewWall && (
          <PreviewWall
            position={transformCoordinates(previewWall.position)}
            isHorizontal={previewWall.isHorizontal}
          />
        )}
      </GridContainer>
      <Controls>
        <button onClick={toggleWallPlacement} disabled={!isMyTurn}>
          {isPlacingWall ? '벽 놓기 취소' : '벽 놓기'}
        </button>
        {isPlacingWall && (
          <>
            <button onClick={() => previewWall && handleWallPlacement(true)} disabled={!previewWall}>
              가로로 놓기
            </button>
            <button onClick={() => previewWall && handleWallPlacement(false)} disabled={!previewWall}>
              세로로 놓기
            </button>
          </>
        )}
      </Controls>
    </BoardContainer>
  );
};

export default Board;