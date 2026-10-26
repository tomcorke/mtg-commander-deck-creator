import { useRef, useState } from 'react'

import type { DeckReviewFilter } from '../deck-review.ts'
import type { Card, DeckCard, DeckCardLocation, ScryfallCard } from '../domain/card-model.ts'
import type { ExportFormat } from '../domain/card-model.ts'
import { usePendingConfirmation, useStoredOption } from '../shared/hooks.ts'

type BuilderModeReturn =
  'review' | 'review-changes' | 'review-confirm' | 'doctor' | 'doctor-history' | 'search' | null

export function useDeckState() {
  const [selectedDeckCardLocation, setSelectedDeckCardLocation] = useState<DeckCardLocation | null>(
    null,
  )
  const [selectedCollectionCard, setSelectedCollectionCard] = useState<DeckCard | null>(null)
  const [selectedGuidanceCard, setSelectedGuidanceCard] = useState<Card | null>(null)
  const [selectedCardReference, setSelectedCardReference] = useState<DeckCard | null>(null)
  const [pendingCardRemoval, setPendingCardRemoval] =
    usePendingConfirmation<DeckCardLocation | null>(null)
  const [basicLandState, setBasicLandState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [selectedManualCard, setSelectedManualCard] = useState<ScryfallCard | null>(null)
  const [manualPrintings, setManualPrintings] = useState<ScryfallCard[]>([])
  const [manualPrinting, setManualPrinting] = useState(0)
  const cardSearchButton = useRef<HTMLButtonElement>(null)
  const manualPrintingRequest = useRef<AbortController | null>(null)
  const [manualPrintingError, setManualPrintingError] = useState('')
  const repairedPrintingBatches = useRef(new Set<string>())
  const skipCompletionReviewDecks = useRef(new WeakSet<DeckCard[]>())
  const [exportFormat, setExportFormat] = useStoredOption<ExportFormat>(
    'exportFormat',
    () => 'moxfield',
  )
  const [copied, setCopied] = useState(false)
  const [loadingArt, setLoadingArt] = useState('')
  const [highlightedManaValue, setHighlightedManaValue] = useState<number | null>(null)
  const [deckReviewFilter, setDeckReviewFilter] = useState<DeckReviewFilter | null>(null)
  const [pendingRemoval, setPendingRemoval] = usePendingConfirmation<number | null>(null)
  const [deckDoctorError, setDeckDoctorError] = useState('')
  const [builderModeReturn, setBuilderModeReturn] = useState<BuilderModeReturn>(null)

  return {
    selectedDeckCardLocation,
    setSelectedDeckCardLocation,
    selectedCollectionCard,
    setSelectedCollectionCard,
    selectedGuidanceCard,
    setSelectedGuidanceCard,
    selectedCardReference,
    setSelectedCardReference,
    pendingCardRemoval,
    setPendingCardRemoval,
    basicLandState,
    setBasicLandState,
    selectedManualCard,
    setSelectedManualCard,
    manualPrintings,
    setManualPrintings,
    manualPrinting,
    setManualPrinting,
    cardSearchButton,
    manualPrintingRequest,
    manualPrintingError,
    setManualPrintingError,
    repairedPrintingBatches,
    skipCompletionReviewDecks,
    exportFormat,
    setExportFormat,
    copied,
    setCopied,
    loadingArt,
    setLoadingArt,
    highlightedManaValue,
    setHighlightedManaValue,
    deckReviewFilter,
    setDeckReviewFilter,
    pendingRemoval,
    setPendingRemoval,
    deckDoctorError,
    setDeckDoctorError,
    builderModeReturn,
    setBuilderModeReturn,
  }
}

export type DeckState = ReturnType<typeof useDeckState>
