export default function Watermark(){
  return (
    <a
      href="https://x.com/MaxisCrypto"
      target="_blank" rel="noreferrer"
      className="fixed right-2 bottom-2 xs:right-4 xs:bottom-4 z-50 text-xs xs:text-sm px-3 py-1 rounded-full border border-zinc-700 bg-zinc-900/70 backdrop-blur hover:bg-zinc-800/80"
      aria-label="Visit @MaxisCrypto on X"
    >
      X: @MaxisCrypto
    </a>
  );
}