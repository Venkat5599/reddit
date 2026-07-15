import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { Herd } from './scenes/Herd';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  parent: 'game-container',
  backgroundColor: '#0b1020',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1024,
    height: 768,
  },
  scene: [Herd],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

document.addEventListener('DOMContentLoaded', () => {
  StartGame('game-container');
});
