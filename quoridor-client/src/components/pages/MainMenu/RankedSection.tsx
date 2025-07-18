import React from 'react';

interface RankedSectionProps {
  userProfile: any;
  loading: boolean;
  isMatchmaking: boolean;
  matchmakingType: string | null;
  startMatchmaking: (mode: 'ranked' | 'custom') => void;
  debugMatchmaking: () => void;
  socket: any;
}

const RankedSection: React.FC<RankedSectionProps> = ({ userProfile, loading, isMatchmaking, matchmakingType, startMatchmaking, debugMatchmaking, socket }) => (
  <div className="ranked-section">
    {socket && (
      <React.Fragment>
        {socket.on && socket.off && (
          (() => {
            socket.off('gameStarted');
            socket.on('gameStarted', (data: any) => {
              alert('테스트 매칭 성공! 상대: ' + (data.opponent || '알 수 없음'));
            });
            socket.off('notification');
            socket.on('notification', (data: any) => {
              if (data.type === 'error') alert('테스트 매칭 실패: ' + data.message);
            });
          })()
        )}
      </React.Fragment>
    )}
    <h2>🏆 랜덤 매칭</h2>
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
        <h3>🏆 랭크 매칭</h3>
        <p>비슷한 실력의 플레이어와 매칭됩니다.</p>
        <p>승리 시 레이팅 상승, 패배 시 레이팅 하락</p>
        <button 
          onClick={() => startMatchmaking('ranked')}
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
            onClick={() => socket && socket.emit('addTestBot')}
            disabled={loading}
            className="match-btn test-match-btn"
            style={{touchAction: 'manipulation', background: '#FF9800', color: 'white'}}
          >
            테스트 봇 추가
          </button>
          <button 
            onClick={() => socket && socket.emit('createBotGame')}
            disabled={loading}
            className="match-btn test-match-btn"
            style={{touchAction: 'manipulation', background: '#9C27B0', color: 'white'}}
          >
            봇끼리 게임 테스트
          </button>
          <button 
            onClick={debugMatchmaking}
            disabled={loading}
            className="match-btn test-match-btn"
            style={{touchAction: 'manipulation', background: '#607D8B', color: 'white'}}
          >
            🐛 매칭 디버그
          </button>
        </div>
      </div>
      <div className="match-option">
        <h3>🎮 일반 매칭</h3>
        <p>빠른 대전으로 연습하세요.</p>
        <p>레이팅에 영향을 주지 않습니다.</p>
        <button 
          onClick={() => startMatchmaking('custom')}
          disabled={loading || isMatchmaking}
          className="match-btn custom-match-btn"
          style={{touchAction: 'manipulation'}}
        >
          {isMatchmaking && matchmakingType === 'custom' ? '매칭 중...' : '일반 매칭 시작'}
        </button>
      </div>
    </div>
  </div>
);

export default RankedSection;
