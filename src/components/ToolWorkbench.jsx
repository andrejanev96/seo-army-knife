import { useState, useCallback } from 'react';
import CopyButton from './CopyButton';
import ClearButton from './ClearButton';
import './ToolWorkbench.css';

export default function ToolWorkbench({ tool }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [flash, setFlash] = useState(false);

  const handleInputChange = useCallback(
    (e) => {
      const raw = e.target.value;
      setInput(raw);

      const trimmed = raw.trim();
      if (!trimmed) {
        setOutput('');
        return;
      }

      try {
        const result = tool.transform(trimmed);
        setOutput(result);
        setFlash(false);
        requestAnimationFrame(() => setFlash(true));
      } catch {
        setOutput('');
      }
    },
    [tool]
  );

  const handleClear = useCallback(() => {
    setInput('');
    setOutput('');
  }, []);

  return (
    <div className="workbench">
      <div className="workbench__panels">
        <div className="workbench__panel">
          <label className="workbench__label">{tool.inputLabel}</label>
          <textarea
            className="workbench__textarea"
            spellCheck={false}
            placeholder={tool.inputPlaceholder}
            value={input}
            onChange={handleInputChange}
          />
        </div>
        <div className="workbench__panel">
          <label className="workbench__label">{tool.outputLabel}</label>
          <textarea
            className={`workbench__textarea workbench__textarea--output ${flash ? 'flash' : ''}`}
            readOnly
            spellCheck={false}
            placeholder={tool.outputPlaceholder}
            value={output}
            onAnimationEnd={() => setFlash(false)}
          />
        </div>
      </div>
      <div className="workbench__actions">
        <CopyButton text={output} />
        <ClearButton onClear={handleClear} />
      </div>
    </div>
  );
}
