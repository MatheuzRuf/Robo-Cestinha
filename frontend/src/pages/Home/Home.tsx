import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CheckboxRow } from '../../components/CheckboxRow';
import { Chip } from '../../components/Chip';
import { Modal } from '../../components/Modal';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatusBadge } from '../../components/StatusBadge';
import { TextInput } from '../../components/TextInput';
import { normalizeSessionCode, sessionService } from '../../services/sessionService';
import { useSessionStore } from '../../stores/sessionStore';
import type { SessionDescriptor, SessionSettings } from '../../types/session';
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
  const [simSpeed, setSimSpeed] = useState<SessionSettings['simSpeed']>('normal');
  const [quarterLength, setQuarterLength] = useState<SessionSettings['quarterLength']>('3');
  const [autoFill, setAutoFill] = useState(true);
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
  const { data: featuredSessionCodes = [] } = useQuery({
    queryKey: ['featured-sessions'],
    queryFn: sessionService.getFeaturedSessionCodes,
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
    mutationFn: ({ userName, settings }: { userName: string; settings: SessionSettings }) =>
      useSessionStore.getState().createSession(userName, settings),
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
      createSessionMutation.mutate({
        userName,
        settings: { simSpeed, quarterLength, autoFill },
      });
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
    <AppShell activeNavItem="home" currentUserName={activeSession?.userName} sessionCode={activeSession?.sessionHash}>
      <div className={styles.page}>
        <section className={styles.heroSection}>
          <h1 className={styles.heroTitle}>
            <span>{t('home.hero.line_1')}</span>
            <span>{t('home.hero.line_2')}</span>
          </h1>
          <p className={styles.heroSubtitle}>{t('home.hero.subtitle')}</p>
        </section>

        {activeSession ? (
          <section className={styles.activeSessionSection} aria-label={t('home.active_session.title')}>
            <Card>
              <div className={styles.activeSessionContent}>
                <div>
                  <StatusBadge tone="info">{t('home.active_session.badge')}</StatusBadge>
                  <h2>{activeSession.sessionName ?? t('home.active_session.unnamed')}</h2>
                  <p>{t('home.active_session.description', { name: activeSession.userName })}</p>
                </div>
                <span className={styles.activeSessionCode}>{activeSession.sessionHash}</span>
              </div>
            </Card>
          </section>
        ) : null}

        <section className={styles.actionsSection}>
          <Card>
            <div className={styles.cardStack}>
              <div className={styles.cardTitleRow}>
                <StatusBadge tone="info">⌂</StatusBadge>
                <h2>{t('home.host.title')}</h2>
              </div>
              <p className={styles.cardDescription}>{t('home.host.description')}</p>
              <SegmentedControl
                label={t('home.host.sim_speed_label')}
                options={[
                  { value: 'normal', label: t('home.host.normal_speed') },
                  { value: 'blitz', label: t('home.host.blitz_speed') },
                ]}
                value={simSpeed}
                onChange={(value) => setSimSpeed(value as SessionSettings['simSpeed'])}
              />
              <SegmentedControl
                label={t('home.host.quarter_length_label')}
                options={[
                  { value: '3', label: t('home.host.three_minutes') },
                  { value: '5', label: t('home.host.five_minutes') },
                ]}
                value={quarterLength}
                onChange={(value) => setQuarterLength(value as SessionSettings['quarterLength'])}
              />
              <CheckboxRow
                title={t('home.host.auto_fill_title')}
                description={t('home.host.auto_fill_description')}
                checked={autoFill}
                onChange={setAutoFill}
              />
              <Button variant="primary" onClick={handleCreate} fullWidth>
                {t('home.host.cta')}
              </Button>
            </div>
          </Card>

          <Card>
            <div className={styles.cardStack}>
              <div className={styles.cardTitleRow}>
                <StatusBadge tone="info">↪</StatusBadge>
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
                trailingAction={{ icon: '📋', label: t('common.paste'), onClick: () => void handlePaste() }}
              />
              {joinError ? (
                <p className={styles.errorMessage} role="alert">
                  {t(joinError)}
                </p>
              ) : null}
              <div className={styles.featuredRow}>
                <span className={styles.featuredLabel}>{t('home.join.featured_label')}</span>
                {featuredSessionCodes.map((code) => (
                  <Chip
                    key={code}
                    label={code}
                    onClick={() => {
                      setSessionCode(code);
                      setJoinError(null);
                    }}
                  />
                ))}
              </div>
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
