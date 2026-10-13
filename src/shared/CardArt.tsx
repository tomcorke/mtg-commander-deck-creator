import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
} from 'react'

import type { CardFinish } from '../domain/card-model'
import { useVisualPreferences } from './VisualPreferencesContext.tsx'
import {
  foilPointer,
  hideHoverFoil,
  moveHoverFoil,
  showHoverFoil,
  type FoilCard,
} from './foil/hover-foil.ts'

export function ArtLoading({ active }: { active: boolean }) {
  return active ? (
    <span className="art-loading" role="status">
      <i />
      Loading art…
    </span>
  ) : null
}

export function PrintingButton({
  count,
  index,
  loading,
  name,
  onClick,
}: {
  count: number
  index: number
  loading: boolean
  name: string
  onClick: () => void
}) {
  return count > 1 ? (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      aria-label={`Show alternate printing of ${name}`}
    >
      ↻ Art {index + 1}/{count}
    </button>
  ) : null
}

export function FinishedCardImage({
  image,
  backImage,
  alt,
  cardName,
  finish,
  foilType,
  set,
  collectorNumber,
  cssOnly = false,
  hasSynergyGlow = false,
  className = '',
  printing,
  showFlipButton = false,
}: {
  image: string
  backImage?: string
  alt: string
  cardName?: string
  finish?: CardFinish
  foilType?: string
  set?: string
  collectorNumber?: string
  cssOnly?: boolean
  hasSynergyGlow?: boolean
  className?: string
  printing?: {
    count: number
    index: number
    loading: boolean
    name: string
    onClick: () => void
  }
  showFlipButton?: boolean
}) {
  const { cardEffects: effectsEnabled } = useVisualPreferences()
  const [loadedImage, setLoadedImage] = useState('')
  const [flipped, setFlipped] = useState(false)
  const displayedImage = flipped && backImage ? backImage : image
  const foilHue =
    [...displayedImage].reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
      0,
    ) % 360
  const finishClass = cardFinishClass(finish, foilType, effectsEnabled)
  const flipName = printing?.name ?? cardName ?? 'card'
  const hasActions = Boolean(printing?.count && printing.count > 1) || (showFlipButton && backImage)
  const name = cardName ?? printing?.name

  const foil = useFoilImage(
    { image: displayedImage, finish, foilType, set, collectorNumber, name },
    effectsEnabled,
    cssOnly,
  )

  return (
    <span
      {...foil}
      className={`finished-card ${loadedImage === displayedImage ? 'image-ready' : ''} ${effectsEnabled ? 'tilting-card' : ''} ${finishClass}`}
      style={effectsEnabled ? ({ '--foil-hue': `${foilHue}deg` } as CSSProperties) : undefined}
    >
      <img
        className={className}
        src={displayedImage}
        alt={flipped ? `${alt} (back face)` : alt}
        onLoad={() => setLoadedImage(displayedImage)}
        onError={() => setLoadedImage(displayedImage)}
      />
      {hasSynergyGlow && <span className="synergy-connector" aria-hidden="true" />}
      {effectsEnabled && finish && finish !== 'nonfoil' && (
        <img
          className={`finish-edges ${finish}-edges ${className}`}
          src={displayedImage}
          alt=""
          aria-hidden="true"
        />
      )}
      {hasActions && (
        <CardImageActions
          flipped={flipped}
          flipName={flipName}
          printing={printing}
          setFlipped={setFlipped}
          showFlipButton={showFlipButton && Boolean(backImage)}
        />
      )}
    </span>
  )
}

function useFoilImage(card: FoilCard, effectsEnabled: boolean, cssOnly: boolean) {
  const { image, finish, foilType, set, collectorNumber, name } = card
  const ref = useRef<HTMLSpanElement>(null)
  const enabled = effectsEnabled && !cssOnly
  // A printing/face or preference change removes the old canvas before the next paint.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (enabled && element.matches(':hover'))
      showHoverFoil(element, { image, finish, foilType, set, collectorNumber, name })
    return () => hideHoverFoil(element)
  }, [image, finish, foilType, set, collectorNumber, name, enabled])
  const leave = (event: PointerEvent<HTMLElement>) => {
    resetFoil(event)
    hideHoverFoil(event.currentTarget)
  }
  return {
    ref,
    onPointerEnter: enabled
      ? (event: PointerEvent<HTMLElement>) =>
          showHoverFoil(
            event.currentTarget,
            card,
            foilPointer(event.currentTarget, event.clientX, event.clientY),
          )
      : undefined,
    onPointerMove: effectsEnabled
      ? (event: PointerEvent<HTMLElement>) => moveHoverFoil(event.currentTarget, moveFoil(event))
      : undefined,
    onPointerLeave: leave,
    onPointerCancel: leave,
  }
}

// Foil types with their own effect; other foil types use the standard holo effect.
const styledFoilTypes = new Set([
  'surgefoil',
  'galaxyfoil',
  'silverfoil',
  'ripplefoil',
  'doublerainbow',
  'rainbowfoil',
  'halofoil',
])

function cardFinishClass(
  finish: CardFinish | undefined,
  foilType: string | undefined,
  effectsEnabled: boolean,
) {
  if (!effectsEnabled) return ''
  if (finish === 'foil')
    return foilType && styledFoilTypes.has(foilType) ? `holo-card foil-${foilType}` : 'holo-card'
  return finish === 'etched' ? 'etched-card' : ''
}

function CardImageActions({
  flipped,
  flipName,
  printing,
  setFlipped,
  showFlipButton,
}: {
  flipped: boolean
  flipName: string
  printing?: {
    count: number
    index: number
    loading: boolean
    name: string
    onClick: () => void
  }
  setFlipped: Dispatch<SetStateAction<boolean>>
  showFlipButton: boolean
}) {
  return (
    <span className="card-image-actions">
      {printing && <PrintingButton {...printing} />}
      {showFlipButton && (
        <button
          type="button"
          className="card-flip-button"
          aria-label={`Show ${flipped ? 'front' : 'back'} of ${flipName}`}
          aria-pressed={flipped}
          onClick={(event) => {
            event.stopPropagation()
            setFlipped((current) => !current)
          }}
        >
          ↔ Flip
        </button>
      )}
    </span>
  )
}

function moveFoil(event: PointerEvent<HTMLElement>) {
  const card = event.currentTarget
  const { x, y } = foilPointer(card, event.clientX, event.clientY)
  card.style.setProperty('--foil-x', `${x * 100}%`)
  card.style.setProperty('--foil-y', `${y * 100}%`)
  card.style.setProperty('--foil-rotate-x', `${(0.5 - y) * 16}deg`)
  card.style.setProperty('--foil-rotate-y', `${(x - 0.5) * 16}deg`)
  card.style.setProperty('--foil-shift', `${(x + y - 1) * 100}deg`)
  return { x, y }
}

function resetFoil(event: PointerEvent<HTMLElement>) {
  for (const property of [
    '--foil-x',
    '--foil-y',
    '--foil-rotate-x',
    '--foil-rotate-y',
    '--foil-shift',
  ])
    event.currentTarget.style.removeProperty(property)
}
