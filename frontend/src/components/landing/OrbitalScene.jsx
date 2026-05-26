import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function OrbitalScene() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Setup ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(0, 0, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x020209, 1);
    container.appendChild(renderer.domElement);

    // ── Lights ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const orangeLight = new THREE.PointLight(0xf97316, 1.2, 30);
    orangeLight.position.set(5, 5, 5);
    scene.add(orangeLight);
    const violetLight = new THREE.PointLight(0x5a4fe6, 0.6, 25);
    violetLight.position.set(-5, -3, 3);
    scene.add(violetLight);

    // ── Starfield ──
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 120;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 120;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xeae8f6, size: 0.12, transparent: true, opacity: 0.6, sizeAttenuation: true }));
    scene.add(stars);

    // ── Core Icosahedron (distorted with noise) ──
    const coreGeo = new THREE.IcosahedronGeometry(1.4, 24); // Increased detail for realistic sun surface
    const originalPositions = coreGeo.attributes.position.array.slice();
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.6,
      roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.95,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Inner glow sphere
    const glowGeo = new THREE.SphereGeometry(2.0, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.1, side: THREE.BackSide });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    // ── Orbital Rings ──
    const ringConfigs = [
      { radius: 2.5, color: 0xf97316, tiltX: 1.2, tiltZ: 0.3, speed: 0.08 },
      { radius: 3.8, color: 0x5a4fe6, tiltX: 0.8, tiltZ: -0.5, speed: -0.05 },
      { radius: 5.2, color: 0x22d3ee, tiltX: 1.5, tiltZ: 0.7, speed: 0.03 },
    ];
    const rings = ringConfigs.map(cfg => {
      const geo = new THREE.TorusGeometry(cfg.radius, 0.01, 16, 120);
      const mat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.22 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = cfg.tiltX;
      mesh.rotation.z = cfg.tiltZ;
      mesh.userData = cfg;
      scene.add(mesh);
      return mesh;
    });

    // ── Orbiting Particles ──
    const particleConfigs = [
      { ring: 0, color: 0xf97316, size: 0.1, speed: 0.6, offset: 0 },
      { ring: 0, color: 0xff9a2a, size: 0.06, speed: 0.6, offset: Math.PI },
      { ring: 1, color: 0x8580f0, size: 0.12, speed: -0.4, offset: 0.5 },
      { ring: 1, color: 0x22d3ee, size: 0.08, speed: -0.4, offset: Math.PI + 0.5 },
      { ring: 2, color: 0xf97316, size: 0.13, speed: 0.25, offset: 1 },
      { ring: 2, color: 0xa78bfa, size: 0.07, speed: 0.25, offset: Math.PI + 1 },
    ];

    const particles = particleConfigs.map(cfg => {
      const geo = new THREE.SphereGeometry(cfg.size, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: cfg.color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = cfg;
      scene.add(mesh);

      // Trail (simple line)
      const trailGeo = new THREE.BufferGeometry();
      const trailPositions = new Float32Array(30 * 3);
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      const trailMat = new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.25 });
      const trail = new THREE.Line(trailGeo, trailMat);
      scene.add(trail);

      return { mesh, trail, history: [] };
    });

    // ── Floating Particle Field ──
    const fieldCount = 200;
    const fieldGeo = new THREE.BufferGeometry();
    const fieldPos = new Float32Array(fieldCount * 3);
    for (let i = 0; i < fieldCount; i++) {
      fieldPos[i * 3] = (Math.random() - 0.5) * 20;
      fieldPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      fieldPos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    fieldGeo.setAttribute('position', new THREE.BufferAttribute(fieldPos, 3));
    const field = new THREE.Points(fieldGeo, new THREE.PointsMaterial({ color: 0xf97316, size: 0.04, transparent: true, opacity: 0.5, sizeAttenuation: true }));
    scene.add(field);

    // ── Mouse interaction ──
    let mouseX = 0, mouseY = 0;
    const onMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    // ── Resize ──
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Simple 3D noise function ──
    function noise3D(x, y, z) {
      return Math.sin(x * 1.7 + z * 0.3) * Math.cos(y * 2.1 + x * 0.5) * Math.sin(z * 1.3 + y * 0.7);
    }

    // ── Animation Loop ──
    let frameId;
    const clock = new THREE.Clock();

    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Distort core icosahedron for realistic solar surface
      const posAttr = coreGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const ox = originalPositions[i * 3];
        const oy = originalPositions[i * 3 + 1];
        const oz = originalPositions[i * 3 + 2];
        const n = noise3D(ox * 1.8 + t * 0.6, oy * 1.8 + t * 0.5, oz * 1.8 + t * 0.7);
        const scale = 1 + n * 0.08;
        posAttr.setXYZ(i, ox * scale, oy * scale, oz * scale);
      }
      posAttr.needsUpdate = true;
      coreGeo.computeVertexNormals();

      // Float core
      core.rotation.y = t * 0.15;
      core.rotation.z = Math.sin(t * 0.3) * 0.1;
      core.position.y = Math.sin(t * 0.5) * 0.15;

      // Glow pulse
      glow.scale.setScalar(1 + Math.sin(t * 0.8) * 0.08);

      // Rotate rings
      rings.forEach(ring => {
        ring.rotation.z += ring.userData.speed * 0.01;
      });

      // Move particles along orbits
      particles.forEach(p => {
        const cfg = p.mesh.userData;
        const ringCfg = ringConfigs[cfg.ring];
        const angle = t * cfg.speed + cfg.offset;
        const x = Math.cos(angle) * ringCfg.radius;
        const z = Math.sin(angle) * ringCfg.radius;

        // Apply ring tilt rotation
        const cos_tx = Math.cos(ringCfg.tiltX), sin_tx = Math.sin(ringCfg.tiltX);
        const cos_tz = Math.cos(ringCfg.tiltZ), sin_tz = Math.sin(ringCfg.tiltZ);
        let rx = x, ry = 0, rz = z;
        // Rotate around X
        const ty = ry * cos_tx - rz * sin_tx;
        const tz = ry * sin_tx + rz * cos_tx;
        ry = ty; rz = tz;
        // Rotate around Z
        const tx2 = rx * cos_tz - ry * sin_tz;
        const ty2 = rx * sin_tz + ry * cos_tz;
        rx = tx2; ry = ty2;

        p.mesh.position.set(rx, ry, rz);

        // Update trail
        p.history.push(rx, ry, rz);
        if (p.history.length > 90) p.history.splice(0, 3);
        const trailPos = p.trail.geometry.attributes.position;
        for (let i = 0; i < 30; i++) {
          const idx = i * 3;
          if (idx < p.history.length) {
            trailPos.setXYZ(i, p.history[p.history.length - idx - 3] || 0, p.history[p.history.length - idx - 2] || 0, p.history[p.history.length - idx - 1] || 0);
          }
        }
        trailPos.needsUpdate = true;
      });

      // Rotate starfield and particle field slowly
      stars.rotation.y = t * 0.008;
      field.rotation.y = t * 0.015;
      field.rotation.x = Math.sin(t * 0.01) * 0.05;

      // Camera follows mouse gently
      camera.position.x += (mouseX * 0.8 - camera.position.x) * 0.02;
      camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />;
}
