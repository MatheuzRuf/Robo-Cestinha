import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BracketTree from './pages/BracketTree/BracketTree';
import Home from './pages/Home/Home';
import MatchBroadcast from './pages/MatchBroadcast/MatchBroadcast';
import TeamLocker from './pages/TeamLocker/TeamLocker';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/team-locker" element={<TeamLocker />} />
        <Route path="/bracket-tree" element={<BracketTree />} />
        <Route path="/match-demo" element={<MatchBroadcast />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
