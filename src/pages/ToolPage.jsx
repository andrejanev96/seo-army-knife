import { useParams } from 'react-router-dom';
import { getToolById } from '../tools/registry';
import ToolWorkbench from '../components/ToolWorkbench';

export default function ToolPage() {
  const { toolId } = useParams();
  const tool = getToolById(toolId);

  if (!tool) {
    return <div className="error-message">Tool not found.</div>;
  }

  // Re-keying on tool.id forces a remount on route change, which re-runs
  // the fade-up entrance animation. CSS-only; no router-transition lib.
  const inner = tool.component
    ? <tool.component tool={tool} />
    : <ToolWorkbench tool={tool} />;

  return (
    <div className="tool-page" key={tool.id}>
      {inner}
    </div>
  );
}
