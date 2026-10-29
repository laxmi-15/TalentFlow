import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import Requisitions from './pages/Requisitions'
import { Candidates, CandidateDetail } from './pages/Candidates'
import Pipeline from './pages/Pipeline'
import Interviews from './pages/Interviews'
import Panels from './pages/Panels'
import Scorecard from './pages/Scorecard'
import Offers from './pages/Offers'
import Exceptions from './pages/Exceptions'
import DataQuality from './pages/DataQuality'
import Audit from './pages/Audit'
import Admin from './pages/Admin'
import { EmptyState } from './components/ui'

export default function App() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<Overview />} />
    <Route path="requisitions" element={<Requisitions />} />
    <Route path="candidates" element={<Candidates />} />
    <Route path="candidates/:id" element={<CandidateDetail />} />
    <Route path="pipeline" element={<Pipeline />} />
    <Route path="interviews" element={<Interviews />} />
    <Route path="panels" element={<Panels />} />
    <Route path="scorecards" element={<Scorecard />} />
    <Route path="offers" element={<Offers />} />
    <Route path="exceptions" element={<Exceptions />} />
    <Route path="data-quality" element={<DataQuality />} />
    <Route path="audit" element={<Audit />} />
    <Route path="admin" element={<Admin />} />
    <Route path="overview" element={<Navigate to="/" replace />} />
    <Route path="*" element={<EmptyState title="Page not found" hint="Use the sidebar to get back on track." />} />
  </Route></Routes>
}
