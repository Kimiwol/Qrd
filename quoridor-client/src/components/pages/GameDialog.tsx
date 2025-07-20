import React from 'react';
import { Dialog, DialogTitle, DialogMessage, DialogButtons, DialogButton } from './Game.styles';

interface GameDialogProps {
  winner: string | null;
  playerId: string | null;
  showQuitDialog: boolean;
  handleQuitCancel: () => void;
  handleQuitConfirm: () => void;
  navigate: any;
}

export default function GameDialog({ winner, playerId, showQuitDialog, handleQuitCancel, handleQuitConfirm, navigate }: GameDialogProps) {
  return (
    <>
      {winner && (
        <Dialog>
          <DialogTitle>게임 종료</DialogTitle>
          <DialogMessage>
            {winner === playerId ? '축하합니다! 당신이 이겼습니다!' : '아쉽게도 당신이 졌습니다.'}
          </DialogMessage>
          <DialogButtons>
            <DialogButton variant="confirm" onClick={() => navigate('/menu')}>
              확인
            </DialogButton>
          </DialogButtons>
        </Dialog>
      )}
      {showQuitDialog && (
        <Dialog>
          <DialogTitle>게임을 나가시겠습니까?</DialogTitle>
          <DialogMessage>
            게임을 나가면 패배로 처리됩니다.<br />
            정말로 나가시겠습니까?
          </DialogMessage>
          <DialogButtons>
            <DialogButton variant="cancel" onClick={handleQuitCancel}>
              취소
            </DialogButton>
            <DialogButton variant="confirm" onClick={handleQuitConfirm}>
              나가기
            </DialogButton>
          </DialogButtons>
        </Dialog>
      )}
    </>
  );
}
