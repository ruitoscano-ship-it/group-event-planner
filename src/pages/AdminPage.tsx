import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { useI18n } from '../i18n/I18nContext'
import {
  adminApi,
  clearAdminToken,
  loadAdminToken,
  saveAdminToken,
  type AdminEventSummary,
  type AdminFilter,
  type AdminStats,
} from '../lib/adminApi'
import { formatDate } from '../lib/money'

function typeLabel(
  type: string,
  t: (key: 'typeLunch' | 'typeDinner' | 'typeBrunch' | 'typeOther') => string,
) {
  if (type === 'lunch') return t('typeLunch')
  if (type === 'dinner') return t('typeDinner')
  if (type === 'brunch') return t('typeBrunch')
  return t('typeOther')
}

export function AdminPage() {
  const { t, localeTag } = useI18n()
  const [token, setToken] = useState<string | null>(() => loadAdminToken())
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [filter, setFilter] = useState<AdminFilter>('all')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [events, setEvents] = useState<AdminEventSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!loadAdminToken()) return
    setLoading(true)
    setError(null)
    try {
      const [nextStats, list] = await Promise.all([
        adminApi.stats(),
        adminApi.listEvents(filter),
      ])
      setStats(nextStats)
      setEvents(list.events)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('adminLoadFailed')
      setError(message)
      if (/auth|password|401/i.test(message)) {
        clearAdminToken()
        setToken(null)
      }
    } finally {
      setLoading(false)
    }
  }, [filter, t])

  useEffect(() => {
    if (token) void refresh()
  }, [token, refresh])

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    if (!password || loginBusy) return
    setLoginBusy(true)
    setLoginError(null)
    try {
      const result = await adminApi.login(password)
      saveAdminToken(result.token)
      setToken(result.token)
      setPassword('')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t('adminLoginFailed'))
    } finally {
      setLoginBusy(false)
    }
  }

  function logout() {
    clearAdminToken()
    setToken(null)
    setStats(null)
    setEvents([])
    setBanner(null)
  }

  async function archive(id: string, archived: boolean) {
    setBusyId(id)
    setBanner(null)
    try {
      await adminApi.setArchived(id, archived)
      setBanner(archived ? t('adminArchivedOk') : t('adminRestoredOk'))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminActionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(t('adminDeleteConfirm', { title }))) return
    setBusyId(id)
    setBanner(null)
    try {
      await adminApi.deleteEvent(id)
      setBanner(t('adminDeletedOk'))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminActionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  async function purgePast() {
    if (!confirm(t('adminPurgeConfirm'))) return
    setBusyId('purge')
    setBanner(null)
    try {
      const result = await adminApi.purgePast(true)
      setBanner(t('adminPurgeOk', { count: result.deleted }))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminActionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (!token) {
    return (
      <>
        <header className="topbar">
          <Link viewTransition to="/" className="brand">
            <i className="brand-mark" aria-hidden />
            Round<span>.</span>
          </Link>
          <LanguageSwitcher />
        </header>

        <section className="admin-shell">
          <div className="admin-login panel">
            <p className="assisted-badge">{t('adminBadge')}</p>
            <h1>{t('adminTitle')}</h1>
            <p className="sub">{t('adminLoginSub')}</p>
            {loginError && (
              <div className="feedback-banner error" role="alert">
                {loginError}
              </div>
            )}
            <form onSubmit={(e) => void onLogin(e)}>
              <label className="full">
                {t('adminPassword')}
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
              </label>
              <div className="form-actions">
                <Link viewTransition className="btn btn-ghost" to="/">
                  {t('backToHome')}
                </Link>
                <button className="btn btn-accent" type="submit" disabled={loginBusy}>
                  {loginBusy ? t('saving') : t('adminSignIn')}
                </button>
              </div>
            </form>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <header className="topbar">
        <Link viewTransition to="/" className="brand">
          <i className="brand-mark" aria-hidden />
          Round<span>.</span>
        </Link>
        <div className="nav-actions">
          <LanguageSwitcher />
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            {t('adminSignOut')}
          </button>
        </div>
      </header>

      <section className="admin-shell">
        <div className="admin-header">
          <div>
            <p className="assisted-badge">{t('adminBadge')}</p>
            <h1>{t('adminTitle')}</h1>
            <p className="sub">{t('adminSub')}</p>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? t('saving') : t('adminRefresh')}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void purgePast()}
              disabled={busyId === 'purge'}
            >
              {t('adminPurgePast')}
            </button>
          </div>
        </div>

        {banner && (
          <div className="feedback-banner" role="status">
            {banner}
          </div>
        )}
        {error && (
          <div className="feedback-banner error" role="alert">
            {error}
          </div>
        )}

        {stats && (
          <div className="admin-stats">
            <div className="admin-stat">
              <span>{t('adminStatTotal')}</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('adminStatActive')}</span>
              <strong>{stats.active}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('adminStatPast')}</span>
              <strong>{stats.past}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('adminStatArchived')}</span>
              <strong>{stats.archived}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('adminStatWeek')}</span>
              <strong>{stats.createdLast7Days}</strong>
            </div>
            <div className="admin-stat">
              <span>{t('adminStatPeople')}</span>
              <strong>{stats.peopleTotal}</strong>
            </div>
          </div>
        )}

        <div className="admin-filters" role="tablist" aria-label={t('adminFilters')}>
          {(
            [
              ['all', 'adminFilterAll'],
              ['active', 'adminFilterActive'],
              ['past', 'adminFilterPast'],
              ['archived', 'adminFilterArchived'],
              ['recent', 'adminFilterRecent'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`admin-filter ${filter === key ? 'on' : ''}`}
              onClick={() => setFilter(key)}
            >
              {t(label)}
            </button>
          ))}
        </div>

        <div className="admin-table-wrap panel">
          {events.length === 0 ? (
            <div className="empty">{loading ? t('saving') : t('adminEmpty')}</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('adminColEvent')}</th>
                  <th>{t('adminColWhen')}</th>
                  <th>{t('adminColCreated')}</th>
                  <th>{t('adminColGuests')}</th>
                  <th>{t('adminColStatus')}</th>
                  <th>{t('adminColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((row) => (
                  <tr key={row.id} className={row.archivedAt ? 'is-archived' : ''}>
                    <td>
                      <strong>{row.title}</strong>
                      <div className="admin-meta">
                        {typeLabel(row.type, t)}
                        {row.organizerName ? ` · ${row.organizerName}` : ''}
                        {row.location ? ` · ${row.location}` : ''}
                      </div>
                      <div className="admin-meta mono">{row.organizerCode || '—'}</div>
                    </td>
                    <td>
                      {row.date
                        ? formatDate(row.date, localeTag, t('dateTbd'))
                        : t('dateTbd')}
                      {row.time ? ` · ${row.time}` : ''}
                      {row.isPast && (
                        <div className="admin-pill past">{t('adminPast')}</div>
                      )}
                    </td>
                    <td>
                      {new Date(row.createdAt).toLocaleString(localeTag)}
                    </td>
                    <td>
                      {row.attendeeCount}
                      <span className="admin-meta">
                        {' '}
                        / {row.peopleCount} {t('peopleLabel')}
                      </span>
                    </td>
                    <td>
                      {row.archivedAt ? (
                        <span className="admin-pill archived">{t('adminArchived')}</span>
                      ) : (
                        <span className="admin-pill active">{t('adminActive')}</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link
                          viewTransition
                          className="btn btn-ghost btn-sm"
                          to={`/events/${row.id}`}
                        >
                          {t('adminOpen')}
                        </Link>
                        {row.archivedAt ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busyId === row.id}
                            onClick={() => void archive(row.id, false)}
                          >
                            {t('adminRestore')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busyId === row.id}
                            onClick={() => void archive(row.id, true)}
                          >
                            {t('adminArchive')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busyId === row.id}
                          onClick={() => void remove(row.id, row.title)}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  )
}
