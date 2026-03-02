import './Toast.css';

export default function Toast({ message, isError, visible }) {
  return (
    <div className={`toast ${visible ? 'toast--visible' : ''} ${isError ? 'toast--error' : ''}`}>
      {message}
    </div>
  );
}
