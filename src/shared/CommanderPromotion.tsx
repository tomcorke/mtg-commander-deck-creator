import {
  commanderPromotionWarning,
  type CommanderPromotionInfo,
} from '../domain/commander-promotion.ts'

type CommanderPromotionProps = {
  info: CommanderPromotionInfo
  onPromote: () => void
}

export function CommanderPromotion({ info, onPromote }: CommanderPromotionProps) {
  return (
    <div className="commander-promotion">
      <button
        type="button"
        className="commander-promotion-button"
        disabled={!info.canPromote}
        onClick={onPromote}
      >
        Use as commander
      </button>
      {!info.canPromote && (
        <p className="commander-warning form-error" role="alert">
          {commanderPromotionWarning(info)}
        </p>
      )}
    </div>
  )
}
