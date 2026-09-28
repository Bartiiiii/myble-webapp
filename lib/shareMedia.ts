// Picture + clip export for the configurator's share dialog.
//
// Both come out portrait 9:16 (stories, reels, a phone's camera roll) and are
// rendered frame by frame through the live R3F renderer at export size, rather
// than scraped off the on-screen canvas:
//
//   • the picture is one 1080 × 1920 frame at the current camera angle, as PNG;
//   • the clip is one full, seamless turn around the piece, encoded to H.264 in
//     a regular MP4. That is the one format every phone, laptop and messenger
//     opens. The old MediaRecorder route produced WebM, or on Safari a
//     fragmented MP4, that many players refused.
//
// The clip always comes out as that same MP4, whatever the browser:
//
//   1. WebCodecs (the browser's own, usually hardware, H.264 encoder) muxed by
//      mediabunny: Chrome/Edge 94+, Safari 16.4+, most Firefox builds;
//   2. otherwise a WebAssembly H.264 encoder, self-hosted in public/vendor and
//      only fetched when needed: older Safari, Firefox without an H.264
//      encoder, anything else that runs the 3D viewer at all (WebGL 2 already
//      rules out every browser without WebAssembly);
//   3. MediaRecorder only if both are somehow unavailable.
import * as THREE from "three";
import type { RootState } from "@react-three/fiber";

export const EXPORT_ASPECT = 9 / 16;
const PICTURE = { width: 1080, height: 1920 };
const CLIP_SIZES = [
  { width: 1080, height: 1920 },
  { width: 720, height: 1280 },
];
const FPS = 30;
/** One full turn. Long enough to read the piece, short enough to loop. */
const CLIP_SECONDS = 6;
const WASM_SIZE = { width: 720, height: 1280 };
const WASM_SCRIPT = "/vendor/h264-mp4-encoder.web.js";

/** 0..1 while a clip is being made, for the progress line in the dialog. */
export type Progress = (fraction: number) => void;

/** Which encoder to use; the override exists to exercise the fallbacks. */
type Engine = "webcodecs" | "wasm" | "recorder";
function forcedEngine(): Engine | null {
  try {
    const v = localStorage.getItem("myble.clipEncoder");
    return v === "webcodecs" || v === "wasm" || v === "recorder" ? v : null;
  } catch {
    return null;
  }
}
type Store = RootState["get"];

/**
 * Resize the renderer to the export size for the duration of `fn`, with the
 * render loop paused so nothing else draws into the buffer in between, then
 * put everything back exactly as it was.
 */
async function atExportSize<T>(
  get: Store,
  size: { width: number; height: number },
  fn: (state: RootState) => Promise<T>,
): Promise<T> {
  const state = get();
  const { gl, setFrameloop } = state;
  const camera = state.camera as THREE.PerspectiveCamera;
  const prev = { ratio: gl.getPixelRatio(), width: state.size.width, height: state.size.height, aspect: camera.aspect };

  setFrameloop("never");
  gl.setPixelRatio(1);
  gl.setSize(size.width, size.height, false);
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  try {
    return await fn(get());
  } finally {
    gl.setPixelRatio(prev.ratio);
    gl.setSize(prev.width, prev.height, false);
    camera.aspect = prev.aspect;
    camera.updateProjectionMatrix();
    setFrameloop("always");
  }
}

