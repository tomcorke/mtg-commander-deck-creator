import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import {
  getRequestActivity,
  observeRequestActivity,
  type RequestActivity,
} from '../adapters/request-scheduler.ts'
import '../styles/request-activity.css'

function positionDetails(button: HTMLButtonElement, panel: HTMLDivElement) {
  const anchor = button.getBoundingClientRect(),
    bounds = panel.getBoundingClientRect()
  panel.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, innerWidth - bounds.width - 8))}px`
  const top =
    anchor.bottom + 8 + bounds.height <= innerHeight
      ? anchor.bottom + 8
      : anchor.top - bounds.height - 8
  panel.style.top = `${Math.max(8, Math.min(top, innerHeight - bounds.height - 8))}px`
}

function useActivityClock(activity: RequestActivity) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      const current = Date.now()
      setNow(current)
      const deadlines = [
        activity.backgroundRetryAt,
        ...activity.providers.map(({ cooldownUntil }) => cooldownUntil),
      ]
      const next = Math.min(...deadlines.filter((at) => at > current))
      if (Number.isFinite(next))
        timer = setTimeout(update, Math.min(2_147_483_647, next - current + 1))
    }
    update()
    return () => clearTimeout(timer)
  }, [activity])
  return now
}
const localTime = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function ActivityDetails({ activity, now }: { activity: RequestActivity; now: number }) {
  return (
    <>
      <strong>API requests — this tab</strong>
      <table>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">Active</th>
            <th scope="col">Queued</th>
          </tr>
        </thead>
        <tbody>
          {activity.providers.map((provider) => (
            <tr key={provider.name}>
              <th scope="row">{provider.name}</th>
              <td>{provider.active}</td>
              <td>{provider.queued}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {activity.providers
        .filter(({ cooldownUntil }) => cooldownUntil > now)
        .map((provider) => (
          <p key={provider.name}>
            {provider.name} cooldown until{' '}
            <time dateTime={new Date(provider.cooldownUntil).toISOString()}>
              {localTime(provider.cooldownUntil)}
            </time>
            .
          </p>
        ))}
      {activity.backgroundRetryAt > now && (
        <p>
          Enrichment waiting; next check at{' '}
          <time dateTime={new Date(activity.backgroundRetryAt).toISOString()}>
            {localTime(activity.backgroundRetryAt)}
          </time>{' '}
          (retry or hourly allowance).
        </p>
      )}
      <small>
        Shared calls count once. Cached lookups and card images are excluded. Deferred work is not
        queued.
      </small>
    </>
  )
}

export function RequestActivityIndicator() {
  const activity = useSyncExternalStore(observeRequestActivity, getRequestActivity)
  const now = useActivityClock(activity)
  const active = activity.providers.reduce((sum, provider) => sum + provider.active, 0)
  const queued = activity.providers.reduce((sum, provider) => sum + provider.queued, 0)
  const waiting =
    activity.backgroundRetryAt > now ||
    activity.providers.some(({ cooldownUntil }) => cooldownUntil > now)
  const state = active || queued ? 'active' : waiting ? 'waiting' : 'idle'
  const id = useId(),
    button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null)
  const pinned = useRef(false)
  const [open, setOpen] = useState(false)
  const show = () => {
    if (!panel.current || !button.current) return
    panel.current.showPopover()
    positionDetails(button.current, panel.current)
  }
  const hide = () => {
    if (!pinned.current) panel.current?.hidePopover()
  }
  useEffect(() => {
    if (!open) return
    const position = () => {
      if (button.current && panel.current) positionDetails(button.current, panel.current)
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open, activity, now])
  return (
    <span className="action-help-wrap request-activity" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={button}
        type="button"
        className="theme-toggle request-activity-button"
        data-state={state}
        aria-label={`API requests: ${active} active, ${queued} queued${waiting ? ', waiting' : ''}`}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={show}
        onBlur={hide}
        onClick={() => {
          pinned.current = !pinned.current
          if (pinned.current) show()
          else panel.current?.hidePopover()
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M12 7v4M5 16v-5h14v5" />
          <circle cx="12" cy="4" r="3" />
          <circle cx="5" cy="19" r="3" />
          <circle cx="19" cy="19" r="3" />
        </svg>
        {queued > 0 && (
          <span className="request-activity-count" aria-hidden="true">
            {queued}
          </span>
        )}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="tooltip"
        className="request-activity-panel"
        onToggle={(event) => {
          const visible = event.newState === 'open'
          setOpen(visible)
          if (!visible) pinned.current = false
        }}
      >
        <ActivityDetails activity={activity} now={now} />
      </div>
    </span>
  )
}
