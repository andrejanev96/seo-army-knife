import './Toast.css';

export default function Toast({ message, isError, visible }) {
  return (
    <div
      className={`toast ${visible ? 'toast--visible' : ''} ${isError ? 'toast--error' : ''}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {message}
    </div>
  );
}
