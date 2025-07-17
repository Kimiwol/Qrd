import React from 'react';

interface NotificationProps {
  notification: { type: string; message: string } | null;
}

const Notification: React.FC<NotificationProps> = ({ notification }) => (
  notification ? (
    <div className={`notification notification-${notification.type}`}>
      {notification.message}
    </div>
  ) : null
);

export default Notification;
