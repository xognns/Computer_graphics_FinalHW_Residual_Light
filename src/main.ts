import { Game } from './game/Game';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element');
}

const game = new Game(app);
game.start();

