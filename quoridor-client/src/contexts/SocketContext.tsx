import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import io from 'socket.io-client';

interface SocketContextType {
  socket: ReturnType<typeof io> | null;
  isConnected: boolean;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectSocket: () => {},
  disconnectSocket: () => {}
});

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectingRef = React.useRef(false);

  const disconnectSocket = useCallback(() => {
    if (socket) {
      console.log('🔌 소켓 연결 해제 시도...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  const connectSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('� 소켓 연결 중단: 토큰 없음');
      return;
    }
    if (socket?.connected) {
      console.log('🚫 소켓 연결 중단: 이미 연결됨');
      return;
    }
    if (connectingRef.current) {
      console.log('⏳ 소켓 연결 진행 중, 대기...');
      return;
    }
    console.log('�🔌 소켓 연결 시도...', {
      hasToken: !!token,
      hasSocket: !!socket,
      socketConnected: socket?.connected,
      wsUrl: process.env.REACT_APP_WS_URL || 'http://localhost:4000'
    });
    // 기존 소켓이 있다면 재사용, 없다면 새로 생성
    console.log(socket ? '♻️ 기존 소켓 재사용...' : '✨ 새 소켓 생성...');
    const wsUrl = process.env.REACT_APP_WS_URL || 'https://quoridoronline-5ngr.onrender.com';
    const newSocket =
      socket ||
      io(wsUrl, {
        auth: { token },
        autoConnect: false, // 수동으로 connect() 호출
        // 인증 토큰 전달과 함께 CORS 자격 증명 사용
        withCredentials: true,
        // Force pure WebSocket transport to avoid CORS issues with XHR polling
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000
      } as any);
    console.log('🚀 소켓 연결 실행...');
    connectingRef.current = true;
    if (!newSocket.connected) {
      newSocket.connect();
    }

    newSocket.on('connect', () => {
      console.log('✅ 소켓 연결 성공:', newSocket.id);
      setIsConnected(true);
      connectingRef.current = false;
    });

    newSocket.on('disconnect', (reason: string) => {
      console.log('❌ 소켓 연결 해제:', reason);
      setIsConnected(false);
       connectingRef.current = false;
      // io client disconnect는 의도된 연결 해제이므로 소켓 인스턴스를 유지
      if (reason !== 'io client disconnect') {
        setSocket(null);
      }
    });

    newSocket.on('connect_error', (error: Error) => {
      console.error('❌ 소켓 연결 에러:', error.message);
      connectingRef.current = false;
      // 인증 에러 처리
      if (error.message.includes('인증')) {
        console.log('인증 오류로 인한 연결 실패. 로그인 정보 삭제.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        disconnectSocket();
      } else {
        // 인증 에러가 아니면 사용자에게 알림 표시
        if (window && window.dispatchEvent) {
          const event = new CustomEvent('socketError', { detail: error.message });
          window.dispatchEvent(event);
        }
        // socket.io의 내장 재연결 로직에 맡김
      }
    });

    newSocket.on('connect_timeout', () => {
      console.error('❌ 소켓 연결 타임아웃');
      connectingRef.current = false;
    });

    if (!socket) {
        setSocket(newSocket);
    }
  }, [socket, disconnectSocket]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      connectSocket();
    }

    // 컴포넌트 언마운트 시 소켓 정리
    return () => {
      if (socket?.connected) {
        console.log('언마운트로 인한 소켓 연결 해제');
        disconnectSocket();
      }
    };
  }, [connectSocket, disconnectSocket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
};
