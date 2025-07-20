import React from 'react';
import { Player } from '../../types';
import { InfoSidebar } from './Game.styles';

interface GameInfoSidebarProps {
  gameState: any;
  playerId: string | null;
  lastMove: any;
  transformedGameState: any;
  shortestPaths: { [playerId: string]: number };
}

export default function GameInfoSidebar({ gameState, playerId, lastMove, transformedGameState, shortestPaths }: GameInfoSidebarProps) {
  return (
    <InfoSidebar>
      <div style={{marginBottom: '1.2rem'}}>
        <strong>현재 라운드/턴</strong><br />
        {gameState?.currentTurn ? (
          <span>{gameState.currentTurn === playerId ? '내 턴' : '상대 턴'}</span>
        ) : '정보 없음'}
      </div>
      <div style={{marginBottom: '1.2rem'}}>
        <strong>상대방 최근 수</strong><br />
        {lastMove && lastMove.player !== playerId ? (
          <span>
            {`(${lastMove.from.x},${lastMove.from.y}) → (${lastMove.to.x},${lastMove.to.y})`}
          </span>
        ) : '정보 없음'}
      </div>
      <div>
        <strong>최단 경로 길이</strong>
        <ul style={{margin: '0.5rem 0 0 0.5rem', padding: 0, listStyle: 'none'}}>
          {transformedGameState.players.map((p: Player) => (
            <li key={p.id}>
              {p.id === playerId ? '나' : '상대'}: {shortestPaths[p.id] ?? '계산 중'}
            </li>
          ))}
        </ul>
      </div>
    </InfoSidebar>
  );
}
