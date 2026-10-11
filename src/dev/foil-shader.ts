// Dev prototype: WebGL foil renderer. One fragment shader draws the card scan and the foil
// effect for the hovered card, so foil can respond per pixel to the image and the tilt.

export const foilShaderTypes = {
  nonfoil: 0,
  foil: 1,
  etched: 2,
  surgefoil: 3,
  ripplefoil: 4,
  halofoil: 5,
  galaxyfoil: 6,
  silverfoil: 7,
  rainbowfoil: 8,
  doublerainbow: 8,
} as const

const vertexSource = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const fragmentSource = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uPointer;   // 0..1 across the card; (0.5, 0.5) is flat
uniform vec2 uTexel;     // 1 / image size
uniform float uTime;
uniform float uAspect;   // height / width
uniform int uType;

const float TAU = 6.28318530718;

vec3 rainbow(float t) {
  return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    total += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return total;
}
float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}
// Screen blend: foil adds light without hiding the ink beneath it.
vec3 screen(vec3 base, vec3 light) {
  return 1.0 - (1.0 - base) * (1.0 - light);
}

// Hard light: foil colour tints light and dark areas alike, as reflected foil colour does.
// Mid-grey (0.5) leaves the base unchanged, so effects are built as offsets from 0.5.
vec3 hardLight(vec3 base, vec3 light) {
  return mix(2.0 * base * light, 1.0 - 2.0 * (1.0 - base) * (1.0 - light), step(0.5, light));
}

// Soft light (W3C formula), as CSS mix-blend-mode: soft-light.
vec3 softLight(vec3 base, vec3 light) {
  vec3 d = mix(sqrt(base), ((16.0 * base - 12.0) * base + 4.0) * base, step(base, vec3(0.25)));
  return mix(base - (1.0 - 2.0 * light) * base * (1.0 - base), base + (2.0 * light - 1.0) * (d - base), step(0.5, light));
}

