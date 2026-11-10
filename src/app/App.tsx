import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../modules/auth/services/AuthContext'
import LoginPage from '../modules/auth/pages/LoginPage'
import DashboardPage from '../modules/dashboard/pages/DashboardPage'
import AppLayout from './layout/AppLayout'
import AnalysisPage from '../modules/analysis/pages/AnalysisPage'
import DetectionsPage from '../modules/detections/pages/DetectionsPage'
import SegmentationPage from '../modules/segmentation/pages/SegmentationPage'
import PatternsPage from '../modules/patterns/pages/PatternsPage'
import AlertsPage from '../modules/alerts/pages/AlertsPage'
import HistoryPage from '../modules/history/pages/HistoryPage'
import ScenariosPage from '../modules/scenarios/pages/ScenariosPage'
import SettingsPage from '../modules/settings/pages/SettingsPage'

function ProtectedLayout() {
  const { user } = useAuth()
  return user ? <AppLayout /> : <Navigate to="/login" replace />
}
export default function App() {
  const { user } = useAuth()
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/analysis" element={<AnalysisPage />} />
      <Route path="/detections" element={<DetectionsPage />} />
      <Route path="/segmentation" element={<SegmentationPage />} />
      <Route path="/patterns" element={<PatternsPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/scenarios" element={<ScenariosPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
  </Routes>
}
