import mongoose from 'mongoose';
import config from './env';

export const connectDB = async () => {
  if (config.mongoURI) {
    try {
      await mongoose.connect(config.mongoURI);
      console.log('✅ MongoDB 연결 성공!');
    } catch (err) {
      console.error('MongoDB 연결 실패:', err);
      console.log('🎮 인증 기능 없이 게임만 진행 가능합니다.');
    }
  } else {
    console.log('MongoDB URI가 설정되지 않았습니다. 인증 기능 없이 게임만 진행 가능합니다.');
  }
};
