import { useEffect } from 'react';
import { GameStartData, GameState } from '../../../types';
import { useNavigate } from 'react-router-dom';

interface UseGameSocketProps {
  socket: any;
  roomId: string | undefined;
  playerId: string | null;
  setPlayerId: (id: string | null) => void;
  setGameState: (state: GameState | null) => void;
  setPlayerInfo: (info: { me: any; opponent: any } | null) => void;
  resetTimer: () => void;
  setShowTimeoutNotification: (show: boolean) => void;
  setWinner: (winnerId: string) => void;
}

export function useGameSocket({
  socket,
  roomId,
  playerId,
  setPlayerId,
  setGameState,
  setPlayerInfo,
  resetTimer,
  setShowTimeoutNotification,
  setWinner,
}: UseGameSocketProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    socket.on('connect_error', (error: Error) => {
      if (error.message === '인증이 필요합니다.') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    });

    socket.on('playerAssigned', (assignedPlayerId: string | null) => {
      if (!playerId) setPlayerId(assignedPlayerId);
    });

    socket.on('gameStarted', (data: GameStartData) => {
      if (!playerId || !setPlayerInfo) {
        setPlayerId(data.playerId);
        setGameState(data.gameState);
        setPlayerInfo(data.playerInfo);
        resetTimer();
      }
    });

    socket.on('gameStateUpdate', (newGameState: GameState) => {
      setGameState(newGameState);
      resetTimer();
    });

    socket.on('gameState', (newGameState: GameState) => {
      setGameState(newGameState);
      resetTimer();
    });

    if (roomId && (!playerId)) {
      socket.emit('requestInitialGameState', { roomId });
    }

    socket.on('turnTimedOut', (message: string) => {
      setShowTimeoutNotification(true);
      setTimeout(() => setShowTimeoutNotification(false), 3000);
      resetTimer();
    });

    socket.on('gameOver', (winnerId: string) => {
      setWinner(winnerId);
    });

    return () => {
      socket.off('connect_error');
      socket.off('playerAssigned');
      socket.off('gameStarted');
      socket.off('gameState');
      socket.off('turnTimedOut');
      socket.off('gameOver');
    };
  }, [socket, roomId, playerId, setPlayerId, setGameState, setPlayerInfo, resetTimer, setShowTimeoutNotification, setWinner, navigate]);
}
