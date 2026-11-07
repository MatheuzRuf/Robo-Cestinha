import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { useTranslation } from '../../lib/i18n/i18n';
import { useBracketStore } from '../../stores/bracketStore';
import { useSessionStore } from '../../stores/sessionStore';
import type { BracketSnapshot } from '../../types/bracket';
import styles from './MatchBroadcast.module.css';

function findLiveMatchId(bracket: BracketSnapshot | null): string | null {
  if (!bracket) return null;

  // Prefer the next playable match, then replay the first finished one. This
  // skips future rounds that are still locked (their teams are not assigned).
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      if (match.match_id && match.status === 'ready') return match.match_id;
    }
  }
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      if (match.match_id && match.status === 'finished') return match.match_id;
    }
  }

  return null;
}

export default function LiveMatchEntry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeSession = useSessionStore(
    (state) => state.recentSessions.find((session) => session.sessionHash === state.activeSessionHash) ?? null,
  );
  const bracket = useBracketStore((state) => state.bracket);
  const status = useBracketStore((state) => state.status);
  const errorKey = useBracketStore((state) => state.errorKey);
  const loadBracket = useBracketStore((state) => state.loadBracket);
  const resetBracket = useBracketStore((state) => state.reset);

  useEffect(() => {
    if (!activeSession) {
      resetBracket();
      return;
    }
    void loadBracket({ sessionHash: activeSession.sessionHash, userId: activeSession.userId });
  }, [activeSession, loadBracket, resetBracket]);

  if (!activeSession) {
    return (
      <main className={styles.page}>
        <div className={styles.statusMessage} role="status">
          {t('match_broadcast.simulation.no_active_session')}
        </div>
      </main>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <main className={styles.page}>
        <div className={styles.statusMessage} role="status">
          {t('match_broadcast.simulation.loading')}
        </div>
      </main>
    );
  }

  if (status === 'error' || !bracket) {
    return (
      <main className={styles.page}>
        <div className={styles.errorState} role="alert">
          <p>{t(errorKey ?? 'match_broadcast.simulation.error')}</p>
          <Button variant="outline" onClick={() => navigate('/bracket-tree')}>
            {t('match_broadcast.simulation.go_to_bracket')}
          </Button>
        </div>
      </main>
    );
  }

  const matchId = findLiveMatchId(bracket);
  if (!matchId) {
    return (
      <main className={styles.page}>
        <div className={styles.errorState} role="alert">
          <p>{t('match_broadcast.simulation.no_match')}</p>
          <Button variant="outline" onClick={() => navigate('/bracket-tree')}>
            {t('match_broadcast.simulation.go_to_bracket')}
          </Button>
        </div>
      </main>
    );
  }

  return <Navigate to={`/matches/${matchId}`} replace />;
}