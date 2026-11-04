// Culture: the original isometric "#" scene (from the iso-hash project, copied
// into src/culture/, restyled to the Halo ink and line weight on its own blue), with its
// "Built Together" headline, subtitle and paragraph on the left. Loaded instead of
// main.js when ?option=d. Sets the page up for it, then starts it.
// one screen, no scrolling: the yellow intro section below is for the HP Hero
// scroll story only
document.getElementById('scroll').style.height = '100vh';
document.getElementById('intro').style.display = 'none';
document.documentElement.style.overflow = document.body.style.overflow = 'hidden';
document.getElementById('tagline').style.display = 'none';
document.getElementById('culture-hero').style.display = 'block';
document.documentElement.style.background = '#c7d9e5';

import('./culture/main.js');
