import React from 'react';

interface MenuHeaderProps {
  userProfile: any;
  onLogout: () => void;
}

const MenuHeader: React.FC<MenuHeaderProps> = ({ userProfile, onLogout }) => (
  <header className="menu-header">
    <h1>🏃‍♂️ Quoridor Online</h1>
    {userProfile && (
      <div className="user-info">
        <span>환영합니다, {userProfile.username}님!</span>
        <button onClick={onLogout} className="logout-btn">로그아웃</button>
      </div>
    )}
  </header>
);

export default MenuHeader;
