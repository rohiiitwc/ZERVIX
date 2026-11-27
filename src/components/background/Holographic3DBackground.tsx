"use client";

import { useEffect, useRef, useState } from "react";

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface StarParticle extends Point3D {
  vx: number;
  vy: number;
  vz: number;
  hue: "violet" | "cyan" | "blue";
  size: number;
}

// Golden ratio icosahedron vertices + edges for crisp 3D wireframe core
const PHI = (1 + Math.sqrt(5)) / 2;
const RAW_ICOSAHEDRON_VERTS: Point3D[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
].map(([x, y, z]) => {
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
});

const ICOSAHEDRON_EDGES: Array<[number, number]> = [
  [0, 11], [0, 5], [0, 1], [0, 7], [0, 10],
  [1, 5], [5, 11], [11, 10], [10, 7], [7, 1],
  [3, 9], [3, 4], [3, 2], [3, 6], [3, 8],
  [4, 9], [9, 8], [8, 6], [6, 2], [2, 4],
  [1, 9], [5, 4], [11, 2], [10, 6], [7, 8],
  [5, 9], [11, 4], [10, 2], [7, 6], [1, 8],
];

function rotatePoint(p: Point3D, ax: number, ay: number, az: number): Point3D {
  // X rotation
  const cosX = Math.cos(ax);
  const sinX = Math.sin(ax);
  const y1 = p.y * cosX - p.z * sinX;
  const z1 = p.y * sinX + p.z * cosX;

  // Y rotation
  const cosY = Math.cos(ay);
  const sinY = Math.sin(ay);
  const x2 = p.x * cosY + z1 * sinY;
  const z2 = -p.x * sinY + z1 * cosY;

  // Z rotation
  const cosZ = Math.cos(az);
  const sinZ = Math.sin(az);
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return { x: x3, y: y3, z: z2 };
}

