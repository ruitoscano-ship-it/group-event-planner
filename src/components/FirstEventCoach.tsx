import { markAssistedComplete } from '../lib/assistedMode'
import { useI18n } from '../i18n/I18nContext'

export type CoachStep = 'code' | 'menu' | 'share' | 'done'

type Props = {
  step: CoachStep
  onStep: (step: CoachStep) => void
  onGoMenu: () => void
  onGoShare: () => void
  onFinish: () => void
}

export function FirstEventCoach({
  step,
  onStep,
  onGoMenu,
  onGoShare,
  onFinish,
}: Props) {
  const { t } = useI18n()

  const copy = (
    {
      code: {
        title: t('coachCodeTitle'),
        body: t('coachCodeBody'),
        primary: t('coachCodeDone'),
        secondary: t('coachSkip'),
      },
      menu: {
        title: t('coachMenuTitle'),
        body: t('coachMenuBody'),
        primary: t('coachMenuOpen'),
        secondary: t('coachMenuSkip'),
      },
      share: {
        title: t('coachShareTitle'),
        body: t('coachShareBody'),
        primary: t('coachShareDone'),
        secondary: t('coachSkip'),
      },
      done: {
        title: t('coachDoneTitle'),
        body: t('coachDoneBody'),
        primary: t('coachDoneClose'),
        secondary: null as string | null,
      },
    } as const
  )[step]

  function advance() {
    if (step === 'code') {
      onGoShare()
      onStep('menu')
      return
    }
    if (step === 'menu') {
      onGoMenu()
      onStep('share')
      return
    }
    if (step === 'share') {
      onGoShare()
      onStep('done')
      return
    }
    markAssistedComplete()
    onFinish()
  }

  function skip() {
    if (step === 'code') onStep('menu')
    else if (step === 'menu') onStep('share')
    else if (step === 'share') onStep('done')
    else {
      markAssistedComplete()
      onFinish()
    }
  }

  return (
    <aside className="first-event-coach" role="dialog" aria-label={t('assistedBadge')}>
      <p className="assisted-badge">{t('assistedBadge')}</p>
      <h2>{copy.title}</h2>
      <p>{copy.body}</p>
      <div className="first-event-coach-actions">
        {copy.secondary && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>
            {copy.secondary}
          </button>
        )}
        <button type="button" className="btn btn-accent btn-sm" onClick={advance}>
          {copy.primary}
        </button>
      </div>
      <div className="first-event-coach-dots" aria-hidden>
        {(['code', 'menu', 'share', 'done'] as const).map((key) => (
          <span key={key} className={key === step ? 'on' : ''} />
        ))}
      </div>
    </aside>
  )
}
