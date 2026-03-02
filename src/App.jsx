import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ToolPage from './pages/ToolPage';
import tools from './tools/registry';
import './App.css';

export default function App() {
  const firstTool = tools[0];

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={`/tool/${firstTool.id}`} replace />} />
        <Route path="tool/:toolId" element={<ToolPage />} />
      </Route>
    </Routes>
  );
}
