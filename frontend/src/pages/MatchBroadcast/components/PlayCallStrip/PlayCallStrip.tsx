import { useTranslation } from '../../../../lib/i18n/i18n';
import { mockMatchData } from '../../data/mockMatchData';
import styles from '../../MatchBroadcast.module.css';

export function PlayCallStrip() {
  const { t } = useTranslation();

  return (
    <section className={styles.playCall}>
      <span>
        <b>{t('match_broadcast.play_call.label')}</b> {mockMatchData.playCall}{' '}
        <em>
          {mockMatchData.shotProbability}% {t('match_broadcast.play_call.probability_label')}
        </em>
      </span>
      <span>
        <b>{t('match_broadcast.play_call.defense_label')}</b> {mockMatchData.defensiveScheme}
      </span>
    </section>
  );
}
