import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../../models/User';

export class AuthHandler {
  static async authenticateSocket(socket: Socket, next: (err?: Error) => void) {
    try {
      console.log('🔐 소켓 인증 시작:', socket.id);
      
      const token = socket.handshake.auth.token;
      console.log('📝 토큰 존재 여부:', !!token);
      
      if (!token) {
        throw new Error('인증이 필요합니다.');
      }

      console.log('🔍 JWT 검증 시작...');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'temp_secret') as { _id: string };
      console.log('✅ JWT 검증 성공:', decoded._id);
      
      // MongoDB 연결이 없을 때는 토큰만 검증
      if (mongoose.connection.readyState !== 1) {
        console.log('📦 MongoDB 연결 없음, 토큰만 검증');
        (socket as any).userId = decoded._id;
        next();
        return;
      }
      
      console.log('🔍 사용자 조회 중...');
      const user = await User.findById(decoded._id);
      
      if (!user) {
        console.log('❌ 사용자를 찾을 수 없음:', decoded._id);
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      console.log('✅ 사용자 찾음:', user._id);
      (socket as any).userId = user._id;
      next();
    } catch (error) {
      console.error('❌ 소켓 인증 실패:', error instanceof Error ? error.message : error);
      next(new Error('인증이 필요합니다.'));
    }
  }

  static async loadUserRating(socket: Socket) {
    try {
      const userId = (socket as any).userId;
      if (!userId || mongoose.connection.readyState !== 1) {
        (socket as any).rating = 1200; // 기본값
        (socket as any).username = `Guest_${userId?.toString().slice(-4) ?? '????'}`;
        return;
      }
      const user = await User.findById(userId);
      if (user) {
        (socket as any).rating = user.rating;
        (socket as any).username = user.username;
        console.log(`[AuthHandler] 🙋‍♂️ 사용자 정보 로드: ${user.username} (레이팅: ${user.rating})`);
      } else {
        (socket as any).rating = 1200;
        (socket as any).username = `User_${userId.toString().slice(-4)}`;
        console.log(`[AuthHandler] 🤷‍♂️ DB에 없는 사용자, 기본값 설정: ${(socket as any).username}`);
      }
    } catch (error) {
      console.error('[AuthHandler] ❌ 레이팅 로드 실패:', error);
      (socket as any).rating = 1200;
      (socket as any).username = `User_${(socket as any).userId?.toString().slice(-4) ?? '????'}`;
    }
  }
}
