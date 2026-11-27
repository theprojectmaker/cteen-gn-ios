import React from 'react';
import { Screen } from '../../src/shell';
import { Home } from '../../src/screens';

export default function HomeTab() {
  return (
    <Screen scoreboard noShabbat>
      <Home />
    </Screen>
  );
}
