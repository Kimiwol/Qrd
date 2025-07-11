import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import Board from './Board';
import { GameState, Position, PlayerInfo, GameStartData, Wall, Player } from '../types';
import { useSocket } from '../contexts/SocketContext';

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
  position: relative;
  
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
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  
  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const HeaderQuitButton = styled.button`
  background: rgba(244, 67, 54, 0.9);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;

  &:hover {
    background: rgba(244, 67, 54, 1);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 12px;
  }
`;

const GameArea = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 15px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 10px;
    gap: 10px;
  }
`;

const InfoContainer = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 600px;
`;

const BoardArea = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 80vh; /* 최대 높이를 기준으로 너비 제한 */
  max-height: 80vh;
  aspect-ratio: 1 / 1; /* 정사각형 비율 유지 */
  min-height: 0;
`;

const PlayerCard = styled.div<{ 
  isCurrentTurn: boolean; 
  isPlayer1: boolean; 
  position: 'top' | 'bottom' 
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
  width: 100%;
  max-width: 600px;
  
  @media (max-width: 768px) {
    padding: 10px 12px;
    border-radius: 12px;
  }
`;

const PlayerAvatar = styled.div<{ isPlayer1: boolean }>`
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
  margin-right: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  
  @media (max-width: 768px) {
    width: 35px;
    height: 35px;
    font-size: 18px;
    margin-right: 10px;
  }
`;

const PlayerDetails = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const PlayerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PlayerName = styled.div`
  font-size: 16px;
  font-weight: 600;
  
  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const WallInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const WallIconContainer = styled.div`
  display: flex;
  gap: 2px;
`;

const WallIcon = styled.div<{ isActive: boolean }>`
  width: 10px;
  height: 3px;
  background: ${props => props.isActive ? '#8b4513' : 'rgba(139, 69, 19, 0.3)'};
  border-radius: 1px;
  transition: background 0.2s ease;
`;

const WallCount = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

const BoardWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
`;

const Dialog = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 30px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  z-index: 1004;
  text-align: center;
  min-width: 300px;
`;

const DialogTitle = styled.h3`
  margin: 0 0 15px 0;
  color: #333;
  font-size: 20px;
`;

const DialogMessage = styled.div`
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 20px;
  color: #333;
  line-height: 1.5;
`;

const DialogButtons = styled.div`
  display: flex;
  justify-content: center;
  gap: 15px;
`;

const DialogButton = styled.button<{ variant?: 'confirm' | 'cancel' }>`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
  
  ${props => props.variant === 'confirm' ? `
    background: #4CAF50;
    color: white;
    
    &:hover {
      background: #45a049;
    }
  ` : `
    background: #f44336;
    color: white;
    
    &:hover {
      background: #da190b;
    }
  `}
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

const PlayerTimer = styled.div<{ isTimeRunningOut: boolean; isActive: boolean }>`
  color: ${props => props.isTimeRunningOut ? '#ff6b6b' : '#666'};
  font-size: 14px;
  font-weight: 600;
  padding: 4px 8px;
  background: ${props => props.isActive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(0, 0, 0, 0.1)'};
  border-radius: 12px;
  border: 2px solid ${props => props.isActive ? '#4CAF50' : 'transparent'};
  animation: ${props => props.isTimeRunningOut && props.isActive ? 'pulse 1s infinite' : 'none'};
  opacity: ${props => props.isActive ? 1 : 0.5};
  transition: all 0.3s ease;
  min-width: 45px;
  text-align: center;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  
  @media (max-width: 768px) {
    font-size: 11px;
    padding: 2px 5px;
    min-width: 35px;
  }
`;

