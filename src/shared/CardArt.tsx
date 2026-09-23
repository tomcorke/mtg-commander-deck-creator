import {
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
} from 'react'

import type { CardFinish } from '../domain/card-model'

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
  effectsEnabled,
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
  effectsEnabled: boolean
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
  const [loadedImage, setLoadedImage] = useState('')
  const [flipped, setFlipped] = useState(false)
  const displayedImage = flipped && backImage ? backImage : image
  const foilHue =
    [...displayedImage].reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
      0,
    ) % 360
  const finishClass = cardFinishClass(finish, effectsEnabled)
  const flipName = printing?.name ?? cardName ?? 'card'
  const hasActions = Boolean(printing?.count && printing.count > 1) || (showFlipButton && backImage)

  return (
    <span
      className={`finished-card ${loadedImage === displayedImage ? 'image-ready' : ''} ${effectsEnabled ? 'tilting-card' : ''} ${finishClass}`}
      style={effectsEnabled ? ({ '--foil-hue': `${foilHue}deg` } as CSSProperties) : undefined}
      onPointerMove={effectsEnabled ? moveFoil : undefined}
      onPointerLeave={effectsEnabled ? resetFoil : undefined}
      onPointerCancel={effectsEnabled ? resetFoil : undefined}
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

function cardFinishClass(finish: CardFinish | undefined, effectsEnabled: boolean) {
  if (!effectsEnabled) return ''
  if (finish === 'foil') return 'holo-card'
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
  const bounds = card.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
  card.style.setProperty('--foil-x', `${x * 100}%`)
  card.style.setProperty('--foil-y', `${y * 100}%`)
  card.style.setProperty('--foil-rotate-x', `${(0.5 - y) * 16}deg`)
  card.style.setProperty('--foil-rotate-y', `${(x - 0.5) * 16}deg`)
  card.style.setProperty('--foil-shift', `${(x + y - 1) * 100}deg`)
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
