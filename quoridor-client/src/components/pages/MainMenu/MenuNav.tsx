import React from 'react';

interface MenuNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const MenuNav: React.FC<MenuNavProps> = ({ activeTab, setActiveTab }) => (
  <nav className="menu-nav">
    <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>프로필</button>
    <button className={activeTab === 'ranked' ? 'active' : ''} onClick={() => setActiveTab('ranked')}>랜덤 매칭</button>
    <button className={activeTab === 'custom' ? 'active' : ''} onClick={() => setActiveTab('custom')}>커스텀 게임</button>
    <button className={activeTab === 'leaderboard' ? 'active' : ''} onClick={() => setActiveTab('leaderboard')}>랭킹</button>
  </nav>
);

export default MenuNav;
