import { useToast } from '../context/ToastContext';

export default function CopyButton({ text }) {
  const showToast = useToast();

  const handleCopy = () => {
    if (!text) {
      showToast('Nothing to copy.');
      return;
    }
    navigator.clipboard.writeText(text).then(() => showToast('Copied!'));
  };

  return (
    <button className="btn btn--copy" onClick={handleCopy}>
      Copy Output
    </button>
  );
}
