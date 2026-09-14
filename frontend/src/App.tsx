import styles from './App.module.css';
import { Court } from './components/Court';
import { Player } from './components/Player';
import { Ball } from './components/Ball';
import { useGameFrames } from './hooks/useGameFrames';
import { COURT_WIDTH_FT, COURT_HEIGHT_FT, ft } from './config/court';

export default function App() {
  const { frame, transitionDurationMs } = useGameFrames();

  if (!frame) return null;

  const durationSec = transitionDurationMs / 1000;

  return (
    <div className={styles.wrapper}>
      <svg
        viewBox={`0 0 ${ft(COURT_WIDTH_FT)} ${ft(COURT_HEIGHT_FT)}`}
        style={{ width: '100%', height: 'auto' }}
      >
        <Court />
        {frame.players.map((p) => (
          <Player key={p.id} player={p} transitionDuration={durationSec} />
        ))}
        <Ball ball={frame.ball} transitionDuration={durationSec} />
      </svg>
    </div>
  );
}