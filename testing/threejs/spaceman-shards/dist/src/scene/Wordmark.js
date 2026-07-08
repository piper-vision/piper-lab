import * as THREE from 'three';

// Gap between wordmark repeats, in the SVG's own pixel units.
const GAP_PX = 80;

/**
 * Wordmark — the SVG logotype scrolling right-to-left on an endless loop,
 * pinned behind the head.
 *
 * The SVG is rasterized once into a canvas tile (artwork + an 80px gap),
 * used as a repeat-wrapped texture on a camera-locked plane sitting deeper
 * than the head — so the head (and passing shards) occlude it naturally.
 * Scrolling is just the texture offset advancing; the wrap makes it
 * infinite and seamless.
 */
export class Wordmark {
  /**
   * @param {object} opts
   * @param {string} opts.url    SVG url.
   * @param {number} opts.depth  Distance behind the camera-space origin.
   * @param {number} opts.height World-space height of the text band.
   * @param {number} opts.width  World-space width of the band (overscan).
   * @param {number} opts.speed  Scroll speed in texture-tiles per second.
   */
  constructor({ url = './assets/piper-vision.svg', depth = 9, height = 1.17, width = 34, speed = 0.045 } = {}) {
    this.speed = speed;
    this._texture = null;

    // Dimmed gray-white: bright enough to read as etched light, dim enough
    // (pre-tonemap ≈ 0.8) to stay under the bloom/starburst thresholds.
    // depthTest off + drawn after the shards: the marquee ignores the
    // shard field entirely (no darkening as shards cross it). The head
    // draws after it still, so the head hides the text.
    this.material = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0.85,
      color: new THREE.Color(0.75, 0.78, 0.82),
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.mesh.renderOrder = 9998; // over the shards; the head draws after
    this.mesh.position.set(0, 0, -depth);
    this.mesh.visible = false; // until the SVG arrives

    const img = new Image();
    img.onload = () => {
      // Rasterize at 2× for crispness; the tile = artwork + gap.
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = (img.width + GAP_PX) * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, img.width * scale, img.height * scale);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;

      // Tile the texture so the artwork keeps its aspect at our band height.
      const tileWorldWidth = height * ((img.width + GAP_PX) / img.height);
      texture.repeat.x = width / tileWorldWidth;

      this.material.map = texture;
      this.material.needsUpdate = true;
      this._texture = texture;
      this.mesh.visible = true;
    };
    img.onerror = (err) => console.error('Wordmark SVG failed to load:', err);
    img.src = url;
  }

  update(dt) {
    // Advancing the sampling window rightward moves the artwork leftward
    // on screen — right-to-left marquee.
    if (this._texture) this._texture.offset.x += dt * this.speed;
  }
}