export function Holographic3DBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const syncTheme = () => {
      const ds = document.documentElement.dataset.theme;
      if (ds === "light" || ds === "dark") {
        setIsLight(ds === "light");
        return;
      }
      const meta = document.querySelector('meta[name="color-scheme"]');
      setIsLight(meta?.getAttribute("content") === "light");
    };
    syncTheme();

    const onTheme = (e: Event) => {
      const detail = (e as CustomEvent<{ effective?: "light" | "dark" }>).detail;
      if (detail?.effective) {
        setIsLight(detail.effective === "light");
      } else {
        syncTheme();
      }
    };
    window.addEventListener("zervix:theme-updated", onTheme);
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      window.removeEventListener("zervix:theme-updated", onTheme);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;

    // Seed deterministic-feeling 3D depth particles
    const particles: StarParticle[] = Array.from({ length: 52 }, (_, i) => {
      const hues: Array<"violet" | "cyan" | "blue"> = ["violet", "cyan", "blue"];
      return {
        x: (Math.sin(i * 12.9898) * 0.5) * 1.9,
        y: (Math.cos(i * 78.233) * 0.5) * 1.4,
        z: ((i % 13) / 13) * 1.8 - 0.6,
        vx: Math.sin(i * 3.1) * 0.0007,
        vy: Math.cos(i * 2.7) * 0.0005,
        vz: 0.0006 + (i % 4) * 0.00018,
        hue: hues[i % 3],
        size: 1.4 + (i % 3) * 0.65,
      };
    });

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onPointerMove(e: PointerEvent) {
      if (!width || !height) return;
      targetX = (e.clientX / width - 0.5) * 2;
      targetY = (e.clientY / height - 0.5) * 2;
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    let time = 0;

    function drawFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      pointerX += (targetX - pointerX) * 0.05;
      pointerY += (targetY - pointerY) * 0.05;

      const violetRgb = isLight ? "109, 40, 217" : "139, 92, 246";
      const cyanRgb = isLight ? "8, 145, 178" : "34, 211, 238";
      const blueRgb = isLight ? "37, 99, 235" : "59, 130, 246";
      const lineAlphaBoost = isLight ? 1.12 : 1;

      // 1. Floating 3D Depth Constellation Field
      const projectedParticles: Array<{ x: number; y: number; depth: number; hue: string; size: number }> = [];
      for (const p of particles) {
        if (!prefersReduced) {
          p.x += p.vx;
          p.y += p.vy;
          p.z -= p.vz;
          if (p.z < -0.75) {
            p.z = 1.25;
            p.x = Math.sin(time + p.y * 5) * 1.1;
            p.y = Math.cos(time * 0.7 + p.x * 4) * 0.8;
          }
          if (p.x > 1.35 || p.x < -1.35) p.vx *= -1;
          if (p.y > 1.05 || p.y < -1.05) p.vy *= -1;
        }

        const perspective = 1.4 / (1.8 + p.z);
        const sx = width * 0.5 + (p.x + pointerX * 0.05 * (1 - p.z)) * width * 0.45 * perspective;
        const sy = height * 0.5 + (p.y + pointerY * 0.05 * (1 - p.z)) * height * 0.45 * perspective;
        const depth = Math.max(0.15, Math.min(1, perspective * 0.85));
        const rgb = p.hue === "violet" ? violetRgb : p.hue === "cyan" ? cyanRgb : blueRgb;
        projectedParticles.push({ x: sx, y: sy, depth, hue: rgb, size: p.size * perspective });
      }

      // Synaptic links between nearby 3D particles
      for (let i = 0; i < projectedParticles.length; i++) {
        const a = projectedParticles[i];
        for (let j = i + 1; j < projectedParticles.length; j++) {
          const b = projectedParticles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 135) {
            const alpha = (1 - dist / 135) * 0.14 * Math.min(a.depth, b.depth) * lineAlphaBoost;
            ctx.strokeStyle = `rgba(${cyanRgb}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const pt of projectedParticles) {
        ctx.fillStyle = `rgba(${pt.hue}, ${(0.42 * pt.depth * lineAlphaBoost).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0.8, pt.size), 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Primary 3D Holographic Geodesic Polyhedron Core (top-right depth focal point)
      const coreCenterX = width * (width >= 768 ? 0.82 : 0.75) + pointerX * 18;
      const coreCenterY = height * 0.28 + pointerY * 14;
      const coreRadius = Math.min(width, height) * (width >= 768 ? 0.19 : 0.24);

      const ax = time * 0.34 + pointerY * 0.22;
      const ay = time * 0.48 + pointerX * 0.28;
      const az = time * 0.16;

      const rotatedVerts = RAW_ICOSAHEDRON_VERTS.map((v) => rotatePoint(v, ax, ay, az));
      const projectedVerts = rotatedVerts.map((v) => {
        const persp = 2.6 / (3.1 - v.z);
        return {
          x: coreCenterX + v.x * coreRadius * persp,
          y: coreCenterY + v.y * coreRadius * persp,
          z: v.z,
          persp,
        };
      });

      // Edges
      for (const [i, j] of ICOSAHEDRON_EDGES) {
        const v1 = projectedVerts[i];
        const v2 = projectedVerts[j];
        const avgZ = (v1.z + v2.z) * 0.5;
        const depthAlpha = (0.14 + ((avgZ + 1) * 0.5) * 0.24) * lineAlphaBoost;
        ctx.strokeStyle =
          avgZ > 0
            ? `rgba(${cyanRgb}, ${depthAlpha.toFixed(3)})`
            : `rgba(${violetRgb}, ${(depthAlpha * 0.75).toFixed(3)})`;
        ctx.lineWidth = avgZ > 0.2 ? 1.35 : 0.85;
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.stroke();
      }

      // Vertices
      for (const v of projectedVerts) {
        const alpha = (0.22 + ((v.z + 1) * 0.5) * 0.45) * lineAlphaBoost;
        ctx.fillStyle = `rgba(${cyanRgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(v.x, v.y, 1.9 * v.persp, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Tilted 3D Orbital Data Rings around the Core
      const drawOrbitalRing = (
        radiusScale: number,
        tiltX: number,
        tiltY: number,
        ringSpeed: number,
        rgb: string
      ) => {
        const steps = 64;
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const pt = rotatePoint(
            {
              x: Math.cos(theta) * radiusScale,
              y: Math.sin(theta) * radiusScale,
              z: 0,
            },
            tiltX,
            tiltY + time * ringSpeed,
            time * 0.12
          );
          const persp = 2.6 / (3.1 - pt.z);
          const sx = coreCenterX + pt.x * coreRadius * persp;
          const sy = coreCenterY + pt.y * coreRadius * persp;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = `rgba(${rgb}, ${(0.18 * lineAlphaBoost).toFixed(3)})`;
        ctx.lineWidth = 1.05;
        ctx.stroke();

        // Orbiting telemetry node on ring
        const orbTheta = time * 1.1;
        const orbPt = rotatePoint(
          {
            x: Math.cos(orbTheta) * radiusScale,
            y: Math.sin(orbTheta) * radiusScale,
            z: 0,
          },
          tiltX,
          tiltY + time * ringSpeed,
          time * 0.12
        );
        const orbPersp = 2.6 / (3.1 - orbPt.z);
        ctx.fillStyle = `rgba(${rgb}, ${(0.75 * lineAlphaBoost).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(
          coreCenterX + orbPt.x * coreRadius * orbPersp,
          coreCenterY + orbPt.y * coreRadius * orbPersp,
          2.6,
          0,
          Math.PI * 2
        );
        ctx.fill();
      };

      drawOrbitalRing(1.38, 1.05, 0.35, 0.25, violetRgb);
      drawOrbitalRing(1.62, -0.82, -0.5, -0.2, cyanRgb);

      // 4. Secondary 3D Geometric Cube/Octahedron silhouette on lower-left background
      const leftX = width * 0.16 - pointerX * 14;
      const leftY = height * 0.78 - pointerY * 10;
      const leftR = Math.min(width, height) * 0.11;
      const octVerts: Point3D[] = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
      ].map((v) => rotatePoint(v, -time * 0.28, time * 0.36, 0.4));
      const octEdges: Array<[number, number]> = [
        [0, 2], [0, 3], [0, 4], [0, 5],
        [1, 2], [1, 3], [1, 4], [1, 5],
        [2, 4], [4, 3], [3, 5], [5, 2],
      ];
      const octProj = octVerts.map((v) => {
        const persp = 2.5 / (3.0 - v.z);
        return {
          x: leftX + v.x * leftR * persp,
          y: leftY + v.y * leftR * persp,
          z: v.z,
        };
      });
      for (const [i, j] of octEdges) {
        const a = octProj[i];
        const b = octProj[j];
        ctx.strokeStyle = `rgba(${violetRgb}, ${(0.16 * lineAlphaBoost).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      if (!prefersReduced) {
        time += 0.012;
        rafId = window.requestAnimationFrame(drawFrame);
      }
    }

    drawFrame();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [isLight]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
    >
      {/* Interactive 3D wireframe polyhedra & orbital telemetry canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Subtle CSS 3D perspective architectural floor grid */}
      <div className="zervix-3d-grid" />
    </div>
  );
}
