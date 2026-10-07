import { useTranslation } from '../../../../lib/i18n/i18n';
import styles from '../../MatchBroadcast.module.css';

interface PlayCallStripProps {
  playCall: string;
  shotProbability: number;
  defensiveScheme: string;
}

export function PlayCallStrip({ playCall, shotProbability, defensiveScheme }: PlayCallStripProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.playCall}>
      <span>
        <b>{t('match_broadcast.play_call.label')}</b> {playCall}{' '}
        <em>
          {shotProbability}% {t('match_broadcast.play_call.probability_label')}
        </em>
      </span>
      <span>
        <b>{t('match_broadcast.play_call.defense_label')}</b> {defensiveScheme}
      </span>
    </section>
  );
}
