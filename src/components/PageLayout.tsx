import { Outlet, useLocation } from 'react-router-dom'

export function PageLayout() {
  const { pathname } = useLocation()

  return (
    <div className="page-stage">
      <div key={pathname} className="page-panel">
        <Outlet />
      </div>
    </div>
  )
}
