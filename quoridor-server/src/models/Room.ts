import mongoose from 'mongoose';
import { GameMode, RoomStatus } from '../types';

export interface IRoom extends mongoose.Document {
    code: string;
    mode: GameMode;
    host: string;
    players: string[];
    status: RoomStatus;
    maxPlayers: number;
    gameState?: any;
    createdAt: Date;
    updatedAt: Date;
}

const roomSchema = new mongoose.Schema<IRoom>({
    code: {
        type: String,
        required: true,
        unique: true,
        length: 6
    },
    mode: {
        type: String,
        enum: Object.values(GameMode),
        required: true
    },
    host: {
        type: String,
        required: true
    },
    players: [{
        type: String,
        required: true
    }],
    status: {
        type: String,
        enum: Object.values(RoomStatus),
        default: RoomStatus.WAITING
    },
    maxPlayers: {
        type: Number,
        default: 2
    },
    gameState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true
});

// 6자리 랜덤 방 코드 생성
roomSchema.statics.generateRoomCode = function(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const Room = mongoose.model<IRoom>('Room', roomSchema);
