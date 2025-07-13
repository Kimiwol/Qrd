import React from 'react';
import styled from 'styled-components';

const DebugContainer = styled.div`
  position: fixed;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 11px;
  max-width: 300px;
  z-index: 1001;
`;

const DebugInfo: React.FC = () => {
  if (process.env.NODE_ENV === 'production') {
    return null; // 프로덕션에서는 표시하지 않음
  }

  return (
    <DebugContainer>
      <div><strong>환경 정보:</strong></div>
      <div>NODE_ENV: {process.env.NODE_ENV}</div>
      <div>API_URL: {process.env.REACT_APP_API_URL || 'undefined'}</div>
      <div>WS_URL: {process.env.REACT_APP_WS_URL || 'undefined'}</div>
      <div>Host: {window.location.host}</div>
      <div>Origin: {window.location.origin}</div>
    </DebugContainer>
  );
};

export default DebugInfo;
