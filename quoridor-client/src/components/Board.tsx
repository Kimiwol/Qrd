import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { GameState, Position, Wall as WallType } from '../types';

interface BoardProps {
  gameState: GameState;
  onCellClick: (position: Position) => void;
  onWallPlace: (wall: WallType) => void;
  playerId: string | null;
  isMyTurn: boolean;
}

const BOARD_SIZE = 9;

const BoardWrapper = styled.div`
  width: 100%;
  max-width: 60vh;
  margin: auto;
  aspect-ratio: 1 / 1;
  padding: 12px;
  background: #4e342e; /* 짙은 단색 */
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  box-sizing: border-box;
`;

const BoardContainer = styled.div`
  --board-size: ${BOARD_SIZE};
  --cell-size: calc((100% - (var(--board-size) - 1) * var(--gap)) / var(--board-size));
  --gap: 6px;

  display: grid;
  grid-template-columns: repeat(var(--board-size), 1fr);
  grid-template-rows: repeat(var(--board-size), 1fr);
  gap: var(--gap);
  background: #4e342e; /* 보드도 단색 */
  padding: 10px;
  position: relative;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  width: 100%;
  height: 100%;
  box-sizing: border-box;

  @media (max-width: 768px) {
    --gap: 4px;
    padding: 6px;
  }
`;

const Cell = styled.div<{ isMyTurn: boolean; isValidMove: boolean; }>`
  background-color: ${props => props.isValidMove ? '#ffe082' : '#bdbdbd'};
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: ${props => props.isMyTurn ? 'pointer' : 'default'};
  position: relative;
  transition: all 0.2s;
  border-radius: 15%;
  box-shadow: none;

  &:hover {
    background-color: ${props => props.isMyTurn && props.isValidMove ? '#ffe082' : (props.isMyTurn ? '#f5f5f5' : '')};
    transform: ${props => props.isMyTurn ? 'translateY(-1px)' : 'none'};
  }
`;

const Player = styled.div<{ color: string; isMe: boolean }>`
  width: 70%;
  height: 70%;
  border-radius: 50%;
  background-color: ${props => props.color};
  border: 2.5px solid ${props => props.isMe ? '#ffd600' : '#bdbdbd'};
  box-shadow: none;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  font-weight: 600;
  font-size: 1em;
`;

const Wall = styled.div<{ orientation: 'horizontal' | 'vertical'; color: string }>`
  position: absolute;
  background-color: ${props => props.color};
  border-radius: 3px;
  box-shadow: none;
  ${({ orientation }) =>
    orientation === 'horizontal'
      ? `
        height: var(--gap);
        width: calc(2 * var(--cell-size) + var(--gap));
        transform: translateY(-50%);
      `
      : `
        width: var(--gap);
        height: calc(2 * var(--cell-size) + var(--gap));
        transform: translateX(-50%);
      `}
`;

const WallPlacementArea = styled.div<{ orientation: 'horizontal' | 'vertical'; isMyTurn: boolean; }>`
  position: absolute;
  cursor: ${props => props.isMyTurn ? 'pointer' : 'default'};
  
  ${({ orientation }) =>
    orientation === 'horizontal'
      ? `
        height: var(--gap);
        width: calc(2 * var(--cell-size) + var(--gap));
        transform: translateY(-50%);
      `
      : `
        width: var(--gap);
        height: calc(2 * var(--cell-size) + var(--gap));
        transform: translateX(-50%);
      `}

  &:hover {
    background-color: ${props => props.isMyTurn ? 'rgba(141, 110, 99, 0.5)' : 'transparent'};
  }
`;

