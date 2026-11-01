import { useState } from 'react';
import { MainMenu } from './screens/MainMenu.tsx';
import { NewCareer, type CareerMode } from './screens/NewCareer.tsx';
import { LoadGame } from './screens/LoadGame.tsx';
import { Shell, type Section } from './shell/Shell.tsx';

export type AppScreen =
  | { name: 'menu' }
  | { name: 'newCareer'; mode?: CareerMode }
  | { name: 'load' }
  | { name: 'game'; slot: string; section?: Section };

export function App() {
  const [screen, setScreen] = useState<AppScreen>({ name: 'menu' });
  switch (screen.name) {
    case 'menu':
      return <MainMenu go={setScreen} />;
    case 'newCareer':
      return <NewCareer go={setScreen} initialMode={screen.mode ?? 'existing'} />;
    case 'load':
      return <LoadGame go={setScreen} />;
    case 'game':
      return (
        <Shell
          slot={screen.slot}
          initialSection={screen.section ?? 'overview'}
          exit={() => setScreen({ name: 'menu' })}
        />
      );
  }
}
