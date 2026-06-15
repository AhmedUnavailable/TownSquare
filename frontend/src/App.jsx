import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import Feed from './components/Feed';
import ServantDashboard from './components/ServantDashboard';

function AppContent() {
  const { user } = useAuth();
  if (!user) return <AuthPage />;
  if (user.role === 'public_servant') return <ServantDashboard />;
  return <Feed />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
