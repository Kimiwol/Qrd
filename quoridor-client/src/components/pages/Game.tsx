import React, { useEffect, useState, useCallback } from 'react';
import {
  GameContainer,
  Header,
  Title,
  HeaderQuitButton,
  GameArea,
  InfoContainer,
  BoardArea,
  InfoSidebar,
  PlayerCard,
  PlayerAvatar,
  PlayerDetails,
  PlayerHeader,
  PlayerName,
  WallInfo,
  WallIconContainer,
  WallIcon,
  WallCount,
  BoardWrapper,
  Dialog,
  DialogTitle,
  DialogMessage,
  DialogButtons,
  DialogButton,
  Notification,
  GameOverlay,
  PlayerTimer
} from './Game.styles';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import Board from '../Board';
import { GameState, Position, PlayerInfo, GameStartData, Wall, Player } from '../../types';
import { useSocket } from '../../contexts/SocketContext';


function Game() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();

  const initialState = location.state as GameStartData | null;

  const [gameState, setGameState] = useState<GameState | null>(initialState?.gameState ?? null);
  const [playerId, setPlayerId] = useState<string | null>(initialState?.playerId ?? null);
  const [playerInfo, setPlayerInfo] = useState<{ me: PlayerInfo; opponent: PlayerInfo } | null>(initialState?.playerInfo ?? null);

  // gameState, playerInfo 값 콘솔 출력 (디버깅용)
  useEffect(() => {
    console.log('gameState', gameState);
    console.log('playerInfo', playerInfo);
  }, [gameState, playerInfo]);
  
  const [isReady, setIsReady] = useState(false); // 렌더링 준비 상태 추가

  const [winner, setWinner] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseMessage, setPauseMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [showTimeoutNotification, setShowTimeoutNotification] = useState(false);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  // 최근 수(lastMove)는 서버에서 전달, 최단 경로(shortestPaths)는 클라이언트에서 계산
  const [lastMove, setLastMove] = useState<{player: string, from: Position, to: Position} | null>(null);
  const [shortestPaths, setShortestPaths] = useState<{[playerId: string]: number}>({});

  // Redirect to menu if the game page is loaded without necessary state
  useEffect(() => {
    console.log('🔍 Game.tsx 초기화 체크:', {
      hasInitialState: !!initialState,
      playerId: initialState?.playerId,
      roomId: initialState?.roomId,
      hasGameState: !!initialState?.gameState,
      hasPlayerInfo: !!initialState?.playerInfo,
      urlRoomId: roomId
    });
    
    if (!initialState || !initialState.playerId || !initialState.roomId) {
      console.error("Game.tsx: 필수 게임 데이터가 없습니다. 메뉴로 이동합니다.");
      navigate('/menu', { replace: true });
      return;
    }
    
    // 게임 데이터가 있으면 준비 완료
    setIsReady(true);
    console.log('✅ Game.tsx 초기화 완료');
  }, [initialState, navigate, roomId]);


  const resetTimer = useCallback(() => {
    setTimeLeft(60);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (!isPaused && gameState?.currentTurn && !winner) {
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
  }, [isPaused, gameState?.currentTurn, winner, socket, playerId]);

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

      // This event might be redundant if state is passed correctly via navigation
      socket.on('playerAssigned', (assignedPlayerId: string | null) => {
        if (!playerId) setPlayerId(assignedPlayerId);
      });

      // This listener is crucial for the *other* player who didn't initiate the navigation
      // But since both players are navigated from MainMenu, this might just be for safety.
      socket.on('gameStarted', (data: GameStartData) => {
        console.log('🎮 게임 시작 데이터 상세 (from socket event):', data);
        // Only update if the state is not already set or for a different room
        if (!playerId || !playerInfo) {
            setPlayerId(data.playerId);
            setGameState(data.gameState);
            setPlayerInfo(data.playerInfo);
            console.log('플레이어 정보 설정 완료 (from socket event):', {
              설정된PlayerId: data.playerId,
              설정된PlayerInfo: data.playerInfo
            });
            resetTimer();
        }
      });

      socket.on('gameStateUpdate', (newGameState: GameState) => {
        console.log('🔄 게임 상태 업데이트:', {
          currentTurn: newGameState.currentTurn,
          myPlayerId: playerId,
          isMyTurn: newGameState.currentTurn === playerId
        });
        setGameState(newGameState);
        resetTimer();
      });

      socket.on('gameState', (newGameState: GameState) => {
        console.log('🔄 게임 상태 (gameState 이벤트):', newGameState);
        setGameState(newGameState);
        resetTimer();
      });
      
      // 초기 게임 상태가 없는 경우 서버에 요청
      if (roomId && (!gameState || !playerId)) {
        console.log('🔄 초기 게임 상태 요청:', roomId);
        socket.emit('requestInitialGameState', { roomId });
      }

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
    if (socket && gameState?.currentTurn === playerId && !winner && !isPaused) {
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
        isMyTurn: gameState?.currentTurn === playerId,
        isWinner: !!winner,
        isPaused: isPaused,
      });
    }
  };

  const handleWallPlacement = (wall: Wall) => {
    if (socket && gameState?.currentTurn === playerId && !winner && !isPaused) {
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
  const getGameState = (): (GameState & { players: Player[] }) | null => {
    if (!gameState) return null;

    // 타입 오류 우회: 실제 데이터 구조에 맞게 player1, player2를 as any로 접근
    const gs: any = gameState;
    // 기본 시작 위치 (player1: 아래, player2: 위)
    const defaultPositions = {
      player1: { x: 4, y: 8 },
      player2: { x: 4, y: 0 }
    };
    const players: Player[] = [
      {
        id: 'player1',
        ...gs.player1,
        position: gs.player1?.position ?? defaultPositions.player1
      },
      {
        id: 'player2',
        ...gs.player2,
        position: gs.player2?.position ?? defaultPositions.player2
      }
    ];
    const safeWalls = gs.walls ?? [];

    if (playerId === 'player2') {
      const transformedPlayers = players.map(player => ({
        ...player,
        position: {
          x: 8 - player.position.x,
          y: 8 - player.position.y
        }
      }));
      const transformedWalls = safeWalls.map((wall: any) => ({
        ...wall,
        position: {
          x: wall.orientation === 'horizontal' ? 7 - wall.position.x : 8 - wall.position.x,
          y: wall.orientation === 'horizontal' ? 8 - wall.position.y : 7 - wall.position.y
        }
      }));
      return { ...gs, players: transformedPlayers, walls: transformedWalls };
    }
    return { ...gs, players, walls: safeWalls };
  };

  const renderPlayerCard = (player: Player, position: 'top' | 'bottom') => {
    if (!gameState) return null;
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
              {isCurrentTurn && gameState ? `⏱️ ${timeLeft}초` : '대기 중'}
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

  // useEffect: 항상 호출되도록 최상단에 위치
  useEffect(() => {
    if (!isReady || !gameState || !playerId) return;
    if (gameState && (gameState as any).lastMove) {
      setLastMove((gameState as any).lastMove);
    }
    // 최단 경로 계산 (플레이어1: y==0, 플레이어2: y==8 도달 목표)
    if (gameState && gameState.players && gameState.walls) {
      const paths: {[playerId: string]: number} = {};
      for (const p of gameState.players) {
        const goalRows = p.id === 'player1' ? [0] : [8];
        paths[p.id] = bfsShortestPath(p.position, goalRows, gameState.walls);
      }
      setShortestPaths(paths);
    }
  }, [isReady, gameState, playerId]);

  // 로딩 상태 처리
  if (!isReady) {
    return (
      <GameOverlay>
        <div className="loading-spinner" style={{marginBottom: '20px'}}></div>
        게임에 접속하는 중입니다...
      </GameOverlay>
    );
  }

  // 게임 데이터가 준비되지 않았으면 로딩 화면 표시
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

  // 플레이어 정보는 원본 게임 상태에서 가져오고, 화면 표시용 상태는 따로 변환
  const transformedGameState = getGameState();
  if (!transformedGameState) {
    console.error("Render crash: transformedGameState is null even when ready.");
    // 일정 시간 후 자동으로 메뉴로 이동
    useEffect(() => {
      const timer = setTimeout(() => {
        navigate('/menu', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }, []);

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
  // 소켓 에러 알림 처리
  useEffect(() => {
    const handleSocketError = (e: any) => {
      alert('서버 연결 오류: ' + (e.detail || '알 수 없는 오류')); // 추후 Notification 컴포넌트로 대체 가능
    };
    window.addEventListener('socketError', handleSocketError);
    return () => {
      window.removeEventListener('socketError', handleSocketError);
    };
  }, []);
  // ...existing code...
  function bfsShortestPath(start: Position, goalRows: number[], walls: any[]): number {
    const BOARD_SIZE = 9;
    const queue: {pos: Position, dist: number}[] = [{pos: start, dist: 0}];
    const visited = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(false));
    visited[start.x][start.y] = true;
    const directions = [
      {dx: 0, dy: -1}, // up
      {dx: 0, dy: 1},  // down
      {dx: -1, dy: 0}, // left
      {dx: 1, dy: 0},  // right
    ];
    // 벽 정보 파싱 (간단화, 실제 로직에 맞게 보완 필요)
    const isBlocked = (x1: number, y1: number, x2: number, y2: number) => {
      for (const wall of walls) {
        if (wall.orientation === 'horizontal') {
          // 가로벽: (x, y)~(x+1, y) 사이 이동 차단
          if ((y1 === wall.position.y && y2 === wall.position.y + 1) || (y2 === wall.position.y && y1 === wall.position.y + 1)) {
            if ((x1 === wall.position.x && x2 === wall.position.x + 1) || (x2 === wall.position.x && x1 === wall.position.x + 1)) {
              return true;
            }
          }
        } else {
          // 세로벽: (x, y)~(x, y+1) 사이 이동 차단
          if ((x1 === wall.position.x && x2 === wall.position.x + 1) || (x2 === wall.position.x && x1 === wall.position.x + 1)) {
            if ((y1 === wall.position.y && y2 === wall.position.y + 1) || (y2 === wall.position.y && y1 === wall.position.y + 1)) {
              return true;
            }
          }
        }
      }
      return false;
    };
    while (queue.length > 0) {
      const {pos, dist} = queue.shift()!;
      if (goalRows.includes(pos.y)) return dist;
      for (const {dx, dy} of directions) {
        const nx = pos.x + dx, ny = pos.y + dy;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
        if (visited[nx][ny]) continue;
        if (isBlocked(pos.x, pos.y, nx, ny)) continue;
        visited[nx][ny] = true;
        queue.push({pos: {x: nx, y: ny}, dist: dist + 1});
      }
    }
    return -1; // 도달 불가
  }


  // ...중복된 useEffect 제거...

  return (
    <GameContainer>
      <Header>
        <Title>Quoridor</Title>
        <HeaderQuitButton onClick={showQuitConfirmDialog}>
          기권하기
        </HeaderQuitButton>
      </Header>
      <GameArea>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
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
              isMyTurn={gameState!.currentTurn === playerId}
            />
          </BoardArea>
          {myPlayer && (
            <InfoContainer>
              {renderPlayerCard(myPlayer, 'bottom')}
            </InfoContainer>
          )}
        </div>
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