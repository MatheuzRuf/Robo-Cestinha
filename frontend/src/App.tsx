import Home from './pages/Home/Home';
import MatchBroadcast from './pages/MatchBroadcast/MatchBroadcast';

export default function App() {
  if (window.location.pathname === '/match-demo') {
    return <MatchBroadcast />;
  }

  return <Home />;
}
