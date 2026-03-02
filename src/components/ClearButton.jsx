export default function ClearButton({ onClear }) {
  return (
    <button className="btn btn--clear" onClick={onClear}>
      Clear
    </button>
  );
}
