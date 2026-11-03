import { useQuery } from '../../engine/hooks.ts';
import { Garage } from './Garage.tsx';

/** Schermata "Moto e upgrade": il garage con la moto al centro e i gruppi tecnici intorno. */
export function BikeScreen({ notify }: { notify: (t: string, err?: boolean) => void }) {
  const q = useQuery('bikeView');
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  return <Garage b={q.data} notify={notify} />;
}
