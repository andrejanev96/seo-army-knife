import { useParams } from 'react-router-dom';
import { getToolById } from '../tools/registry';
import ToolWorkbench from '../components/ToolWorkbench';

export default function ToolPage() {
  const { toolId } = useParams();
  const tool = getToolById(toolId);

  if (!tool) {
    return <div className="error-message">Tool not found.</div>;
  }

  return <ToolWorkbench key={tool.id} tool={tool} />;
}
