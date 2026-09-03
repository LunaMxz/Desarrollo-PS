import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
// import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* TODO (equipo frontend): agregar rutas protegidas para
            residentes, cuotas, incidencias, etc. usando <ProtectedRoute> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
