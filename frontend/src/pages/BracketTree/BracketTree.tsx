import { useEffect } from 'react';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { useTranslation } from '../../lib/i18n/i18n';
import { useBracketStore } from '../../stores/bracketStore';
import { useSessionStore } from '../../stores/sessionStore';
import { RoundColumn } from './components/RoundColumn/RoundColumn';
import styles from './BracketTree.module.css';

const roundTitleKeys = ['quarterfinals', 'semifinals', 'final'] as const;
const matchLabels = ['QF', 'SF', 'F'] as const;

export default function BracketTree() {
  const { t } = useTranslation();
  const activeSession = useSessionStore(
    (state) => state.recentSessions.find((session) => session.sessionHash === state.activeSessionHash) ?? null,
  );
  const bracket = useBracketStore((state) => state.bracket);
  const status = useBracketStore((state) => state.status);
  const isGenerating = useBracketStore((state) => state.isGenerating);
  const errorKey = useBracketStore((state) => state.errorKey);
  const loadBracket = useBracketStore((state) => state.loadBracket);
  const generateBracket = useBracketStore((state) => state.generateBracket);
  const resetBracket = useBracketStore((state) => state.reset);

  useEffect(() => {
    if (!activeSession) {
      resetBracket();
      return;
    }

    void loadBracket({ sessionHash: activeSession.sessionHash, userId: activeSession.userId });
  }, [activeSession, loadBracket, resetBracket]);

  const rounds = bracket?.rounds.map((round) => ({
    title: t(`bracket_tree.rounds.${roundTitleKeys[round.round_number] ?? 'final'}`),
    matches: round.matches.map((match) => ({
      matchNumber: `${matchLabels[round.round_number] ?? 'R'}-${match.slot + 1}`,
      teams: [match.home_team, match.away_team] as const,
    })),
  }));

  return (
    <AppShell
      activeNavItem="bracketTree"
      currentUserName={activeSession?.userName}
      sessionName={activeSession?.sessionName}
      sessionCode={activeSession?.sessionHash}
      onLeaveSession={() => useSessionStore.getState().leaveSession()}
    >
      <main className={styles.page}>
        <h1 className={styles.title}>{t('bracket_tree.title')}</h1>
        {!activeSession ? (
          <p className={styles.message}>{t('bracket_tree.no_session')}</p>
        ) : status === 'loading' || status === 'idle' ? (
          <p className={styles.message}>{t('bracket_tree.loading')}</p>
        ) : status === 'error' || !bracket ? (
          <p className={styles.message} role="alert">
            {t(errorKey ?? 'bracket_tree.errors.load_failed')}
          </p>
        ) : (
          <>
            {!bracket.generated && bracket.can_generate ? (
              <div className={styles.action}>
                <Button
                  variant="primary"
                  onClick={() =>
                    void generateBracket({
                      sessionHash: activeSession.sessionHash,
                      userId: activeSession.userId,
                    })
                  }
                  disabled={isGenerating}
                >
                  {t(isGenerating ? 'bracket_tree.generating' : 'bracket_tree.generate')}
                </Button>
              </div>
            ) : null}
            {!bracket.generated && !bracket.can_generate ? (
              <p className={styles.message}>{t('bracket_tree.owner_generates')}</p>
            ) : null}
            {errorKey ? (
              <p className={styles.error} role="alert">
                {t(errorKey)}
              </p>
            ) : null}
            <section className={styles.bracketGrid} aria-label={t('bracket_tree.sections.bracket')}>
              {rounds?.map((round, index) => (
                <RoundColumn key={index} {...round} tbdLabel={t('bracket_tree.tbd')} />
              ))}
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
