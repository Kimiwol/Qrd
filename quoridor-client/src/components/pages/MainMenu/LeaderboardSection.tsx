import React from 'react';

interface LeaderboardSectionProps {
  leaderboard: any[];
  userProfile: any;
}

const LeaderboardSection: React.FC<LeaderboardSectionProps> = ({ leaderboard, userProfile }) => (
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
);

export default LeaderboardSection;
