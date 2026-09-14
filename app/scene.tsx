import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createExplosionLayout} from './explosion-layout';
import {decodeModelResponse} from './model-download';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,type Atlas,type SceneState} from './anatomy';

interface Props {
  atlas: Atlas;
  state: SceneState;
  onSelect: (id: string) => void;
  onProgress: (n: number) => void;
  onError: (s: string) => void;
  onAnchorUpdate?: (pos: { x: number; y: number; visible: boolean } | null) => void;
}

export default function AnatomyScene({atlas,state,onSelect,onProgress,onError,onAnchorUpdate}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  const select = useRef(onSelect);
  const anchorCallback = useRef(onAnchorUpdate);
  latest.current = state;
  select.current = onSelect;
  anchorCallback.current = onAnchorUpdate;

  useEffect(() => {
    const el = host.current!;
    let disposed = false, frame = 0, dirty = true, ready = false;
    let lastView = '', lastReset = -1, lastIsolate = '', lastTheme = '', lastXray: boolean | undefined = undefined;
    let layoutKey = '', amount = 0;
    let lastState: SceneState | null = null;
    const abort = new AbortController();

    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
    } catch {
      onError('WebGL tidak didukung atau dinonaktifkan di browser ini.');
      return;
    }

    const isDark = latest.current.theme !== 'light';
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
    renderer.setClearColor(isDark ? '#080B11' : '#f2f3f3');
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.28 : 1.12;
    renderer.localClippingEnabled = true;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Visualisasi Anatomi Manusia 3D Interaktif');

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(1.4, 1.05, 3.6);
    controls.target.set(0, 0.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.82;
    controls.zoomSpeed = 0.88;
    controls.minDistance = 0.07;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.96;
    controls.addEventListener('change', () => { dirty = true; });

    // Surgical Studio Environment
    const pmrem = new T.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();

    const hemi = new T.HemisphereLight(0xffffff, isDark ? 0x0f172a : 0xa7acb2, isDark ? 0.95 : 1.05);
    scene.add(hemi);

    const key = new T.DirectionalLight(0xfffdf7, isDark ? 2.8 : 2.3);
    key.position.set(-2.5, 4.5, 3.5);
    scene.add(key);

    const fill = new T.DirectionalLight(0x38bdf8, isDark ? 1.2 : 0.8);
    fill.position.set(-3, 1, -2);
    scene.add(fill);

    const rim = new T.DirectionalLight(isDark ? 0x38bdf8 : 0xe9f0ff, isDark ? 2.4 : 1.8);
    rim.position.set(2.5, 2.5, -3.2);
    scene.add(rim);

    // Platform & Holographic Medical Reticle
    const ground = new T.Mesh(
      new T.CircleGeometry(30, 96),
      new T.MeshStandardMaterial({ color: isDark ? 0x06080D : 0xd5d9dc, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.019;
    scene.add(ground);

    const platform = new T.Mesh(
      new T.CylinderGeometry(0.68, 0.72, 0.028, 100),
      new T.MeshStandardMaterial({ color: isDark ? 0x111722 : 0xeeeeec, metalness: 0.2, roughness: 0.6 })
    );
    platform.position.y = -0.016;
    scene.add(platform);

    const ring = new T.Mesh(
      new T.RingGeometry(0.63, 0.634, 128),
      new T.MeshBasicMaterial({ color: isDark ? 0x38bdf8 : 0x8c969f, transparent: true, opacity: isDark ? 0.35 : 0.4, side: T.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    scene.add(ring);

    const innerRing = new T.Mesh(
      new T.RingGeometry(0.54, 0.543, 128),
      new T.MeshBasicMaterial({ color: isDark ? 0x0ea5e9 : 0xa4aeb8, transparent: true, opacity: isDark ? 0.22 : 0.16, side: T.DoubleSide })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.001;
    scene.add(innerRing);

    // Data textures for GPU batching
    const width = T.MathUtils.ceilPowerOfTwo(atlas.parts.length);
    const data = new Float32Array(width * 4);
    const partTexture = new T.DataTexture(data, width, 1, T.RGBAFormat, T.FloatType);
    partTexture.needsUpdate = true;

    const selectedData = new Uint8Array(width * 4);
    const selectionTexture = new T.DataTexture(selectedData, width, 1);
    selectionTexture.needsUpdate = true;

    // CT Cross-Section Clipping Plane
    const clipPlane = new T.Plane(new T.Vector3(0, -1, 0), 2.0);
    const slicePlaneGeo = new T.PlaneGeometry(1.3, 1.3);
    const slicePlaneMat = new T.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: T.DoubleSide,
      depthWrite: false
    });
    const slicePlaneMesh = new T.Mesh(slicePlaneGeo, slicePlaneMat);
    slicePlaneMesh.visible = false;
    scene.add(slicePlaneMesh);

    const slicePlaneEdge = new T.LineSegments(
      new T.EdgesGeometry(slicePlaneGeo),
      new T.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    slicePlaneMesh.add(slicePlaneEdge);

    const materials: T.MeshStandardMaterial[] = [];
    const geometries: T.BufferGeometry[] = [];
    const pickers: (T.Mesh | undefined)[] = [];
    const centers = atlas.parts.map(p =>
      new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(0.5)
    );
    const offsets: T.Vector3[] = [];
    const bounds = atlas.parts.map(p => new T.Box3(new T.Vector3().fromArray(p.bounds[0]), new T.Vector3().fromArray(p.bounds[1])));
    let packingWidth = 1, packingHeight = 1;

    const markerPositions = new Float32Array(atlas.parts.length * 3);
    const markerGeometry = new T.BufferGeometry();
    markerGeometry.setAttribute('position', new T.BufferAttribute(markerPositions, 3));
    const markerMaterial = new T.PointsMaterial({
      color: isDark ? 0x38bdf8 : 0x64748b,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.72,
      depthTest: false
    });
    markerMaterial.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;'
      );
    };
    const markers = new T.Points(markerGeometry, markerMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 10;
    markers.visible = false;
    scene.add(markers);

    const hover = document.createElement('div');
    hover.className = 'part-hover';
    hover.setAttribute('role', 'tooltip');
    hover.hidden = true;
    el.appendChild(hover);

    type Target = { index: number; x: number; y: number; left: number; right: number; top: number; bottom: number };
    let targets: Target[] = [];
    const projected = new T.Vector3();

    const findTarget = (x: number, y: number, radius: number) => {
      let best = -1, score = Infinity;
      for (const t of targets) {
        const dx = Math.max(t.left - x, 0, x - t.right);
        const dy = Math.max(t.top - y, 0, y - t.bottom);
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const candidate = distance + Math.hypot(t.x - x, t.y - y) * 0.025;
        if (candidate < score) {
          score = candidate;
          best = t.index;
        }
      }
      return best;
    };

    const xrayUniform = { value: 0.0 };
    const timeUniform = { value: 0.0 };

    const materialFor = (system: string) => {
      const m = new T.MeshStandardMaterial({
        color: SYSTEMS.find(s => s.id === system)?.color ?? '#aebbb8',
        metalness: 0.1,
        roughness: 0.52,
        side: T.DoubleSide,
        transparent: system === 'integumentary',
        opacity: system === 'integumentary' ? 0.1 : 1,
        depthWrite: system !== 'integumentary'
      });
      m.userData.isSkin = system === 'integumentary';
      m.userData.isBone = system === 'skeletal';

      let sysCode = 0.0;
      if (system === 'cardiac') sysCode = 1.0;
      else if (system === 'respiratory') sysCode = 2.0;
      else if (system === 'arterial' || system === 'venous') sysCode = 3.0;
      else if (system === 'nervous') sysCode = 4.0;
      else if (system === 'skeletal') sysCode = 5.0;

      m.onBeforeCompile = shader => {
        shader.uniforms.partState = { value: partTexture };
        shader.uniforms.selectionState = { value: selectionTexture };
        shader.uniforms.stateWidth = { value: width };
        shader.uniforms.isXray = xrayUniform;
        shader.uniforms.uTime = timeUniform;
        shader.uniforms.systemCode = { value: sysCode };

        shader.vertexShader =
          'attribute float partIndex;\n' +
          'uniform sampler2D partState;\n' +
          'uniform sampler2D selectionState;\n' +
          'uniform float stateWidth;\n' +
          'uniform float systemCode;\n' +
          'uniform float uTime;\n' +
          'varying float partVisible;\n' +
          'varying float partSelected;\n' +
          'varying float vWorldY;\n' +
          shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n' +
          'vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);\n' +
          'vec4 state = texture2D(partState, stateUv);\n' +
          'transformed += state.xyz;\n' +
          // 1. CARDIAC SYSTOLIC / DIASTOLIC PULSE
          'if (systemCode > 0.5 && systemCode < 1.5) {\n' +
          '  float phase = mod(uTime * 1.2, 1.0);\n' +
          '  float twitch = exp(-phase * 12.0) * sin(phase * 35.0) * 0.018;\n' +
          '  transformed += normal * twitch;\n' +
          '}\n' +
          // 2. TIDAL RESPIRATORY EXPANSION (Lungs & Thorax at 14 breaths/min)
          'if (systemCode > 1.5 && systemCode < 2.5) {\n' +
          '  float breath = 0.5 + 0.5 * sin(uTime * 1.46);\n' +
          '  transformed.z += breath * 0.007;\n' +
          '  transformed.x += normal.x * breath * 0.005;\n' +
          '}\n' +
          // 3. HEMODYNAMIC VASCULAR PRESSURE WAVE
          'if (systemCode > 2.5 && systemCode < 3.5) {\n' +
          '  float flowWave = sin(uTime * 7.54 - transformed.y * 12.0);\n' +
          '  transformed += normal * max(0.0, flowWave) * 0.0035;\n' +
          '}\n' +
          'partVisible = state.w;\n' +
          'partSelected = texture2D(selectionState, stateUv).r;\n' +
          'vWorldY = transformed.y;'
        );

        shader.fragmentShader =
          'uniform float isXray;\n' +
          'uniform float uTime;\n' +
          'uniform float systemCode;\n' +
          'varying float partVisible;\n' +
          'varying float partSelected;\n' +
          'varying float vWorldY;\n' +
          shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;'
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec3 norm = normalize( vNormal );
vec3 viewDirection = normalize( - vViewPosition );
float fresnel = pow( 1.0 - max(dot(viewDirection, norm), 0.0), 2.4 );
float pulse = 0.5 + 0.5 * sin(uTime * 4.2);

if (isXray > 0.5) {
  // QUANTUM SPECTRAL DUAL-ENERGY TOMOGRAPHY
  vec3 xrayColor;
  if (systemCode > 4.5) {
    // Skeletal: Crystalline dense cortical bone with mineral fluorescence
    xrayColor = mix(vec3(0.12, 0.40, 0.60), vec3(0.96, 0.92, 0.80), fresnel * 1.8);
  } else if (systemCode > 2.5 && systemCode < 3.5) {
    // Vascular: Iodinated contrast angiographic neon emerald stream
    float flow = sin(uTime * 7.54 - vWorldY * 14.0);
    xrayColor = mix(vec3(0.04, 0.70, 0.50), vec3(0.25, 1.0, 0.85), max(0.0, flow) * 0.85 + fresnel);
  } else if (systemCode > 3.5 && systemCode < 4.5) {
    // Neural: Action potential bio-luminescent pulse
    float neural = pow(max(0.0, sin(uTime * 10.0 - vWorldY * 20.0)), 6.0);
    xrayColor = mix(vec3(0.08, 0.35, 0.85), vec3(0.35, 0.90, 1.0), neural * 1.4 + fresnel);
  } else {
    // Soft tissue: Deep radiolucent cyan
    xrayColor = mix(vec3(0.03, 0.20, 0.42), vec3(0.14, 0.70, 0.98), fresnel * 1.6);
  }

  float scanline = sin(vViewPosition.y * 130.0 - uTime * 4.5) * 0.035;
  vec3 xrayHighlight = vec3(0.18, 0.98, 0.88) * (1.15 + 0.35 * pulse);
  diffuseColor.rgb = mix(xrayColor + scanline, xrayHighlight, partSelected);
  diffuseColor.a = mix(clamp(0.20 + 0.78 * fresnel, 0.0, 1.0), 0.98, partSelected);
} else {
  // NORMAL BIO-PBR RENDERING WITH SUBSURFACE SCATTERING
  vec3 rimHighlight = vec3(0.24, 0.68, 0.98) * fresnel * 0.40;
  vec3 subSurface = vec3(0.72, 0.16, 0.10) * pow(1.0 - max(dot(-viewDirection, norm), 0.0), 3.2) * 0.075;
  diffuseColor.rgb += rimHighlight + subSurface;

  // VASCULAR HEMODYNAMIC STREAM GLOW
  if (systemCode > 2.5 && systemCode < 3.5) {
    float flow = sin(uTime * 7.54 - vWorldY * 12.0);
    diffuseColor.rgb += vec3(0.35, 0.05, 0.05) * max(0.0, flow);
  }

  // NEURAL ACTION POTENTIAL PULSE
  if (systemCode > 3.5 && systemCode < 4.5) {
    float neural = pow(max(0.0, sin(uTime * 9.0 - vWorldY * 18.0)), 8.0);
    diffuseColor.rgb += vec3(0.2, 0.75, 1.0) * neural * 0.75;
  }

  if (partSelected > 0.5) {
    vec3 selColor = mix(vec3(0.12, 0.92, 0.82), vec3(0.35, 0.88, 1.0), pulse);
    diffuseColor.rgb = mix(diffuseColor.rgb, selColor, 0.86);
  }
}`
        );
      };
      materials.push(m);
      return m;
    };

    const mats = new Map(SYSTEMS.map(s => [s.id, materialFor(s.id)]));
    let loaded = 0;

    const loadChunk = async (ci: number) => {
      const chunk = atlas.chunks[ci];
      const compressed = !!chunk.gzip && typeof DecompressionStream !== 'undefined';
      const response = await fetch(compressed ? chunk.gzip! : chunk.url, { signal: abort.signal });
      const buffer = await decodeModelResponse(response, chunk.bytes, compressed);
      if (disposed) return;
      const groups = new Map<string, T.BufferGeometry[]>();

      atlas.parts.forEach((p, i) => {
        if (p.chunk !== ci) return;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3));
        g.setAttribute('normal', new T.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true));
        g.setIndex(new T.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
        g.boundingBox = bounds[i].clone();
        g.computeBoundingSphere();
        const pick = new T.Mesh(g);
        pick.matrixAutoUpdate = false;
        pickers[i] = pick;
        geometries.push(g);
        g.setAttribute('partIndex', new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1));
        const list = groups.get(p.system) ?? [];
        list.push(g);
        groups.set(p.system, list);
      });

      groups.forEach((gs, system) => {
        const geometry = mergeGeometries(gs, false);
        if (!geometry) throw new Error('Could not assemble anatomy geometry.');
        geometries.push(geometry);
        const mesh = new T.Mesh(geometry, mats.get(system as never));
        mesh.frustumCulled = false;
        scene.add(mesh);
      });

      lastState = null;
      loaded++;
      onProgress(Math.round((loaded / atlas.chunks.length) * 100));
      dirty = true;
    };

    (async () => {
      try {
        let cursor = 0;
        await Promise.all(
          Array.from({ length: 3 }, async () => {
            while (cursor < atlas.chunks.length) {
              const i = cursor++;
              await loadChunk(i);
            }
          })
        );
        if (!disposed) {
          ready = true;
          dirty = true;
        }
      } catch (e) {
        if (!disposed) onError(e instanceof Error ? e.message : 'Could not load the anatomy.');
      }
    })();

    // Smooth Camera Transition State
    const camTargetStart = controls.target.clone();
    const camTargetEnd = controls.target.clone();
    const camPosStart = camera.position.clone();
    const camPosEnd = camera.position.clone();
    let camAnimT = 1.0;

    const fit = (view: string, extent = 0) => {
      const mobile = el.clientWidth < 768;
      const normalDistance = mobile
        ? Math.max(4.5, (1.8 * el.clientHeight) / Math.max(160, el.clientHeight - 350) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))))
        : 4;
      const reservedHeight = mobile ? 350 : 270;
      const availableAspect = Math.max(0.35, (el.clientWidth - (mobile ? 40 : 340)) / Math.max(160, el.clientHeight - reservedHeight));
      const atlasDistance =
        (Math.max(packingHeight, packingWidth / availableAspect) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) *
        (el.clientHeight / Math.max(160, el.clientHeight - reservedHeight)) *
        1.08;
      const distance = T.MathUtils.lerp(normalDistance, Math.max(0.2, atlasDistance), extent);
      if (extent > 0.8) view = 'front';

      let direction = new T.Vector3(0.35, 0.06, 1).normalize();
      let targetY = extent > 0.1 || mobile ? 0.85 : 0.68;
      let customDist = distance;

      if (view === 'front') { direction = new T.Vector3(0, 0.02, 1); }
      else if (view === 'back') { direction = new T.Vector3(0, 0.02, -1); }
      else if (view === 'side') { direction = new T.Vector3(1, 0.02, 0); }
      else if (view === 'head') { direction = new T.Vector3(0, 0.04, 1); targetY = 1.62; customDist = mobile ? 1.0 : 0.72; }
      else if (view === 'chest') { direction = new T.Vector3(0, 0.03, 1); targetY = 1.25; customDist = mobile ? 1.3 : 0.95; }
      else if (view === 'abdomen') { direction = new T.Vector3(0, 0.03, 1); targetY = 0.95; customDist = mobile ? 1.3 : 0.95; }
      else if (view === 'legs') { direction = new T.Vector3(0, 0.02, 1); targetY = 0.45; customDist = mobile ? 1.8 : 1.4; }

      camTargetStart.copy(controls.target);
      camTargetEnd.set(extent > 0.1 && el.clientWidth > 767 ? -packingWidth * 0.12 : 0, targetY, 0);
      camPosStart.copy(camera.position);
      camPosEnd.copy(camTargetEnd).addScaledVector(direction, customDist);
      camAnimT = 0.0;
      dirty = true;
    };

    const resize = () => {
      layoutKey = '';
      lastState = null;
      renderer.setPixelRatio(Math.min(devicePixelRatio, el.clientWidth < 768 || el.clientHeight < 600 ? 1.5 : 2));
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      fit(latest.current.view, amount);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    const tap = new PointerTap();
    const worldBox = new T.Box3();
    const hitPoint = new T.Vector3();

    const down = (e: PointerEvent) => {
      hover.hidden = true;
      tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch' ? 12 : 5);
    };

    const move = (e: PointerEvent) => {
      tap.move(e.pointerId, e.clientX, e.clientY);
      if (e.buttons || amount < 0.5 || e.pointerType === 'touch') {
        hover.hidden = true;
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const index = findTarget(x, y, 12);
      hover.hidden = index < 0;
      renderer.domElement.style.cursor = index < 0 ? 'grab' : 'pointer';
      if (index >= 0) {
        hover.textContent = atlas.parts[index].name;
        hover.style.left = `${Math.max(8, Math.min(x + 14, el.clientWidth - 260))}px`;
        hover.style.top = `${Math.max(8, Math.min(y + 18, el.clientHeight - 55))}px`;
      }
    };

    const cancel = (e: PointerEvent) => tap.cancel(e.pointerId);

    const up = (e: PointerEvent) => {
      const validTap = tap.up(e.pointerId, e.clientX, e.clientY);
      if (!validTap || !ready) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      let nearest = Infinity, found = -1;
      const hasSolid = atlas.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > 0.5);
      pickers.forEach((mesh, i) => {
        if (!mesh || data[i * 4 + 3] < 0.5 || (hasSolid && atlas.parts[i].system === 'integumentary')) return;
        worldBox.copy(bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits[0] && hits[0].distance < nearest) {
          nearest = hits[0].distance;
          found = i;
        }
      });
      if (found < 0 && amount > 0.45) {
        found = findTarget(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === 'touch' ? 24 : 16);
      }
      if (found >= 0) {
        hover.hidden = true;
        select.current(atlas.parts[found].id);
      }
    };

    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', cancel);

    const clock = new T.Clock();
    let lastExtent = -1;

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const s = latest.current;

      // Update shader dynamic uniforms
      timeUniform.value += dt;

      // Rotating holographic scanner pedestal rings
      if (ring) ring.rotation.z += dt * 0.12;
      if (innerRing) innerRing.rotation.z -= dt * 0.18;

      // Smooth Camera Interpolation
      if (camAnimT < 1.0) {
        camAnimT = Math.min(1.0, camAnimT + dt * 2.8);
        const ease = 1.0 - Math.pow(1.0 - camAnimT, 3);
        controls.target.lerpVectors(camTargetStart, camTargetEnd, ease);
        camera.position.lerpVectors(camPosStart, camPosEnd, ease);
        controls.update();
        dirty = true;
      }

      // Theme updates
      if (s.theme !== lastTheme) {
        const dark = s.theme !== 'light';
        renderer.setClearColor(dark ? '#080B11' : '#f2f3f3');
        renderer.toneMappingExposure = dark ? 1.28 : 1.12;
        ground.material.color.setHex(dark ? 0x06080D : 0xd5d9dc);
        platform.material.color.setHex(dark ? 0x111722 : 0xeeeeec);
        ring.material.color.setHex(dark ? 0x38bdf8 : 0x8c969f);
        ring.material.opacity = dark ? 0.35 : 0.4;
        innerRing.material.color.setHex(dark ? 0x0ea5e9 : 0xa4aeb8);
        innerRing.material.opacity = dark ? 0.22 : 0.16;
        key.intensity = dark ? 2.8 : 2.3;
        rim.intensity = dark ? 2.4 : 1.8;
        rim.color.setHex(dark ? 0x38bdf8 : 0xe9f0ff);
        hemi.groundColor.setHex(dark ? 0x0f172a : 0xa7acb2);
        hemi.intensity = dark ? 0.95 : 1.05;
        markerMaterial.color.setHex(dark ? 0x38bdf8 : 0x64748b);
        lastTheme = s.theme ?? '';
        dirty = true;
      }

      // X-Ray Mode updates
      if (s.xray !== lastXray) {
        xrayUniform.value = s.xray ? 1.0 : 0.0;
        materials.forEach(m => {
          m.transparent = !!s.xray || m.userData.isSkin;
          m.opacity = s.xray ? (m.userData.isBone ? 0.88 : 0.35) : (m.userData.isSkin ? 0.1 : 1.0);
          m.depthWrite = !s.xray && !m.userData.isSkin;
          m.needsUpdate = true;
        });
        lastXray = s.xray;
        dirty = true;
      }

      // CT Cross-Section Clipping Plane updates
      if (s.clipping?.enabled) {
        slicePlaneMesh.visible = true;
        const p = s.clipping.position;
        if (s.clipping.plane === 'axial') {
          clipPlane.normal.set(0, -1, 0);
          clipPlane.constant = p;
          slicePlaneMesh.rotation.set(-Math.PI / 2, 0, 0);
          slicePlaneMesh.position.set(0, p, 0);
        } else if (s.clipping.plane === 'sagittal') {
          const x = (p - 0.9) * 0.7;
          clipPlane.normal.set(-1, 0, 0);
          clipPlane.constant = x;
          slicePlaneMesh.rotation.set(0, Math.PI / 2, 0);
          slicePlaneMesh.position.set(x, 0.9, 0);
        } else {
          const z = (p - 0.9) * 0.5;
          clipPlane.normal.set(0, 0, -1);
          clipPlane.constant = z;
          slicePlaneMesh.rotation.set(0, 0, 0);
          slicePlaneMesh.position.set(0, 0.9, z);
        }
        materials.forEach(m => {
          if (!m.clippingPlanes || m.clippingPlanes.length === 0) {
            m.clippingPlanes = [clipPlane];
            m.clipShadows = true;
            m.needsUpdate = true;
          }
        });
        dirty = true;
      } else if (slicePlaneMesh.visible) {
        slicePlaneMesh.visible = false;
        materials.forEach(m => {
          if (m.clippingPlanes && m.clippingPlanes.length > 0) {
            m.clippingPlanes = [];
            m.needsUpdate = true;
          }
        });
        dirty = true;
      }

      const changed = lastState?.visible !== s.visible || lastState?.selected !== s.selected || lastState?.isolate !== s.isolate;
      const moving = Math.abs(amount - s.explode) > 0.0001;
      if (moving) {
        amount = T.MathUtils.damp(amount, s.explode, 8, dt);
        dirty = true;
      }

      if (changed || moving || lastExtent < 0) {
        const visible = new Set(s.visible), selection = new Set(s.selected);
        const visibleParts = atlas.parts.filter(p => s.isolate ? selection.has(p.id) : visible.has(p.system) || selection.has(p.id));
        const nextLayoutKey = visibleParts.map(p => p.id).join(',') + ':' + camera.aspect.toFixed(3);
        if (nextLayoutKey !== layoutKey) {
          const layout = createExplosionLayout(visibleParts, camera.aspect);
          packingWidth = layout.width;
          packingHeight = layout.height;
          atlas.parts.forEach((p, i) => {
            const cell = layout.cells.get(p.id);
            offsets[i] = cell ? new T.Vector3(cell.x, cell.y + 0.85, 0) : centers[i].clone();
          });
          layoutKey = nextLayoutKey;
          if (amount > 0.05 && !s.isolate) fit(s.view, Math.max(0, (amount - 0.3) / 0.7));
        }

        atlas.parts.forEach((p, i) => {
          const c = centers[i], destination = offsets[i];
          let dx = 0, dy = 0, dz = 0;
          if (amount <= 0.45) {
            const t = amount / 0.45;
            const group = SYSTEMS.findIndex(sys => sys.id === p.system);
            const angle = (group / SYSTEMS.length) * Math.PI * 2;
            dx = Math.sin(angle) * t * 0.48;
            dy = (c.y - 0.85) * t * 0.28;
            dz = Math.cos(angle) * t * 0.48;
          } else {
            const t = (amount - 0.45) / 0.55, group = SYSTEMS.findIndex(sys => sys.id === p.system), angle = (group / SYSTEMS.length) * Math.PI * 2;
            dx = T.MathUtils.lerp(Math.sin(angle) * 0.48, destination.x - c.x, t);
            dy = T.MathUtils.lerp((c.y - 0.85) * 0.28, destination.y - c.y, t);
            dz = T.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
          }
          const selected = selection.has(p.id);
          data.set([dx, dy, dz, (s.isolate ? selected : visible.has(p.system) || selected) ? 1 : 0], i * 4);
          selectedData[i * 4] = selected ? 255 : 0;
          markerPositions.set(data[i * 4 + 3] > 0.5 ? [c.x + dx, c.y + dy, c.z + dz] : [10000, 10000, 10000], i * 3);
          const mesh = pickers[i];
          if (mesh) {
            mesh.position.set(dx, dy, dz);
            mesh.updateMatrix();
            mesh.updateMatrixWorld(true);
          }
        });
        partTexture.needsUpdate = true;
        selectionTexture.needsUpdate = true;
        markerGeometry.attributes.position.needsUpdate = true;
        lastState = s;
        lastExtent = amount;
        dirty = true;
      }

      if (s.view !== lastView || s.reset !== lastReset) {
        fit(s.view, amount);
        lastView = s.view;
        lastReset = s.reset;
      }
      if (moving && !s.isolate) fit(amount > 0.5 ? 'front' : s.view, Math.max(0, (amount - 0.3) / 0.7));

      const isolateKey = s.isolate ? s.selected.join(',') + ':' + s.reset + ':' + s.inspectorOpen + ':' + camera.aspect : '';
      if (isolateKey !== lastIsolate || (s.isolate && moving)) {
        if (s.isolate) {
          const box = new T.Box3();
          atlas.parts.forEach((p, i) => {
            if (s.selected.includes(p.id)) box.union(bounds[i].clone().translate(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])));
          });
          if (!box.isEmpty()) {
            const center = box.getCenter(new T.Vector3());
            const size = box.getSize(new T.Vector3());
            const w = el.clientWidth, h = el.clientHeight, mobile = w < 768, landscape = w > h && h <= 600;
            let left = 20, right = w - 20, top = mobile ? 175 : 110, bottom = h - 170;
            if (s.inspectorOpen) {
              if (landscape) {
                right = w - 335; top = 100; bottom = h - 125;
              } else if (mobile) {
                const sheet = document.querySelector('.detail-sheet')?.getBoundingClientRect();
                const header = document.querySelector('.identity')?.getBoundingClientRect();
                top = (header?.bottom ?? 94) + 16;
                bottom = (sheet?.top ?? h * 0.58 - 139) - 16;
              } else {
                right = w - 370; left = w > 1100 ? 285 : 25;
              }
            }
            const availableWidth = Math.max(150, right - left);
            const availableHeight = Math.max(40, bottom - top);
            camera.setViewOffset(w, h, w / 2 - (left + right) / 2, h / 2 - (top + bottom) / 2, w, h);
            const distance = Math.max(
              0.07,
              (Math.max((size.y * h) / availableHeight, (size.x * w) / availableWidth / camera.aspect, size.z) /
                (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) *
                1.35
            );
            controls.maxDistance = Math.max(40, distance * 2);

            camTargetStart.copy(controls.target);
            camTargetEnd.copy(center);
            camPosStart.copy(camera.position);
            camPosEnd.copy(center).add(new T.Vector3(0.2, 0.1, 1).normalize().multiplyScalar(distance));
            camAnimT = 0.0;
            dirty = true;
          }
        } else if (lastIsolate) {
          camera.clearViewOffset();
          fit(s.view, amount);
        }
        lastIsolate = isolateKey;
      }

      // 3D Anchor Point projection for dynamic leader line HUD
      if (s.selected.length > 0) {
        const selIdx = atlas.parts.findIndex(p => s.selected.includes(p.id));
        if (selIdx >= 0) {
          const c = centers[selIdx].clone().add(new T.Vector3(data[selIdx * 4], data[selIdx * 4 + 1], data[selIdx * 4 + 2]));
          const projectedPos = c.clone().project(camera);
          if (projectedPos.z < 1.0) {
            const sx = ((projectedPos.x + 1) * el.clientWidth) / 2;
            const sy = ((-projectedPos.y + 1) * el.clientHeight) / 2;
            anchorCallback.current?.({ x: sx, y: sy, visible: true });
          } else {
            anchorCallback.current?.(null);
          }
        } else {
          anchorCallback.current?.(null);
        }
      } else {
        anchorCallback.current?.(null);
      }

      controls.enableRotate = amount < 0.8;
      controls.mouseButtons.LEFT = amount < 0.8 ? T.MOUSE.ROTATE : T.MOUSE.PAN;
      controls.touches.ONE = amount < 0.8 ? T.TOUCH.ROTATE : T.TOUCH.PAN;
      ground.visible = platform.visible = ring.visible = innerRing.visible = amount < 0.5 && !s.isolate;
      markers.visible = amount > 0.75;
      controls.autoRotate = s.rotate && !s.isolate && amount < 0.4;
      controls.autoRotateSpeed = 0.65;
      controls.update();
      if (controls.autoRotate) dirty = true;

      // Render loop
      if (dirty || s.heartbeat || camAnimT < 1.0 || s.selected.length > 0 || s.rotate || (ring && ring.visible)) {
        renderer.render(scene, camera);
        targets = [];
        if (amount > 0.45) {
          const hasSolid = atlas.parts.some((p, i) => p.system !== 'integumentary' && data[i * 4 + 3] > 0.5);
          atlas.parts.forEach((p, i) => {
            if (data[i * 4 + 3] < 0.5 || (hasSolid && p.system === 'integumentary')) return;
            let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
            for (let corner = 0; corner < 8; corner++) {
              projected.set(
                p.bounds[(corner & 1) ? 1 : 0][0] + data[i * 4],
                p.bounds[(corner & 2) ? 1 : 0][1] + data[i * 4 + 1],
                p.bounds[(corner & 4) ? 1 : 0][2] + data[i * 4 + 2]
              ).project(camera);
              const x = ((projected.x + 1) * el.clientWidth) / 2;
              const y = ((-projected.y + 1) * el.clientHeight) / 2;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
            projected.copy(centers[i]).add(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])).project(camera);
            if (projected.z < -1 || projected.z > 1) return;
            targets.push({ index: i, x: ((projected.x + 1) * el.clientWidth) / 2, y: ((-projected.y + 1) * el.clientHeight) / 2, left, right, top, bottom });
          });
        }
        if (camAnimT >= 1.0 && s.selected.length === 0 && !s.rotate) {
          dirty = false;
        }
      }
    };
    animate();

    const contextLost = (e: Event) => {
      e.preventDefault();
      onError('Sesi WebGL dihentikan oleh perangkat. Muat ulang peramban untuk melanjutkan.');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      scene.traverse(o => {
        if (o instanceof T.Mesh && !geometries.includes(o.geometry)) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(m => m.dispose());
        }
      });
      env.dispose();
      partTexture.dispose();
      selectionTexture.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      hover.remove();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [atlas]);

  return <div className="scene" ref={host} />;
}
