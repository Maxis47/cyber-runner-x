import { useEffect, useState } from 'react';
import {
  streamLeaderboard, streamGlobalStats, streamPlayer,
  fetchLeaderboard, fetchGlobalStats, fetchPlayer
} from '../lib/live';

export default function useDashboardLive(identity) {
  const addr = identity?.address?.toLowerCase?.();
  const [leaderboard, setLeaderboard] = useState([]);
  const [global, setGlobal] = useState({ players: 0, global_best: 0, total_plays: 0, last24h: 0 });
  const [player, setPlayer] = useState({ best: 0, plays: 0, history: [] });

  // initial fetch cepat
  useEffect(() => {
    fetchLeaderboard().then(setLeaderboard).catch(()=>{});
    fetchGlobalStats().then(setGlobal).catch(()=>{});
  }, []);
  useEffect(() => {
    if (!addr) return;
    fetchPlayer(addr).then(setPlayer).catch(()=>{});
  }, [addr]);

  // live SSE
  useEffect(() => {
    const stopLB = streamLeaderboard(setLeaderboard);
    const stopGS = streamGlobalStats(setGlobal);
    let stopP = () => {};
    if (addr) stopP = streamPlayer(addr, setPlayer);
    return () => { stopLB(); stopGS(); stopP(); };
  }, [addr]);

  return { leaderboard, global, player };
}
