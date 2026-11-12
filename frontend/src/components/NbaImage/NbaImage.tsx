import { useState } from 'react';
import { getNbaPlayerHeadshotUrl, getNbaTeamLogoUrl, type NbaHeadshotSize } from '../../lib/nbaImages';
import styles from './NbaImage.module.css';

interface NbaImageProps {
  kind: 'player' | 'team';
  nbaId: number | null | undefined;
  alt: string;
  fallback: string;
  size?: NbaHeadshotSize;
  className?: string;
}

function getFallbackText(kind: NbaImageProps['kind'], text: string) {
  if (kind === 'team') return text.toUpperCase();

  return text
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function NbaImage({ kind, nbaId, alt, fallback, size = 'thumbnail', className }: NbaImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = kind === 'player' ? getNbaPlayerHeadshotUrl(nbaId, size) : getNbaTeamLogoUrl(nbaId);
  const classes = [styles.frame, className].filter(Boolean).join(' ');
  const fallbackText = getFallbackText(kind, fallback);

  if (!imageUrl || failedUrl === imageUrl) {
    return (
      <span className={`${classes} ${styles.fallbackFrame}`} role="img" aria-label={alt || fallback}>
        <span aria-hidden="true">{fallbackText}</span>
      </span>
    );
  }

  return (
    <span className={classes}>
      <img
        className={styles.image}
        data-kind={kind}
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(imageUrl)}
      />
    </span>
  );
}
