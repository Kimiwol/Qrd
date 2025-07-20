import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import Board from '../Board';
import PlayerCardComponent from './PlayerCard';
import GameDialog from './GameDialog';
import GameInfoSidebar from './GameInfoSidebar';
import { useGameSocket } from './hooks/useGameSocket';
import {
  GameContainer,
  Header,
  Title,
  HeaderQuitButton,
  GameArea,
  InfoContainer,
  BoardArea,
  GameOverlay
} from './Game.styles';
import { GameState, Position, PlayerInfo, GameStartData, Wall, Player } from '../../types';
import { getGameState, bfsShortestPath } from './utils/gameUtils';

function Game() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const initialState = location.state as GameStartData | null;

  // 상태 변수 선언
  const [gameState, setGameState] = useState<GameState | null>(initialState?.gameState ?? null);
  const [playerId, setPlayerId] = useState<string | null>(initialState?.playerId ?? null);
  const [playerInfo, setPlayerInfo] = useState<{ me: PlayerInfo; opponent: PlayerInfo } | null>(initialState?.playerInfo ?? null);
  const [isReady, setIsReady] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [showTimeoutNotification, setShowTimeoutNotification] = useState(false);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [lastMove, setLastMove] = useState<{player: string, from: Position, to: Position} | null>(null);
  const [shortestPaths, setShortestPaths] = useState<{[playerId: string]: number}>({});

  // 핸들러 함수 선언
  const resetTimer = useCallback(() => setTimeLeft(60), []);
  const handleQuitConfirm = () => {
    if (socket) socket.emit('forfeit');
    navigate('/menu');
  };
  const handleQuitCancel = () => setShowQuitDialog(false);
  const showQuitConfirmDialog = () => setShowQuitDialog(true);
  const handleCellClick = useCallback((cell: Position) => {
    if (!gameState || !playerId) return;
    socket?.emit('move', { roomId, playerId, to: cell });
  }, [gameState, playerId, socket, roomId]);
  const handleWallPlacement = useCallback((wall: Wall) => {
    if (!gameState || !playerId) return;
    socket?.emit('placeWall', { roomId, playerId, wall });
  }, [gameState, playerId, socket, roomId]);
  const getTransformedGameState = useCallback(() => getGameState(gameState, playerId), [gameState, playerId]);
  const transformedGameState = getTransformedGameState();

  // 모든 Hook은 상태 변수 선언 직후, 조건문(return ...) 이전에 위치
  useEffect(() => {
    if (!isReady || !gameState || !playerId) return;
    if (gameState && (gameState as any).lastMove) setLastMove((gameState as any).lastMove);
    if (gameState && gameState.players && gameState.walls) {
      const paths: {[playerId: string]: number} = {};
      for (const p of gameState.players) {
        const goalRows = p.id === 'player1' ? [0] : [8];
        paths[p.id] = bfsShortestPath(p.position, goalRows, gameState.walls);
      }
      setShortestPaths(paths);
    }
  }, [isReady, gameState, playerId]);

  useEffect(() => {
    if (!transformedGameState) {
      const timer = setTimeout(() => {
        navigate('/menu', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [transformedGameState, navigate]);

  useEffect(() => {
    const handleSocketError = (e: any) => {
      alert('서버 연결 오류: ' + (e.detail || '알 수 없는 오류'));
    };
    window.addEventListener('socketError', handleSocketError);
    return () => {
      window.removeEventListener('socketError', handleSocketError);
    };
  }, []);

  useGameSocket({
    socket,
    roomId,
    playerId,
    setPlayerId,
    setGameState,
    setPlayerInfo,
    resetTimer,
    setShowTimeoutNotification,
    setWinner,
  });

  // 조건부 렌더링은 Hook 이후에만 실행
  if (!isReady) {
    return (
      <GameOverlay>
        <div className="loading-spinner" style={{marginBottom: '20px'}}></div>
        게임에 접속하는 중입니다...
      </GameOverlay>
    );
  }
  if (!isReady || !gameState || !playerId) {
    return (
      <GameContainer>
        <GameOverlay>
          <div style={{ textAlign: 'center' }}>
            <h2>🎮 게임 로딩 중...</h2>
            <p>게임 데이터를 불러오고 있습니다.</p>
            <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
          </div>
        </GameOverlay>
      </GameContainer>
    );
  }
  if (!transformedGameState) {
    console.error("Render crash: transformedGameState is null even when ready.");
    return (
      <GameContainer>
        <GameOverlay>
          <div style={{ textAlign: 'center', color: 'red', marginTop: '40px' }}>
            <h2>오류가 발생했습니다</h2>
            <p>게임 데이터가 올바르지 않습니다.</p>
            <p>3초 후 메인메뉴로 이동합니다.</p>
            <button onClick={() => navigate('/menu', { replace: true })} style={{ marginTop: '20px' }}>메뉴로 바로 이동</button>
          </div>
        </GameOverlay>
      </GameContainer>
    );
  }
  const myPlayer = transformedGameState.players.find((p: Player) => p.id === playerId);
  const opponentPlayer = transformedGameState.players.find((p: Player) => p.id !== playerId);

  return (
    <GameContainer>
      <Header>
        <Title>Quoridor</Title>
        <HeaderQuitButton onClick={showQuitConfirmDialog}>기권하기</HeaderQuitButton>
      </Header>
      <GameArea>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          {opponentPlayer && (
            <InfoContainer>
              <PlayerCardComponent player={opponentPlayer} position="top" playerId={playerId} playerInfo={playerInfo} timeLeft={timeLeft} gameState={gameState} />
            </InfoContainer>
          )}
          <BoardArea>
            <Board 
              gameState={transformedGameState} 
              onCellClick={handleCellClick}
              onWallPlace={handleWallPlacement}
              playerId={playerId}
              isMyTurn={gameState!.currentTurn === playerId}
            />
          </BoardArea>
          {myPlayer && (
            <InfoContainer>
              <PlayerCardComponent player={myPlayer} position="bottom" playerId={playerId} playerInfo={playerInfo} timeLeft={timeLeft} gameState={gameState} />
            </InfoContainer>
          )}
        </div>
        <GameInfoSidebar gameState={gameState} playerId={playerId} lastMove={lastMove} transformedGameState={transformedGameState} shortestPaths={shortestPaths} />
      </GameArea>
      <GameDialog winner={winner} playerId={playerId} showQuitDialog={showQuitDialog} handleQuitCancel={handleQuitCancel} handleQuitConfirm={handleQuitConfirm} navigate={navigate} />
    </GameContainer>
  );
}

export default Game;