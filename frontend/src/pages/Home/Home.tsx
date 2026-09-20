import { useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CheckboxRow } from '../../components/CheckboxRow';
import { Chip } from '../../components/Chip';
import { Modal } from '../../components/Modal';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatusBadge } from '../../components/StatusBadge';
import { TextInput } from '../../components/TextInput';
import { useTranslation } from '../../lib/i18n/i18n';
import { SessionCard } from './components/SessionCard';
import styles from './Home.module.css';

const RECENT_SESSIONS = [
  {
    sessionCode: '#RC-9104-TEX',
    sessionName: 'LONESTAR INVITATIONAL',
    status: { tone: 'live' as const, label: 'LIVE · SEMI-FINALS' },
    detailLine: 'Court 1: Austin Armadillos vs Dallas Drifters',
    primaryStat: { label: 'AUSTIN ARMADILLOS', value: 'Your Claimed Club' },
    secondaryStat: { label: '', value: '74 : 71', highlight: true },
    footerLeft: 'Q4 01:24',
    footerRight: '7/8 Teams Claimed',
    ctaKey: 'resume_broadcast' as const,
    ctaVariant: 'primary' as const,
  },
  {
    sessionCode: '#RC-4421-CHI',
    sessionName: 'RUSTBELT CLASSIC',
    status: { tone: 'complete' as const, label: 'FINAL RESULTS' },
    detailLine: 'Championship Final Series Complete',
    primaryStat: { label: 'CHICAGO STEEL', value: 'CHAMPION WINNER' },
    secondaryStat: { label: '', value: '104 - 98', highlight: false },
    footerLeft: '7 Games Logged',
    footerRight: 'Stats Vault Ready',
    ctaKey: 'view_replay_bracket' as const,
    ctaVariant: 'outline' as const,
  },
  {
    sessionCode: '#RC-2089-SEA',
    sessionName: 'EMERALD COAST 8',
    status: { tone: 'paused' as const, label: 'PAUSED · ROUND OF 8' },
    detailLine: 'Lobby waiting for Tip-Off command',
    primaryStat: { label: 'SEATTLE TOTEMS', value: 'Locker Slot #03' },
    secondaryStat: { label: '', value: '8/8 READY', highlight: false },
    footerLeft: 'All Rosters Full',
    footerRight: 'Paused Today',
    ctaKey: 'continue_lobby' as const,
    ctaVariant: 'secondary' as const,
  },
];

function getSavedName() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('robo-cestinha-display-name') ?? '';
}

export default function Home() {
  const { t } = useTranslation();
  const [simSpeed, setSimSpeed] = useState<'normal' | 'blitz'>('normal');
  const [quarterLength, setQuarterLength] = useState<'3' | '5'>('3');
  const [autoFill, setAutoFill] = useState(true);
  const [sessionCode, setSessionCode] = useState('');
  const [displayName, setDisplayName] = useState(getSavedName());
  const [nameDraft, setNameDraft] = useState(displayName);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | 'create' | 'join'>(null);

  const featuredSessions = ['#RC-7842-OAK', '#RC-9104-TEX'];

  const recentCards = useMemo(() => RECENT_SESSIONS.slice(0, 3), []);

  const requireName = (action: 'create' | 'join') => {
    const saved = displayName.trim();
    if (!saved) {
      setPendingAction(action);
      setNameDraft('');
      setNameModalOpen(true);
      return false;
    }
    return true;
  };

  const submitName = () => {
    const nextName = nameDraft.trim();
    if (!nextName) return;
    window.localStorage.setItem('robo-cestinha-display-name', nextName);
    setDisplayName(nextName);
    setNameModalOpen(false);
    if (pendingAction) {
      setPendingAction(null);
    }
  };

  const handleCreate = () => {
    if (!requireName('create')) return;
  };

  const handleJoin = () => {
    if (!requireName('join')) return;
  };

  return (
    <AppShell activeNavItem="home" onlineCount={{ current: 8, total: 8 }} sessionCode="#RC-7842-OAK">
      <div className={styles.page}>
        <section className={styles.heroSection}>
          <h1 className={styles.heroTitle}>
            <span>{t('home.hero.line_1')}</span>
            <span>{t('home.hero.line_2')}</span>
          </h1>
          <p className={styles.heroSubtitle}>{t('home.hero.subtitle')}</p>
        </section>

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
                  { value: 'normal', label: 'NORMAL 1X' },
                  { value: 'blitz', label: 'BLITZ 2X' },
                ]}
                value={simSpeed}
                onChange={(value) => setSimSpeed(value as 'normal' | 'blitz')}
              />
              <SegmentedControl
                label={t('home.host.quarter_length_label')}
                options={[
                  { value: '3', label: '3 MINS' },
                  { value: '5', label: '5 MINS' },
                ]}
                value={quarterLength}
                onChange={(value) => setQuarterLength(value as '3' | '5')}
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
                onChange={setSessionCode}
                trailingAction={{
                  icon: '📋',
                  label: t('common.paste'),
                  onClick: async () => {
                    const text = await navigator.clipboard.readText();
                    setSessionCode(text);
                  },
                }}
              />
              <div className={styles.featuredRow}>
                <span className={styles.featuredLabel}>{t('home.join.featured_label')}</span>
                {featuredSessions.map((code) => (
                  <Chip key={code} label={code} onClick={() => setSessionCode(code)} />
                ))}
              </div>
              <Button variant="secondary" onClick={handleJoin} fullWidth>
                {t('home.join.cta')}
              </Button>
            </div>
          </Card>
        </section>

        {recentCards.length ? (
          <section className={styles.recentSection}>
            <div className={styles.recentHeadingRow}>
              <div>
                <div className={styles.eyebrow}>{t('home.recent.eyebrow')}</div>
                <h2>{t('home.recent.heading')}</h2>
              </div>
              <div className={styles.savedNote}>{t('home.recent.saved_note')}</div>
            </div>
            <div className={styles.recentGrid}>
              {recentCards.map((session) => (
                <SessionCard
                  key={session.sessionCode}
                  sessionCode={session.sessionCode}
                  sessionName={session.sessionName}
                  status={session.status}
                  detailLine={session.detailLine}
                  primaryStat={session.primaryStat}
                  secondaryStat={session.secondaryStat}
                  footerLeft={session.footerLeft}
                  footerRight={session.footerRight}
                  cta={{
                    label: t(`home.session_card.${session.ctaKey}`),
                    variant: session.ctaVariant,
                    onClick: () => {},
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <Modal
        title={t('home.name_modal.title')}
        open={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
        closeLabel={t('common.close')}
      >
        <div className={styles.modalStack}>
          <TextInput
            label={t('home.name_modal.label')}
            placeholder={t('home.name_modal.placeholder')}
            value={nameDraft}
            onChange={setNameDraft}
          />
          <Button variant="primary" onClick={submitName} fullWidth>
            {t('home.name_modal.cta')}
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
