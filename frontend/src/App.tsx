import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Gastos from './pages/Gastos';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './routes/ProtectedRoute';
import Pagos from './pages/Pagos';
import Historial from './pages/Historial';
import Metas from './pages/Metas';
import Analitica from './pages/Analitica';
import MisDatos from './pages/MisDatos';

function App() {

  return (

    <BrowserRouter>

      <Routes>

        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Clase 21 - Analitica: panel propio, solo desarrollo, sin login */}
        <Route path="/analitica" element={<Analitica />} />

        <Route element={<ProtectedRoute />}>

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/pagos" element={<Pagos />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/metas" element={<Metas />} />
          <Route path="/mis-datos" element={<MisDatos />} />

        </Route>

      </Routes>

    </BrowserRouter>

  );

}

export default App;