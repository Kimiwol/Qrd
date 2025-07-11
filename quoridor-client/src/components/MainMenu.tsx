import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import './MainMenu.css';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  createdAt: string;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

interface Room {
  _id: string;
  code: string;
  mode: string;
  host: string;
  players: string[];
  status: string;
  maxPlayers: number;
}

const MainMenu: React.FC = () => {
  const navigate = useNavigate();
  const { socket, connectSocket } = useSocket();
  const [activeTab, setActiveTab] = useState<'profile' | 'ranked' | 'custom' | 'leaderboard'>('profile');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // 랭크 매칭 관련 상태
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingType, setMatchmakingType] = useState<'ranked' | 'custom' | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'info' | 'error', message: string} | null>(null);
  
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  const fetchUserProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('프로필 조회 실패:', error);
    }
  }, [apiUrl]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('랭킹 조회 실패:', error);
    }
  }, [apiUrl]);

  const fetchCurrentRoom = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/room/my`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentRoom(data.room);
      }
    } catch (error) {
      console.error('방 정보 조회 실패:', error);
    }
  }, [apiUrl]);


  useEffect(() => {
    fetchUserProfile();
    fetchLeaderboard();
    fetchCurrentRoom();
  }, [fetchUserProfile, fetchLeaderboard, fetchCurrentRoom]);

  // 소켓 연결과 이벤트 리스너를 별도 useEffect로 분리
  useEffect(() => {
    // 토큰이 있으면 소켓 연결
    const token = localStorage.getItem('token');
    if (token && !socket) {
      connectSocket();
    }
  }, [socket, connectSocket]);

  // 소켓 이벤트 리스너 설정을 별도 useEffect로 분리
  useEffect(() => {
    if (!socket) return;

    console.log('메인메뉴에서 소켓 이벤트 리스너 설정');

      // 소켓 이벤트 리스너
      const handleNotification = (data: {type: 'success' | 'info' | 'error', message: string, duration?: number}) => {
        console.log('알림 받음:', data);
        setNotification(data);
        setTimeout(() => setNotification(null), data.duration || 3000);
      };

      const handleQueueJoined = (data: {mode: string, queueSize: number}) => {
        console.log('✅ 큐 참가 성공:', data);
        setIsMatchmaking(true);
        setMatchmakingType(data.mode as 'ranked' | 'custom');
        setMessage(`매칭 대기 중... (${data.queueSize}명 대기중)`);
      };

      const handleQueueLeft = () => {
        console.log('❌ 큐 떠남');
        setIsMatchmaking(false);
        setMatchmakingType(null);
        setMessage('');
      };

      const handleGameStarted = (data: {playerId: string, roomId: string, gameState?: any}) => {
        console.log('🎮 게임 시작 이벤트 받음:', data);
        
        // 매칭 상태 즉시 해제
        setIsMatchmaking(false);
        setMatchmakingType(null);
        
        // 더 구체적인 로깅
        console.log('🚀 게임 화면으로 이동 시도:', {
          playerId: data.playerId,
          roomId: data.roomId,
          hasGameState: !!data.gameState,
          userAgent: navigator.userAgent
        });
        
        try {
          // 게임 페이지로 이동
          navigate('/game', { 
            state: { 
              playerId: data.playerId, 
              roomId: data.roomId,
              gameState: data.gameState 
            },
            replace: true  // replace 옵션 추가
          });
          console.log('✅ 게임 페이지 이동 완료');
        } catch (error) {
          console.error('❌ 게임 페이지 이동 실패:', error);
        }
      };

      const handleGameState = (gameState: any) => {
        console.log('게임 상태 받음:', gameState);
        // 게임이 시작되면 게임 페이지로 이동
        navigate('/game', { state: { gameState } });
      };

      const handleRatingUpdate = (ratingData: any) => {
        console.log('레이팅 업데이트:', ratingData);
        // 레이팅 업데이트 시 프로필 다시 로드
        fetchUserProfile();
      };

      // 매칭 관련 추가 이벤트
      const handleWaiting = (message: string) => {
        console.log('대기 메시지:', message);
      };

      const handleMatchFound = (data: any) => {
        console.log('매치 찾음:', data);
      };

      socket.on('notification', handleNotification);
      socket.on('queueJoined', handleQueueJoined);
      socket.on('queueLeft', handleQueueLeft);
      socket.on('gameStarted', handleGameStarted);
      socket.on('gameState', handleGameState);
      socket.on('ratingUpdate', handleRatingUpdate);
      socket.on('waiting', handleWaiting);
      socket.on('matchFound', handleMatchFound);

      return () => {
        // 이벤트 리스너 정리
        socket.off('notification', handleNotification);
        socket.off('queueJoined', handleQueueJoined);
        socket.off('queueLeft', handleQueueLeft);
        socket.off('gameStarted', handleGameStarted);
        socket.off('gameState', handleGameState);
        socket.off('ratingUpdate', handleRatingUpdate);
        socket.off('waiting', handleWaiting);
        socket.off('matchFound', handleMatchFound);
      };
    }
  , [socket, navigate, fetchUserProfile]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const createRoom = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/room/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`방이 생성되었습니다! 방 코드: ${data.code}`);
        await fetchCurrentRoom();
      } else {
        setMessage(data.error || '방 생성에 실패했습니다.');
      }
    } catch (error) {
      setMessage('방 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) {
      setMessage('방 코드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/room/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: roomCode })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('방에 참여했습니다!');
        setRoomCode('');
        await fetchCurrentRoom();
      } else {
        setMessage(data.error || '방 참여에 실패했습니다.');
      }
    } catch (error) {
      setMessage('방 참여에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const leaveRoom = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/room/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setCurrentRoom(null);
      } else {
        setMessage(data.error || '방 나가기에 실패했습니다.');
      }
    } catch (error) {
      setMessage('방 나가기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startMatchmaking = (mode: 'ranked' | 'custom') => {
    console.log(`${mode === 'ranked' ? '랭크' : '일반'} 매칭 시작 시도:`, { 
      socket: !!socket, 
      isMatchmaking, 
      socketConnected: socket?.connected 
    });
    if (socket && !isMatchmaking) {
      console.log(`join${mode === 'ranked' ? 'Ranked' : 'Custom'}Queue 이벤트 전송`);
      socket.emit(`join${mode === 'ranked' ? 'Ranked' : 'Custom'}Queue`);
    } else {
      console.log('매칭 시작 실패:', { 
        noSocket: !socket, 
        alreadyMatchmaking: isMatchmaking 
      });
    }
  };

  const cancelMatchmaking = () => {
    console.log('매칭 취소 시도:', { isMatchmaking });
    if (socket && isMatchmaking) {
      console.log('leaveQueue 이벤트 전송');
      socket.emit('leaveQueue');
    }
  };

  const enterGame = () => {
    if (currentRoom) {
      navigate('/game', { state: { roomId: currentRoom._id, roomCode: currentRoom.code } });
    }
  };

  return (
    <div className="main-menu">
      {/* 알림 팝업 */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      {/* 매칭 진행 상태 */}
      {isMatchmaking && (
        <div className="matchmaking-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="matchmaking-popup">
            <h3>🔍 매칭 중...</h3>
            <p>{matchmakingType === 'ranked' ? '랭크 게임' : '일반 게임'} 상대방을 찾고 있습니다.</p>
            <p style={{fontSize: '0.8rem', color: '#999'}}>
              상태: {isMatchmaking ? '매칭중' : '대기'} | 타입: {matchmakingType}
            </p>
            <div className="loading-spinner"></div>
            <button 
              onClick={cancelMatchmaking} 
              className="cancel-btn"
              style={{touchAction: 'manipulation'}}
            >
              매칭 취소
            </button>
          </div>
        </div>
      )}
      
      <header className="menu-header">
        <h1>🏃‍♂️ Quoridor Online</h1>
        {userProfile && (
          <div className="user-info">
            <span>환영합니다, {userProfile.username}님!</span>
            <button onClick={handleLogout} className="logout-btn">로그아웃</button>
          </div>
        )}
      </header>

      <nav className="menu-nav">
        <button 
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          프로필
        </button>
        <button 
          className={activeTab === 'ranked' ? 'active' : ''}
          onClick={() => setActiveTab('ranked')}
        >
          랜덤 매칭
        </button>
        <button 
          className={activeTab === 'custom' ? 'active' : ''}
          onClick={() => setActiveTab('custom')}
        >
          커스텀 게임
        </button>
        <button 
          className={activeTab === 'leaderboard' ? 'active' : ''}
          onClick={() => setActiveTab('leaderboard')}
        >
          랭킹
        </button>
      </nav>

      <main className="menu-content">
        {message && (
          <div className={`message ${message.includes('실패') || message.includes('없습니다') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {activeTab === 'profile' && userProfile && (
          <div className="profile-section">
            <h2>내 프로필</h2>
            <div className="profile-card">
              <div className="profile-info">
                <h3>{userProfile.username}</h3>
                <p>이메일: {userProfile.email}</p>
                <p>가입일: {new Date(userProfile.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="profile-stats">
                <div className="stat">
                  <label>레이팅</label>
                  <span className="rating">{userProfile.rating}</span>
                </div>
                <div className="stat">
                  <label>게임 수</label>
                  <span>{userProfile.gamesPlayed}</span>
                </div>
                <div className="stat">
                  <label>승 / 패</label>
                  <div className="win-loss-container">
                    <span className="wins">{userProfile.gamesWon}</span>
                    <span className="separator">/</span>
                    <span className="losses">{userProfile.gamesPlayed - userProfile.gamesWon}</span>
                  </div>
                </div>
                <div className="stat">
                  <label>승률</label>
                  <span>{userProfile.winRate}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ranked' && (
          <div className="ranked-section">
            <h2>� 랜덤 매칭</h2>
            {userProfile && (
              <div className="current-rank">
                <div className="rank-display">
                  <div className="rank-info">
                    <span className="rank-label">현재 랭크</span>
                    <span className="rank-value">브론즈</span>
                  </div>
                  <div className="rating-info">
                    <span className="rating-label">레이팅</span>
                    <span className="rating-value">{userProfile.rating}</span>
                  </div>
                </div>
                <div className="rank-stats">
                  <div className="stat-item">
                    <span>게임 수</span>
                    <span>{userProfile.gamesPlayed}게임</span>
                  </div>
                  <div className="stat-item">
                    <span>승률</span>
                    <span>{userProfile.winRate}%</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="match-container">
              <div className="match-option">
                <h3>� 랭크 매칭</h3>
                <p>비슷한 실력의 플레이어와 매칭됩니다.</p>
                <p>승리 시 레이팅 상승, 패배 시 레이팅 하락</p>
                <button 
                  onClick={() => {
                    console.log('랭크 매칭 버튼 클릭됨');
                    startMatchmaking('ranked');
                  }}
                  disabled={loading || isMatchmaking}
                  className="match-btn ranked-match-btn"
                  style={{touchAction: 'manipulation'}}
                >
                  {isMatchmaking && matchmakingType === 'ranked' ? '매칭 중...' : '랭크 매칭 시작'}
                </button>
              </div>
              
              <div className="match-option">
                <h3>🤖 테스트 매칭</h3>
                <p>봇과 대전하여 매칭 시스템을 테스트합니다.</p>
                <p style={{color: '#FF9800', fontSize: '0.9em'}}>개발/디버깅용 기능입니다.</p>
                <div style={{display: 'flex', gap: '10px', flexDirection: 'column'}}>
                  <button 
                    onClick={() => {
                      console.log('테스트 봇 추가 버튼 클릭됨');
                      if (socket) {
                        socket.emit('addTestBot');
                      }
                    }}
                    disabled={loading}
                    className="match-btn test-match-btn"
                    style={{touchAction: 'manipulation', background: '#FF9800', color: 'white'}}
                  >
                    테스트 봇 추가
                  </button>
                  <button 
                    onClick={() => {
                      console.log('봇끼리 게임 생성 버튼 클릭됨');
                      if (socket) {
                        socket.emit('createBotGame');
                      }
                    }}
                    disabled={loading}
                    className="match-btn test-match-btn"
                    style={{touchAction: 'manipulation', background: '#9C27B0', color: 'white'}}
                  >
                    봇끼리 게임 테스트
                  </button>
                </div>
              </div>
              
              <div className="match-option">
                <h3>🎮 일반 매칭</h3>
                <p>빠른 대전으로 연습하세요.</p>
                <p>레이팅에 영향을 주지 않습니다.</p>
                <button 
                  onClick={() => {
                    console.log('일반 매칭 버튼 클릭됨');
                    startMatchmaking('custom');
                  }}
                  disabled={loading || isMatchmaking}
                  className="match-btn custom-match-btn"
                  style={{touchAction: 'manipulation'}}
                >
                  {isMatchmaking && matchmakingType === 'custom' ? '매칭 중...' : '일반 매칭 시작'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="custom-section">
            <h2>커스텀 게임</h2>
            
            {currentRoom ? (
              <div className="current-room">
                <h3>현재 참여 중인 방</h3>
                <div className="room-info">
                  <p><strong>방 코드:</strong> {currentRoom.code}</p>
                  <p><strong>플레이어:</strong> {currentRoom.players.length}/{currentRoom.maxPlayers}</p>
                  <p><strong>상태:</strong> {currentRoom.status === 'waiting' ? '대기 중' : '게임 중'}</p>
                </div>
                <div className="room-actions">
                  <button onClick={enterGame} className="enter-game-btn">
                    게임 입장
                  </button>
                  <button onClick={leaveRoom} disabled={loading} className="leave-room-btn">
                    방 나가기
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="create-room">
                  <h3>방 만들기</h3>
                  <p>새로운 방을 만들어 친구들과 게임하세요.</p>
                  <button 
                    onClick={createRoom}
                    disabled={loading}
                    className="create-btn"
                  >
                    {loading ? '생성 중...' : '방 만들기'}
                  </button>
                </div>

                <div className="join-room">
                  <h3>방 참여하기</h3>
                  <p>방 코드를 입력해서 친구의 방에 참여하세요.</p>
                  <div className="join-form">
                    <input
                      type="text"
                      placeholder="방 코드 입력"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={6}
                    />
                    <button 
                      onClick={joinRoom}
                      disabled={loading || !roomCode.trim()}
                      className="join-btn"
                    >
                      {loading ? '참여 중...' : '참여하기'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="leaderboard-section">
            <h2>랭킹</h2>
            <div className="leaderboard-table">
              <table>
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>플레이어</th>
                    <th>레이팅</th>
                    <th>게임 수</th>
                    <th>승률</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((player) => (
                    <tr 
                      key={player.username}
                      className={userProfile?.username === player.username ? 'current-user' : ''}
                    >
                      <td className="rank">#{player.rank}</td>
                      <td className="username">{player.username}</td>
                      <td className="rating">{player.rating}</td>
                      <td>{player.gamesPlayed}</td>
                      <td>{player.winRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MainMenu;
