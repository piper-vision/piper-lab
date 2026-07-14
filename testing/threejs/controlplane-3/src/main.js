import { SceneController } from './SceneController.js';

const controller = new SceneController(document.getElementById('scene'));

// Console tuning hook: window.filterDebug.layers, .beams, .camera …
window.filterDebug = controller;
