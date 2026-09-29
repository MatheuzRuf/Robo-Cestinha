import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BracketTree from './pages/BracketTree/BracketTree';
import Home from './pages/Home/Home';
import MatchBroadcast from './pages/MatchBroadcast/MatchBroadcast';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/bracket-tree" element={<BracketTree />} />
        <Route path="/match-demo" element={<MatchBroadcast />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
