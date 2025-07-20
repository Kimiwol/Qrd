import React from 'react';
import { Player, PlayerInfo } from '../../types';
import { PlayerCard, PlayerAvatar, PlayerDetails, PlayerHeader, PlayerName, PlayerTimer, WallInfo, WallIconContainer, WallIcon, WallCount } from './Game.styles';

interface PlayerCardProps {
  player: Player;
  position: 'top' | 'bottom';
  playerId: string | null;
  playerInfo: { me: PlayerInfo; opponent: PlayerInfo } | null;
  timeLeft: number;
  gameState: any;
}

export default function PlayerCardComponent({ player, position, playerId, playerInfo, timeLeft, gameState }: PlayerCardProps) {
  const isCurrentTurn = gameState.currentTurn === player.id;
  const isPlayer1 = player.id === 'player1';
  const isMe = player.id === playerId;

  const wallIcons = Array.from({ length: 10 }, (_, i) => (
    <WallIcon key={i} isActive={i < player.wallsLeft} />
  ));

  let playerName = '알 수 없음';
  if (isMe) {
    if (playerInfo?.me?.username) {
      playerName = playerInfo.me.username;
    } else {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          playerName = user.username || `나 (${player.id})`;
        } else {
          playerName = `나 (${player.id})`;
        }
      } catch (error) {
        playerName = `나 (${player.id})`;
      }
    }
  } else {
    if (playerInfo?.opponent?.username) {
      playerName = playerInfo.opponent.username;
    } else {
      playerName = `상대 (${player.id})`;
    }
  }

  return (
    <PlayerCard key={player.id} isCurrentTurn={isCurrentTurn} isPlayer1={isPlayer1} position={position}>
      <PlayerAvatar isPlayer1={isPlayer1}>{isPlayer1 ? '🔴' : '🔵'}</PlayerAvatar>
      <PlayerDetails>
        <PlayerHeader>
          <PlayerName>{playerName}</PlayerName>
          <PlayerTimer isTimeRunningOut={timeLeft <= 10} isActive={isCurrentTurn}>
            {isCurrentTurn && gameState ? `⏱️ ${timeLeft}초` : '대기 중'}
          </PlayerTimer>
        </PlayerHeader>
        <WallInfo>
          <WallIconContainer>{wallIcons}</WallIconContainer>
          <WallCount>{player.wallsLeft}</WallCount>
        </WallInfo>
      </PlayerDetails>
    </PlayerCard>
  );
}
