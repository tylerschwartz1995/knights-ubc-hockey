import { useEffect, useState } from 'react';
import { SEASONS } from '../config.js';
import { emptySeasonData, loadSeasonData } from '../data/seasons.js';

export function useSeasonData() {
  const [state, setState] = useState(() => ({ ...emptySeasonData(), loaded: false }));
  useEffect(() => {
    let cancelled = false;
    loadSeasonData(SEASONS).then(data => {
      if (!cancelled) setState({ ...data, loaded: true });
    });
    return () => { cancelled = true; };
  }, []);
  return state;
}
