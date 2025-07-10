import React, { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Board from './Board';
import { GameState, Position } from '../types';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 20px;
`;

const GameInfo = styled.div`
  margin-bottom: 20px;
  display: flex;
  gap: 20px;
`;

const PlayerInfo = styled.div<{ isCurrentTurn: boolean }>`
  padding: 10px;
  border: 2px solid ${props => props.isCurrentTurn ? '#4CAF50' : '#ddd'};
  border-radius: 5px;
  background-color: ${props => props.isCurrentTurn ? '#e8f5e9' : 'white'};
`;

const GameOver = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px 40px;
  border-radius: 10px;
  font-size: 24px;
  z-index: 1000;
`;

const GameControls = styled.div`
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
`;

const Button = styled.button`
  padding: 10px 20px;
  font-size: 16px;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  background-color: #4CAF50;
  
  &:hover {
    background-color: #45a049;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const Timer = styled.div<{ isTimeRunningOut: boolean }>`
  font-size: 20px;
  margin-bottom: 10px;
  color: ${props => props.isTimeRunningOut ? '#ff4444' : '#333'};
  animation: ${props => props.isTimeRunningOut ? 'blink 1s infinite' : 'none'};

  @keyframes blink {
    50% {
      opacity: 0.5;
    }
  }
`;

const Notification = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #ff4444;
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  animation: slideDown 0.3s ease-out;

  @keyframes slideDown {
    from {
      top: -50px;
    }
    to {
      top: 20px;
    }
  }
`;

const LogoutButton = styled(Button)`
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: #f44336;
  
  &:hover {
    background-color: #d32f2f;
  }
`;

function Game() {
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    walls: [],
    currentTurn: ''
  });
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseMessage, setPauseMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [showTimeoutNotification, setShowTimeoutNotification] = useState(false);
  const navigate = useNavigate();

  const resetTimer = useCallback(() => {
    setTimeLeft(60);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (!isPaused && gameState.currentTurn && !winner) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0) return 0;
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPaused, gameState.currentTurn, winner]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const newSocket = io(process.env.REACT_APP_WS_URL || 'ws://localhost:4000', {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect_error', (error: Error) => {
      if (error.message === '인증이 필요합니다.') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    });

    newSocket.on('playerAssigned', (assignedPlayerId: string | null) => {
      setPlayerId(assignedPlayerId);
    });

    newSocket.on('gameState', (newGameState: GameState) => {
      setGameState(newGameState);
      resetTimer();
    });

    newSocket.on('turnTimedOut', () => {
      setShowTimeoutNotification(true);
      setTimeout(() => setShowTimeoutNotification(false), 3000);
      resetTimer();
    });

    newSocket.on('gameOver', (winnerId: string) => {
      setWinner(winnerId);
    });

    newSocket.on('gamePaused', (message: string) => {
      setIsPaused(true);
      setPauseMessage(message);
    });

    newSocket.on('gameResumed', () => {
      setIsPaused(false);
      setPauseMessage('');
      resetTimer();
    });

    newSocket.on('gameRestarted', () => {
      setWinner(null);
      resetTimer();
    });

    return () => {
      newSocket.close();
    };
  }, [resetTimer, navigate]);

  const handleCellClick = (position: Position) => {
    if (socket && playerId && playerId === gameState.currentTurn && !isPaused) {
      socket.emit('move', position);
    }
  };

  const handleWallPlace = (position: Position, isHorizontal: boolean) => {
    if (socket && playerId && playerId === gameState.currentTurn && !isPaused) {
      socket.emit('placeWall', { position, isHorizontal });
    }
  };

  const handleRestart = () => {
    if (socket && (winner || isPaused)) {
      socket.emit('restartGame');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <Container>
      <LogoutButton onClick={handleLogout}>로그아웃</LogoutButton>
      <Title>Quoridor Game</Title>
      {!isPaused && !winner && gameState.currentTurn && (
        <Timer isTimeRunningOut={timeLeft <= 10}>
          남은 시간: {timeLeft}초
        </Timer>
      )}
      {showTimeoutNotification && (
        <Notification>
          시간 초과! 턴이 넘어갑니다.
        </Notification>
      )}
      {(winner || isPaused) && (
        <GameControls>
          <Button onClick={handleRestart}>
            게임 재시작
          </Button>
        </GameControls>
      )}
      <GameInfo>
        <PlayerInfo isCurrentTurn={gameState.currentTurn === 'player1'}>
          플레이어 1 (빨강){playerId === 'player1' ? ' (나)' : ''}
          <br />
          남은 벽: {gameState.players.find(p => p.id === 'player1')?.wallsLeft || 0}
        </PlayerInfo>
        <PlayerInfo isCurrentTurn={gameState.currentTurn === 'player2'}>
          플레이어 2 (파랑){playerId === 'player2' ? ' (나)' : ''}
          <br />
          남은 벽: {gameState.players.find(p => p.id === 'player2')?.wallsLeft || 0}
        </PlayerInfo>
      </GameInfo>
      <Board 
        gameState={gameState} 
        onCellClick={handleCellClick} 
        onWallPlace={handleWallPlace}
      />
      {winner && (
        <GameOver>
          {winner === playerId ? '승리했습니다!' : '패배했습니다!'}
        </GameOver>
      )}
      {isPaused && (
        <GameOver>
          {pauseMessage}
        </GameOver>
      )}
      {!playerId && (
        <GameOver>
          대기 중... 다른 플레이어의 참가를 기다리고 있습니다.
        </GameOver>
      )}
    </Container>
  );
}

export default Game;