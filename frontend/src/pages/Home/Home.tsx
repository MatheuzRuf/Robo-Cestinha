import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Clipboard, Home as HomeIcon, LogIn, UsersRound } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { TextInput } from '../../components/TextInput';
import { normalizeSessionCode, sessionService } from '../../services/sessionService';
import { useSessionStore } from '../../stores/sessionStore';
import type { SessionDescriptor } from '../../types/session';
import { useTranslation } from '../../lib/i18n/i18n';
import { SessionCard } from './components/SessionCard';
import styles from './Home.module.css';

const MAX_USER_NAME_LENGTH = 24;

type PendingAction = 'create' | 'join' | null;

function getErrorKey(error: unknown) {
  if (!(error instanceof Error)) return 'home.errors.action_failed';

  switch (error.message) {
    case 'session_storage_unavailable':
      return 'home.errors.storage_unavailable';
    case 'session_not_found':
      return 'home.errors.session_not_found';
    case 'saved_identity_not_found':
      return 'home.errors.saved_session_not_found';
    default:
      return 'home.errors.action_failed';
  }
}

function formatLastVisited(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function Home() {
  const { t, locale } = useTranslation();
  const [sessionCode, setSessionCode] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [joinTarget, setJoinTarget] = useState<SessionDescriptor | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const recentSessions = useSessionStore((state) => state.recentSessions);
  const activeSessionHash = useSessionStore((state) => state.activeSessionHash);
  const activeSession = recentSessions.find((session) => session.sessionHash === activeSessionHash) ?? null;
  const participantsQuery = useQuery({
    queryKey: ['sessionParticipants', activeSession?.sessionHash],
    queryFn: () =>
      activeSession ? sessionService.getSessionParticipants(activeSession.sessionHash) : Promise.resolve([]),
    enabled: Boolean(activeSession),
  });

  const lookupSessionMutation = useMutation({
    mutationFn: async (code: string) => {
      const session = await useSessionStore.getState().findSession(code);
      if (!session) throw new Error('session_not_found');
      return session;
    },
    onSuccess: (session) => {
      setJoinTarget(session);
      setPendingAction('join');
      setNameDraft('');
      setNameError(null);
      setNameModalOpen(true);
    },
    onError: (error) => setJoinError(getErrorKey(error)),
  });

  const createSessionMutation = useMutation({
    mutationFn: (userName: string) => useSessionStore.getState().createSession(userName),
    onSuccess: () => closeNameModal(),
    onError: (error) => setNameError(getErrorKey(error)),
  });

  const joinSessionMutation = useMutation({
    mutationFn: ({ session, userName }: { session: SessionDescriptor; userName: string }) =>
      useSessionStore.getState().joinSession(session, userName),
    onSuccess: () => closeNameModal(),
    onError: (error) => setNameError(getErrorKey(error)),
  });

  const isNameSubmitting = createSessionMutation.isPending || joinSessionMutation.isPending;

  function closeNameModal() {
    setNameModalOpen(false);
    setPendingAction(null);
    setJoinTarget(null);
    setNameError(null);
  }

  const handleCreate = () => {
    setPendingAction('create');
    setNameDraft('');
    setNameError(null);
    setNameModalOpen(true);
  };

  const handleJoin = () => {
    setJoinError(null);
    const normalizedCode = normalizeSessionCode(sessionCode);
    if (!normalizedCode) {
      setJoinError('home.errors.invalid_session_code');
      return;
    }

    const savedMembership = useSessionStore.getState().getSavedMembership(normalizedCode);
    if (savedMembership) {
      try {
        useSessionStore.getState().resumeSession(normalizedCode);
      } catch (error) {
        setJoinError(getErrorKey(error));
      }
      return;
    }

    lookupSessionMutation.mutate(normalizedCode);
  };

  const submitName = () => {
    const userName = nameDraft.trim();
    if (!userName) {
      setNameError('home.errors.name_required');
      return;
    }
    if (userName.length > MAX_USER_NAME_LENGTH) {
      setNameError('home.errors.name_too_long');
      return;
    }

    setNameError(null);
    if (pendingAction === 'create') {
      createSessionMutation.mutate(userName);
      return;
    }

    if (pendingAction === 'join' && joinTarget) {
      joinSessionMutation.mutate({ session: joinTarget, userName });
    }
  };

  const handleResume = (code: string) => {
    try {
      useSessionStore.getState().resumeSession(code);
    } catch (error) {
      setJoinError(getErrorKey(error));
    }
  };

  const handlePaste = async () => {
    setJoinError(null);
    try {
      setSessionCode(await navigator.clipboard.readText());
    } catch {
      setJoinError('home.errors.paste_failed');
    }
  };

  return (
    <AppShell
      activeNavItem="home"
      currentUserName={activeSession?.userName}
      sessionName={activeSession?.sessionName}
      sessionCode={activeSession?.sessionHash}
      onLeaveSession={() => useSessionStore.getState().leaveSession()}
    >
      <div className={styles.page}>
        <section className={styles.heroSection}>
          <h1 className={styles.heroTitle}>
            <span>{t('home.hero.line_1')}</span>
            <span>{t('home.hero.line_2')}</span>
          </h1>
          <p className={styles.heroSubtitle}>{t('home.hero.subtitle')}</p>
        </section>

        {activeSession ? (
          <section className={styles.playersSection} aria-labelledby="session-players-heading">
            <Card>
              <div className={styles.playersCard}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardIcon} aria-hidden="true">
                    <UsersRound size={16} />
                  </span>
                  <h2 id="session-players-heading">{t('home.players.title')}</h2>
                </div>
                {participantsQuery.isPending ? (
                  <p className={styles.playerMessage} role="status">
                    {t('home.players.loading')}
                  </p>
                ) : participantsQuery.isError ? (
                  <div className={styles.playerError}>
                    <p className={styles.errorMessage} role="alert">
                      {t('home.players.load_failed')}
                    </p>
                    <Button variant="outline" onClick={() => void participantsQuery.refetch()}>
                      {t('home.players.retry')}
                    </Button>
                  </div>
                ) : participantsQuery.data?.length ? (
                  <ol className={styles.playerList}>
                    {participantsQuery.data.map((participant) => (
                      <li className={styles.playerRow} key={participant.userId}>
                        <span className={styles.playerSequence}>#{participant.joinSequence}</span>
                        <span className={styles.playerName}>{participant.userName}</span>
                        {participant.isOwner ? (
                          <span className={styles.ownerLabel}>{t('home.players.owner')}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.playerMessage}>{t('home.players.empty')}</p>
                )}
              </div>
            </Card>
          </section>
        ) : null}

        <section className={styles.actionsSection}>
          <Card>
            <div className={styles.cardStack}>
              <div className={styles.cardTitleRow}>
                <span className={styles.cardIcon} aria-hidden="true">
                  <HomeIcon size={16} />
                </span>
                <h2>{t('home.host.title')}</h2>
              </div>
              <p className={styles.cardDescription}>{t('home.host.description')}</p>
              <Button variant="primary" onClick={handleCreate} fullWidth>
                {t('home.host.cta')}
              </Button>
            </div>
          </Card>

          <Card>
            <div className={styles.cardStack}>
              <div className={styles.cardTitleRow}>
                <span className={styles.cardIcon} aria-hidden="true">
                  <LogIn size={16} />
                </span>
                <h2>{t('home.join.title')}</h2>
              </div>
              <p className={styles.cardDescription}>{t('home.join.description')}</p>
              <TextInput
                label={t('home.join.input_label')}
                hint={t('home.join.input_hint')}
                placeholder={t('home.join.input_placeholder')}
                value={sessionCode}
                onChange={(value) => {
                  setSessionCode(value);
                  setJoinError(null);
                }}
                trailingAction={{
                  icon: <Clipboard size={16} aria-hidden="true" />,
                  label: t('common.paste'),
                  onClick: () => void handlePaste(),
                }}
              />
              {joinError ? (
                <p className={styles.errorMessage} role="alert">
                  {t(joinError)}
                </p>
              ) : null}
              <Button variant="secondary" onClick={handleJoin} disabled={lookupSessionMutation.isPending} fullWidth>
                {lookupSessionMutation.isPending ? t('home.join.checking') : t('home.join.cta')}
              </Button>
            </div>
          </Card>
        </section>

        <section className={styles.recentSection}>
          <div className={styles.recentHeadingRow}>
            <div>
              <div className={styles.eyebrow}>{t('home.recent.eyebrow')}</div>
              <h2>{t('home.recent.heading')}</h2>
            </div>
            <div className={styles.savedNote}>{t('home.recent.saved_note')}</div>
          </div>
          {recentSessions.length ? (
            <div className={styles.recentGrid}>
              {recentSessions.map((session) => (
                <SessionCard
                  key={session.sessionHash}
                  sessionCode={session.sessionHash}
                  sessionName={session.sessionName ?? t('home.session_card.unnamed')}
                  isActive={session.sessionHash === activeSessionHash}
                  activeLabel={t('home.session_card.active')}
                  currentLabel={t('home.session_card.current')}
                  savedLabel={t('home.session_card.saved')}
                  joinedAsLabel={t('home.session_card.joined_as', { name: session.userName })}
                  lastVisitedLabel={t('home.session_card.last_visited', {
                    date: formatLastVisited(session.lastVisitedAt, locale),
                  })}
                  resumeLabel={t('home.session_card.resume')}
                  onResume={() => handleResume(session.sessionHash)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <div className={styles.emptyState}>
                <h3>{t('home.recent.empty_title')}</h3>
                <p>{t('home.recent.empty_description')}</p>
              </div>
            </Card>
          )}
        </section>
      </div>

      <Modal
        title={t(pendingAction === 'join' ? 'home.name_modal.join_title' : 'home.name_modal.create_title')}
        open={nameModalOpen}
        onClose={() => {
          if (!isNameSubmitting) closeNameModal();
        }}
        closeLabel={t('common.close')}
      >
        <form
          className={styles.modalStack}
          onSubmit={(event) => {
            event.preventDefault();
            submitName();
          }}
        >
          <p className={styles.modalDescription}>{t('home.name_modal.description')}</p>
          <TextInput
            label={t('home.name_modal.label')}
            placeholder={t('home.name_modal.placeholder')}
            maxLength={MAX_USER_NAME_LENGTH}
            value={nameDraft}
            onChange={(value) => {
              setNameDraft(value);
              setNameError(null);
            }}
          />
          {nameError ? (
            <p className={styles.errorMessage} role="alert">
              {t(nameError)}
            </p>
          ) : null}
          <Button variant="primary" type="submit" disabled={isNameSubmitting} fullWidth>
            {isNameSubmitting ? t('home.name_modal.submitting') : t('home.name_modal.cta')}
          </Button>
        </form>
      </Modal>
    </AppShell>
  );
}
