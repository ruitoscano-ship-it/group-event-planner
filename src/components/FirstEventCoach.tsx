import { markAssistedComplete } from '../lib/assistedMode'
import { useI18n } from '../i18n/I18nContext'

export type CoachStep = 'code' | 'menu' | 'share' | 'done'

const STEPS: CoachStep[] = ['code', 'menu', 'share', 'done']

type Props = {
  step: CoachStep
  onStep: (step: CoachStep) => void
  onGoMenu: () => void
  onGoShare: () => void
  onGoCode: () => void
  onFinish: () => void
}

export function FirstEventCoach({
  step,
  onStep,
  onGoMenu,
  onGoShare,
  onGoCode,
  onFinish,
}: Props) {
  const { t } = useI18n()
  const stepIndex = STEPS.indexOf(step)

  const copy = (
    {
      code: {
        title: t('demoCodeTitle'),
        body: t('demoCodeBody'),
        primary: t('demoCodeDone'),
        secondary: t('demoSkip'),
      },
      menu: {
        title: t('demoMenuTitle'),
        body: t('demoMenuBody'),
        primary: t('demoMenuOpen'),
        secondary: t('demoMenuSkip'),
      },
      share: {
        title: t('demoShareTitle'),
        body: t('demoShareBody'),
        primary: t('demoShareDone'),
        secondary: t('demoSkip'),
      },
      done: {
        title: t('demoDoneTitle'),
        body: t('demoDoneBody'),
        primary: t('demoDoneClose'),
        secondary: null as string | null,
      },
    } as const
  )[step]

  function focusStep(next: CoachStep) {
    onStep(next)
    if (next === 'code') onGoCode()
    if (next === 'menu') onGoMenu()
    if (next === 'share') onGoShare()
  }

  function advance() {
    if (step === 'code') {
      focusStep('menu')
      return
    }
    if (step === 'menu') {
      focusStep('share')
      return
    }
    if (step === 'share') {
      onStep('done')
      return
    }
    markAssistedComplete()
    onFinish()
  }

  function skip() {
    if (step === 'code') focusStep('menu')
    else if (step === 'menu') focusStep('share')
    else if (step === 'share') onStep('done')
    else {
      markAssistedComplete()
      onFinish()
    }
  }

  return (
    <aside className="first-event-coach" role="dialog" aria-label={t('demoBadge')}>
      <div className="first-event-coach-head">
        <p className="assisted-badge">{t('demoBadge')}</p>
        <span className="first-event-coach-progress">
          {t('demoStepOf', { n: stepIndex + 1, total: STEPS.length })}
        </span>
      </div>
      <ol className="demo-roadmap" aria-hidden={step === 'done'}>
        {(
          [
            ['code', 'demoRoadmapCode'],
            ['menu', 'demoRoadmapMenu'],
            ['share', 'demoRoadmapShare'],
            ['done', 'demoRoadmapDone'],
          ] as const
        ).map(([key, label], i) => (
          <li
            key={key}
            className={`${key === step ? 'current' : ''} ${i < stepIndex ? 'done' : ''}`}
          >
            <span>{i + 1}</span>
            {t(label)}
          </li>
        ))}
      </ol>
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
    </aside>
  )
}
