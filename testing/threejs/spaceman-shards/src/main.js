import { App } from './core/App.js';

const app = new App(document.querySelector('#scene'));
app.start();

// Handy console handle for live tuning; harmless in production.
window.__app = app;
