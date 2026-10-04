import { useEffect, useState } from 'react';
import { Card } from '../../../components/Card';
import { useTranslation } from '../../../lib/i18n/i18n';
import type { PlayerAttributes, TeamPlayer } from '../../../types/team';
import { getPlayerCatalogPercentiles } from '../data/playerStatProfile';
import styles from './PlayerStatNet.module.css';

const metrics: { key: keyof PlayerAttributes; label: string }[] = [
  { key: 'twoPointPct', label: 'two_point' },
  { key: 'threePointPct', label: 'three_point' },
  { key: 'freeThrowPct', label: 'free_throw' },
  { key: 'turnoverRate', label: 'turnover_rate' },
  { key: 'foulRate', label: 'foul_rate' },
  { key: 'reboundRate', label: 'rebound_rate' },
  { key: 'assistRate', label: 'assist_rate' },
  { key: 'stealRate', label: 'steal_rate' },
  { key: 'blockRate', label: 'block_rate' },
  { key: 'stamina', label: 'stamina' },
  { key: 'clutchFactor', label: 'clutch_factor' },
  { key: 'usageRate', label: 'usage_rate' },
];

const chart = { width: 440, height: 360, centerX: 220, centerY: 172, radius: 112 };

function pointAt(index: number, value: number) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / metrics.length;
  const distance = chart.radius * (value / 100);
  return {
    x: chart.centerX + Math.cos(angle) * distance,
    y: chart.centerY + Math.sin(angle) * distance,
  };
}

function polygonPoints(value: number) {
  return metrics
    .map((_, index) => {
      const point = pointAt(index, value);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(' ');
}

export function PlayerStatNet({ player, embedded = false }: { player: TeamPlayer; embedded?: boolean }) {
  const { t, locale } = useTranslation();
  const [profile, setProfile] = useState<{ playerId: string; values: Record<keyof PlayerAttributes, number> } | null>(
    null,
  );
  useEffect(() => {
    let isActive = true;
    void getPlayerCatalogPercentiles(player.attributes).then((values) => {
      if (isActive) setProfile({ playerId: player.id, values });
    });
    return () => {
      isActive = false;
    };
  }, [player.id, player.attributes]);
  const percentiles = profile?.playerId === player.id ? profile.values : null;
  const formatPercentage = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const formatFactor = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const shootingMetrics = metrics.slice(0, 3);
  const rateMetrics = metrics.slice(3, 9).concat(metrics[11]);
  const simulationMetrics = metrics.slice(9, 11);
  const sections = [
    { label: t('team_locker.player_profile.shooting'), items: shootingMetrics, format: formatPercentage },
    { label: t('team_locker.player_profile.rates'), items: rateMetrics, format: formatPercentage },
    { label: t('team_locker.player_profile.simulation_attributes'), items: simulationMetrics, format: formatFactor },
  ];

  const content = (
    <>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>{t('team_locker.player_profile.title')}</p>
          {embedded ? <h3>{player.name}</h3> : <h2>{player.name}</h2>}
        </div>
        <span className={styles.position}>{player.position}</span>
      </header>
      <p className={styles.note}>{t('team_locker.player_profile.chart_note')}</p>
      <div className={styles.profileLayout}>
        {percentiles ? (
          <div className={styles.chartWrap}>
            <svg
              className={styles.chart}
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              role="img"
              aria-label={t('team_locker.player_profile.chart_description', { name: player.name })}
            >
              {[20, 40, 60, 80, 100].map((value) => (
                <polygon className={styles.grid} points={polygonPoints(value)} key={value} />
              ))}
              {metrics.map((metric, index) => {
                const axisPoint = pointAt(index, 100);
                const labelPoint = pointAt(index, 124);
                const textAnchor =
                  labelPoint.x < chart.centerX - 10 ? 'end' : labelPoint.x > chart.centerX + 10 ? 'start' : 'middle';

                return (
                  <g key={metric.key}>
                    <line
                      className={styles.axis}
                      x1={chart.centerX}
                      y1={chart.centerY}
                      x2={axisPoint.x}
                      y2={axisPoint.y}
                    />
                    <text className={styles.axisLabel} x={labelPoint.x} y={labelPoint.y} textAnchor={textAnchor}>
                      {t(`team_locker.player_stats.${metric.label}`)}
                    </text>
                  </g>
                );
              })}
              <polygon
                className={styles.profile}
                points={metrics
                  .map((metric, index) => {
                    const point = pointAt(index, percentiles[metric.key]);
                    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
                  })
                  .join(' ')}
              />
              {metrics.map((metric, index) => {
                const point = pointAt(index, percentiles[metric.key]);
                return (
                  <circle className={styles.point} cx={point.x} cy={point.y} r="3.5" key={`profile-${metric.key}`} />
                );
              })}
            </svg>
          </div>
        ) : (
          <p className={styles.chartLoading} role="status">
            {t('team_locker.player_profile.chart_loading')}
          </p>
        )}
        <div className={styles.stats}>
          {sections.map((section) => (
            <section className={styles.statsSection} key={section.label}>
              <h3>{section.label}</h3>
              <dl>
                {section.items.map((metric) => (
                  <div className={styles.statRow} key={metric.key}>
                    <dt>{t(`team_locker.player_stats.${metric.label}`)}</dt>
                    <dd>{section.format(player.attributes[metric.key])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </>
  );

  return embedded ? (
    <Card className={`${styles.card} ${styles.embedded}`}>{content}</Card>
  ) : (
    <Card className={styles.card}>{content}</Card>
  );
}
