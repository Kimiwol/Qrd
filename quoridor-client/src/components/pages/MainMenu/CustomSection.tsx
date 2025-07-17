import React from 'react';

interface CustomSectionProps {
  currentRoom: any;
  loading: boolean;
  roomCode: string;
  setRoomCode: (v: string) => void;
  createRoom: () => void;
  joinRoom: () => void;
  leaveRoom: () => void;
  enterGame: () => void;
}

const CustomSection: React.FC<CustomSectionProps> = ({ currentRoom, loading, roomCode, setRoomCode, createRoom, joinRoom, leaveRoom, enterGame }) => (
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
          <button onClick={enterGame} className="enter-game-btn">게임 입장</button>
          <button onClick={leaveRoom} disabled={loading} className="leave-room-btn">방 나가기</button>
        </div>
      </div>
    ) : (
      <>
        <div className="create-room">
          <h3>방 만들기</h3>
          <p>새로운 방을 만들어 친구들과 게임하세요.</p>
          <button onClick={createRoom} disabled={loading} className="create-btn">
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
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button onClick={joinRoom} disabled={loading || !roomCode.trim()} className="join-btn">
              {loading ? '참여 중...' : '참여하기'}
            </button>
          </div>
        </div>
      </>
    )}
  </div>
);

export default CustomSection;
