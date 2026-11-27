import { useEffect, useRef } from "react";

/**
 * Background for the TV: layered silk bands of grain, slowly billowing, in Twigeo's light
 * colours. One small WebGL shader, drawn at half resolution and at most 30 frames a second,
 * paused while the tab is hidden. If WebGL isn't available it draws nothing (the CSS colour
 * fields behind it stay visible).
 */
const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float t;

// warm paper, peach, Twigeo orange, a touch of soft yellow
const vec3 PAPER  = vec3(0.957, 0.937, 0.910);
const vec3 PEACH  = vec3(1.000, 0.855, 0.760);
const vec3 ORANGE = vec3(1.000, 0.560, 0.300);
const vec3 BUTTER = vec3(0.975, 0.965, 0.700);

float hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }

float noise(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  float aspect = res.x / res.y;
  vec2 q = vec2(uv.x * aspect, uv.y);
  vec3 col = PAPER;

  // Five silk layers: each a soft band whose centre line billows with slow noise
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float speed = 0.035 + fi * 0.012;
    float centre = 0.18 + fi * 0.17
      + 0.10 * sin(q.x * (1.1 + fi * 0.35) + t * speed * 6.0 + fi * 1.7)
      + 0.08 * (noise(vec2(q.x * 1.6 + t * speed, fi * 3.1)) - 0.5);
    float d = abs(uv.y - centre);
    float width = 0.06 + 0.04 * noise(vec2(q.x * 2.0 - t * speed, fi));
    float band = smoothstep(width, 0.0, d);

    // grain: the band is made of particles, denser in the middle of the band
    float g = hash(floor(gl_FragCoord.xy) + floor(t * 12.0) * 17.0 + fi * 31.0);
    float particles = step(1.0 - band * 0.85, g);

    vec3 tint = fi < 1.5 ? ORANGE : (fi < 3.5 ? PEACH : BUTTER);
    col = mix(col, tint, particles * (0.15 + 0.08 * band) + band * 0.08);
  }

  // a whisper of overall film grain so flat areas aren't dead
  col += (hash(gl_FragCoord.xy + t) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}
`;

const SCALE = 0.5; // draw at half resolution: plenty for a soft background, light on TVs
const FRAME_MS = 1000 / 30;

export function GrainSilk() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) {
      canvas.style.display = "none";
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      canvas.style.display = "none";
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "res");
    const uT = gl.getUniformLocation(prog, "t");

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * SCALE));
      const h = Math.max(1, Math.round(canvas.clientHeight * SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let last = 0;
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden || now - last < FRAME_MS) return;
      last = now;
      gl.uniform1f(uT, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    if (still) {
      gl.uniform1f(uT, 20);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full" style={{ imageRendering: "auto" }} />;
}
