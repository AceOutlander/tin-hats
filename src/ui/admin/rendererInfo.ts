/**
 * The admin panel's renderer readout (debug tab): what the battlefield is drawn with, so the owner can check a phone
 * (an iPhone's Safari above all) without a computer. The figures the view measures come in through AdminInfo; the rest
 * is asked of the game's own canvas: getContext on a canvas that already has a context returns that one (or null for
 * another kind), so this never creates a second context.
 */
import type { AdminInfo } from './contracts';

type Gl = WebGLRenderingContext | WebGL2RenderingContext;

/** The game's canvas (not the admin panel's own debug canvas), or null before the view has made it. */
function gameCanvas(doc: Document): HTMLCanvasElement | null {
  return doc.querySelector<HTMLCanvasElement>('canvas:not(.th-admin-canvas)');
}

function context(canvas: HTMLCanvasElement): { gl: Gl | null; kind: string } {
  try {
    const gl2 = canvas.getContext('webgl2');
    if (gl2) return { gl: gl2, kind: 'WebGL 2' };
    const gl1 = canvas.getContext('webgl');
    if (gl1) return { gl: gl1, kind: 'WebGL 1' };
    if (canvas.getContext('2d')) return { gl: null, kind: 'Canvas 2D' };
  } catch {
    // A browser that throws on asking: reported as unknown.
  }
  return { gl: null, kind: 'unknown' };
}

/** The readout lines: renderer, GPU, limits, sizes and the frame-time governor's quality level. */
export function rendererLines(render: AdminInfo['render'], doc: Document): string[] {
  const lines: string[] = [];
  const canvas = gameCanvas(doc);
  if (!canvas) return ['No game canvas yet'];
  const { gl, kind } = context(canvas);
  lines.push(`Renderer: ${kind}`);
  if (gl) {
    let vendor = String(gl.getParameter(gl.VENDOR));
    let gpu = String(gl.getParameter(gl.RENDERER));
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      vendor = String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
      gpu = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
    }
    lines.push(`GPU: ${gpu}`, `Vendor: ${vendor}`);
    lines.push(`Version: ${String(gl.getParameter(gl.VERSION))}`);
    lines.push(`Max texture: ${String(gl.getParameter(gl.MAX_TEXTURE_SIZE))} px, texture units ${String(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS))}`);
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    lines.push(`Fragment highp: ${hp && hp.precision > 0 ? 'yes' : 'no'}`);
    if (gl.isContextLost()) lines.push('Context LOST');
  }
  lines.push(`Canvas: ${render.canvasW}x${render.canvasH} px, pixel ratio ${render.dpr} (device ${doc.defaultView?.devicePixelRatio ?? 1})`);
  lines.push(`Quality level: ${render.quality} (0 = full)  FPS ${Math.round(render.fps)}`);
  return lines;
}
