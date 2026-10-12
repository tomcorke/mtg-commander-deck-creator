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
      'Voronoi shards about 2.5% of the card wide, each with its own random tilt, shimmering faintly and flashing brightly in its own rainbow colour at its own angle, with thin dark seams between shards. Shards cover the whole card. On the outer border (about 5% of the width) they use a screen blend, so they shine on the dark border; elsewhere a softer hard-light blend, so they show on light art and keep text readable. Faded off-axis. The preview uses a regular Overlord of the Hauntwoods printing, because the fracture scans include photographed foil.',
  },
  raisedfoil: {
    expected:
      'Raised foil: a raised, embossed glossy layer on parts of the frame. Bloomburrow raises the gold or bronze vine ornaments around the name and text box; the Big Score Vault cards have a raised gold stamp in the frame. The raised parts catch glossy highlights and cast slight shading as the card tilts, over a foil card.',
    css: standardCss,
    webgl:
      'Finds warm metallic ink (gold, bronze, copper) in the scan and treats it as a height map with a steep, wide bevel. Normals from that height are lit from a direction set by the tilt, giving the ornaments strong shading and bright glossy gold highlights. A light foil sheen covers the rest, and everything fades off-axis. Cards without warm metallic frames show little raised effect. The preview uses the Bloomburrow Zoraline raised-foil scan, whose ornaments are the raised parts.',
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
      'Dragonscale foil (Tarkir: Dragonstorm Special Guests fetch lands), from photos of Misty Rainforest, Marsh Flats and Arid Mesa: a net of bright, silvery seams around darker scales over the whole card, about 10-14 scales across, wider than tall, in staggered rows that curve slightly. Each scale is shaded so it looks slightly raised. The net shows in patches where the light catches it, and is clearest over dark areas such as the text box. Narrow, saturated vertical rainbow streaks run down the card and slide sideways with the tilt.',
    css: standardCss,
    webgl:
      'Scales are cells of a staggered, slightly jittered grid (about 11 across, rows warped by a sine and noise so they curve), with rounded corners from a smooth-min over the cell edges. Seams are lightened with a hard-light blend so they show on dark ink; scale interiors are darkened a little and shaded from the tilt direction. A noise mask that shifts with the tilt reveals the net in patches, on top of the off-axis fade. Narrow vertical rainbow streaks (about 8 across) slide with horizontal tilt, break up along their length, dim over the seams and are strongest near the light. The preview uses a Special Guests fetch land, whose scan has no scales printed in.',
  },
  singularityfoil: {
    expected:
      'Singularity foil: made only for the Edge of Eternities headliner, Sothera, the Supervoid (EOE #382, Collector Boosters, under 1% of packs). In photos of a PSA-graded copy, the whole card is dark mirror chrome with fine vertical brushed lines that show even over the black void. The white title turns chrome silver with a pale rainbow, the cyan and purple ribbons take on a cool metallic sheen, and the soft glow in the background sinks almost to black.',
    css: standardCss,
    webgl:
      'Fine vertical brushed lines (about 900 across, each broken up along its length) cover the card, faint everywhere and brighter in a narrow horizontal highlight band at the height of the light, as brushed metal stretches a reflection across the brushing. Light ink turns chrome silver, slightly darker than white away from the light, with a pale rainbow that shifts with the tilt. Coloured ink takes a cool, slightly desaturated metallic cast, and dark and mid areas darken away from the light. Hard-light blend, faded off-axis. The preview uses the Sothera scan, which has no foil printed in.',
  },
  oilslick: {
    expected:
      'Oil slick raised foil (Phyrexia: All Will Be One Compleat Edition bundle, ONE #345-369: praetors, planeswalkers and basic lands in the inverted ichor style), from the mtg.wiki "Oil slick.gif" photo: a glossy black card, as if soaked in Phyrexian oil. The blacks are fully black and shiny, catching a glossy highlight near the light. The light ink keeps its brightness and, where the light catches it, shows a thin oil film: broad, smooth bands of copper, magenta, violet and blue, with little green, that slide across the card as it tilts.',
    css: standardCss,
    webgl:
      'Dark ink (luminance below about 0.3) is crushed to full black; bright ink is not darkened. Hue comes from a smooth, domain-warped fbm "film thickness" plus a gentle gradient and the tilt, so colour bands are broad and swirl rather than stripe, pulled towards an oily palette (green muted into teal and blue). A broad, near-vertical sweep follows the light, on top of the off-axis fade, and the strength scales with ink brightness. The tint uses a hard-light blend around neutral grey, then shifts back to the original luminance so bright ink keeps its brightness. The blacks get a glossy sheen: a tight highlight along the light with a hint of oil colour, screen-blended on the black only. The preview uses the non-foil showcase Atraxa (ONE #316), because the oil slick scans have the tint baked in. Its art is light ink on black rather than the dark ichor art of the oil slick printing, so more of the card turns to chrome than on a real oil slick card.',
  },
  confettifoil: {
    expected:
      'Confetti foil (Wilds of Eldraine Enchanting Tales anime borderless cards, WOT #84-103, and Secret Lair drops such as the Furby cards, SLD #2326-2338), from the mtg.wiki photo of Distant Melody and the WOT Rhystic Study #91 scan: a dense, even scatter of tiny irregular glitter flecks over the whole card, about 100 across, including the frame and text box. Each fleck catches the light in its own saturated colour (green, blue, red, gold, violet), so the card shimmers with multicoloured sparkle that changes as it tilts. Strongest on bright art; dimmer on the dark text box, where the text stays readable.',
    css: standardCss,
    webgl:
      'Flecks on a rotated, strongly jittered grid (about 90 across), each a small round-to-pentagonal dot with its own size; about three quarters of the cells hold one. Each fleck has its own facing: it flashes its own rainbow colour, which shifts with the tilt, at its own angle, with a soft response so many are lit at once. Hard-light blend around neutral grey, stronger on light ink, plus a small screen sparkle on dark ink. A softened off-axis fade (about 30% away from the light), since the glitter shows everywhere on the real cards. The preview uses the plain anime Rhystic Study (WOT #71), because confetti scans have the flecks printed in.',
  },
  gilded: {
    expected:
      'Gilded foil (Streets of New Capenna Golden Age showcase, SNC #361-405, and three Secret Lair commanders such as Atraxa, SLD #453): the gold Art Deco frame lines are a raised, mirror-polished gold hot stamp over a traditional foil card. In the Wizards collecting-article animation of Nimble Larcenist, the frame swings from dull dark bronze to saturated, almost orange gold as the card turns, and the raised lines catch small glints. The art and text box keep a mild traditional foil sheen; the text box pattern stays dark. Scryfall’s SNC gilded scans show the frame as thin dark copper lines, because the stamp isn’t printed.',
    css: standardCss,
    webgl:
      'Finds warm gold ink in the scan and treats it as the stamp and its height map. The stamp is replaced by metal that is dark bronze away from the light and bright saturated gold where a broad diagonal reflection band, which follows the light, crosses it. Normals from the height add shading and small glints lit from the tilt direction. The rest of the card gets a gentle traditional foil sweep that fades off-axis. Gold ink in the art also turns metallic. The preview uses the regular Golden Age Raffine (SNC #327), whose scan prints the frame in flat gold; the gilded scans show only thin dark lines there, so the effect is weak on them.',
  },
  invisibleink: {
    expected:
      'Invisible ink foil (Murders at Karlov Manor showcase dossiers, MKM #377-389, Collector Boosters only, always English). Wizards’ "Collecting Murders at Karlov Manor" says the cards carry mark-up and details "handwritten" on the file, and the MKM #384 Alquist Proft scan shows pale handwriting ("But of course", "Handsome, Genius") and a magnifying-glass doodle on the right of the text box, with more marks near the bottom. Underneath is traditional foil. Sources disagree on how the notes appear: mtg.wiki says they are designed to be visible at right angles; TCGplayer’s MKM variants guide says they appear under UV light; Draftsim and Cardsphere say at certain angles or in certain light; the mtg.wiki "Invisible Ink MKM.gif" video shows them clearly under a blacklight and barely at all in normal light.',
    css: standardCss,
    webgl:
      'The traditional foil sweep, plus procedural notes: wavy, loopy lines broken into words by noise (two lines at the top right of the text box, one near the bottom, one in the top margin), a magnifying-glass doodle and a ring circling part of the art. The notes are almost invisible face-on (4%) and show only at a steep tilt towards the bottom right, following the "visible at an angle" reading; UV can’t be simulated. The ink is violet-grey: it darkens the cream text box and lightens dark art, so it reads on both. The preview uses the non-foil showcase dossier Alquist Proft (MKM #355), because invisible ink scans have the notes baked in.',
  },
  silverscroll: {
    expected:
      'Silver scroll foil (Secrets of Strixhaven Mystical Archive, Japanese-art cards SOA #131-195; Collector Boosters only, in every language). mtg.wiki says it gives the card “a silvery shine”; Wizards’ “Collecting Secrets of Strixhaven” only calls it “shimmering and spellbindingly beautiful”; Draftsim and retailer listings (Card Kingdom, Face to Face) add no visual detail. The best visual source is the Scryfall scan of Daze (SOA #145) against its non-foil twin (#80): the blue title scroll and frame turn mirror silver, the pale sky and waves become grainy, brushed silver, and the coloured art stays visible but cool and muted, as if printed over silver foil. The sources don’t contradict each other; they just say very little, and I found no in-hand photos or videos.',
    css: standardCss,
    webgl:
      'The whole card is pulled towards a cool silver grey (55% desaturated, up to 95% on pale, unsaturated areas such as sky and text box). A broad diagonal metallic sheen follows the light, broken by fine noise grain, strongest on pale areas, kept off the darkest ink, and faded off-axis. Hard-light blend around neutral grey. The frame isn’t detected separately, so a saturated frame stays slightly coloured rather than turning fully silver. The preview uses the non-foil Japanese Daze (SOA #80), because silver scroll scans have the silver baked in; the preview page now allows a non-foil-only scan when an override applies the foil type.',
  },
  manafoil: {
    expected:
      'Mana foil (Foundations borderless rares and mythics, FDN #362-421, 60 cards; Collector Boosters only, English only). Wizards’ “Collecting Foundations” says each card has “the five mana symbols stamped over” the borderless art and doesn’t say whether they are raised. mtg.wiki says the symbols are in a randomised pattern across the card face and are raised for a 3D texture like step-and-compleat, citing a collector’s in-hand post (Ben Bateman: “this just looks insane in person”). The Scryfall scan of Herald of Eternal Dawn (FDN #368), also the mtg.wiki gallery image, shows the symbols faintly: each mana symbol in a thin ring, about 12 across, over art, frame and text box alike, in metallic silver-gold. The sources agree on the pattern; only mtg.wiki and the collector mention texture.',
    css: standardCss,
    webgl:
      'Simplified mana symbols (sun, drop, skull, fireball, tree) inside thin rings, drawn as distance functions on a staggered, slightly jittered grid (about 10 across), with the symbol picked at random per cell and a few cells left empty. Each symbol is embossed from a light direction set by the tilt and tinted metallic silver with a hint of its mana colour and a slight rainbow shift. The symbols show in patches near the light (a tilt-shifting noise reveal times the squared glare) and fade to about 8% elsewhere. A traditional foil sweep covers the rest. Hard-light blend around neutral grey. The preview uses the non-foil borderless Herald of Eternal Dawn (FDN #299), because mana foil scans have the symbols baked in.',
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
