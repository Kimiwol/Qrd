import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [activeTab, setActiveTab] = useState<'profile' | 'ranked' | 'custom' | 'leaderboard'>('profile');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  useEffect(() => {
    fetchUserProfile();
    fetchLeaderboard();
    fetchCurrentRoom();
  }, []);

  const fetchUserProfile = async () => {
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
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('랭킹 조회 실패:', error);
    }
  };

  const fetchCurrentRoom = async () => {
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

  const startRankedMatch = () => {
    setMessage('랭크 매칭은 아직 구현되지 않았습니다.');
  };

  const enterGame = () => {
    if (currentRoom) {
      navigate('/game', { state: { roomId: currentRoom._id, roomCode: currentRoom.code } });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="main-menu">
      <header className="menu-header">
        <h1>🏃‍♂️ Quoridor Online</h1>
        {userProfile && (
          <div className="user-info">
            <span>환영합니다, {userProfile.username}님!</span>
            <button onClick={logout} className="logout-btn">로그아웃</button>
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
          랭크 게임
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
                  <label>승리</label>
                  <span>{userProfile.gamesWon}</span>
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
            <h2>랭크 게임</h2>
            <div className="ranked-card">
              <p>다른 플레이어와 랭킹을 겨루는 게임입니다.</p>
              <p>승리하면 레이팅이 올라가고, 패배하면 레이팅이 내려갑니다.</p>
              <button 
                onClick={startRankedMatch}
                disabled={loading}
                className="match-btn"
              >
                {loading ? '매칭 중...' : '랭크 매칭 시작'}
              </button>
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
