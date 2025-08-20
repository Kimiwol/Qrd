import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import './MainMenu.css';
import ProfileSection from './MainMenu/ProfileSection';
import RankedSection from './MainMenu/RankedSection';
import CustomSection from './MainMenu/CustomSection';
import LeaderboardSection from './MainMenu/LeaderboardSection';
import MatchmakingOverlay from './MainMenu/MatchmakingOverlay';
import Notification from './MainMenu/Notification';
import MenuHeader from './MainMenu/MenuHeader';
import MenuNav from './MainMenu/MenuNav';

interface GameHistoryItem {
  id: string;
  result: 'win' | 'lose';
  opponent: string;
  date: string;
}
interface Notice {
  id: string;
  message: string;
  type: 'event' | 'update' | 'maintenance';
}
interface Stats {
  onlineUsers: number;
  activeGames: number;
}

const MainMenu: React.FC = () => {
  // 소켓 에러 알림 처리
  useEffect(() => {
    const handleSocketError = (e: any) => {
      setNotification({ type: 'error', message: '서버 연결 오류: ' + (e.detail || '알 수 없는 오류') });
      setTimeout(() => setNotification(null), 3000);
    };
    window.addEventListener('socketError', handleSocketError);
    return () => {
      window.removeEventListener('socketError', handleSocketError);
    };
  }, []);
  // ...existing code...

  // ...existing code...
  // 이미 선언된 것 외 누락된 상태/함수 선언 추가
  // setLoading, setMessage, apiUrl, roomCode, setRoomCode, fetchCurrentRoom
  // (중복 선언 방지, 이미 있으면 추가하지 않음)
  // fetchCurrentRoom 임시 선언
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'ranked' | 'custom' | 'leaderboard'>('profile');
  const apiUrl = process.env.REACT_APP_API_URL || 'https://quoridoronline-5ngr.onrender.com';
const fetchCurrentRoom = useCallback(async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      setCurrentRoom(null);
      return;
    }
    const response = await fetch(`${apiUrl}/api/room/current`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setCurrentRoom(data);
    } else {
      setCurrentRoom(null);
    }
  } catch (error) {
    console.error('현재 방 정보 조회 실패:', error);
    setCurrentRoom(null);
  }
}, [apiUrl]);
  // 매치 발견 핸들러
  const handleMatchFound = (data: { opponent: string }) => {
    setMatchmakingStatus('found');
    setMessage(`상대를 찾았습니다: ${data.opponent}. 곧 게임을 시작합니다...`);
  };



  // 실제 프로필 정보 불러오기 구현
  const fetchUserProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      }
    } catch (error) {
      setNotification({ type: 'error', message: '프로필 정보 조회에 실패했습니다.' });
      setTimeout(() => setNotification(null), 3000);
      console.error('프로필 정보 조회 실패:', error);
    }
  }, [apiUrl]);
  // 페이지 진입 시 프로필 정보 불러오기
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);
  const navigate = useNavigate();
  const { socket, connectSocket } = useSocket();
  const [notification, setNotification] = useState<{type: 'success' | 'info' | 'error', message: string} | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState<'searching' | 'found' | 'starting'>('searching');
  const [matchmakingType, setMatchmakingType] = useState<'ranked' | 'custom' | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState<any>(null);

  // 누락된 핸들러 함수 선언
  const handleNotification = (data: { type: 'success' | 'info' | 'error', message: string }) => {
    setNotification(data);
    setTimeout(() => setNotification(null), 3000);
  };
  const handleQueueJoined = () => setIsMatchmaking(true);
  const handleQueueLeft = () => setIsMatchmaking(false);
  // matchFound, gameStarted 등은 이미 아래에 구현되어 있음

  // 최근 전적 불러오기
  const fetchGameHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/history?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGameHistory(data);
      }
    } catch (error) {
      setNotification({ type: 'error', message: '최근 전적 조회에 실패했습니다.' });
      setTimeout(() => setNotification(null), 3000);
      console.error('최근 전적 조회 실패:', error);
    }
  }, [apiUrl]);

  // 공지/이벤트 불러오기
  const fetchNotices = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/notice`);
      if (response.ok) {
        const data = await response.json();
        setNotices(data);
      }
    } catch (error) {
      setNotification({ type: 'error', message: '공지/이벤트 조회에 실패했습니다.' });
      setTimeout(() => setNotification(null), 3000);
      console.error('공지/이벤트 조회 실패:', error);
    }
  }, [apiUrl]);

  // 실시간 접속자/게임 수 불러오기
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      setNotification({ type: 'error', message: '실시간 통계 조회에 실패했습니다.' });
      setTimeout(() => setNotification(null), 3000);
      console.error('실시간 통계 조회 실패:', error);
    }
  }, [apiUrl]);
  // 공지/이벤트, 실시간 통계 데이터 불러오기 (함수 선언 이후에 위치)
  useEffect(() => {
    fetchNotices();
    fetchStats();
  }, [fetchNotices, fetchStats]);

  // 공지/이벤트, 실시간 통계 데이터 불러오기 (함수 선언 이후에 위치)
  useEffect(() => {
    fetchNotices();
    fetchStats();
  }, [fetchNotices, fetchStats]);

  useEffect(() => {
    const handleGameStarted = (data: {playerId: string, roomId: string, gameState?: any, playerInfo?: any}) => {
      // ...기존 handleGameStarted 코드...
      if (!data.playerId || !data.roomId) {
        setNotification({ type: 'error', message: '게임 시작에 실패했습니다. 잠시 후 다시 시도해주세요.' });
        setIsMatchmaking(false);
        return;
      }
      setMatchmakingStatus('starting');
      setMessage('게임에 접속하는 중입니다...');
      setTimeout(() => {
        navigate(`/game/${data.roomId}`, { 
          state: { playerId: data.playerId, roomId: data.roomId, gameState: data.gameState, playerInfo: data.playerInfo },
          replace: true
        });
        setIsMatchmaking(false);
        setMatchmakingType(null);
        setMatchmakingStatus('searching');
        setMessage('');
      }, 500);
    };
    const handleGameState = (gameState: any) => {
      navigate('/game', { state: { gameState } });
    };
    const handleRatingUpdate = (ratingData: any) => {
      fetchUserProfile();
    };
    const handleWaiting = (message: string) => {
      // 대기 메시지 핸들러(로깅 등)
    };
    socket?.on('notification', handleNotification);
    socket?.on('queueJoined', handleQueueJoined);
    socket?.on('queueLeft', handleQueueLeft);
    socket?.on('matchFound', handleMatchFound);
    socket?.on('gameStarted', handleGameStarted);
    socket?.on('gameState', handleGameState);
    socket?.on('ratingUpdate', handleRatingUpdate);
    socket?.on('waiting', handleWaiting);
    return () => {
      socket?.off('notification', handleNotification);
      socket?.off('queueJoined', handleQueueJoined);
      socket?.off('queueLeft', handleQueueLeft);
      socket?.off('matchFound', handleMatchFound);
      socket?.off('gameStarted', handleGameStarted);
      socket?.off('gameState', handleGameState);
      socket?.off('ratingUpdate', handleRatingUpdate);
      socket?.off('waiting', handleWaiting);
    };
  }, [socket, navigate, fetchUserProfile]);



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
        setNotification({ type: 'success', message: `방이 생성되었습니다! 방 코드: ${data.code}` });
        setTimeout(() => setNotification(null), 3000);
        await fetchCurrentRoom();
      } else {
        setMessage(data.error || '방 생성에 실패했습니다.');
        setNotification({ type: 'error', message: data.error || '방 생성에 실패했습니다.' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      setMessage('방 생성에 실패했습니다.');
      setNotification({ type: 'error', message: '방 생성에 실패했습니다.' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) {
      setMessage('방 코드를 입력해주세요.');
      setNotification({ type: 'error', message: '방 코드를 입력해주세요.' });
      setTimeout(() => setNotification(null), 3000);
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
        setNotification({ type: 'success', message: '방에 참여했습니다!' });
        setTimeout(() => setNotification(null), 3000);
        setRoomCode('');
        await fetchCurrentRoom();
      } else {
        setMessage(data.error || '방 참여에 실패했습니다.');
        setNotification({ type: 'error', message: data.error || '방 참여에 실패했습니다.' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      setMessage('방 참여에 실패했습니다.');
      setNotification({ type: 'error', message: '방 참여에 실패했습니다.' });
      setTimeout(() => setNotification(null), 3000);
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
        setNotification({ type: 'success', message: data.message });
        setTimeout(() => setNotification(null), 3000);
        setCurrentRoom(null);
      } else {
        setMessage(data.error || '방 나가기에 실패했습니다.');
        setNotification({ type: 'error', message: data.error || '방 나가기에 실패했습니다.' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      setMessage('방 나가기에 실패했습니다.');
      setNotification({ type: 'error', message: '방 나가기에 실패했습니다.' });
      setTimeout(() => setNotification(null), 3000);
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
    console.log('매칭 취소 시도:', { isMatchmaking, matchmakingType });
    if (socket && isMatchmaking) {
      console.log('leaveQueue 이벤트 전송');
      socket.emit('leaveQueue');
      
      // 즉시 로컬 상태 업데이트 (서버 응답을 기다리지 않음)
      setIsMatchmaking(false);
      setMatchmakingType(null);
      setMatchmakingStatus('searching');
      setMessage('');
      
      // 성공 메시지 표시
      setNotification({
        type: 'info',
        message: '매칭이 취소되었습니다.'
      });
      
      // 3초 후 알림 제거
      setTimeout(() => setNotification(null), 3000);
    } else {
      console.log('매칭 취소 실패:', { 
        noSocket: !socket, 
        notMatchmaking: !isMatchmaking 
      });
    }
  };

  const enterGame = () => {
    if (currentRoom) {
      navigate('/game', { state: { roomId: currentRoom._id, roomCode: currentRoom.code } });
    }
  };

  const debugMatchmaking = () => {
    if (socket) {
      console.log('🐛 디버그 매칭 정보 요청');
      socket.emit('debugMatchmaking');
      
      // 디버그 정보 이벤트 리스너 추가
      socket.on('debugInfo', (data: any) => {
        console.log('🐛 디버그 정보 수신:', data);
        setNotification({
          type: 'info',
          message: `디버그: ${data.queues.ranked.size + data.queues.custom.size}명 대기 중`
        });
      });
    }
  };

  return (
    <div className="main-menu">
      <Notification notification={notification} />
      <MatchmakingOverlay
        isMatchmaking={isMatchmaking}
        matchmakingStatus={matchmakingStatus}
        matchmakingType={matchmakingType}
        message={message}
        loading={loading}
        cancelMatchmaking={cancelMatchmaking}
      />
      <MenuHeader userProfile={userProfile} onLogout={handleLogout} />
      <MenuNav
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as 'profile' | 'ranked' | 'custom' | 'leaderboard')}
      />
      {/* 공지/이벤트 섹션 */}
      {notices.length > 0 && (
        <section className="notice-section">
          <h2>공지/이벤트</h2>
          <ul>
            {notices.map(notice => (
              <li key={notice.id} className={`notice-${notice.type}`}>
                {notice.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* 실시간 통계 섹션 */}
      {stats && (
        <section className="stats-section">
          <h2>실시간 통계</h2>
          <p>접속자 수: {stats.onlineUsers}명</p>
          <p>진행 중인 게임: {stats.activeGames}개</p>
        </section>
      )}
      <main className="menu-content">
        <section className="quick-actions">
          <h2>빠른 시작</h2>
          <div className="actions-grid">
            <button
              className="quick-btn ranked"
              onClick={() => startMatchmaking('ranked')}
              disabled={loading || isMatchmaking}
            >
              빠른 랭크 매칭
            </button>
            <button
              className="quick-btn custom"
              onClick={() => startMatchmaking('custom')}
              disabled={loading || isMatchmaking}
            >
              일반 매칭
            </button>
            <button
              className="quick-btn create"
              onClick={createRoom}
              disabled={loading || isMatchmaking}
            >
              방 만들기
            </button>
          </div>
        </section>
        {message && (
          <div className={`message ${message.includes('실패') || message.includes('없습니다') ? 'error' : 'success'}`}>{message}</div>
        )}
        {activeTab === 'profile' && <ProfileSection userProfile={userProfile} />}
        {activeTab === 'ranked' && (
          <RankedSection
            userProfile={userProfile}
            loading={loading}
            isMatchmaking={isMatchmaking}
            matchmakingType={matchmakingType}
            startMatchmaking={startMatchmaking}
            debugMatchmaking={debugMatchmaking}
            socket={socket}
          />
        )}
        {activeTab === 'custom' && (
          <CustomSection
            currentRoom={currentRoom}
            loading={loading}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            createRoom={createRoom}
            joinRoom={joinRoom}
            leaveRoom={leaveRoom}
            enterGame={enterGame}
          />
        )}
        {activeTab === 'leaderboard' && (
          <LeaderboardSection leaderboard={[]} userProfile={userProfile} />
        )}
      </main>
    </div>
  );
}
export default MainMenu;
