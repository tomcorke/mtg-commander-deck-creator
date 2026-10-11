// Dev notes shown beside the ?foil-preview comparison: how each foil should look, and how the CSS
// and WebGL versions currently imitate it. Keep these in step with every effect change.
// All WebGL foils share an off-axis fade: about 15% strength away from the light, full near it.
export type FoilDescription = { expected: string; css: string; webgl: string }

const standardCss =
  'No dedicated CSS effect: uses the standard holo (colour blobs in colour-dodge plus a moving sheen), shown on hover.'
const standardWebgl =
  'No dedicated shader: uses the traditional-foil sweep (a rainbow band that follows the light, strongest on light ink).'

export const foilDescriptions: Record<string, FoilDescription> = {
  nonfoil: {
    expected: 'No foil. The printed card only.',
    css: 'No effect; the card tilts with the pointer.',
    webgl: 'Draws the scan unchanged.',
  },
  foil: {
    expected:
      'Traditional foil: a rainbow holographic sheen over the whole card that sweeps and changes colour as the card tilts. Strongest where the ink is light, muted under dark ink.',
    css: 'Five soft colour blobs blended with colour-dodge, with a hue that varies per card and shifts with the tilt, plus a diagonal sheen that moves with the pointer. Shown on hover.',
    webgl:
      'A diagonal rainbow band centred on the light, fading away from it. The hue shifts with the tilt and the strength scales with ink brightness. Hard-light blend around neutral grey.',
  },
  etched: {
    expected:
      'Foil-etched: no laminate. Metallic gold highlights pick out edges and detail in the art, giving a grainy, textured shine that appears near the light. The rest of the card stays matte.',
    css: 'An SVG filter finds edges in the art box (3x3 Laplacian, gold colour matrix), masked to a circle around the pointer, plus a soft-light gold sheen and a faint warm glow.',
    webgl:
      'Based on the CSS effect: the same 3x3 Laplacian edges, limited to the art box and masked to a circle around the light, with a soft-light gold sheen and a warm glow. Made more pronounced than the CSS: edges about 2.7x stronger and brighter gold, a larger area around the light, and a stronger sheen and glow.',
  },
  surgefoil: {
    expected:
      'Surge foil: saturated rainbow streaks like brushed flames or a surging wave, rising to the right. Streaks vary in width, bend and merge, and the bright area shifts across the card with the tilt. Not even stripes.',
    css: 'SVG texture: stripes broken into dashes by stretched noise and warped by a turbulence filter, coloured in broad rainbow bands. Revealed through a shifting noise mask. Hard-light.',
    webgl:
      'Noise stretched along steep streaks (about 5:1) with an extra mid-scale warp, thresholded into soft bands of varied width. Rainbow hue shifts with position and tilt. Revealed by large noise that moves with the tilt, and faded off-axis (about 15% away from the light). Strength capped at 0.65.',
  },
  ripplefoil: {
    expected:
      'Ripple foil: soft rainbow rings on a grid. Neighbouring rings alternate, one set growing while the other shrinks as the card tilts. Where four rings meet near the light, their arcs converge into a star-like shape. At some angles a ring shows as a complete circle.',
    css: 'Sixteen radial-gradient rainbow rings on a 4x4 grid. The two checkerboard sets grow and shrink in turn with the tilt, overlapping when large. Hard-light.',
    webgl:
      'A 3-wide grid of thick rings (band 0.03). The checkerboard sets grow from zero to 0.5 and back. Each ring draws only the arc facing a light point that moves 35% as far as the pointer, so arcs converge near it. Each ring also has its own tilt at which it shows whole. Colour shifts around each ring. Strength 0.42.',
  },
  halofoil: {
    expected:
      'Halo foil: swirling, liquid ribbons filled with fine parallel streaks that follow the swirl, in iridescent cyan, blue and violet. Patches of the card stay bare, and different areas light up as it tilts.',
    css: 'SVG texture: silver-led rainbow bands warped by a strong turbulence filter into marbling, revealed through a large noise mask that shifts with the tilt. Hard-light.',
    webgl:
      'A warped directional field from two smooth noise layers. Broad ribbons follow it, and fine contour lines of the same field run inside them as streaks that follow the swirl. Hues stay within cyan, blue and violet and shift with the tilt. Revealed by large noise that moves with the tilt, and faded off-axis (about 15% away from the light).',
  },
  galaxyfoil: {
    expected:
      'Galaxy foil: dense fine rainbow glitter plus scattered larger shapes (four- and five-point stars, dots, rings, swirls) of varied size. Each glints at its own angle, so only some sparkle at once.',
    css: 'Two SVG tiles: fine coloured glitter, and stars, dots, rings and swirls that shift colour with the tilt. Masked brightest around the pointer, over a faint rainbow sheen.',
    webgl:
      'Round, antialiased glitter points, each twinkling at its own angle. Two layers of shapes (many small, a few large, sizes skewed small), each of random kind, rotation and colour, lighting up only within its own narrow range of angles. Revealed by large noise that moves with the tilt, and faded off-axis (about 15% away from the light).',
  },
  silverfoil: {
    expected:
      'Silverscreen foil: a monochrome print under a broad metallic silver sheen. Dark ink and text stay readable; the sheen lifts the lighter areas.',
    css: 'A broad silver gradient band that follows the pointer. Hard-light.',
    webgl:
      'Partly desaturates the card, then adds a silver band that follows the light. The sheen scales with ink brightness, so the darkest blacks keep full contrast. Peak strength about 0.34.',
  },
  rainbowfoil: {
    expected:
      'Rainbow foil: like traditional foil but with more vivid colour (per Wizards, a different printing method on the same foil).',
    css: 'The standard holo with a lighter, wider rainbow tint.',
    webgl: 'The traditional-foil sweep at higher strength (0.75 instead of 0.5).',
  },
  doublerainbow: {
    expected:
      'Double rainbow: a brighter, more multicoloured shine than traditional foil. Used on serialized and special cards.',
    css: 'The rainbow-foil tint plus a second rainbow band moving against the first.',
    webgl: 'Same as rainbow foil for now (the traditional sweep at strength 0.75).',
  },
  fracturefoil: {
    expected:
      'Fracture foil (Japan Showcase): the border is covered in small, sharp-edged glass shards, each catching the light in its own rainbow colour, like shattered glass. A few sparkles also show in light parts of the art. Shards flash on and off as the card tilts.',
    css: standardCss,
    webgl:
      'Voronoi shards about 2.5% of the card wide, each with its own random tilt, shimmering faintly and flashing brightly in its own rainbow colour at its own angle, with thin dark seams between shards. Dense on the outer border (about 5% of the width), sparse elsewhere and only on light ink. Faded off-axis. Screen blend, so shards shine on dark borders. The preview uses a regular Overlord of the Hauntwoods printing, because the fracture scans include photographed foil.',
  },
  raisedfoil: {
    expected:
      'Raised foil: a raised, embossed glossy layer on parts of the frame. Bloomburrow raises the gold or bronze vine ornaments around the name and text box; the Big Score Vault cards have a raised gold stamp in the frame. The raised parts catch glossy highlights and cast slight shading as the card tilts, over a foil card.',
    css: standardCss,
    webgl:
      'Finds warm metallic ink (gold, bronze, copper) in the scan and treats it as a height map. Normals from that height are lit from a direction set by the tilt, giving the ornaments shading and glossy gold highlights. A faint foil sheen covers the rest, and everything fades off-axis. Cards without warm metallic frames show little raised effect. The preview uses the Bloomburrow Zoraline raised-foil scan, whose ornaments are the raised parts.',
  },
  neonink: {
    expected:
      'Neon ink (Kamigawa: Neon Dynasty, later Cavern of Souls, Mana Crypt and others): a flat, very saturated fluorescent spot ink (pink, yellow, green, blue or orange) printed in parts of the art and frame, over a foil card. The ink looks almost lit from within and glows under a blacklight; it does not change with angle, but the foil around it does.',
    css: standardCss,
    webgl:
      'Detects the neon ink as very saturated, bright pixels in the scan. The ink is made slightly brighter and more saturated, and a soft glow spreads from it, sampled from a 24-point ring around each pixel. The rest of the card gets the traditional foil sweep, fading off-axis. The ink and glow do not depend on angle. The preview uses Hidetsugu (Kamigawa: Neon Dynasty), whose scan shows the printed ink.',
  },
  dragonscalefoil: {
    expected:
      'Dragonscale foil (Tarkir: Dragonstorm Special Guests fetch lands): a textured pattern of rounded, overlapping scales (about 13 across) over the whole card. Each scale has a bright, silvery, slightly iridescent surface, with dark seams between scales. The scales catch the light as a band that moves with the tilt.',
    css: standardCss,
    webgl:
      'A staggered grid of rounded scales (about 13 across) with dark seams. Each scale is shaded as a shallow dome lit from a direction set by the tilt (with a slight random wobble per scale), so it catches its own specular highlight. Silvery surface with a faint rainbow tint per scale; strongest near the light and fading off-axis. The preview uses a Special Guests fetch land, whose scan has no scales printed in.',
  },
  stepandcompleat: {
    expected:
      'Step-and-compleat: a staggered step-and-repeat grid of raised Phyrexian symbols (a ring with a vertical stroke through it) across the whole card, about seven or eight across. The symbols catch the light in metallic gold, rose, green and silver.',
    css: standardCss,
    webgl:
      'Symbols drawn from a distance function on a staggered grid (about 7-8 across; symbols about 25% larger than the first version). Each is embossed (lit from a direction set by the tilt) and tinted metallic gold, rose, green or silver with a slight rainbow shift, fading to about 15% away from the light, so the pattern shows mainly where the light catches it. A faint holo sheen covers the rest. The preview uses a regular Glissa printing, because step-and-compleat scans already include the symbols.',
  },
}

export const describeFoil = (foil: string): FoilDescription =>
  foilDescriptions[foil] ?? {
    expected: 'Not researched in detail yet; see the mtg.wiki "Foil" page for this type.',
    css: standardCss,
    webgl: standardWebgl,
  }
