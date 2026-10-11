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
  stepandcompleat: 9,
  fracturefoil: 10,
  raisedfoil: 11,
  neonink: 12,
  dragonscalefoil: 13,
  singularityfoil: 16,
  oilslick: 15,
  confettifoil: 17,
  gilded: 14,
  invisibleink: 22,
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

// Galaxy shapes on one grid scale: each cell may hold a four-, five- or six-point star, a dot,
// a ring or a small swirl with its own size, rotation and colour. Each lights up only within its
// own narrow range of viewing angles, so a few appear at a time and change as the card tilts.
vec3 galaxyShapes(vec2 p, vec2 tilt, float scale, float salt, float density) {
  vec2 grid = p * scale;
  vec2 cell = floor(grid) + salt;
  float seed = hash(cell + 17.0);
  vec2 local = fract(grid) - 0.5 + (vec2(hash(cell + 2.0), hash(cell + 5.0)) - 0.5) * 0.25;
  float size = 0.06 + 0.3 * pow(hash(cell + 9.0), 2.0);
  float kind = floor(hash(cell + 13.0) * 6.0);
  float r = length(local) / size;
  float angle = atan(local.y, local.x) + hash(cell + 21.0) * TAU;
  float shape;
  if (kind < 3.0) {
    float spike = pow(abs(cos(angle * (kind + 4.0) * 0.5)), 6.0);
    shape = smoothstep(0.1, 0.0, r - mix(0.22, 1.0, spike));
  } else if (kind < 4.0) {
    shape = smoothstep(0.55, 0.35, r);
  } else if (kind < 5.0) {
    shape = smoothstep(0.14, 0.0, abs(r - 0.75));
  } else {
    float swirl = fract(angle / TAU + r * 1.4);
    shape = smoothstep(0.18, 0.0, abs(swirl - 0.5)) * smoothstep(1.0, 0.7, r);
  }
  vec2 facing = vec2(hash(cell + 31.0), hash(cell + 37.0)) * 2.0 - 1.0;
  float twinkle = pow(max(0.0, cos(dot(tilt, facing) * 14.0 + seed * TAU)), 10.0);
  return (rainbow(seed * 5.0 + dot(tilt, facing) * 2.0) - 0.5) * step(1.0 - density, seed) * shape * twinkle;
}

// How strongly a pixel looks like warm metallic ink (gold, bronze, copper): used as the height
// of raised-foil frame ornaments.
float warmMetal(vec3 c) {
  float high = max(c.r, max(c.g, c.b));
  float low = min(c.r, min(c.g, c.b));
  float saturation = high > 0.0 ? (high - low) / high : 0.0;
  float warm = step(c.b, c.g) * step(c.g, c.r);
  return warm * smoothstep(0.18, 0.4, saturation) * smoothstep(0.2, 0.4, luminance(c));
}

// How strongly a pixel looks like fluorescent neon ink: very saturated and bright.
float neonInk(vec3 c) {
  float high = max(c.r, max(c.g, c.b));
  float low = min(c.r, min(c.g, c.b));
  float saturation = high > 0.0 ? (high - low) / high : 0.0;
  return smoothstep(0.55, 0.75, saturation) * smoothstep(0.45, 0.7, high);
}

// Distance to a Phyrexian symbol: a ring with a vertical stroke through it, extending above and below.
float phyrexianSymbol(vec2 l) {
  float ring = abs(length(l) - 0.026) - 0.0056;
  vec2 stem = abs(l) - vec2(0.0052, 0.042);
  float bar = length(max(stem, 0.0)) + min(max(stem.x, stem.y), 0.0);
  return min(ring, bar);
}

