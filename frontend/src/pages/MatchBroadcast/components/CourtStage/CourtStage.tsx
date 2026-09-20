import { useGameFrames } from '../../../../hooks/useGameFrames';
import styles from './CourtStage.module.css';
import { Ball } from './Ball';
import { Court } from './Court';
import { Player } from './Player';

export function CourtStage() {
  const { frame, transitionDurationMs } = useGameFrames();
  const transitionDuration = transitionDurationMs / 1000;

  return (
    <div className={styles.stage}>
      <svg viewBox="0 0 940 500" role="img" aria-label="Animated basketball court">
        <Court />
        {frame?.players.map((player) => (
          <Player key={player.id} player={player} transitionDuration={transitionDuration} />
        ))}
        {frame ? <Ball ball={frame.ball} transitionDuration={transitionDuration} /> : null}
      </svg>
    </div>
  );
}
