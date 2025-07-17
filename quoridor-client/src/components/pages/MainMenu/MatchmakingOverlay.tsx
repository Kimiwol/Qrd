import React from 'react';

interface MatchmakingOverlayProps {
  isMatchmaking: boolean;
  matchmakingStatus: string;
  matchmakingType: string | null;
  message: string;
  loading: boolean;
  cancelMatchmaking: () => void;
}

const MatchmakingOverlay: React.FC<MatchmakingOverlayProps> = ({ isMatchmaking, matchmakingStatus, matchmakingType, message, loading, cancelMatchmaking }) => (
  isMatchmaking ? (
    <div className="matchmaking-overlay" onClick={e => e.stopPropagation()}>
      <div className="matchmaking-popup">
        {matchmakingStatus === 'searching' && (
          <>
            <h3>🔍 매칭 중...</h3>
            <p>{matchmakingType === 'ranked' ? '랭크 게임' : '일반 게임'} 상대방을 찾고 있습니다.</p>
            <div className="loading-spinner"></div>
          </>
        )}
        {matchmakingStatus === 'found' && (
          <>
            <h3>✅ 매치 성사!</h3>
            <p>{message}</p>
            <div className="loading-spinner"></div>
          </>
        )}
        {matchmakingStatus === 'starting' && (
          <>
            <h3>🚀 게임 시작 중...</h3>
            <p>게임 화면으로 이동합니다...</p>
            <div className="loading-spinner"></div>
          </>
        )}
        <button 
          onClick={cancelMatchmaking}
          className="cancel-btn"
          style={{touchAction: 'manipulation'}}
          disabled={matchmakingStatus !== 'searching'}
          title={matchmakingStatus !== 'searching' ? '취소할 수 없습니다' : '매칭을 취소합니다'}
        >
          {matchmakingStatus === 'searching' ? '매칭 취소' : '취소 불가'}
        </button>
      </div>
    </div>
  ) : null
);

export default MatchmakingOverlay;
