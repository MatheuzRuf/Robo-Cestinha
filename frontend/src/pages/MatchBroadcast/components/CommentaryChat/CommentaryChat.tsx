import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from './CommentaryChat.module.css';

interface CommentaryChatProps {
  messages: CommentaryMessage[];
  currentFrame: number;
  isTyping: boolean;
}

interface CommentaryMessage {
  frame: number;
  text: string;
}

export function CommentaryChat({ messages, currentFrame, isTyping }: CommentaryChatProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const visibleMessages = isTyping ? [...messages, { frame: currentFrame, text: '…' }] : messages;

  useLayoutEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [isExpanded, isTyping, messages]);

  return (
    <section className={styles.panel} aria-label={t('match_broadcast.commentary.title')}>
      <header className={styles.header}>
        <h2 className={styles.heading}>{t('match_broadcast.commentary.title')}</h2>
        <button
          className={styles.toggle}
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
          aria-label={t(
            isExpanded ? 'match_broadcast.commentary.collapse' : 'match_broadcast.commentary.expand',
          )}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
      </header>
      <ol
        className={`${styles.messages} ${isExpanded ? styles.expanded : styles.collapsed}`}
        ref={listRef}
        aria-live="polite"
        aria-relevant="additions text"
      >
        {(isExpanded ? visibleMessages : visibleMessages.slice(-1)).map((message, index) => (
          <li
            className={`${styles.message} ${message.text === '…' ? styles.typing : ''} ${
              message.frame === currentFrame ? styles.currentMessage : ''
            }`}
            key={`${message.frame}-${index}`}
            aria-current={message.frame === currentFrame ? 'step' : undefined}
            aria-label={
              message.text === '…'
                ? t('match_broadcast.commentary.typing')
                : t('match_broadcast.commentary.frame_message', {
                    frame: message.frame,
                    message: message.text,
                  })
            }
          >
            <span className={styles.frameNumber}>{message.frame}</span>
            <span className={styles.messageText}>{message.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