function Game() {
  const { socket } = useSocket();
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
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [playerInfo, setPlayerInfo] = useState<{
    me: PlayerInfo;
    opponent: PlayerInfo;
  } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 라우터 state에서 초기 데이터 가져오기
  useEffect(() => {
    const state = location.state as any;
    if (state) {
      if (state.playerId) {
        setPlayerId(state.playerId);
      }
      
      if (state.gameState) {
        setGameState(state.gameState);
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

    // 전역 소켓이 있는 경우에만 이벤트 리스너 설정
    if (socket) {
      console.log('🎮 Game.tsx에서 소켓 이벤트 리스너 설정');

      socket.on('connect_error', (error: Error) => {
        if (error.message === '인증이 필요합니다.') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        }
      });

      socket.on('playerAssigned', (assignedPlayerId: string | null) => {
        setPlayerId(assignedPlayerId);
      });

      socket.on('gameStarted', (data: GameStartData) => {
        console.log('🎮 게임 시작 데이터 상세:', {
          전체데이터: data,
          playerId: data.playerId,
          playerInfo: data.playerInfo,
          me정보: data.playerInfo?.me,
          opponent정보: data.playerInfo?.opponent,
          gameState: data.gameState
        });
        console.log('🎯 초기 턴 정보:', {
          currentTurn: data.gameState.currentTurn,
          myPlayerId: data.playerId,
          isMyTurn: data.gameState.currentTurn === data.playerId
        });
        setPlayerId(data.playerId);
        setGameState(data.gameState);
        setPlayerInfo(data.playerInfo);
        console.log('플레이어 정보 설정 완료:', {
          설정된PlayerId: data.playerId,
          설정된PlayerInfo: data.playerInfo
        });
        resetTimer();
      });

      socket.on('gameState', (newGameState: GameState) => {
        console.log('🔄 게임 상태 업데이트:', {
          currentTurn: newGameState.currentTurn,
          myPlayerId: playerId,
          isMyTurn: newGameState.currentTurn === playerId
        });
        setGameState(newGameState);
        resetTimer();
      });

      socket.on('turnTimedOut', (message: string) => {
        console.log('🕐 턴 타임아웃:', message);
        setShowTimeoutNotification(true);
        setTimeout(() => setShowTimeoutNotification(false), 3000);
        resetTimer();
      });

      socket.on('gameOver', (winnerId: string) => {
        console.log('🏁 게임 종료:', winnerId);
        setWinner(winnerId);
      });

      socket.on('gamePaused', (message: string) => {
        setIsPaused(true);
        setPauseMessage(message);
      });

      socket.on('gameResumed', () => {
        setIsPaused(false);
        setPauseMessage('');
        resetTimer();
      });

      socket.on('playerDisconnected', (message: string) => {
        console.log('🚪 플레이어 연결 해제:', message);
        setIsPaused(true);
        setPauseMessage(message);
      });

      return () => {
        // 이벤트 리스너 정리
        socket.off('connect_error');
        socket.off('playerAssigned');
        socket.off('gameStarted');
        socket.off('gameState');
        socket.off('turnTimedOut');
        socket.off('gameOver');
        socket.off('gamePaused');
        socket.off('gameResumed');
        socket.off('playerDisconnected');
      };
    }
  }, [socket, navigate, resetTimer, playerId]);

  const handleCellClick = (position: Position) => {
    console.log(`[Game.tsx] handleCellClick received from Board:`, position);
    if (socket && gameState.currentTurn === playerId && !winner && !isPaused) {
      let serverPosition = position;
      // Player2인 경우, 서버의 절대 좌표계(player1 기준)로 변환
      if (playerId === 'player2') {
        serverPosition = {
          x: 8 - position.x,
          y: 8 - position.y,
        };
        console.log(`[Game.tsx] P2 좌표 변환 (Move):`, { from: position, to: serverPosition });
      }
      
      console.log(`[Game.tsx] 'move' 이벤트 전송:`, serverPosition);
      socket.emit('move', serverPosition);

    } else {
      console.warn(`[Game.tsx] Move ignored. Conditions not met:`, {
        socketExists: !!socket,
        isMyTurn: gameState.currentTurn === playerId,
        isWinner: !!winner,
        isPaused: isPaused,
      });
    }
  };

  const handleWallPlacement = (wall: Wall) => {
    if (socket && gameState.currentTurn === playerId && !winner && !isPaused) {
      let serverWall = wall;
      // Player2인 경우, 서버의 절대 좌표계(player1 기준)로 변환
      if (playerId === 'player2') {
        serverWall = {
          ...wall,
          position: {
            x: wall.orientation === 'horizontal' ? 7 - wall.position.x : 8 - wall.position.x,
            y: wall.orientation === 'horizontal' ? 8 - wall.position.y : 7 - wall.position.y,
          },
        };
        console.log(`[Game.tsx] P2 좌표 변환 (Wall):`, { from: wall, to: serverWall });
      }
      
      console.log(`[Game.tsx] 'placeWall' 이벤트 전송:`, serverWall);
      socket.emit('placeWall', serverWall);
    }
  };

  const handleQuit = () => {
    setShowQuitDialog(true);
  };

  const handleQuitConfirm = () => {
    if (socket) {
      socket.emit('forfeit'); // 서버에 기권 신호 전송
    }
    navigate('/menu');
  };

  const handleQuitCancel = () => {
    setShowQuitDialog(false);
  };

  const showQuitConfirmDialog = () => {
    setShowQuitDialog(true);
  };

  // 게임 상태를 플레이어 관점으로 변환 (각자 하단에서 시작하도록)
  const getGameState = (): GameState => {
    if (playerId === 'player2') {
      // Player2인 경우 보드를 180도 회전하여 표시
      const transformedState = {
        ...gameState,
        players: gameState.players.map(player => ({
          ...player,
          position: {
            x: 8 - player.position.x,
            y: 8 - player.position.y
          }
        })),
        walls: gameState.walls.map(wall => ({
          ...wall,
          position: {
            x: wall.orientation === 'horizontal' ? 7 - wall.position.x : 8 - wall.position.x,
            y: wall.orientation === 'horizontal' ? 8 - wall.position.y : 7 - wall.position.y
          }
        }))
      };
      return transformedState;
    }
    return gameState;
  };

  const renderPlayerCard = (player: Player, position: 'top' | 'bottom') => {
    // 원본 gameState의 currentTurn과 비교해야 함 (변환된 상태가 아닌 원본 상태 사용)
    const isCurrentTurn = gameState.currentTurn === player.id;
    const isPlayer1 = player.id === 'player1';
    const isMe = player.id === playerId;
    
    const wallIcons = Array.from({ length: 10 }, (_, i) => (
      <WallIcon key={i} isActive={i < player.wallsLeft} />
    ));

    // 플레이어 이름 결정 로직 개선
    let playerName = '알 수 없음';
    
    if (isMe) {
      // 내 정보인 경우
      if (playerInfo?.me?.username) {
        playerName = playerInfo.me.username;
      } else {
        // localStorage에서 사용자 정보 가져오기
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
      // 상대방 정보인 경우
      if (playerInfo?.opponent?.username) {
        playerName = playerInfo.opponent.username;
      } else {
        playerName = `상대 (${player.id})`;
      }
    }

    return (
      <PlayerCard 
        key={player.id}
        isCurrentTurn={isCurrentTurn} 
        isPlayer1={isPlayer1}
        position={position}
      >
        <PlayerAvatar isPlayer1={isPlayer1}>
          {isPlayer1 ? '🔴' : '🔵'}
        </PlayerAvatar>
        <PlayerDetails>
          <PlayerHeader>
            <PlayerName>
              {playerName}
            </PlayerName>
            <PlayerTimer 
              isTimeRunningOut={timeLeft <= 10} 
              isActive={isCurrentTurn}
            >
              {isCurrentTurn ? `⏱️ ${timeLeft}초` : '대기 중'}
            </PlayerTimer>
          </PlayerHeader>
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

  // 플레이어 정보는 원본 게임 상태에서 가져오고, 화면 표시용 상태는 따로 변환
  const transformedGameState = getGameState();
  const myPlayer = transformedGameState.players.find((p: Player) => p.id === playerId);
  const opponentPlayer = transformedGameState.players.find((p: Player) => p.id !== playerId);

  return (
    <GameContainer>
      <Header>
        <Title>Quoridor</Title>
        <HeaderQuitButton onClick={showQuitConfirmDialog}>
          기권하기
        </HeaderQuitButton>
      </Header>
      
      <GameArea>
        {opponentPlayer && (
          <InfoContainer>
            {renderPlayerCard(opponentPlayer, 'top')}
          </InfoContainer>
        )}
        <BoardArea>
          <Board 
            gameState={transformedGameState} 
            onCellClick={handleCellClick}
            onWallPlace={handleWallPlacement}
            playerId={playerId}
            isMyTurn={gameState.currentTurn === playerId}
          />
        </BoardArea>
        {myPlayer && (
          <InfoContainer>
            {renderPlayerCard(myPlayer, 'bottom')}
          </InfoContainer>
        )}
      </GameArea>

      {winner && (
        <Dialog>
          <DialogTitle>게임 종료</DialogTitle>
          <DialogMessage>
            {winner === playerId ? '축하합니다! 당신이 이겼습니다!' : '아쉽게도 당신이 졌습니다.'}
          </DialogMessage>
          <DialogButtons>
            <DialogButton variant="confirm" onClick={() => navigate('/menu')}>
              확인
            </DialogButton>
          </DialogButtons>
        </Dialog>
      )}

      {showQuitDialog && (
        <Dialog>
          <DialogTitle>게임을 나가시겠습니까?</DialogTitle>
          <DialogMessage>
            게임을 나가면 패배로 처리됩니다.<br />
            정말로 나가시겠습니까?
          </DialogMessage>
          <DialogButtons>
            <DialogButton variant="cancel" onClick={handleQuitCancel}>
              취소
            </DialogButton>
            <DialogButton variant="confirm" onClick={handleQuitConfirm}>
              나가기
            </DialogButton>
          </DialogButtons>
        </Dialog>
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