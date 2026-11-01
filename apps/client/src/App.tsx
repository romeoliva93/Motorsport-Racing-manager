import { useState } from 'react';
import { MainMenu } from './screens/MainMenu.tsx';
import { NewCareer } from './screens/NewCareer.tsx';
import { LoadGame } from './screens/LoadGame.tsx';
import { Shell } from './shell/Shell.tsx';

export type AppScreen =
  { name: 'menu' } | { name: 'newCareer' } | { name: 'load' } | { name: 'game'; slot: string };

export function App() {
  const [screen, setScreen] = useState<AppScreen>({ name: 'menu' });
  switch (screen.name) {
    case 'menu':
      return <MainMenu go={setScreen} />;
    case 'newCareer':
      return <NewCareer go={setScreen} />;
    case 'load':
      return <LoadGame go={setScreen} />;
    case 'game':
      return <Shell slot={screen.slot} exit={() => setScreen({ name: 'menu' })} />;
  }
}
