import { Router } from 'express';
import { auth } from '../middleware/auth';
import { User } from '../models/User';
import { Room } from '../models/Room';
import { GameMode, RoomStatus } from '../types';

const router = Router();

// 사용자 프로필 조회
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById((req as any).user._id).select('-password');
        if (!user) {
            return res.status(404).send({ error: '사용자를 찾을 수 없습니다.' });
        }

        const winRate = user.gamesPlayed > 0 ? (user.gamesWon / user.gamesPlayed * 100).toFixed(1) : '0.0';

        res.send({
            id: user._id,
            username: user.username,
            email: user.email,
            rating: user.rating,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            winRate: parseFloat(winRate),
            createdAt: user.createdAt
        });
    } catch (error) {
        res.status(500).send({ error: '프로필을 불러오는데 실패했습니다.' });
    }
});

// 랭킹 조회 (상위 10명)
router.get('/leaderboard', async (req, res) => {
    try {
        const topPlayers = await User.find({})
            .select('username rating gamesPlayed gamesWon')
            .sort({ rating: -1 })
            .limit(10);

        const leaderboard = topPlayers.map((player, index) => ({
            rank: index + 1,
            username: player.username,
            rating: player.rating,
            gamesPlayed: player.gamesPlayed,
            gamesWon: player.gamesWon,
            winRate: player.gamesPlayed > 0 ? 
                parseFloat((player.gamesWon / player.gamesPlayed * 100).toFixed(1)) : 0
        }));

        res.send(leaderboard);
    } catch (error) {
        res.status(500).send({ error: '랭킹을 불러오는데 실패했습니다.' });
    }
});

// 커스텀 방 생성
router.post('/room/create', auth, async (req, res) => {
    try {
        const userId = (req as any).user._id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).send({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 기존에 호스팅하는 방이 있는지 확인
        const existingRoom = await Room.findOne({ 
            host: userId.toString(),
            status: { $in: [RoomStatus.WAITING, RoomStatus.IN_PROGRESS] }
        });

        if (existingRoom) {
            return res.status(400).send({ 
                error: '이미 호스팅 중인 방이 있습니다.',
                roomCode: existingRoom.code
            });
        }

        // 새 방 코드 생성 (중복 확인)
        let roomCode;
        let attempts = 0;
        do {
            roomCode = (Room as any).generateRoomCode();
            const existingCodeRoom = await Room.findOne({ code: roomCode });
            if (!existingCodeRoom) break;
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            return res.status(500).send({ error: '방 코드 생성에 실패했습니다.' });
        }

        const room = new Room({
            code: roomCode,
            mode: GameMode.CUSTOM,
            host: userId.toString(),
            players: [userId.toString()],
            status: RoomStatus.WAITING
        });

        await room.save();

        res.send({
            roomId: room._id,
            code: room.code,
            message: `방이 생성되었습니다. 방 코드: ${room.code}`
        });
    } catch (error) {
        console.error('Room creation error:', error);
        res.status(500).send({ error: '방 생성에 실패했습니다.' });
    }
});

// 방 참여
router.post('/room/join', auth, async (req, res) => {
    try {
        const { code } = req.body;
        const userId = (req as any).user._id;

        if (!code) {
            return res.status(400).send({ error: '방 코드를 입력해주세요.' });
        }

        const room = await Room.findOne({ 
            code: code.toUpperCase(),
            status: RoomStatus.WAITING
        });

        if (!room) {
            return res.status(404).send({ error: '방을 찾을 수 없거나 이미 진행 중입니다.' });
        }

        if (room.players.includes(userId.toString())) {
            return res.status(400).send({ error: '이미 참여한 방입니다.' });
        }

        if (room.players.length >= room.maxPlayers) {
            return res.status(400).send({ error: '방이 가득 찼습니다.' });
        }

        room.players.push(userId.toString());
        await room.save();

        res.send({
            roomId: room._id,
            code: room.code,
            message: '방에 참여했습니다.'
        });
    } catch (error) {
        console.error('Room join error:', error);
        res.status(500).send({ error: '방 참여에 실패했습니다.' });
    }
});

// 내가 참여한 방 조회
router.get('/room/my', auth, async (req, res) => {
    try {
        const userId = (req as any).user._id;
        
        const room = await Room.findOne({
            players: userId.toString(),
            status: { $in: [RoomStatus.WAITING, RoomStatus.IN_PROGRESS] }
        }).populate('players', 'username rating');

        if (!room) {
            return res.send({ room: null });
        }

        res.send({ room });
    } catch (error) {
        res.status(500).send({ error: '방 정보를 불러오는데 실패했습니다.' });
    }
});

// 방 나가기
router.post('/room/leave', auth, async (req, res) => {
    try {
        const userId = (req as any).user._id;
        
        const room = await Room.findOne({
            players: userId.toString(),
            status: { $in: [RoomStatus.WAITING, RoomStatus.IN_PROGRESS] }
        });

        if (!room) {
            return res.status(404).send({ error: '참여 중인 방이 없습니다.' });
        }

        // 방장이 나가면 방 삭제
        if (room.host === userId.toString()) {
            await Room.findByIdAndDelete(room._id);
            return res.send({ message: '방이 삭제되었습니다.' });
        }

        // 일반 참여자가 나가면 플레이어 목록에서 제거
        room.players = room.players.filter(p => p !== userId.toString());
        await room.save();

        res.send({ message: '방에서 나갔습니다.' });
    } catch (error) {
        res.status(500).send({ error: '방 나가기에 실패했습니다.' });
    }
});

export default router;
