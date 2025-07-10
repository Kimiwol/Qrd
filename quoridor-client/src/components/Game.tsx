import React, { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import Board from './Board';
import { GameState, Position } from '../types';

const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 10px;
  box-sizing: border-box;
  
  @media (max-width: 768px) {
    padding: 5px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  margin-bottom: 15px;
  
  @media (max-width: 768px) {
    padding: 8px 12px;
    margin-bottom: 10px;
  }
`;

const Title = styled.h1`
  color: white;
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  
  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const Timer = styled.div<{ isTimeRunningOut: boolean }>`
  color: ${props => props.isTimeRunningOut ? '#ff6b6b' : '#ffffff'};
  font-size: 20px;
  font-weight: 600;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  animation: ${props => props.isTimeRunningOut ? 'pulse 1s infinite' : 'none'};

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  
  @media (max-width: 768px) {
    font-size: 16px;
    padding: 6px 12px;
  }
`;

const GameArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
  
  @media (max-width: 768px) {
    height: calc(100vh - 120px);
    justify-content: space-between;
  }
`;

const PlayerCard = styled.div<{ 
  isCurrentTurn: boolean; 
  isPlayer1: boolean; 
  position: 'top' | 'bottom' | 'side' 
}>`
  display: flex;
  align-items: center;
  background: ${props => props.isCurrentTurn 
    ? 'linear-gradient(135deg, #4CAF50, #45a049)' 
    : 'rgba(255, 255, 255, 0.9)'};
  color: ${props => props.isCurrentTurn ? 'white' : '#333'};
  padding: 15px 20px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: ${props => props.isCurrentTurn ? '3px solid #4CAF50' : '2px solid rgba(255, 255, 255, 0.3)'};
  transition: all 0.3s ease;
  min-width: 280px;
  
  ${props => props.position === 'top' && `
    order: 1;
    margin-bottom: 15px;
  `}
  
  ${props => props.position === 'bottom' && `
    order: 3;
    margin-top: 15px;
  `}
  
  @media (max-width: 768px) {
    margin: ${props => props.position === 'top' ? '0 0 10px 0' : '10px 0 0 0'};
    padding: 12px 16px;
    min-width: calc(100vw - 40px);
    justify-content: space-between;
  }
  
  @media (min-width: 769px) {
    ${props => props.position === 'side' && `
      position: absolute;
      ${props.isPlayer1 ? 'left: 20px;' : 'right: 20px;'}
      top: 50%;
      transform: translateY(-50%);
      flex-direction: column;
      text-align: center;
      min-width: 200px;
    `}
  }
`;

const PlayerAvatar = styled.div<{ isPlayer1: boolean; position: string }>`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: ${props => props.isPlayer1 
    ? 'linear-gradient(135deg, #ff6b6b, #ee5a52)' 
    : 'linear-gradient(135deg, #4dabf7, #339af0)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  color: white;
  margin-right: ${props => props.position === 'side' ? '0' : '15px'};
  margin-bottom: ${props => props.position === 'side' ? '10px' : '0'};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  
  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
    font-size: 20px;
    margin-right: 12px;
    margin-bottom: 0;
  }
`;

const PlayerDetails = styled.div`
  flex: 1;
`;

const PlayerName = styled.div`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 5px;
  
  @media (max-width: 768px) {
    font-size: 16px;
  }
`;

const WallInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
`;

const WallIconContainer = styled.div`
  display: flex;
  gap: 2px;
`;

const WallIcon = styled.div<{ isActive: boolean }>`
  width: 12px;
  height: 4px;
  background: ${props => props.isActive ? '#8b4513' : 'rgba(139, 69, 19, 0.3)'};
  border-radius: 1px;
  transition: background 0.2s ease;
`;

const WallCount = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

const BoardWrapper = styled.div`
  order: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  
  @media (min-width: 769px) {
    margin: 0 240px;
  }
`;

const GameControls = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 1000;
`;

const ControlButton = styled.button`
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.logout {
    background: #ff6b6b;
    color: white;
    
    &:hover {
      background: #ff5252;
      transform: translateY(-2px);
    }
  }
`;

const Notification = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #ff6b6b;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  animation: slideDown 0.3s ease-out;
  z-index: 1001;

  @keyframes slideDown {
    from {
      top: -50px;
      opacity: 0;
    }
    to {
      top: 20px;
      opacity: 1;
    }
  }
`;

const GameOverlay = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 40px 60px;
  border-radius: 20px;
  font-size: 28px;
  font-weight: 600;
  text-align: center;
  z-index: 1002;
  backdrop-filter: blur(10px);
  
  @media (max-width: 768px) {
    padding: 30px 40px;
    font-size: 24px;
  }
`;

const ContinueDialog = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 30px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  z-index: 1003;
  text-align: center;
`;

const DialogButtons = styled.div`
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-top: 20px;
`;

const DialogButton = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.continue {
    background: #4CAF50;
    color: white;
    
    &:hover {
      background: #45a049;
    }
  }
  
  &.quit {
    background: #f44336;
    color: white;
    
    &:hover {
      background: #da190b;
    }
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
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 라우터 state에서 초기 데이터 가져오기
  useEffect(() => {
    const state = location.state as any;
    if (state) {
      console.log('Game 컴포넌트에서 받은 초기 데이터:', state);
      
      if (state.playerId) {
        setPlayerId(state.playerId);
        console.log('플레이어 ID 설정:', state.playerId);
      }
      
      if (state.gameState) {
        setGameState(state.gameState);
        console.log('초기 게임 상태 설정:', state.gameState);
      }
    }
  }, [location.state]);

  const resetTimer = useCallback(() => {
    setTimeLeft(60);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (!isPaused && gameState.currentTurn && !winner) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (socket && gameState.currentTurn === playerId) {
              console.log('⏰ 턴 타임아웃 - 서버에 알림');
              socket.emit('turnTimeout');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPaused, gameState.currentTurn, winner, socket, playerId]);

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

    return () => {
      newSocket.disconnect();
    };
  }, [navigate, resetTimer]);

  const handleCellClick = (position: Position) => {
    if (socket && gameState.currentTurn === playerId && !winner && !isPaused) {
      socket.emit('move', position);
    }
  };

  const handleWallPlace = (position: Position, isHorizontal: boolean) => {
    if (socket && gameState.currentTurn === playerId && !winner && !isPaused) {
      socket.emit('placeWall', { position, isHorizontal });
    }
  };

  const handleRestart = () => {
    if (socket) {
      socket.emit('restartGame');
      setWinner(null);
      setShowContinueDialog(false);
    }
  };

  const handleQuit = () => {
    navigate('/menu');
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const renderPlayerCard = (player: any, position: 'top' | 'bottom' | 'side') => {
    const isCurrentTurn = gameState.currentTurn === player.id;
    const isPlayer1 = player.id === 'player1';
    const isMe = player.id === playerId;
    
    const wallIcons = Array.from({ length: 10 }, (_, i) => (
      <WallIcon key={i} isActive={i < player.wallsLeft} />
    ));

    return (
      <PlayerCard 
        key={player.id}
        isCurrentTurn={isCurrentTurn} 
        isPlayer1={isPlayer1}
        position={position}
      >
        <PlayerAvatar isPlayer1={isPlayer1} position={position}>
          {isPlayer1 ? '🔴' : '🔵'}
        </PlayerAvatar>
        <PlayerDetails>
          <PlayerName>
            {isMe ? '나' : '상대방'} {isCurrentTurn && '(턴)'}
          </PlayerName>
          <WallInfo>
            <WallIconContainer>
              {wallIcons}
            </WallIconContainer>
            <WallCount>{player.wallsLeft}</WallCount>
          </WallInfo>
        </PlayerDetails>
      </PlayerCard>
    );
  };

  const isMobile = window.innerWidth <= 768;
  const myPlayer = gameState.players.find(p => p.id === playerId);
  const opponentPlayer = gameState.players.find(p => p.id !== playerId);

  return (
    <GameContainer>
      <Header>
        <Title>🏛️ Quoridor</Title>
        <Timer isTimeRunningOut={timeLeft <= 10}>
          ⏱️ {timeLeft}초
        </Timer>
      </Header>

      <GameControls>
        <ControlButton className="logout" onClick={logout}>
          로그아웃
        </ControlButton>
      </GameControls>

      {showTimeoutNotification && (
        <Notification>
          ⏰ 시간 초과로 턴이 넘어갔습니다!
        </Notification>
      )}

      <GameArea>
        {opponentPlayer && renderPlayerCard(
          opponentPlayer, 
          isMobile ? 'top' : 'side'
        )}

        <BoardWrapper>
          <Board
            gameState={gameState}
            onCellClick={handleCellClick}
            onWallPlace={handleWallPlace}
          />
        </BoardWrapper>

        {myPlayer && renderPlayerCard(
          myPlayer, 
          isMobile ? 'bottom' : 'side'
        )}
      </GameArea>

      {winner && (
        <GameOverlay>
          🎉 {winner === playerId ? '승리!' : '패배...'} 🎉
          <br />
          <div style={{ fontSize: '18px', marginTop: '20px' }}>
            <button 
              onClick={() => setShowContinueDialog(true)}
              style={{
                padding: '10px 20px',
                margin: '0 10px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              다시 하기
            </button>
            <button 
              onClick={handleQuit}
              style={{
                padding: '10px 20px',
                margin: '0 10px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              나가기
            </button>
          </div>
        </GameOverlay>
      )}

      {showContinueDialog && (
        <ContinueDialog>
          <h3>게임을 다시 시작하시겠습니까?</h3>
          <DialogButtons>
            <DialogButton className="continue" onClick={handleRestart}>
              계속하기
            </DialogButton>
            <DialogButton className="quit" onClick={handleQuit}>
              나가기
            </DialogButton>
          </DialogButtons>
        </ContinueDialog>
      )}

      {isPaused && (
        <GameOverlay>
          ⏸️ 게임이 일시정지되었습니다
          <br />
          <div style={{ fontSize: '18px', marginTop: '10px' }}>
            {pauseMessage}
          </div>
        </GameOverlay>
      )}
    </GameContainer>
  );
}

export default Game;