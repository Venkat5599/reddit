import { context, requestExpandedMode } from '@devvit/web/client';

const startButton = document.getElementById('start-button') as HTMLButtonElement;
startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

const greet = document.getElementById('greet');
if (greet) greet.textContent = context.username ? `Ready, ${context.username}?` : 'Ready?';
