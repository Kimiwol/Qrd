import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import mongoose from 'mongoose';

const router = Router();

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 입력값 검증
        if (!username || !email || !password) {
            return res.status(400).send({ 
                message: '모든 필드를 입력해주세요.' 
            });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).send({ 
                message: '사용자 이름은 3-20자 사이여야 합니다.' 
            });
        }

        // MongoDB 연결이 없을 때 임시 응답
        if (mongoose.connection.readyState !== 1) {
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

        // 기존 사용자 확인
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
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

        const user = new User({ username, email, password });
        await user.save();
        
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

        // 입력값 검증
        if (!email || !password) {
            return res.status(400).send({ 
                error: '이메일과 비밀번호를 모두 입력해주세요.' 
            });
        }

        // MongoDB 연결이 없을 때 임시 응답
        if (mongoose.connection.readyState !== 1) {
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

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).send({ 
                error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
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