const Board: React.FC<BoardProps> = ({ gameState, onCellClick, onWallPlace, playerId, isMyTurn }) => {
  const [hoveredWall, setHoveredWall] = useState<WallType | null>(null);

  const me = gameState.players.find(p => p.id === playerId);
  const isPlayerOne = me ? gameState.players[0].id === me.id : false;

  const transformPosition = (pos: Position): Position => {
    if (isPlayerOne) {
      return pos;
    }
    return { x: BOARD_SIZE - 1 - pos.x, y: BOARD_SIZE - 1 - pos.y };
  };

  const validMoves = useMemo(() => {
    if (!me || !isMyTurn) return [];
    return (me && me.validMoves ? me.validMoves : []).map(transformPosition);
  }, [me, isMyTurn]);

  const handleCellClick = (x: number, y: number) => {
    if (!isMyTurn) return;
    const originalPosition = transformPosition({ x, y });
    onCellClick(originalPosition);
  };

  const handleWallPlace = (wall: WallType) => {
    if (!isMyTurn) return;
    const originalWall = {
      ...wall,
      position: transformPosition(wall.position),
    };
    if (wall.orientation === 'vertical') {
      originalWall.position.x = BOARD_SIZE - 2 - wall.position.x;
    } else {
      originalWall.position.y = BOARD_SIZE - 2 - wall.position.y;
    }
    onWallPlace(originalWall);
  };

  const renderCell = (x: number, y: number) => {
    const pos = { x, y };
    const playerOnCell = gameState.players.find(p => {
      const transformedP = transformPosition(p.position);
      return transformedP.x === x && transformedP.y === y;
    });

    const isValidMove = validMoves.some(move => move.x === x && move.y === y);

    return (
      <Cell
        key={`${x}-${y}`}
        isMyTurn={isMyTurn}
        isValidMove={isValidMove}
        onClick={() => handleCellClick(x, y)}
      >
        {playerOnCell && (
          <Player color={playerOnCell.id === gameState.players[0].id ? '#fff' : '#222'} isMe={playerOnCell.id === playerId}>
            {playerOnCell.id === playerId ? 'Me' : ''}
          </Player>
        )}
      </Cell>
    );
  };

  const getWallStyle = (wall: WallType) => {
    const transformedPos = transformPosition(wall.position);
    const topOffset = `calc(${transformedPos.y} * (var(--cell-size) + var(--gap)))`;
    const leftOffset = `calc(${transformedPos.x} * (var(--cell-size) + var(--gap)))`;

    if (wall.orientation === 'horizontal') {
      return {
        top: `calc(${topOffset} + var(--cell-size) + var(--gap) / 2)`,
        left: leftOffset,
      };
    } else { // vertical
      return {
        top: topOffset,
        left: `calc(${leftOffset} + var(--cell-size) + var(--gap) / 2)`,
      };
    }
  };

  return (
    <BoardWrapper>
      <BoardContainer>
        {/* Cells */}
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, index) => {
          const x = index % BOARD_SIZE;
          const y = Math.floor(index / BOARD_SIZE);
          return renderCell(x, y);
        })}

        {/* Placed Walls */}
        {(gameState.walls || []).map((wall, index) => {
          // 벽의 y좌표가 4 이상이면 player1(아래쪽) 색, 3 이하이면 player2(위쪽) 색
          let color = '#fff';
          if (wall.position.y >= 4) {
            color = '#fff'; // player1(백)
          } else {
            color = '#222'; // player2(흑)
          }
          return (
            <Wall
              key={`wall-${index}`}
              orientation={wall.orientation}
              color={color}
              style={getWallStyle(wall)}
            />
          );
        })}

        {/* Wall Placement Areas */}
        {isMyTurn && Array.from({ length: (BOARD_SIZE - 1) * (BOARD_SIZE - 1) }).map((_, index) => {
          const x = index % (BOARD_SIZE - 1);
          const y = Math.floor(index / (BOARD_SIZE - 1));
          
          // Horizontal
          const hWall: WallType = { position: { x, y }, orientation: 'horizontal' };
          // Vertical
          const vWall: WallType = { position: { x, y }, orientation: 'vertical' };

          return (
            <React.Fragment key={`wall-area-${index}`}>
              <WallPlacementArea
                orientation="horizontal"
                isMyTurn={isMyTurn}
                style={getWallStyle(hWall)}
                onClick={() => handleWallPlace(hWall)}
                onMouseEnter={() => setHoveredWall(hWall)}
                onMouseLeave={() => setHoveredWall(null)}
              />
              <WallPlacementArea
                orientation="vertical"
                isMyTurn={isMyTurn}
                style={getWallStyle(vWall)}
                onClick={() => handleWallPlace(vWall)}
                onMouseEnter={() => setHoveredWall(vWall)}
                onMouseLeave={() => setHoveredWall(null)}
              />
            </React.Fragment>
          );
        })}

        {/* Hovered Wall Preview */}
        {hoveredWall && isMyTurn && (
          <Wall
            orientation={hoveredWall.orientation}
            style={{ ...getWallStyle(hoveredWall), backgroundColor: 'rgba(141, 110, 99, 0.7)' }}
          />
        )}
      </BoardContainer>
    </BoardWrapper>
  );
};

export default Board;