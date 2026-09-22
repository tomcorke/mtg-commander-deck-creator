import { useState, type CSSProperties, type PointerEvent } from 'react'

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
  alt,
  finish,
  effectsEnabled,
  hasSynergyGlow = false,
  className = '',
}: {
  image: string
  alt: string
  finish?: CardFinish
  effectsEnabled: boolean
  hasSynergyGlow?: boolean
  className?: string
}) {
  const [loadedImage, setLoadedImage] = useState('')
  const foilHue =
    [...image].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0) % 360
  const finishClass = effectsEnabled
    ? finish === 'foil'
      ? 'holo-card'
      : finish === 'etched'
        ? 'etched-card'
        : ''
    : ''
  return (
    <span
      className={`finished-card ${loadedImage === image ? 'image-ready' : ''} ${effectsEnabled ? 'tilting-card' : ''} ${finishClass}`}
      style={effectsEnabled ? ({ '--foil-hue': `${foilHue}deg` } as CSSProperties) : undefined}
      onPointerMove={effectsEnabled ? moveFoil : undefined}
      onPointerLeave={effectsEnabled ? resetFoil : undefined}
      onPointerCancel={effectsEnabled ? resetFoil : undefined}
    >
      <img
        className={className}
        src={image}
        alt={alt}
        onLoad={() => setLoadedImage(image)}
        onError={() => setLoadedImage(image)}
      />
      {hasSynergyGlow && <span className="synergy-connector" aria-hidden="true" />}
      {effectsEnabled && finish && finish !== 'nonfoil' && (
        <img
          className={`finish-edges ${finish}-edges ${className}`}
          src={image}
          alt=""
          aria-hidden="true"
        />
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
