import { useParams } from 'react-router-dom';
import { getToolById } from '../tools/registry';
import ToolWorkbench from '../components/ToolWorkbench';

export default function ToolPage() {
  const { toolId } = useParams();
  const tool = getToolById(toolId);

  if (!tool) {
    return <div className="error-message">Tool not found.</div>;
  }

  // Custom component tools render their own UI
  if (tool.component) {
    const CustomComponent = tool.component;
    return <CustomComponent key={tool.id} tool={tool} />;
  }

  // Standard tools use the shared ToolWorkbench
  return <ToolWorkbench key={tool.id} tool={tool} />;
}
