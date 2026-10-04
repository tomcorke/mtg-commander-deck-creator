import { useEffect } from 'react'
import { Joyride, type TooltipRenderProps, type Step } from 'react-joyride'
import { ModalCloseButton } from '../../shared/CardDetails.tsx'
import { useVisualPreferences } from '../../shared/VisualPreferencesContext.tsx'

const steps: Step[] = [
  {
    target: '[data-guide="decisions"]',
    title: 'Choose what happens to each card',
    content:
      'Add puts the card in your deck. Later saves it for a future batch. Ignore removes it from future recommendations.',
  },
  {
    target: '[data-guide="more-like-this"]',
    title: 'More like this',
    content: 'Use More like this to give related cards more weight in later batches.',
  },
  {
    target: '[data-guide="settings"]',
    title: 'Recommendation settings',
    content:
      'Change priority, power, exclusions, price and sets here. Your play style is only a starting point.',
  },
  {
    target: '[data-guide="targets"]',
    title: 'Deck targets',
    content:
      'Edit role targets in the sidebar. Counts are app estimates, not construction requirements.',
  },
  {
    target: '[data-guide="review"]',
    title: 'Deck review',
    content: 'Review the deck for possible gaps and compare changes before applying them.',
  },
].map((step) => ({ ...step, skipBeacon: true }))

function GuideTooltip({
  tooltipProps,
  step,
  index,
  size,
  backProps,
  primaryProps,
  skipProps,
  controls,
}: TooltipRenderProps) {
  const { darkMode } = useVisualPreferences()
  return (
    <section
      {...tooltipProps}
      className={`export-modal intro-guide ${darkMode ? 'dark' : ''}`}
      role="dialog"
      aria-labelledby="intro-guide-title"
      aria-describedby="intro-guide-content"
    >
      <div className="export-heading">
        <h2 id="intro-guide-title">{step.title}</h2>
        <ModalCloseButton onClick={() => controls.skip()} label="Skip intro guide" />
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Guide: {step.title}. {index + 1} of {size}.
      </p>
      <p id="intro-guide-content">{step.content}</p>
      <div className="export-actions">
        <button {...backProps} className="export" type="button" disabled={index === 0}>
          Back
        </button>
        <button {...primaryProps} className="primary" type="button">
          {index === size - 1 ? 'Finish' : 'Next'}
        </button>
        <button {...skipProps} className="export" type="button">
          Skip
        </button>
      </div>
    </section>
  )
}

export function IntroGuide({ close }: { close: () => void }) {
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      close()
    }
    document.addEventListener('keydown', dismiss, true)
    return () => document.removeEventListener('keydown', dismiss, true)
  }, [close])
  return (
    <Joyride
      run
      continuous
      steps={steps}
      tooltipComponent={GuideTooltip}
      locale={{
        back: 'Back',
        next: 'Next',
        last: 'Finish',
        skip: 'Skip',
        close: 'Skip intro guide',
      }}
      options={{
        buttons: ['back', 'close', 'primary', 'skip'],
        closeButtonAction: 'skip',
        dismissKeyAction: 'close',
        blockTargetInteraction: true,
        scrollDuration: 0,
        targetWaitTimeout: 1000,
        width: 380,
        zIndex: 70,
      }}
      styles={{ floater: { transition: 'none' } }}
      onEvent={(event) => {
        if (
          event.status === 'finished' ||
          event.status === 'skipped' ||
          (event.action === 'close' && event.origin === 'keyboard')
        )
          close()
      }}
    />
  )
}