// Handwriting-like scrawl: a wavy line with irregular loops, broken into words by noise.
// Returns 0..1 ink coverage for a line of writing at height y0 running from x0 to x1.
float scrawl(vec2 uv, float y0, float x0, float x1, float salt) {
  float x = uv.x;
  float wobble = sin(x * 210.0 + salt) * 0.0055 + sin(x * 97.0 + salt * 2.0) * 0.003
    + (noise(vec2(x * 40.0, salt)) - 0.5) * 0.008;
  float stroke = smoothstep(0.003, 0.0012, abs(uv.y - y0 - wobble));
  float words = step(0.38, noise(vec2(x * 22.0 + salt * 3.0, salt)));
  return stroke * words * step(x0, x) * step(x, x1);
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
  // Almost every foil fades out off-axis: faint away from the light, full near it.
  float onAxis = 0.15 + 0.85 * glare;
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
    float edgeAlpha = clamp(8.0 * laplacian - 0.1, 0.0, 1.0);
    float inArt = step(0.07, vUv.x) * step(vUv.x, 0.93) * step(0.08, vUv.y) * step(vUv.y, 0.55);
    float near = length((vUv - uPointer) * vec2(1.0, uAspect)) / 1.6;
    float edgeMask = mix(1.0, 0.53, smoothstep(0.18, 0.35, near)) * (1.0 - smoothstep(0.35, 0.58, near));
    vec3 edged = screen(base, vec3(1.0, 0.9, 0.6) * min(1.0, edgeAlpha * edgeMask * inArt * 1.3));
    float diagonal = dot(vUv - uPointer / 3.0, vec2(0.57, 0.82)) * 1.2;
    vec3 sheenColour = mix(vec3(0.22, 0.18, 0.16), vec3(0.91, 0.84, 0.67), 0.5 + 0.5 * sin(diagonal * TAU));
    vec3 sheen = softLight(edged, mix(vec3(0.5), sheenColour, 0.75));
    float glow = mix(0.22, 0.0, smoothstep(0.0, 0.58, length(vUv - uPointer)));
    colour = screen(sheen, vec3(1.0, 0.94, 0.77) * glow * 0.85);
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
    float amount = bands * reveal * onAxis * 1.3;
    colour = hardLight(base, 0.5 + (hue - 0.5) * clamp(amount, 0.0, 0.65));
  } else if (uType == 4) {
    // Ripple: rings on a 4x4 grid; the checkerboard sets grow from zero and shrink back in turn.
    // Each ring only shows the arc facing the light, so where four rings meet near the light
    // their arcs converge into a star-like shape. Colour shifts with the angle around the ring.
    // Gentler response: the cycle and the light point move less than the pointer.
    float t = clamp(0.5 + (uPointer.x * 0.5 + uPointer.y * 0.5 - 0.5) * 0.8, 0.0, 1.0);
    vec2 light = mix(vec2(0.5, 0.5 * uAspect), vec2(uPointer.x, uPointer.y * uAspect), 0.35);
    vec3 rings = vec3(0.0); // offsets from neutral grey
    // A 3-wide grid: fewer, larger rings that still overlap.
    for (int row = 0; row < 5; row++) {
      for (int col = 0; col < 3; col++) {
        vec2 centre = vec2((float(col) + 0.5) / 3.0, (float(row) + 0.5) / 3.0);
        bool even = mod(float(row + col), 2.0) < 0.5;
        float radius = mix(0.0, 0.5, even ? t : 1.0 - t);
        vec2 fromCentre = p - centre;
        float offset = (length(fromCentre) - radius) / 0.03;
        float band = exp(-offset * offset) * smoothstep(0.0, 0.04, radius);
        vec2 towardLight = light - centre;
        float facing = dot(normalize(fromCentre + 0.0001), normalize(towardLight + 0.0001));
        float arc = smoothstep(0.0, 0.95, facing) * exp(-pow(length(towardLight) / 0.62, 2.0));
        // Each ring also has its own tilt at which it shows as a complete circle.
        float phase = hash(centre + 0.37) * TAU;
        vec2 ringFacing = vec2(hash(centre + 3.3), hash(centre + 7.7)) * 2.0 - 1.0;
        float whole = pow(max(0.0, cos(dot(tilt, ringFacing) * 7.0 + phase)), 8.0);
        arc = max(arc, whole);
        float hue = offset * 0.1 + atan(fromCentre.y, fromCentre.x) / TAU + dot(tilt, vec2(1.7, 1.1));
        rings += (rainbow(hue) - 0.5) * band * arc;
      }
    }
    colour = hardLight(base, clamp(0.5 + rings * 0.42, 0.0, 1.0));
  } else if (uType == 5) {
    // Halo: swirling ribbons from domain-warped marbling, each filled with fine streaks that follow
    // the swirl (contour lines of the same field), in iridescent cyan, blue and violet.
    // Revealed in patches by large noise that shifts with the tilt.
    vec2 q = p * 2.2;
    vec2 warp = vec2(fbm(q + vec2(0.0, uTime * 0.02)), fbm(q + vec2(5.2, 1.3)));
    // A warped directional field: its contour lines flow in long swirls without closed loops.
    // Two smooth noise layers only, so the contours flow instead of wiggling.
    vec2 swirl = q + warp * 2.5;
    float marble = q.y * 0.7 + q.x * 0.3 + (noise(swirl) * 0.65 + noise(swirl * 2.0) * 0.35) * 1.8;
    float ribbon = smoothstep(0.3, 0.8, 0.5 + 0.5 * sin(marble * 9.0 + tilt.x * 4.0));
    float streaks = smoothstep(0.25, 0.9, 0.5 + 0.5 * sin(marble * 140.0 + tilt.y * 8.0));
    float amount = ribbon * (0.35 + 0.65 * streaks);
    vec3 silver = vec3(0.86, 0.9, 0.96);
    // Iridescent hues kept within cyan, blue and violet.
    float shift = 0.5 + 0.5 * sin(marble * 3.0 + dot(tilt, vec2(3.0, 2.0)));
    vec3 hue = shift < 0.5
      ? mix(vec3(0.3, 0.92, 1.0), vec3(0.32, 0.5, 1.0), shift * 2.0)
      : mix(vec3(0.32, 0.5, 1.0), vec3(0.72, 0.42, 1.0), shift * 2.0 - 1.0);
    vec3 tint = mix(silver, hue, 0.7);
    float reveal = smoothstep(0.42, 0.66, fbm(p * 1.1 - tilt * 1.4 + 3.0));
    colour = hardLight(base, 0.5 + (tint - 0.5) * amount * reveal * onAxis * 1.1);
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
    vec3 glitter = (rainbow(seed * 3.0 + tilt.x) - 0.5) * point * twinkle;
    // Shapes in two layers: many small ones and a few large ones, with sizes skewed small.
    vec3 stars = (galaxyShapes(p, tilt, 16.0, 0.0, 0.3) + galaxyShapes(p, tilt, 5.0, 40.0, 0.3)) * 1.6;
    float light = reveal * onAxis * 1.3;
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

  if (uType == 13) {
    // Dragonscale, matched to TDM Special Guests photos: an irregular net of scales (about 11
    // across, wider than tall, rows gently curving) printed as bright silvery seams around darker
    // cells. Each cell is shaded like a shallow overlapping scale, lit from the tilt direction.
    // The net shows in patches where the light catches it and fades off-axis. Narrow vertical
    // rainbow streaks sweep sideways with the tilt and break up along their length.
    vec2 q = vec2(p.x * 11.0, p.y * 17.0);
    q.y += sin(p.x * 4.0 + p.y * 1.5) * 0.6;
    q += (vec2(fbm(p * 5.0), fbm(p * 5.0 + 7.0)) - 0.5) * 0.6;
    vec2 g = floor(q);
    // Two-pass cell edges on a staggered, jittered grid; smooth-min rounds the corners.
    vec2 nearest = vec2(9.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -2; x <= 1; x++) {
        vec2 c = g + vec2(float(x), float(y));
        vec2 r = c + vec2(mod(c.y, 2.0) * 0.5 + 0.5, 0.5) + (vec2(hash(c), hash(c + 5.0)) - 0.5) * 0.35 - q;
        if (dot(r, r) < dot(nearest, nearest)) nearest = r;
      }
    }
    float edge = 9.0;
    for (int y = -2; y <= 2; y++) {
      for (int x = -2; x <= 2; x++) {
        vec2 c = g + vec2(float(x), float(y));
        vec2 r = c + vec2(mod(c.y, 2.0) * 0.5 + 0.5, 0.5) + (vec2(hash(c), hash(c + 5.0)) - 0.5) * 0.35 - q;
        vec2 between = r - nearest;
        if (dot(between, between) > 0.0001) {
          float e = dot(0.5 * (nearest + r), normalize(between));
          float k = 0.1;
          float h = clamp(0.5 + 0.5 * (edge - e) / k, 0.0, 1.0);
          edge = mix(edge, e, h) - k * h * (1.0 - h);
        }
      }
    }
    vec2 local = -nearest;
    float seam = 1.0 - smoothstep(0.03, 0.1, edge);
    float shade = dot(local, normalize(tilt + vec2(0.001, 0.25))) - 0.25 * local.y;
    float reveal = onAxis * (0.35 + 0.65 * smoothstep(0.35, 0.65, fbm(p * 2.2 + tilt * 1.8)));
    vec3 net = vec3(seam * 0.34 - (1.0 - seam) * (0.07 - shade * 0.12)) * reveal;
    float phase = vUv.x * 8.0 - tilt.x * 5.0;
    float streak = pow(0.5 + 0.5 * cos(TAU * phase), 14.0);
    streak *= smoothstep(0.3, 0.6, noise(vec2(floor(phase + 0.5) * 3.7, vUv.y * 4.0 + tilt.y * 3.0)));
    streak *= (0.25 + 0.75 * glare) * (1.0 - seam * 0.5);
    vec3 hue = rainbow(phase * 0.45 + vUv.y * 0.25 + tilt.y);
    vec3 light = 0.5 + net + ((hue - 0.5) * 0.9 + 0.12) * streak * 0.55;
    colour = hardLight(base, clamp(light, 0.0, 1.0));
  }
  if (uType == 12) {
    // Neon ink: a flat fluorescent spot ink over a foil card. The ink pops (slightly brighter and
    // more saturated) and glows softly into its surroundings; it doesn't change with angle. The
    // foil underneath sweeps with the light and fades off-axis, as on traditional foil.
    float ink = neonInk(base);
    vec3 glowColour = vec3(0.0);
    float glowWeight = 0.0;
    for (int i = 0; i < 12; i++) {
      float angle = float(i) * TAU / 12.0;
      for (int ring = 1; ring <= 2; ring++) {
        vec2 offset = vec2(cos(angle), sin(angle)) * uTexel * 7.0 * float(ring);
        vec3 sampleColour = texture2D(uImage, vUv + offset).rgb;
        float weight = neonInk(sampleColour) / float(ring);
        glowColour += sampleColour * weight;
        glowWeight += 1.0 / float(ring);
      }
    }
    vec3 glow = glowColour / glowWeight;
    vec3 popped = mix(base, clamp(base * 1.18 + (base - luminance(base)) * 0.35, 0.0, 1.0), ink);
    float along = dot(vUv - uPointer, vec2(0.8, 0.6));
    float sweep = 0.35 + 0.65 * exp(-pow(along / 0.3, 2.0));
    float hue = dot(vUv, vec2(0.9, 0.6)) * 1.4 + tilt.x * 1.5 + tilt.y;
    vec3 foiled = hardLight(popped, 0.5 + (rainbow(hue) - 0.5) * 0.45 * foilMask * sweep * onAxis * (1.0 - ink));
    colour = screen(foiled, glow * 0.9);
  }
  if (uType == 11) {
    // Raised foil: the warm metallic frame ornaments are treated as a raised, glossy surface.
    // Their height comes from the scan; light from a direction set by the tilt gives them glossy
    // gold highlights and shading. A faint foil sheen covers the rest; everything fades off-axis.
    vec2 step2 = uTexel * 2.5;
    float h = warmMetal(base);
    float hx = warmMetal(texture2D(uImage, vUv + vec2(step2.x, 0.0)).rgb) - warmMetal(texture2D(uImage, vUv - vec2(step2.x, 0.0)).rgb);
    float hy = warmMetal(texture2D(uImage, vUv + vec2(0.0, step2.y)).rgb) - warmMetal(texture2D(uImage, vUv - vec2(0.0, step2.y)).rgb);
    vec3 normal = normalize(vec3(-hx * 14.0, -hy * 14.0, 1.0));
    vec3 lightDir = normalize(vec3(tilt * 2.2, 0.8));
    float diffuse = dot(normal, lightDir) - lightDir.z;
    float specular = pow(max(0.0, dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0))), 6.0);
    vec3 gold = vec3(1.0, 0.86, 0.55);
    vec3 holo = (rainbow(dot(vUv, vec2(0.9, 0.6)) * 1.4 + tilt.x * 1.5) - 0.5) * 0.3 * glare * foilMask;
    vec3 light = 0.5 + h * (diffuse * 1.8 + (gold - 0.5) * 0.85) * onAxis + holo;
    colour = screen(hardLight(base, clamp(light, 0.0, 1.0)), gold * specular * h * onAxis * 2.4);
  }
  if (uType == 10) {
    // Fracture: shattered-glass shards (Voronoi cells about 2.5% of the card wide), each tilted
    // its own way so it flashes its own rainbow colour at its own angle, over the whole card and
    // strongest on the border; fades off-axis. Screen on the dark border, hard light elsewhere so
    // shards also show on light art.
    vec2 grid = p * 40.0;
    vec2 cellBase = floor(grid);
    float nearest = 8.0;
    float second = 8.0;
    vec2 shard = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell = cellBase + vec2(float(x), float(y));
        vec2 point = cell + vec2(hash(cell), hash(cell + 4.1));
        float d = length(grid - point);
        if (d < nearest) {
          second = nearest;
          nearest = d;
          shard = cell;
        } else if (d < second) {
          second = d;
        }
      }
    }
    vec2 shardTilt = vec2(hash(shard + 7.3), hash(shard + 2.9)) * 2.0 - 1.0;
    float flash = pow(max(0.0, cos(dot(tilt, shardTilt) * 12.0 + hash(shard + 1.7) * TAU)), 3.0);
    float seam = smoothstep(0.0, 0.08, second - nearest);
    vec2 edgeDistance = min(vUv, 1.0 - vUv) * vec2(1.0, uAspect);
    float border = 1.0 - smoothstep(0.04, 0.055, min(edgeDistance.x, edgeDistance.y));
    vec3 glass = rainbow(hash(shard + 5.5) + dot(tilt, shardTilt) * 1.5) * 0.8 + 0.2;
    // Every shard shimmers a little; the ones angled at the light flash brightly.
    float shine = (0.3 + 0.9 * flash) * seam * onAxis;
    vec3 inner = hardLight(base, clamp(0.5 + (glass - 0.4) * shine * 0.7, 0.0, 1.0));
    colour = mix(inner, screen(base, glass * shine), border);
  }
  if (uType == 9) {
    // Step-and-compleat: a staggered step-and-repeat grid of raised Phyrexian symbols. Each symbol
    // is embossed (lit from the light direction) and tinted metallic gold, rose, green or silver,
    // shifting with the tilt and brightest near the light; a light holo sheen covers the rest.
    vec2 spacing = vec2(0.13, 0.136);
    float row = floor(p.y / spacing.y);
    vec2 shifted = vec2(p.x + mod(row, 2.0) * spacing.x * 0.5, p.y);
    vec2 cell = floor(shifted / spacing);
    vec2 l = (fract(shifted / spacing) - 0.5) * spacing;
    float d = phyrexianSymbol(l);
    float inside = smoothstep(0.0012, -0.0012, d);
    float e = 0.0015;
    vec2 normal = normalize(vec2(
      phyrexianSymbol(l + vec2(e, 0.0)) - phyrexianSymbol(l - vec2(e, 0.0)),
      phyrexianSymbol(l + vec2(0.0, e)) - phyrexianSymbol(l - vec2(0.0, e))) + 0.0001);
    vec2 lightDir = normalize(vec2(-0.6, -0.8) + tilt * 2.0);
    float rim = smoothstep(-0.004, 0.0, d) * inside;
    float emboss = dot(-normal, lightDir) * rim;
    float pick = hash(cell);
    vec3 metal = pick < 0.3 ? vec3(0.95, 0.8, 0.45) : pick < 0.55 ? vec3(0.95, 0.6, 0.65)
      : pick < 0.75 ? vec3(0.65, 0.9, 0.55) : vec3(0.85, 0.88, 0.92);
    vec3 tint = mix(metal, rainbow(pick * 2.0 + dot(tilt, vec2(2.0, 1.5))), 0.3);
    float shine = inside * onAxis * 1.1;
    vec3 holo = (rainbow(dot(vUv, vec2(0.9, 0.6)) * 1.4 + tilt.x * 1.5) - 0.5) * 0.18 * glare * foilMask;
    vec3 light = 0.5 + (tint - 0.5) * shine * 0.9 + emboss * 0.35 * onAxis + holo;
    colour = hardLight(base, clamp(light, 0.0, 1.0));
  }

  if (uType == 16) {
    // Singularity, matched to photos of Sothera, the Supervoid (EOE #382): dark mirror chrome with
    // fine vertical brushed lines. The brushing stretches the highlight into a horizontal band at
    // the light's height. Light ink turns chrome silver with a pale rainbow that shifts with the
    // tilt; dark areas sink towards black off-axis. Everything fades off-axis.
    float column = floor(vUv.x * 900.0);
    float brushed = (hash(vec2(column, 3.1)) - 0.5) * (0.4 + 0.6 * noise(vec2(column * 0.37, vUv.y * 5.0)));
    float sheen = exp(-pow((vUv.y - uPointer.y) * uAspect / 0.12, 2.0)) * exp(-pow((vUv.x - uPointer.x) / 0.6, 2.0));
    // Light ink becomes silver chrome (darker than white off-axis) with a pale shifting rainbow.
    float chromeInk = smoothstep(0.45, 0.9, lum);
    vec3 chrome = mix(vec3(0.82, 0.86, 0.9), rainbow(vUv.x * 1.2 + vUv.y * 0.6 + dot(tilt, vec2(2.0, 1.2))), 0.3);
    chrome *= 0.7 + 0.3 * glare + 0.2 * sheen;
    // Coloured ink takes a cool, slightly desaturated metallic cast.
    vec3 metal = mix(base, lum * vec3(0.85, 0.97, 1.08), 0.25);
    metal = mix(metal, chrome, chromeInk * 0.75);
    vec3 light = 0.5 + brushed * (0.08 + 0.12 * sheen)
      + vec3(0.07, 0.09, 0.11) * sheen
      - 0.13 * (1.0 - glare) * (1.0 - chromeInk);
    colour = hardLight(metal, clamp(light, 0.0, 1.0));
  }
  if (uType == 15) {
    // Oil slick (ONE Compleat Edition): glossy black stock. Dark ink is crushed to full black and
    // carries a glossy sheen near the light. Light ink keeps its brightness and turns to chrome
    // with a thin oil film: broad, smooth bands of copper, magenta, violet and blue that swirl
    // gently and slide with the tilt, strongest in a broad sweep near the light.
    vec2 q = p * 1.6 + (vec2(fbm(p * 2.0 + 3.0), fbm(p * 2.0 + 9.0)) - 0.5) * 0.9;
    float film = fbm(q) * 2.2 + dot(vUv, vec2(0.35, 0.6)) + dot(tilt, vec2(2.2, 1.4));
    vec3 hue = rainbow(film);
    // Pull the hues towards an oily palette: green muted into teal and blue.
    hue = vec3(hue.r, hue.g * 0.5, max(hue.b, hue.g * 0.7));
    float along = dot(vUv - uPointer, vec2(0.95, 0.3));
    float sweep = 0.3 + 0.7 * exp(-pow(along / 0.28, 2.0));
    float amount = foilMask * sweep * onAxis;
    // Crush dark ink to black; bright ink is untouched.
    float black = 1.0 - smoothstep(0.06, 0.3, lum);
    vec3 deep = base * (1.0 - black);
    vec3 tinted = hardLight(deep, clamp(0.5 + (hue - 0.5) * amount * 0.9, 0.0, 1.0));
    // Keep the bright ink's luminosity: shift the tinted colour back to the original brightness.
    tinted = clamp(tinted + (luminance(deep) - luminance(tinted)) * (1.0 - black), 0.0, 1.0);
    // Glossy sheen on the black: a tight highlight following the light with a hint of oil colour.
    float gloss = exp(-pow(along / 0.12, 2.0)) * glare;
    colour = screen(tinted, mix(vec3(0.75), hue, 0.45) * gloss * black * 0.45);
  }

  if (uType == 17) {
    // Confetti (WOT anime borderless, SLD Furby): a dense scatter of tiny irregular glitter
    // flecks over the whole card (about 90 across). Each fleck has its own facing, so it flashes
    // its own saturated colour at its own angle; many are lit at once near the light and few
    // away from it. Strongest on bright art, dimmer but still visible on dark ink.
    // A rotated grid with strong jitter, so the flecks don't line up in rows; flecks clipped at a
    // cell edge just look more irregular.
    vec2 grid = mat2(0.87, 0.5, -0.5, 0.87) * p * 90.0;
    vec2 cell = floor(grid);
    float seed = hash(cell);
    vec2 local = fract(grid) - 0.5 - (vec2(hash(cell + 1.7), hash(cell + 6.1)) - 0.5) * 0.65;
    float angle = atan(local.y, local.x) + seed * TAU;
    float radius = (0.24 + 0.16 * hash(cell + 3.3)) * (0.85 + 0.15 * cos(angle * 5.0));
    float fleck = smoothstep(radius, radius - 0.08, length(local)) * step(0.25, seed);
    vec2 facing = vec2(hash(cell + 9.2), hash(cell + 4.4)) * 2.0 - 1.0;
    float flash = pow(0.5 + 0.5 * cos(dot(tilt, facing) * 9.0 + seed * TAU), 2.0);
    vec3 hue = rainbow(hash(cell + 12.5) + dot(tilt, facing) * 1.5);
    float amount = fleck * (0.3 + 0.7 * flash) * (0.3 + 0.7 * onAxis);
    vec3 tinted = hardLight(base, clamp(0.5 + (hue - 0.5) * amount * (0.8 + 1.0 * foilMask) + 0.12 * amount, 0.0, 1.0));
    colour = screen(tinted, hue * amount * flash * 0.5 * (1.0 - foilMask));
  }
  if (uType == 14) {
    // Gilded (SNC Golden Age): the gold frame is an embossed, mirror-polished hot stamp over a
    // traditional foil card. Warm gold ink in the scan marks the stamp; it is replaced by metal that
    // is dull bronze away from the light and saturated bright gold where a broad reflection band,
    // which sweeps with the tilt, crosses it. Height edges get shading and glints. The rest of the
    // card gets a gentle traditional foil sweep that fades off-axis.
    vec2 step2 = uTexel * 1.5;
    float h = warmMetal(base);
    float hx = warmMetal(texture2D(uImage, vUv + vec2(step2.x, 0.0)).rgb) - warmMetal(texture2D(uImage, vUv - vec2(step2.x, 0.0)).rgb);
    float hy = warmMetal(texture2D(uImage, vUv + vec2(0.0, step2.y)).rgb) - warmMetal(texture2D(uImage, vUv - vec2(0.0, step2.y)).rgb);
    vec3 normal = normalize(vec3(-hx * 5.0, -hy * 5.0, 1.0));
    vec3 lightDir = normalize(vec3(tilt * 2.2, 0.8));
    float diffuse = dot(normal, lightDir) - lightDir.z;
    float specular = pow(max(0.0, dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0))), 8.0);
    float along = dot(vUv - uPointer, vec2(0.8, 0.6));
    float reflection = clamp(exp(-pow(along / 0.22, 2.0)) * 0.8 + glare * 0.5, 0.0, 1.0);
    vec3 metal = mix(vec3(0.26, 0.16, 0.05), vec3(1.0, 0.72, 0.18), reflection);
    metal = clamp(metal * (0.75 + 0.5 * luminance(base)) + diffuse * 0.5, 0.0, 1.0);
    float hue = dot(vUv, vec2(0.9, 0.6)) * 1.4 + tilt.x * 1.5 + tilt.y;
    vec3 foiled = hardLight(base, 0.5 + (rainbow(hue) - 0.5) * 0.22 * foilMask * onAxis);
    colour = screen(mix(foiled, metal, h), vec3(1.0, 0.88, 0.6) * specular * h * 0.8);
  }

  if (uType == 22) {
    // Invisible ink (MKM showcase dossiers): a traditional foil card with Alquist Proft's
    // handwritten case notes and doodles in the margins and text box. The notes are almost
    // invisible face-on and show as violet-grey ink only when the card is tilted
    // steeply towards the bottom right. Under the notes, the traditional foil sweep.
    float along = dot(vUv - uPointer, vec2(0.8, 0.6));
    float sweep = 0.35 + 0.65 * exp(-pow(along / 0.3, 2.0));
    float hueShift = dot(vUv, vec2(0.9, 0.6)) * 1.4 + tilt.x * 1.5 + tilt.y;
    vec3 foiled = hardLight(base, 0.5 + (rainbow(hueShift) - 0.5) * 0.45 * foilMask * sweep * (0.2 + 0.8 * glare));
    vec2 hand = vec2(vUv.x, vUv.y + (vUv.x - 0.5) * 0.04);
    float notes = max(max(scrawl(hand, 0.615, 0.5, 0.82, 1.0), scrawl(hand, 0.66, 0.56, 0.9, 4.0)),
      max(scrawl(hand, 0.86, 0.3, 0.6, 7.0), scrawl(hand, 0.125, 0.62, 0.9, 9.0)));
    // A magnifying-glass doodle and a ring circling part of the art.
    vec2 m = (vUv - vec2(0.88, 0.63)) * vec2(1.0, uAspect);
    float glass = smoothstep(0.003, 0.001, abs(length(m) - 0.03));
    vec2 handle = m - vec2(0.03, 0.03);
    glass = max(glass, smoothstep(0.003, 0.001, abs(handle.x - handle.y) * 0.7) * step(0.0, handle.x) * step(handle.x, 0.025));
    vec2 r = (vUv - vec2(0.7, 0.3)) * vec2(1.0, uAspect);
    float ring = smoothstep(0.0035, 0.0012, abs(length(r * vec2(1.0, 1.3)) - 0.09 - 0.006 * sin(atan(r.y, r.x) * 3.0)));
    notes = max(notes, max(glass, ring * 0.8));
    // Revealed only at a steep tilt towards the bottom right.
    float reveal = smoothstep(0.55, 0.9, dot(normalize(tilt + 0.0001), vec2(0.7, 0.7))) * smoothstep(0.12, 0.3, length(tilt));
    // Violet-grey ink: darkens the cream text box, lightens dark art, so it reads on both.
    vec3 inked = mix(screen(foiled, vec3(0.85, 0.8, 1.0)), foiled * vec3(0.5, 0.45, 0.7), smoothstep(0.35, 0.65, lum));
    colour = mix(foiled, inked, notes * (0.04 + 0.86 * reveal));
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
