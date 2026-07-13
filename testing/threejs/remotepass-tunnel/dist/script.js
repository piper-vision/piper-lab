    import * as THREE from "three";
    import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
    import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
    import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
    import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
    import GUI from "lil-gui";

    const TAU = Math.PI * 2;
    const loading = document.querySelector("#loading");

    const params = {
      flightSpeed: 30,
      mouseInfluence: 0.51,
      fieldOfView: 89,
      tunnelRadius: 14.4,
      openingSize: 57,
      ribbonCount: 150,
      ribbonWidth: 0.16,
      lightIntensity: 0.78,
      pulseSpeed: 0.49,
      bloomStrength: 0.59,
      bloomRadius: 0.72,
      bloomThreshold: 0.18,
      starBrightness: 0.83,
      starDensity: 7400,
      lineColor1: "#1a27d8",
      lineColor2: "#3f55ff",
      lineColor3: "#2f8cff",
      lineColor4: "#ff4f9e",
      dpr: 2,
      insideDuration: 5,
      waveDuration: 10,
      transitionDuration: 3,
      wavePullback: 30,
      waveHeight: 5,
      waveFov: 60,
      railWaveAmount: 2.2,
      railWaveSpeed: 1.2,
      sweepCount: 8,
      sweepSpeed: 0.36,
      sweepStrength: 0.85,
      sweepHot: 1.8,
      sweepInside: 0.45,
      waveBlur: 0.5,
      waveBlurLength: 0.028,
      waveBloom: 0.15,
      paused: false,
      resetView: () => {
        progress = 0.018;
        cycleTime = 0;
        pointerTarget.set(0, 0);
        pointerSmooth.set(0, 0);
        cameraOrientationReady = false;
      }
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020105);

    const camera = new THREE.PerspectiveCamera(
      params.fieldOfView,
      window.innerWidth / window.innerHeight,
      0.06,
      1800
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(params.dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    document.body.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      params.bloomStrength,
      params.bloomRadius,
      params.bloomThreshold
    );
    // Directional streak blur, faded in while the wave view holds — smears
    // the rails along their screen direction like a long-exposure photo.
    const streakBlurPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uAmount: { value: 0 },
        uRadius: { value: params.waveBlurLength }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uAmount;
        uniform float uRadius;
        varying vec2 vUv;

        void main() {
          vec4 base = texture2D(tDiffuse, vUv);

          if (uAmount <= 0.001) {
            gl_FragColor = base;
            return;
          }

          vec4 sum = vec4(0.0);
          float total = 0.0;

          for (int i = -8; i <= 8; i += 1) {
            float f = float(i) / 8.0;
            float weight = 1.0 - abs(f) * 0.65;
            vec2 offset = vec2(f * uRadius, f * uRadius * 0.12) * uAmount;
            sum += texture2D(tDiffuse, vUv + offset) * weight;
            total += weight;
          }

          vec4 blurred = sum / total;
          vec4 color = mix(base, blurred, uAmount);
          color.rgb += blurred.rgb * uAmount * 0.35;
          gl_FragColor = color;
        }
      `
    });

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(streakBlurPass);

    const world = new THREE.Group();
    scene.add(world);

    const pathPoints = [];
    const pathPointCount = 18;

    for (let i = 0; i < pathPointCount; i += 1) {
      const a = (i / pathPointCount) * TAU;
      const radius = 72 + Math.sin(a * 3.0) * 12 + Math.cos(a * 5.0) * 5;

      pathPoints.push(
        new THREE.Vector3(
          Math.cos(a) * radius,
          Math.sin(a * 2.0) * 16 + Math.cos(a * 4.0) * 4,
          Math.sin(a) * radius
        )
      );
    }

    const flightPath = new THREE.CatmullRomCurve3(pathPoints, true, "centripetal", 0.45);
    flightPath.arcLengthDivisions = 3000;

    const tunnelSegments = 620;
    const pathLength = flightPath.getLength();
    const frames = flightPath.computeFrenetFrames(tunnelSegments, true);
    const pathSamples = Array.from({ length: tunnelSegments + 1 }, (_, index) =>
      flightPath.getPointAt(index / tunnelSegments)
    );

    const ribbonPalette = [
      new THREE.Color(params.lineColor1),
      new THREE.Color(params.lineColor2),
      new THREE.Color(params.lineColor3),
      new THREE.Color(params.lineColor4)
    ];

    function syncRibbonPalette() {
      ribbonPalette[0].set(params.lineColor1);
      ribbonPalette[1].set(params.lineColor2);
      ribbonPalette[2].set(params.lineColor3);
      ribbonPalette[3].set(params.lineColor4);
    }

    const tunnelGroup = new THREE.Group();
    world.add(tunnelGroup);

    let tunnelMesh = null;
    let tunnelMaterial = null;
    let sparkField = null;
    let starField = null;
    let glowSprites = null;

    function mulberry32(seed) {
      return function random() {
        let value = (seed += 0x6d2b79f5);
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
    }

    function shortestAngle(angle) {
      return Math.atan2(Math.sin(angle), Math.cos(angle));
    }

    function createRibbonGeometry() {
      const random = mulberry32(9137);
      const positions = [];
      const colors = [];
      const sides = [];
      const pathCoordinates = [];
      const phases = [];
      const indices = [];

      const gap = THREE.MathUtils.degToRad(params.openingSize);
      const availableArc = TAU - gap;
      const gapHalf = gap * 0.5;
      const lineCount = Math.round(params.ribbonCount);

      for (let ribbonIndex = 0; ribbonIndex < lineCount; ribbonIndex += 1) {
        const lane = (ribbonIndex + 0.32 + random() * 0.36) / lineCount;
        const baseAngle = gapHalf + lane * availableArc;
        const radius = params.tunnelRadius * (0.84 + random() * 0.32);
        const width = params.ribbonWidth * (0.35 + Math.pow(random(), 1.7) * 2.65);
        const waveAmplitude = (random() - 0.5) * 0.16;
        const waveFrequency = 1 + Math.floor(random() * 4);
        const wavePhase = random() * TAU;
        const pulsePhase = random() * 30;
        const color = ribbonPalette[Math.floor(random() * ribbonPalette.length)].clone();
        const colorBoost = 0.72 + random() * 0.55;
        color.multiplyScalar(colorBoost);

        for (let segmentIndex = 0; segmentIndex <= tunnelSegments; segmentIndex += 1) {
          const u = segmentIndex / tunnelSegments;
          const center = pathSamples[segmentIndex];
          const normal = frames.normals[segmentIndex];
          const binormal = frames.binormals[segmentIndex];
          const angle = baseAngle + Math.sin(u * TAU * waveFrequency + wavePhase) * waveAmplitude;

          const radial = new THREE.Vector3()
            .copy(binormal)
            .multiplyScalar(Math.cos(angle))
            .addScaledVector(normal, Math.sin(angle));

          const lateral = new THREE.Vector3()
            .copy(binormal)
            .multiplyScalar(-Math.sin(angle))
            .addScaledVector(normal, Math.cos(angle));

          const ripple = 1 + Math.sin(u * TAU * (2 + waveFrequency) + wavePhase) * 0.015;
          const ribbonCenter = new THREE.Vector3().copy(center).addScaledVector(radial, radius * ripple);

          for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
            const side = sideIndex === 0 ? -1 : 1;
            const vertex = new THREE.Vector3().copy(ribbonCenter).addScaledVector(lateral, width * 0.5 * side);

            positions.push(vertex.x, vertex.y, vertex.z);
            colors.push(color.r, color.g, color.b);
            sides.push(side);
            pathCoordinates.push(u);
            phases.push(pulsePhase);
          }
        }

        const ribbonVertexOffset = ribbonIndex * (tunnelSegments + 1) * 2;

        for (let segmentIndex = 0; segmentIndex < tunnelSegments; segmentIndex += 1) {
          const a = ribbonVertexOffset + segmentIndex * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          indices.push(a, c, b, c, d, b);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(sides, 1));
      geometry.setAttribute("aPath", new THREE.Float32BufferAttribute(pathCoordinates, 1));
      geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();

      return geometry;
    }

    function createTunnelMaterial() {
      return new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: params.lightIntensity },
          uPulseSpeed: { value: params.pulseSpeed },
          uWaveMix: { value: 0 },
          uRailWaveAmp: { value: params.railWaveAmount },
          uRailWaveSpeed: { value: params.railWaveSpeed },
          uSweepCount: { value: params.sweepCount },
          uSweepSpeed: { value: params.sweepSpeed },
          uSweepStrength: { value: params.sweepStrength },
          uSweepHot: { value: params.sweepHot },
          uSweepInside: { value: params.sweepInside }
        },
        vertexShader: `
          uniform float uTime;
          uniform float uWaveMix;
          uniform float uRailWaveAmp;
          uniform float uRailWaveSpeed;
          attribute float aSide;
          attribute float aPath;
          attribute float aPhase;
          varying vec3 vColor;
          varying float vSide;
          varying float vPath;
          varying float vPhase;

          void main() {
            vColor = color;
            vSide = aSide;
            vPath = aPath;
            vPhase = aPhase;

            // Gentle whole-tunnel undulation, faded in by uWaveMix while the
            // camera watches the rails from the center of the loop.
            vec3 pos = position;
            float wavePhase = aPath * 6.2831853;
            float sway = sin(wavePhase * 7.0 - uTime * uRailWaveSpeed) * 0.7
                       + sin(wavePhase * 17.0 + uTime * uRailWaveSpeed * 1.6) * 0.3;
            pos.y += sway * uRailWaveAmp * uWaveMix;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uIntensity;
          uniform float uPulseSpeed;
          uniform float uWaveMix;
          uniform float uSweepCount;
          uniform float uSweepSpeed;
          uniform float uSweepStrength;
          uniform float uSweepHot;
          uniform float uSweepInside;
          varying vec3 vColor;
          varying float vSide;
          varying float vPath;
          varying float vPhase;

          void main() {
            float center = pow(max(0.0, 1.0 - abs(vSide)), 2.2);
            float halo = pow(max(0.0, 1.0 - abs(vSide)), 0.48);
            float finePulse = 0.82 + 0.18 * sin(vPath * 1450.0 - uTime * 8.0 * uPulseSpeed + vPhase);
            float longPulse = 0.78 + 0.22 * sin(vPath * 82.0 - uTime * 2.4 * uPulseSpeed + vPhase * 0.37);
            float energy = mix(0.22, 1.0, center) * finePulse * longPulse;

            // Comets of light running along each rail individually (in the
            // flight direction, i.e. left to right in the wave view). Every
            // rail gets its own phase offset and speed from vPhase, so the
            // packets never line up into rings across the tunnel.
            float railRandom = fract(vPhase * 0.618034);
            float railSpeed = uSweepSpeed * (0.6 + railRandom * 0.9);
            float cometPos = fract(vPath * uSweepCount - uTime * railSpeed + vPhase);
            // Exponent scales with packet spacing so the streak keeps the
            // same absolute length whatever uSweepCount is set to. Kept low
            // so each light is a long flat gradient, not a blobby comet.
            float sweep = pow(cometPos, 48.0 / uSweepCount);

            // A random subset of rails carries "hot" comets: bright enough to
            // push past the bloom threshold, with a white-hot core.
            float hotRail = step(0.85, fract(vPhase * 2.399963));
            // The lights never fully switch off inside the tunnel: uSweepInside
            // keeps a base level running, and the wave view fades in the rest.
            float sweepMix = max(uWaveMix, uSweepInside);
            float sweepBoost = sweep * uSweepStrength * sweepMix * (1.0 + hotRail * uSweepHot);

            vec3 color = vColor * uIntensity * (0.5 + energy * 1.35 + sweepBoost);
            color += vec3(1.0) * sweepBoost * hotRail * 0.16;
            float alpha = (halo * 0.24 + center * 0.78) * (0.74 + energy * 0.26);
            alpha = min(1.0, alpha + sweepBoost * 0.25 * halo);
            gl_FragColor = vec4(color, alpha);
          }
        `,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });
    }

    function rebuildTunnel() {
      if (tunnelMesh) {
        tunnelGroup.remove(tunnelMesh);
        tunnelMesh.geometry.dispose();
        tunnelMesh.material.dispose();
      }

      tunnelMaterial = createTunnelMaterial();
      tunnelMesh = new THREE.Mesh(createRibbonGeometry(), tunnelMaterial);
      tunnelMesh.frustumCulled = false;
      tunnelGroup.add(tunnelMesh);

      rebuildSparks();
    }

    function rebuildSparks() {
      if (sparkField) {
        tunnelGroup.remove(sparkField);
        sparkField.geometry.dispose();
        sparkField.material.dispose();
      }

      const random = mulberry32(4412);
      const positions = [];
      const colors = [];
      const sparkCount = 1500;

      for (let i = 0; i < sparkCount; i += 1) {
        const u = random();
        const sampleIndex = Math.min(tunnelSegments, Math.floor(u * tunnelSegments));
        const center = pathSamples[sampleIndex];
        const normal = frames.normals[sampleIndex];
        const binormal = frames.binormals[sampleIndex];
        const angle = random() * TAU;
        const radius = params.tunnelRadius * (0.12 + Math.pow(random(), 0.48) * 0.75);
        const point = new THREE.Vector3()
          .copy(center)
          .addScaledVector(binormal, Math.cos(angle) * radius)
          .addScaledVector(normal, Math.sin(angle) * radius);

        const color = ribbonPalette[Math.floor(random() * ribbonPalette.length)].clone();
        color.lerp(new THREE.Color(0xffffff), 0.55 + random() * 0.35);

        positions.push(point.x, point.y, point.z);
        colors.push(color.r, color.g, color.b);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.075,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        toneMapped: false
      });

      sparkField = new THREE.Points(geometry, material);
      sparkField.frustumCulled = false;
      tunnelGroup.add(sparkField);
    }

    function createStarMaterial() {
      return new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: params.dpr },
          uBrightness: { value: params.starBrightness }
        },
        vertexShader: `
          uniform float uTime;
          uniform float uPixelRatio;
          attribute float aSize;
          attribute float aPhase;
          varying float vTwinkle;

          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            float distanceScale = 620.0 / max(80.0, -viewPosition.z);
            gl_PointSize = clamp(aSize * uPixelRatio * distanceScale, 0.7, 5.5);
            gl_Position = projectionMatrix * viewPosition;
            vTwinkle = 0.72 + 0.28 * sin(uTime * 1.5 + aPhase);
          }
        `,
        fragmentShader: `
          uniform float uBrightness;
          varying float vTwinkle;

          void main() {
            vec2 point = gl_PointCoord - 0.5;
            float distanceToCenter = length(point);
            float core = smoothstep(0.5, 0.0, distanceToCenter);
            float sparkle = pow(core, 3.0) + pow(core, 12.0) * 1.8;
            gl_FragColor = vec4(vec3(uBrightness * vTwinkle * sparkle), core);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
    }

    function rebuildStars() {
      if (starField) {
        world.remove(starField);
        starField.geometry.dispose();
        starField.material.dispose();
      }

      const random = mulberry32(7821);
      const positions = [];
      const sizes = [];
      const phases = [];
      const count = Math.round(params.starDensity);

      for (let i = 0; i < count; i += 1) {
        const z = random() * 2 - 1;
        const angle = random() * TAU;
        const radiusOnSphere = Math.sqrt(1 - z * z);
        const distance = 260 + Math.pow(random(), 0.42) * 850;

        positions.push(
          Math.cos(angle) * radiusOnSphere * distance,
          z * distance,
          Math.sin(angle) * radiusOnSphere * distance
        );
        sizes.push(0.45 + Math.pow(random(), 4.0) * 3.9);
        phases.push(random() * TAU);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
      geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));

      starField = new THREE.Points(geometry, createStarMaterial());
      starField.frustumCulled = false;
      world.add(starField);
    }

    function createGlowTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.08, "rgba(196,214,255,0.95)");
      gradient.addColorStop(0.22, "rgba(84,110,255,0.55)");
      gradient.addColorStop(0.48, "rgba(255,74,180,0.12)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function buildGlowSprites() {
      if (glowSprites) {
        world.remove(glowSprites);
      }

      glowSprites = new THREE.Group();
      const texture = createGlowTexture();
      const positions = [
        new THREE.Vector3(210, 48, -330),
        new THREE.Vector3(-310, -70, 230),
        new THREE.Vector3(120, 180, 390),
        new THREE.Vector3(-430, 120, -110)
      ];

      positions.forEach((position, index) => {
        const material = new THREE.SpriteMaterial({
          map: texture,
          color: index % 2 === 0 ? 0x4558ff : 0xff64c7,
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        const size = index === 0 ? 48 : 28 + index * 5;
        sprite.scale.set(size, size, 1);
        glowSprites.add(sprite);
      });

      world.add(glowSprites);
    }

    const pointerTarget = new THREE.Vector2();
    const pointerSmooth = new THREE.Vector2();

    window.addEventListener("pointermove", (event) => {
      pointerTarget.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1)
      );
    });

    window.addEventListener("pointerleave", () => {
      pointerTarget.set(0, 0);
    });

    let progress = 0.018;
    let cycleTime = 0;
    let cameraOrientationReady = false;
    const clock = new THREE.Clock();
    const currentPosition = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const desiredUp = new THREE.Vector3();
    const exteriorPosition = new THREE.Vector3();
    const outwardDir = new THREE.Vector3();
    const rightDir = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const lateralOffset = new THREE.Vector3();
    const pathTangent = new THREE.Vector3();
    const pathNormal = new THREE.Vector3();
    const pathBinormal = new THREE.Vector3();
    const desiredQuaternion = new THREE.Quaternion();
    const lookMatrix = new THREE.Matrix4();

    function samplePathFrame(u) {
      const wrapped = ((u % 1) + 1) % 1;
      const scaledIndex = wrapped * tunnelSegments;
      const indexA = Math.floor(scaledIndex);
      const indexB = Math.min(tunnelSegments, indexA + 1);
      const interpolation = scaledIndex - indexA;

      flightPath.getTangentAt(wrapped, pathTangent).normalize();
      pathNormal
        .copy(frames.normals[indexA])
        .lerp(frames.normals[indexB], interpolation)
        .addScaledVector(pathTangent, -pathNormal.dot(pathTangent))
        .normalize();
      pathBinormal.crossVectors(pathTangent, pathNormal).normalize();
    }

    function easeInOut(t) {
      return t * t * (3 - 2 * t);
    }

    // 0 = riding inside the rails, 1 = holding the exterior wave view.
    function cameraCycleBlend() {
      let t = cycleTime;
      if (t < params.insideDuration) return 0;
      t -= params.insideDuration;
      if (t < params.transitionDuration) return easeInOut(t / params.transitionDuration);
      t -= params.transitionDuration;
      if (t < params.waveDuration) return 1;
      t -= params.waveDuration;
      return 1 - easeInOut(t / params.transitionDuration);
    }

    function updateCamera(delta) {
      if (!params.paused) {
        const cycleLength =
          params.insideDuration + params.waveDuration + params.transitionDuration * 2;
        cycleTime = (cycleTime + delta) % cycleLength;
      }

      const waveBlend = cameraCycleBlend();

      if (!params.paused) {
        // Flight slows to a stop while the wave view holds, so the camera
        // dives back into the same rails it has been watching.
        progress =
          (progress + (params.flightSpeed / pathLength) * delta * (1 - waveBlend)) % 1;
      }

      pointerSmooth.x = THREE.MathUtils.damp(pointerSmooth.x, pointerTarget.x, 2.8, delta);
      pointerSmooth.y = THREE.MathUtils.damp(pointerSmooth.y, pointerTarget.y, 2.8, delta);

      // Peaks mid pull-out / mid re-entry, zero while riding or holding.
      const transitionActivity = waveBlend * (1 - waveBlend) * 4;

      samplePathFrame(progress);
      // A longer look-ahead mid-transition averages out the path's wiggles,
      // so the camera sweeps in one smooth arc instead of chasing every turn.
      const lookAhead = (progress + (7.2 + transitionActivity * 18) / pathLength) % 1;

      flightPath.getPointAt(progress, currentPosition);
      lateralOffset
        .copy(pathBinormal)
        .multiplyScalar(pointerSmooth.x * params.mouseInfluence)
        .addScaledVector(pathNormal, pointerSmooth.y * params.mouseInfluence * 0.68);
      currentPosition.add(lateralOffset);

      flightPath.getPointAt(lookAhead, lookTarget);
      lookTarget
        .addScaledVector(pathBinormal, pointerSmooth.x * params.mouseInfluence * 0.24)
        .addScaledVector(pathNormal, pointerSmooth.y * params.mouseInfluence * 0.15);

      const roll = -pointerSmooth.x * 0.16;
      desiredUp
        .copy(pathNormal)
        .multiplyScalar(Math.cos(roll))
        .addScaledVector(pathBinormal, Math.sin(roll))
        .normalize();

      if (waveBlend > 0) {
        // Sit at the center of the rail circle looking outward, so a single
        // side of the loop sweeps across the frame. The look target is left
        // untouched (still the flight's look-ahead point), which keeps the
        // camera from turning as it slides between the two positions.
        outwardDir.set(lookTarget.x, 0, lookTarget.z).normalize();
        rightDir.crossVectors(outwardDir, worldUp).normalize();

        exteriorPosition
          .set(0, params.waveHeight, 0)
          .addScaledVector(outwardDir, -params.wavePullback)
          .addScaledVector(rightDir, pointerSmooth.x * params.mouseInfluence * 6)
          .addScaledVector(worldUp, pointerSmooth.y * params.mouseInfluence * 4);

        currentPosition.lerp(exteriorPosition, waveBlend);
        // Level out early in the pull-out (and stay level until late in the
        // re-entry) so the camera doesn't roll while it travels.
        const upBlend = THREE.MathUtils.smoothstep(waveBlend, 0, 0.5);
        desiredUp.lerp(worldUp, upBlend).normalize();
      }

      camera.position.copy(currentPosition);
      lookMatrix.lookAt(currentPosition, lookTarget, desiredUp);
      desiredQuaternion.setFromRotationMatrix(lookMatrix);

      if (!cameraOrientationReady) {
        camera.quaternion.copy(desiredQuaternion);
        cameraOrientationReady = true;
      } else {
        // Heavier rotation damping mid-transition smooths away small turns.
        const rotationRate = THREE.MathUtils.lerp(4.2, 1.7, Math.min(1, transitionActivity));
        const orientationBlend = 1 - Math.exp(-rotationRate * delta);
        camera.quaternion.slerp(desiredQuaternion, orientationBlend);
      }

      const dynamicFov = params.fieldOfView + Math.min(6, params.flightSpeed * 0.07);
      const targetFov = THREE.MathUtils.lerp(dynamicFov, params.waveFov, waveBlend);
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 3.5, delta);
      camera.updateProjectionMatrix();

      return waveBlend;
    }

    const gui = new GUI({ title: "Setting" });

    const flightFolder = gui.addFolder("Flight");
    flightFolder.add(params, "flightSpeed", 0, 85, 0.1).name("Speed");
    flightFolder.add(params, "mouseInfluence", 0, 3, 0.01).name("Mouse Influence");
    flightFolder.add(params, "fieldOfView", 50, 105, 1).name("Field of View");
    flightFolder.add(params, "paused").name("Pause");
    flightFolder.add(params, "resetView").name("Reset View");

    const cycleFolder = gui.addFolder("Camera Cycle");
    cycleFolder.add(params, "insideDuration", 1, 20, 0.5).name("Inside Time (s)");
    cycleFolder.add(params, "waveDuration", 1, 20, 0.5).name("Wave Time (s)");
    cycleFolder.add(params, "transitionDuration", 0.5, 8, 0.1).name("Travel Time (s)");
    cycleFolder.add(params, "wavePullback", -40, 80, 1).name("Wave Pullback");
    cycleFolder.add(params, "waveHeight", -80, 150, 1).name("Wave Height");
    cycleFolder.add(params, "waveFov", 30, 100, 1).name("Wave FOV");

    const waveFxFolder = gui.addFolder("Wave FX");
    waveFxFolder.add(params, "railWaveAmount", 0, 8, 0.1).name("Rail Wave");
    waveFxFolder.add(params, "railWaveSpeed", 0, 4, 0.05).name("Rail Wave Speed");
    waveFxFolder.add(params, "sweepCount", 4, 60, 1).name("Light Packets");
    waveFxFolder.add(params, "sweepSpeed", 0, 8, 0.1).name("Sweep Speed");
    waveFxFolder.add(params, "sweepStrength", 0, 4, 0.05).name("Sweep Brightness");
    waveFxFolder.add(params, "sweepHot", 0, 6, 0.1).name("Bloom Boost");
    waveFxFolder.add(params, "sweepInside", 0, 1, 0.01).name("Lights Inside");
    waveFxFolder.add(params, "waveBlur", 0, 1, 0.01).name("Streak Blur");
    waveFxFolder.add(params, "waveBlurLength", 0, 0.05, 0.001).name("Streak Length");
    waveFxFolder.add(params, "waveBloom", 0, 2, 0.05).name("Wave Bloom");

    const tunnelFolder = gui.addFolder("Tunnel");
    tunnelFolder.add(params, "tunnelRadius", 5, 18, 0.1).name("Radius").onFinishChange(rebuildTunnel);
    tunnelFolder.add(params, "openingSize", 35, 190, 1).name("Open Side").onFinishChange(rebuildTunnel);
    tunnelFolder.add(params, "ribbonCount", 28, 300, 1).name("Light Strips").onFinishChange(rebuildTunnel);
    tunnelFolder.add(params, "ribbonWidth", 0.03, 0.42, 0.01).name("Strip Width").onFinishChange(rebuildTunnel);

    const colorsFolder = gui.addFolder("Line Colors");
    const rebuildColors = () => {
      syncRibbonPalette();
      rebuildTunnel();
    };
    colorsFolder.addColor(params, "lineColor1").name("Color 1").onFinishChange(rebuildColors);
    colorsFolder.addColor(params, "lineColor2").name("Color 2").onFinishChange(rebuildColors);
    colorsFolder.addColor(params, "lineColor3").name("Color 3").onFinishChange(rebuildColors);
    colorsFolder.addColor(params, "lineColor4").name("Color 4").onFinishChange(rebuildColors);

    const lightFolder = gui.addFolder("Light");
    lightFolder.add(params, "lightIntensity", 0.2, 5, 0.01).name("Intensity").onChange((value) => {
      tunnelMaterial.uniforms.uIntensity.value = value;
    });
    lightFolder.add(params, "pulseSpeed", 0, 2, 0.01).name("Pulse Speed").onChange((value) => {
      tunnelMaterial.uniforms.uPulseSpeed.value = value;
    });
    lightFolder.add(params, "bloomStrength", 0, 3.5, 0.01).name("Bloom Strength").onChange((value) => {
      bloomPass.strength = value;
    });
    lightFolder.add(params, "bloomRadius", 0, 1, 0.01).name("Bloom Radius").onChange((value) => {
      bloomPass.radius = value;
    });
    lightFolder.add(params, "bloomThreshold", 0, 1, 0.01).name("Bloom Threshold").onChange((value) => {
      bloomPass.threshold = value;
    });

    const starsFolder = gui.addFolder("Stars");
    starsFolder.add(params, "starBrightness", 0.1, 2.5, 0.01).name("Brightness").onChange((value) => {
      if (starField) starField.material.uniforms.uBrightness.value = value;
    });
    starsFolder.add(params, "starDensity", 1000, 14000, 100).name("Density").onFinishChange(rebuildStars);

    const renderingFolder = gui.addFolder("Rendering");
    renderingFolder.add(params, "dpr", 0.5, 2, 0.25).name("DPR").onChange((value) => {
      renderer.setPixelRatio(value);
      composer.setPixelRatio(value);
      if (starField) starField.material.uniforms.uPixelRatio.value = value;
    });

    flightFolder.open();
    gui.close();

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
    }

    window.addEventListener("resize", resize);

    rebuildTunnel();
    rebuildStars();
    buildGlowSprites();
    resize();

    window.railsDebug = {
      params,
      cycleTime: () => cycleTime,
      setCycle: (t) => { cycleTime = t; },
      setProgress: (v) => { progress = v; }
    };

    let firstFrame = true;

    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      const waveBlend = updateCamera(delta);

      if (tunnelMaterial) {
        tunnelMaterial.uniforms.uTime.value = elapsed;
        tunnelMaterial.uniforms.uWaveMix.value = waveBlend;
        tunnelMaterial.uniforms.uRailWaveAmp.value = params.railWaveAmount;
        tunnelMaterial.uniforms.uRailWaveSpeed.value = params.railWaveSpeed;
        tunnelMaterial.uniforms.uSweepCount.value = params.sweepCount;
        tunnelMaterial.uniforms.uSweepSpeed.value = params.sweepSpeed;
        tunnelMaterial.uniforms.uSweepStrength.value = params.sweepStrength;
        tunnelMaterial.uniforms.uSweepHot.value = params.sweepHot;
        tunnelMaterial.uniforms.uSweepInside.value = params.sweepInside;
      }

      streakBlurPass.uniforms.uAmount.value = waveBlend * params.waveBlur;
      streakBlurPass.uniforms.uRadius.value = params.waveBlurLength;
      bloomPass.strength = params.bloomStrength + waveBlend * params.waveBloom;

      if (starField) {
        starField.material.uniforms.uTime.value = elapsed;
      }

      composer.render();

      if (firstFrame) {
        firstFrame = false;
        requestAnimationFrame(() => loading.classList.add("is-hidden"));
      }
    });