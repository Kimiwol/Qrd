
import styled from 'styled-components';

export const InfoSidebar = styled.div`
  width: 220px;
  min-width: 180px;
  max-width: 260px;
  background: #ede3d1;
  color: #2d1b12;
  border-radius: 10px;
  box-shadow: none;
  padding: 1.2rem 1.1rem;
  margin-left: 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  font-size: 1rem;
  font-weight: 400;
  @media (max-width: 900px) {
    display: none;
  }
`;

export const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #2d1b12;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Noto Sans KR', 'Segoe UI', Arial, sans-serif;
  @media (max-width: 768px) {
    padding: 0;
  }
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2.5rem 2.5rem 1.5rem 2.5rem;
  background: #22140b;
  border-bottom: 1px solid #3e2723;
  border-radius: 0;
  margin-bottom: 0;
  position: relative;
  box-shadow: none;
  @media (max-width: 768px) {
    padding: 1.2rem 1rem 0.7rem 1rem;
  }
`;

export const Title = styled.h1`
  color: #fff;
  margin: 0;
  font-size: 1.7rem;
  font-weight: 500;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  letter-spacing: 0.04em;
  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
`;

export const HeaderQuitButton = styled.button`
  background: #2d1b12;
  color: #fff;
  border: 1px solid #4e342e;
  padding: 0.45rem 1.1rem;
  border-radius: 4px;
  font-size: 0.95rem;
  font-weight: 400;
  cursor: pointer;
  margin-left: auto;
  transition: background 0.15s;
  &:hover {
    background: #3e2723;
    color: #fff;
  }
  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 12px;
  }
`;

export const GameArea = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  padding: 0;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
`;

export const InfoContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 600px;
  min-width: unset;
  margin: 0 auto;
`;

export const BoardArea = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 60vh;
  max-height: 60vh;
  aspect-ratio: 1 / 1;
  min-height: 0;
`;

export const PlayerCard = styled.div<{ isCurrentTurn: boolean; isPlayer1: boolean; position: 'top' | 'bottom' }>`
  display: flex;
  align-items: center;
  background: #ede3d1;
  color: #2d1b12;
  border-radius: 8px;
  box-shadow: none;
  padding: 1.1rem 1.2rem;
  font-size: 1rem;
  font-weight: 400;
  padding: 13px 18px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border: 2px solid ${props => props.isCurrentTurn ? '#795548' : '#e0e0e0'};
  transition: border 0.2s;
  width: 100%;
  max-width: 520px;
  @media (max-width: 768px) {
    padding: 8px 10px;
    border-radius: 10px;
  }
`;

export const PlayerAvatar = styled.div<{ isPlayer1: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: ${props => props.isPlayer1 ? '#bdb76b' : '#8d5524'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  margin-right: 13px;
  border: 2px solid #e0e0e0;
  box-shadow: none;
  @media (max-width: 768px) {
    width: 32px;
    height: 32px;
    font-size: 15px;
    margin-right: 8px;
  }
`;

export const PlayerDetails = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

export const PlayerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const PlayerName = styled.div`
  font-size: 16px;
  font-weight: 600;
  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

export const WallInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const WallIconContainer = styled.div`
  display: flex;
  gap: 2px;
`;

export const WallIcon = styled.div<{ isActive: boolean }>`
  width: 10px;
  height: 3px;
  background: ${props => props.isActive ? '#8b4513' : 'rgba(139, 69, 19, 0.3)'};
  border-radius: 1px;
  transition: background 0.2s ease;
`;

export const WallCount = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

export const BoardWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
`;

export const Dialog = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 30px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  z-index: 1004;
  text-align: center;
  min-width: 300px;
`;

export const DialogTitle = styled.h3`
  margin: 0 0 15px 0;
  color: #333;
  font-size: 20px;
`;

export const DialogMessage = styled.div`
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 20px;
  color: #333;
  line-height: 1.5;
`;

export const DialogButtons = styled.div`
  display: flex;
  justify-content: center;
  gap: 15px;
`;

export const DialogButton = styled.button<{ variant?: 'confirm' | 'cancel' }>`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
  ${props => props.variant === 'confirm' ? `
    background: #4CAF50;
    color: white;
    &:hover {
      background: #45a049;
    }
  ` : `
    background: #f44336;
    color: white;
    &:hover {
      background: #da190b;
    }
  `}
`;

export const Notification = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #ff6b6b;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  animation: slideDown 0.3s ease-out;
  z-index: 1001;
  @keyframes slideDown {
    from {
      top: -50px;
      opacity: 0;
    }
    to {
      top: 20px;
      opacity: 1;
    }
  }
`;

export const GameOverlay = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255,255,255,0.98);
  color: #333;
  padding: 36px 48px;
  border-radius: 16px;
  font-size: 24px;
  font-weight: 500;
  text-align: center;
  z-index: 1002;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  @media (max-width: 768px) {
    padding: 22px 18px;
    font-size: 18px;
  }
`;

export const PlayerTimer = styled.div<{ isTimeRunningOut: boolean; isActive: boolean }>`
  color: ${props => props.isTimeRunningOut ? '#ff6b6b' : '#666'};
  font-size: 14px;
  font-weight: 600;
  padding: 4px 8px;
  background: ${props => props.isActive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(0, 0, 0, 0.1)'};
  border-radius: 12px;
  border: 2px solid ${props => props.isActive ? '#4CAF50' : 'transparent'};
  animation: ${props => props.isTimeRunningOut && props.isActive ? 'pulse 1s infinite' : 'none'};
  opacity: ${props => props.isActive ? 1 : 0.5};
  transition: all 0.3s ease;
  min-width: 45px;
  text-align: center;
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @media (max-width: 768px) {
    font-size: 11px;
    padding: 2px 5px;
    min-width: 35px;
  }
`;
