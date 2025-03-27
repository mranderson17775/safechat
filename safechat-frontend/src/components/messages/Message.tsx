import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface MessageProps {
  id: string;
  content: string;
  timestamp: string;
  isOwnMessage: boolean;
  isRead: boolean;
  isRevoked: boolean;
  isExpired: boolean;
  isEncrypted: boolean;
  expiresAt?: string;
  isReadOnce?: boolean;
  onRevoke: (messageId: string) => void;
}

const Message: React.FC<MessageProps> = ({
  id,
  content,
  timestamp,
  isOwnMessage,
  isRead,
  isRevoked,
  isExpired,
  isEncrypted,
  expiresAt,
  isReadOnce,
  onRevoke
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Calculate and update time remaining until expiration
  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeRemaining = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diffMs = expiry.getTime() - now.getTime();

      if (diffMs <= 0) return 'Expired';

      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

      if (diffHrs > 0) {
        return `${diffHrs}h ${diffMins}m`;
      } else if (diffMins > 0) {
        return `${diffMins}m ${diffSecs}s`;
      } else {
        return `${diffSecs}s`;
      }
    };

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second for countdown effect
    const intervalId = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      // Stop interval if expired
      if (remaining === 'Expired') {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [expiresAt]);

  return (
    <div
      className={`mb-4 flex group ${
        isOwnMessage ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-xs p-3 rounded-lg ${
          isRevoked || isExpired
            ? 'bg-gray-200 text-gray-500 italic'
            : isOwnMessage
            ? 'bg-blue-500 text-white'
            : 'bg-gray-300'
        }`}
      >
        {isRevoked ? (
          'This message has been revoked'
        ) : isExpired ? (
          'This message has expired'
        ) : (
          <div>
            <div className="flex items-center">
              {isEncrypted && (
                <span className="mr-1 text-xs">
                  {isOwnMessage ? '🔒' : '🔒'}
                </span>
              )}
              <div>{content}</div>
            </div>

            {isReadOnce && (
              <div className="text-xs mt-1 italic">
                Read once message
              </div>
            )}

            {expiresAt && timeRemaining && (
              <div className={`text-xs mt-1 italic ${
                timeRemaining === 'Expired' ? 'text-red-400' : ''
              }`}>
                {timeRemaining === 'Expired' ? 'Expired' : `Expires in ${timeRemaining}`}
              </div>
            )}

            <div
              className={`text-xs mt-1 flex justify-between ${
                isOwnMessage ? 'text-blue-200' : 'text-gray-600'
              }`}
            >
              <span>{format(new Date(timestamp), 'HH:mm')}</span>
              {isOwnMessage && (
                <span className="ml-2">
                  {isRead ? '✓✓' : '✓'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {isOwnMessage && !isRevoked && !isExpired && showOptions && (
        <div className="ml-2 flex flex-col justify-end mb-2">
          <button
            onClick={() => onRevoke(id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onRevoke(id);
              }
            }}
            role="button"
            tabIndex={0} // Allow tab navigation
            className="text-xs text-gray-500 hover:text-red-500"
          >
            Revoke
          </button>
        </div>
      )}
    </div>
  );
};

export default Message;
