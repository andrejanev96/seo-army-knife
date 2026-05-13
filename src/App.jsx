import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ToolPage from './pages/ToolPage';
import tools from './tools/registry';
import './App.css';

function EmptyState() {
  return (
    <div className="empty-state">
      <h2>No tools registered</h2>
      <p>Add a tool to <code>src/tools/registry.js</code> to get started.</p>
    </div>
  );
}

export default function App() {
  const firstTool = tools[0];

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={firstTool ? <Navigate to={`/tool/${firstTool.id}`} replace /> : <EmptyState />}
        />
        <Route path="tool/:toolId" element={<ToolPage />} />
      </Route>
    </Routes>
  );
}
