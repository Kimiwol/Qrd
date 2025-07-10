import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import mongoose from 'mongoose';

const router = Router();

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        console.log('Register request received:', { username, email, password: '***' });

        // 입력값 검증
        if (!username || !email || !password) {
            console.log('Validation failed: missing fields');
            return res.status(400).send({ 
                message: '모든 필드를 입력해주세요.' 
            });
        }

        if (username.length < 3 || username.length > 20) {
            console.log('Validation failed: username length');
            return res.status(400).send({ 
                message: '사용자 이름은 3-20자 사이여야 합니다.' 
            });
        }

        // MongoDB 연결이 없을 때 임시 응답
        if (mongoose.connection.readyState !== 1) {
            console.log('MongoDB not connected, using temp account');
            const tempUser = {
                _id: 'temp_' + Date.now(),
                username,
                email
            };
            const token = jwt.sign({ _id: tempUser._id }, process.env.JWT_SECRET || 'temp_secret');
            return res.send({ 
                user: tempUser, 
                token,
                message: '임시 계정으로 로그인되었습니다. (MongoDB 연결 필요)'
            });
        }

        console.log('Checking for existing user...');
        
        // 테스트 계정 생성 (test@test.com)
        if (email === 'test@test.com') {
            console.log('Creating test account');
            const testUser = {
                _id: 'test_user_id',
                username: 'testuser',
                email: 'test@test.com',
                rating: 1200,
                gamesPlayed: 0,
                gamesWon: 0,
                winRate: 0,
                createdAt: new Date().toISOString()
            };
            const token = jwt.sign({ _id: testUser._id }, process.env.JWT_SECRET || 'temp_secret');
            return res.send({ 
                user: testUser, 
                token,
                message: '테스트 계정이 생성되었습니다.'
            });
        }
        
        // 기존 사용자 확인
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            console.log('User already exists:', existingUser.email);
            if (existingUser.email === email) {
                return res.status(400).send({ 
                    message: '이미 사용 중인 이메일입니다.' 
                });
            }
            if (existingUser.username === username) {
                return res.status(400).send({ 
                    message: '이미 사용 중인 사용자 이름입니다.' 
                });
            }
        }

        console.log('Creating new user...');
        const user = new User({ username, email, password });
        await user.save();
        console.log('User created successfully');
        
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET!);
        res.send({ user, token });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).send({ 
            message: '회원가입에 실패했습니다. 다시 시도해주세요.' 
        });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login request received:', { email, password: '***' });

        // 입력값 검증
        if (!email || !password) {
            console.log('Validation failed: missing email or password');
            return res.status(400).send({ 
                error: '이메일과 비밀번호를 모두 입력해주세요.' 
            });
        }

        // MongoDB 연결이 없을 때 임시 응답
        if (mongoose.connection.readyState !== 1) {
            console.log('MongoDB not connected, using temp account for login');
            const tempUser = {
                _id: 'temp_' + Date.now(),
                username: email.split('@')[0],
                email
            };
            const token = jwt.sign({ _id: tempUser._id }, process.env.JWT_SECRET || 'temp_secret');
            return res.send({ 
                user: tempUser, 
                token,
                message: '임시 계정으로 로그인되었습니다. (MongoDB 연결 필요)'
            });
        }

        console.log('Looking for user in database...');

        // 임시 테스트 계정 추가
        if (email === 'test@test.com' && password === 'test123') {
            console.log('Using test account');
            const testUser = {
                _id: 'test_user_id',
                username: 'testuser',
                email: 'test@test.com',
                rating: 1200,
                gamesPlayed: 0,
                gamesWon: 0,
                winRate: 0,
                createdAt: new Date().toISOString()
            };
            const token = jwt.sign({ _id: testUser._id }, process.env.JWT_SECRET || 'temp_secret');
            return res.send({ 
                user: testUser, 
                token,
                message: '테스트 계정으로 로그인되었습니다.'
            });
        }

        const user = await User.findOne({ email });
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('User not found for email:', email);
            return res.status(401).send({ 
                error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }

        console.log('Checking password...');
        const isMatch = await user.comparePassword(password);
        console.log('Password match:', isMatch);
        if (!isMatch) {
            console.log('Password does not match');
            return res.status(401).send({ 
                error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }
        
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET!);
        res.send({ user, token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(400).send({ 
            error: '로그인에 실패했습니다. 다시 시도해주세요.' 
        });
    }
});

export default router;