void main() {
  vec3 base = texture2D(uImage, vUv).rgb;
  vec2 tilt = uPointer - 0.5;
  // Card-space coordinates with square units, so circles stay round.
  vec2 p = vec2(vUv.x, vUv.y * uAspect);
  float lum = luminance(base);
  // Real foil shines through light ink and is blocked by dark ink.
  float foilMask = 0.25 + 0.75 * smoothstep(0.05, 0.75, lum);
  // Broad specular highlight that follows the pointer.
  float glare = exp(-pow(length((vUv - uPointer) * vec2(1.0, uAspect)) / 0.45, 2.0));
  vec3 colour = base;

  if (uType == 1 || uType == 8) {
    // Traditional or rainbow foil: holographic sheen in diagonal bands that sweep and change
    // colour with the tilt; strongest near the light, faint elsewhere.
    float strength = uType == 8 ? 0.75 : 0.5;
    float along = dot(vUv - uPointer, vec2(0.8, 0.6));
    float sweep = 0.35 + 0.65 * exp(-pow(along / 0.3, 2.0));
    float hue = dot(vUv, vec2(0.9, 0.6)) * 1.4 + tilt.x * 1.5 + tilt.y;
    float amount = strength * foilMask * sweep * (0.2 + 0.8 * glare);
    colour = hardLight(base, 0.5 + (rainbow(hue) - 0.5) * amount);
  } else if (uType == 2) {
    // Etched, ported from the CSS effect: gold edges found with a 3x3 Laplacian inside the art box
    // only, masked to a circle around the light; a soft-light gold sheen; a faint warm glow.
    float centre = luminance(base);
    float around = 0.0;
    for (int dy = -1; dy <= 1; dy++)
      for (int dx = -1; dx <= 1; dx++)
        around += luminance(texture2D(uImage, vUv + vec2(float(dx), float(dy)) * uTexel).rgb);
    float laplacian = 9.0 * centre - around;
    float edgeAlpha = clamp(3.0 * laplacian - 0.12, 0.0, 1.0);
    float inArt = step(0.07, vUv.x) * step(vUv.x, 0.93) * step(0.08, vUv.y) * step(vUv.y, 0.55);
    float near = length((vUv - uPointer) * vec2(1.0, uAspect)) / 1.2;
    float edgeMask = mix(1.0, 0.53, smoothstep(0.18, 0.35, near)) * (1.0 - smoothstep(0.35, 0.58, near));
    vec3 edged = screen(base, vec3(1.0, 0.88, 0.55) * edgeAlpha * edgeMask * inArt);
    float diagonal = dot(vUv - uPointer / 3.0, vec2(0.57, 0.82)) * 1.2;
    vec3 sheenColour = mix(vec3(0.22, 0.18, 0.16), vec3(0.91, 0.84, 0.67), 0.5 + 0.5 * sin(diagonal * TAU));
    vec3 sheen = softLight(edged, mix(vec3(0.5), sheenColour, 0.4 * 0.88));
    float glow = mix(0.22, 0.0, smoothstep(0.0, 0.58, length(vUv - uPointer)));
    colour = screen(sheen, vec3(1.0, 0.94, 0.77) * glow * 0.45);
  } else if (uType == 3) {
    // Surge: noise stretched along steep streaks rising to the right and thresholded into
    // bands of varied width, like brushed flames; saturated rainbow that shifts with the tilt.
    vec2 q = mat2(0.5, -0.87, 0.87, 0.5) * p;
    q += (vec2(fbm(p * 1.4), fbm(p * 1.4 + 7.3)) - 0.5) * 0.25;
    vec2 stretched = vec2(q.x * 2.6, q.y * 14.0) + tilt * vec2(1.5, 4.0);
    stretched.y += (fbm(q * vec2(3.0, 5.0) + 2.7) - 0.5) * 4.0;
    float streaks = fbm(stretched);
    float bands = smoothstep(0.46, 0.72, streaks) * (0.6 + 0.4 * noise(vec2(q.x * 5.0, q.y * 60.0)));
    float reveal = smoothstep(0.18, 0.48, fbm(p * 1.3 + tilt * 1.6));
    vec3 hue = rainbow(q.y * 2.4 + streaks * 1.5 + tilt.x * 2.0 + tilt.y);
    float amount = bands * reveal * (0.75 + 0.7 * glare);
    colour = hardLight(base, 0.5 + (hue - 0.5) * clamp(amount, 0.0, 0.65));
  } else if (uType == 4) {
    // Ripple: rings on a 4x4 grid; the checkerboard sets grow from zero and shrink back in turn.
    // Each ring only shows the arc facing the light, so where four rings meet near the light
    // their arcs converge into a star-like shape. Colour shifts with the angle around the ring.
    float t = clamp(uPointer.x * 0.5 + uPointer.y * 0.5, 0.0, 1.0);
    vec2 light = vec2(uPointer.x, uPointer.y * uAspect);
    vec3 rings = vec3(0.0); // offsets from neutral grey
    for (int row = 0; row < 6; row++) {
      for (int col = 0; col < 4; col++) {
        vec2 centre = vec2((float(col) + 0.5) * 0.25, (float(row) + 0.5) * 0.25);
        bool even = mod(float(row + col), 2.0) < 0.5;
        float radius = mix(0.0, 0.42, even ? t : 1.0 - t);
        vec2 fromCentre = p - centre;
        float offset = (length(fromCentre) - radius) / 0.018;
        float band = exp(-offset * offset) * smoothstep(0.0, 0.04, radius);
        vec2 towardLight = light - centre;
        float facing = dot(normalize(fromCentre + 0.0001), normalize(towardLight + 0.0001));
        float arc = smoothstep(0.35, 0.95, facing) * exp(-pow(length(towardLight) / 0.55, 2.0));
        float hue = offset * 0.1 + atan(fromCentre.y, fromCentre.x) / TAU + dot(tilt, vec2(1.7, 1.1));
        rings += (rainbow(hue) - 0.5) * band * arc;
      }
    }
    colour = hardLight(base, clamp(0.5 + rings * 0.5, 0.0, 1.0));
  } else if (uType == 5) {
    // Halo: domain-warped marbling, mostly silver with rainbow and dark veins,
    // revealed in patches by large noise that shifts with the tilt.
    vec2 q = p * 2.2;
    vec2 warp = vec2(fbm(q + vec2(0.0, uTime * 0.02)), fbm(q + vec2(5.2, 1.3)));
    float marble = fbm(q + warp * 3.0);
    float bands = 0.5 + 0.5 * sin(marble * 22.0 + tilt.x * 4.0);
    vec3 silver = vec3(0.86, 0.9, 0.96);
    vec3 tint = mix(silver, rainbow(marble * 2.5 + tilt.y * 2.0), 0.55);
    // Thin, soft dark veins between silver and tinted bands.
    vec3 halo = mix(vec3(0.38), mix(silver, tint, smoothstep(0.55, 0.95, bands)), smoothstep(0.04, 0.2, bands));
    float reveal = smoothstep(0.46, 0.68, fbm(p * 1.1 - tilt * 1.4 + 3.0));
    colour = hardLight(base, 0.5 + (halo - 0.5) * 0.5 * reveal);
  } else if (uType == 6) {
    // Galaxy: round rainbow glitter points and larger stars. Each point twinkles at its own angle,
    // and a large noise reveal shifts with the tilt, so only some areas sparkle at once.
    float reveal = smoothstep(0.25, 0.52, fbm(p * 1.4 + tilt * 1.8 + 11.0));
    vec2 grid = p * 90.0;
    vec2 cell = floor(grid);
    float seed = hash(cell);
    vec2 spot = fract(grid) - 0.5 - (vec2(hash(cell + 1.3), hash(cell + 4.7)) - 0.5) * 0.6;
    float point = smoothstep(0.2, 0.06, length(spot)) * step(0.5, seed);
    float twinkle = pow(max(0.0, cos(dot(tilt, vec2(hash(cell + 2.1), hash(cell + 8.4)) * 2.0 - 1.0) * 16.0 + seed * TAU)), 3.0);
    // Larger shapes, each with its own kind, size, rotation and colour: four-, five- and
    // six-point stars, dots, rings and small swirls. Each lights up only within its own narrow
    // range of viewing angles, so a few appear at a time and change as the card tilts.
    vec2 starGrid = p * 16.0;
    vec2 starCell = floor(starGrid);
    float starSeed = hash(starCell + 17.0);
    vec2 local = fract(starGrid) - 0.5 + (vec2(hash(starCell + 2.0), hash(starCell + 5.0)) - 0.5) * 0.4;
    float size = 0.12 + 0.22 * hash(starCell + 9.0);
    float kind = floor(hash(starCell + 13.0) * 6.0);
    float r = length(local) / size;
    float a = atan(local.y, local.x) + hash(starCell + 21.0) * TAU;
    float shape;
    if (kind < 3.0) {
      float points = kind + 4.0;
      float spike = pow(abs(cos(a * points * 0.5)), 6.0);
      shape = smoothstep(0.1, 0.0, r - mix(0.22, 1.0, spike));
    } else if (kind < 4.0) {
      shape = smoothstep(0.55, 0.35, r);
    } else if (kind < 5.0) {
      shape = smoothstep(0.14, 0.0, abs(r - 0.75));
    } else {
      float swirl = fract((a / TAU) + r * 1.4);
      shape = smoothstep(0.18, 0.0, abs(swirl - 0.5)) * smoothstep(1.0, 0.7, r);
    }
    vec2 starFacing = vec2(hash(starCell + 31.0), hash(starCell + 37.0)) * 2.0 - 1.0;
    float starTwinkle = pow(max(0.0, cos(dot(tilt, starFacing) * 14.0 + starSeed * TAU)), 10.0);
    float star = step(0.7, starSeed) * shape;
    vec3 glitter = (rainbow(seed * 3.0 + tilt.x) - 0.5) * point * twinkle;
    vec3 stars = (rainbow(starSeed * 5.0 + dot(tilt, starFacing) * 2.0) - 0.5) * star * starTwinkle * 1.6;
    float light = reveal * (0.55 + 0.9 * glare);
    colour = hardLight(base, clamp(0.5 + (glitter + stars) * light * 2.2, 0.0, 1.0));
  } else if (uType == 7) {
    // Silverscreen: monochrome print under a broad metallic silver sheen.
    float grey = luminance(base);
    vec3 mono = vec3(grey);
    float band = exp(-pow((dot(vUv - uPointer, vec2(0.8, 0.6))) / 0.22, 2.0));
    // Shine is limited, and fades out on dark ink, so text and the darkest blacks stay readable.
    float inkKeep = smoothstep(0.08, 0.45, grey);
    float metal = 0.5 + band * 0.34 * inkKeep - 0.05 * (1.0 - band) * glare;
    colour = hardLight(mix(base, mono, 0.6), vec3(metal, metal + 0.01, metal + 0.02));
  }

  gl_FragColor = vec4(colour, 1.0);
}`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile failed')
  return shader
}

export function createFoilRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false })
  if (!gl) return null
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? 'Shader link failed')
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // Card scans are not power-of-two sized, so WebGL 1 needs clamped, unmipmapped textures.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const uniforms = {
    pointer: uniform('uPointer'),
    texel: uniform('uTexel'),
    time: uniform('uTime'),
    aspect: uniform('uAspect'),
    type: uniform('uType'),
  }
  let imageSize = { width: 488, height: 680 }

  return {
    setImage(image: HTMLImageElement) {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      imageSize = { width: image.naturalWidth, height: image.naturalHeight }
    },
    render(type: number, pointer: { x: number; y: number }, time: number) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uniforms.pointer, pointer.x, pointer.y)
      gl.uniform2f(uniforms.texel, 1 / imageSize.width, 1 / imageSize.height)
      gl.uniform1f(uniforms.time, time)
      gl.uniform1f(uniforms.aspect, imageSize.height / imageSize.width)
      gl.uniform1i(uniforms.type, type)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
  }
}
