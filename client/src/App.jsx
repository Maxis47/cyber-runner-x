import Navbar from './components/Navbar';
import Game from './components/Game';
import Dashboard from './components/Dashboard';
import Watermark from './components/Watermark';
import RequireMGID from './components/RequireMGID';

export default function App(){
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar />
      {/* Gate wajib MGID di bawah ini.
          Hanya render Game/Dashboard kalau identity valid */}
      <RequireMGID>
        {(identity)=> (
          <main className="container mx-auto px-3 xs:px-4 py-5 space-y-6">
            <section className="grid lg:grid-cols-2 gap-6 items-start">
              <div>
                <h2 className="text-xl font-semibold mb-3">Play</h2>
                <Game identity={identity} />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-3">Dashboard</h2>
                <Dashboard identity={identity} />
              </div>
            </section>
          </main>
        )}
      </RequireMGID>
      <Watermark />
    </div>
  );
}
