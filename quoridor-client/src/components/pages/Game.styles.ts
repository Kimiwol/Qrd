import styled from 'styled-components';

export const GameContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 10px;
  box-sizing: border-box;
  @media (max-width: 768px) {
    padding: 5px;
  }
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  margin-bottom: 15px;
  position: relative;
  @media (max-width: 768px) {
    padding: 8px 12px;
    margin-bottom: 10px;
  }
`;

export const Title = styled.h1`
  color: white;
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

export const HeaderQuitButton = styled.button`
  background: rgba(244, 67, 54, 0.9);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;
  &:hover {
    background: rgba(244, 67, 54, 1);
    transform: translateY(-1px);
  }
  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 12px;
  }
`;

export const GameArea = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 15px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  @media (max-width: 768px) {
    padding: 10px;
    gap: 10px;
  }
`;

export const InfoContainer = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 600px;
`;

export const BoardArea = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 80vh;
  max-height: 80vh;
  aspect-ratio: 1 / 1;
  min-height: 0;
`;

export const PlayerCard = styled.div<{ isCurrentTurn: boolean; isPlayer1: boolean; position: 'top' | 'bottom' }>`
  display: flex;
  align-items: center;
  background: ${props => props.isCurrentTurn 
    ? 'linear-gradient(135deg, #4CAF50, #45a049)' 
    : 'rgba(255, 255, 255, 0.9)'};
  color: ${props => props.isCurrentTurn ? 'white' : '#333'};
  padding: 15px 20px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: ${props => props.isCurrentTurn ? '3px solid #4CAF50' : '2px solid rgba(255, 255, 255, 0.3)'};
  transition: all 0.3s ease;
  width: 100%;
  max-width: 600px;
  @media (max-width: 768px) {
    padding: 10px 12px;
    border-radius: 12px;
  }
`;

export const PlayerAvatar = styled.div<{ isPlayer1: boolean }>`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: ${props => props.isPlayer1 
    ? 'linear-gradient(135deg, #ff6b6b, #ee5a52)' 
    : 'linear-gradient(135deg, #4dabf7, #339af0)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  color: white;
  margin-right: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  @media (max-width: 768px) {
    width: 35px;
    height: 35px;
    font-size: 18px;
    margin-right: 10px;
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
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 40px 60px;
  border-radius: 20px;
  font-size: 28px;
  font-weight: 600;
  text-align: center;
  z-index: 1002;
  backdrop-filter: blur(10px);
  @media (max-width: 768px) {
    padding: 30px 40px;
    font-size: 24px;
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
