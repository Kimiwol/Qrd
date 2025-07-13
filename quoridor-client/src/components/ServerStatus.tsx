import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';

const StatusContainer = styled.div<{ isOnline: boolean }>`
  position: fixed;
  top: 10px;
  right: 10px;
  padding: 8px 12px;
  background: ${props => props.isOnline ? '#4CAF50' : '#f44336'};
  color: white;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1000;
`;

const ServerStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL;
        if (!apiUrl) {
          setIsOnline(false);
          return;
        }

        const response = await axios.get(`${apiUrl}/`, {
          timeout: 5000
        });
        
        if (response.status === 200) {
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch (error) {
        console.error('Server status check failed:', error);
        setIsOnline(false);
      }
    };

    // 즉시 확인
    checkServerStatus();

    // 30초마다 서버 상태 확인
    const interval = setInterval(checkServerStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  if (isOnline === null) return null;

  return (
    <StatusContainer isOnline={isOnline}>
      {isOnline ? '🟢 서버 온라인' : '🔴 서버 오프라인'}
    </StatusContainer>
  );
};

export default ServerStatus;
