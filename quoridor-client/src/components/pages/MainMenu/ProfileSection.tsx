import React from 'react';

interface ProfileSectionProps {
  userProfile: any;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ userProfile }) => {
  if (!userProfile) return null;
  return (
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
  );
};

export default ProfileSection;