/** The PNG: one frame at the angle the preview is showing right now. */
export async function renderPicture(get: Store): Promise<Blob> {
  return atExportSize(get, PICTURE, async ({ gl, scene, camera }) => {
    gl.render(scene, camera);
    const blob = await new Promise<Blob | null>((resolve) => gl.domElement.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("no_blob");
    return blob;
  });
}

/** Camera placement for frame `i` of a full turn that starts where it stands. */
function orbit(camera: THREE.Camera, start: THREE.Vector3, i: number, frames: number) {
  const radius = Math.hypot(start.x, start.z);
  const a0 = Math.atan2(start.x, start.z);
  const a = a0 + (2 * Math.PI * i) / frames;
  camera.position.set(Math.sin(a) * radius, start.y, Math.cos(a) * radius);
  camera.lookAt(0, 0, 0);
}

export interface Clip {
  blob: Blob;
  extension: "mp4" | "webm";
}

/** The clip: always an MP4/H.264, by the best encoder this browser has. */
export async function renderClip(get: Store, onProgress?: Progress): Promise<Clip> {
  const forced = forcedEngine();
  if (forced !== "wasm" && forced !== "recorder" && typeof VideoEncoder !== "undefined") {
    try {
      const mb = await import("mediabunny");
      for (const size of CLIP_SIZES) {
        if (await mb.canEncodeVideo("avc", { ...size, bitrate: 8_000_000 })) {
          return await encodeMp4(get, size, mb, onProgress);
        }
      }
    } catch {
      // A WebCodecs build that advertises H.264 and then fails is not the end:
      // the WebAssembly encoder below produces the very same file.
    }
  }
  if (forced !== "recorder" && typeof WebAssembly === "object") {
    try {
      return await encodeWasm(get, onProgress);
    } catch {
      /* fall through to the live recording */
    }
  }
  return recordFallback(get, onProgress);
}

async function encodeMp4(
  get: Store,
  size: { width: number; height: number },
  mb: typeof import("mediabunny"),
  onProgress?: Progress,
): Promise<Clip> {
  return atExportSize(get, size, async ({ gl, scene, camera }) => {
    const start = camera.position.clone();
    const output = new mb.Output({
      // In-memory fast start puts the index at the front: a plain, seekable
      // MP4 rather than a fragmented stream.
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const source = new mb.CanvasSource(gl.domElement, { codec: "avc", bitrate: 8_000_000, keyFrameInterval: 1 });
    output.addVideoTrack(source, { frameRate: FPS });
    await output.start();

    const frames = FPS * CLIP_SECONDS;
    try {
      for (let i = 0; i < frames; i++) {
        orbit(camera, start, i, frames);
        gl.render(scene, camera);
        await source.add(i / FPS, 1 / FPS);
        onProgress?.((i + 1) / frames);
      }
      await output.finalize();
    } finally {
      camera.position.copy(start);
      camera.lookAt(0, 0, 0);
    }

    const buffer = output.target.buffer;
    if (!buffer) throw new Error("no_buffer");
    return { blob: new Blob([buffer], { type: "video/mp4" }), extension: "mp4" as const };
  });
}

interface WasmEncoder {
  width: number;
  height: number;
  frameRate: number;
  speed: number;
  quantizationParameter: number;
  groupOfPictures: number;
  outputFilename: string;
  initialize(): void;
  addFrameRgba(buffer: Uint8ClampedArray): void;
  finalize(): void;
  delete(): void;
  FS: { readFile(path: string): Uint8Array; unlink(path: string): void };
}
type WasmGlobal = { createH264MP4Encoder(): Promise<WasmEncoder> };

let wasmLoading: Promise<WasmGlobal> | null = null;

/** The encoder script defines a global `HME`; load it once, on first use. */
function loadWasmEncoder(): Promise<WasmGlobal> {
  const w = window as unknown as { HME?: WasmGlobal };
  if (w.HME) return Promise.resolve(w.HME);
  wasmLoading ??= new Promise<WasmGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WASM_SCRIPT;
    script.async = true;
    script.onload = () => (w.HME ? resolve(w.HME) : reject(new Error("encoder_missing")));
    script.onerror = () => reject(new Error("encoder_load_failed"));
    document.head.appendChild(script);
  }).catch((err) => {
    wasmLoading = null; // let a later tap try the download again
    throw err;
  });
  return wasmLoading;
}

/** Hand the page a moment to repaint (the progress line) between frames. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * The same MP4/H.264 clip as the WebCodecs path, encoded in software by
 * WebAssembly. Slower (a few seconds more) and at 720 × 1280, but it runs in
 * every browser that can show the configurator at all.
 */
async function encodeWasm(get: Store, onProgress?: Progress): Promise<Clip> {
  const HME = await loadWasmEncoder();
  const encoder = await HME.createH264MP4Encoder();
  const { width, height } = WASM_SIZE;
  encoder.width = width;
  encoder.height = height;
  encoder.frameRate = FPS;
  encoder.speed = 8; // 0 = best, 10 = fastest; 8 keeps a laptop well under 20 s
  encoder.quantizationParameter = 24; // lower = sharper; 24 keeps board edges crisp
  encoder.groupOfPictures = FPS;
  encoder.initialize();

  // Frames come off the WebGL canvas through a 2D canvas: getImageData hands
  // over RGBA the right way up, which readPixels would not.
  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no_2d");

  try {
    await atExportSize(get, WASM_SIZE, async ({ gl, scene, camera }) => {
      const start = camera.position.clone();
      const frames = FPS * CLIP_SECONDS;
      try {
        for (let i = 0; i < frames; i++) {
          orbit(camera, start, i, frames);
          gl.render(scene, camera);
          ctx.drawImage(gl.domElement, 0, 0, width, height);
          encoder.addFrameRgba(ctx.getImageData(0, 0, width, height).data);
          onProgress?.((i + 1) / frames);
          if (i % 4 === 3) await breathe();
        }
      } finally {
        camera.position.copy(start);
        camera.lookAt(0, 0, 0);
      }
    });
    encoder.finalize();
    const bytes = encoder.FS.readFile(encoder.outputFilename);
    try {
      encoder.FS.unlink(encoder.outputFilename); // the FS is shared; don't leave 1 MB behind
    } catch {
      /* already gone */
    }
    return { blob: await fastStart(new Blob([bytes.slice()], { type: "video/mp4" })), extension: "mp4" };
  } finally {
    encoder.delete();
  }
}

/**
 * The WebAssembly encoder writes the MP4 index after the video data. Players
 * cope with that for a saved file, but some previews and upload pipelines
 * want it up front, as the WebCodecs path writes it. Rewriting the container
 * copies the H.264 packets untouched (no decoder, no re-encode), so it works
 * without WebCodecs too; if it fails for any reason the original stands.
 */
async function fastStart(blob: Blob): Promise<Blob> {
  try {
    const mb = await import("mediabunny");
    const input = new mb.Input({ source: new mb.BlobSource(blob), formats: [mb.MP4] });
    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const conversion = await mb.Conversion.init({ input, output });
    if (!conversion.isValid) return blob;
    await conversion.execute();
    const buffer = output.target.buffer;
    return buffer ? new Blob([buffer], { type: "video/mp4" }) : blob;
  } catch {
    return blob;
  }
}

/** Last resort if neither encoder is available: record the turn live. */
async function recordFallback(get: Store, onProgress?: Progress): Promise<Clip> {
  if (typeof MediaRecorder === "undefined") throw new Error("video_unsupported");
  const mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  if (!mime) throw new Error("video_unsupported");

  return atExportSize(get, CLIP_SIZES[1], async ({ gl, scene, camera }) => {
    if (typeof gl.domElement.captureStream !== "function") throw new Error("video_unsupported");
    const start = camera.position.clone();
    const stream = gl.domElement.captureStream(FPS);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    const frames = FPS * CLIP_SECONDS;
    recorder.start();
    const t0 = performance.now();
    try {
      // Real time here: the recorder timestamps frames as they arrive.
      await new Promise<void>((resolve) => {
        const tick = () => {
          const i = Math.min(frames, Math.floor(((performance.now() - t0) / 1000) * FPS));
          orbit(camera, start, i, frames);
          onProgress?.(i / frames);
          gl.render(scene, camera);
          if (i >= frames) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      recorder.stop();
      await stopped;
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      camera.position.copy(start);
      camera.lookAt(0, 0, 0);
    }
    const type = mime.split(";")[0];
    return { blob: new Blob(chunks, { type }), extension: type === "video/mp4" ? "mp4" : "webm" };
  });
}
