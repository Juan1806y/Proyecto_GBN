/**
 * Simulador visual del protocolo de ventana deslizante Go-Back-N.
 *
 * Composición de la interfaz: la lógica del protocolo vive por completo en
 * `simulation/engine.ts` y llega aquí a través del hook `useGoBackN`.
 */

import { ControlPanel } from './components/ControlPanel'
import { EventLog } from './components/EventLog'
import { NetworkChannel } from './components/NetworkChannel'
import { ReceiverPanel } from './components/ReceiverPanel'
import { SenderPanel } from './components/SenderPanel'
import { SequenceDiagram } from './components/SequenceDiagram'
import { TheoryPanel } from './components/TheoryPanel'
import { Tag } from './components/ui'
import { cx } from './lib/cx'
import { useGoBackN, useKeyboardShortcuts } from './hooks/useGoBackN'
import { formatPercent } from './simulation/formulas'

function HeaderStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-[86px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
      <div className="text-[9.5px] tracking-[0.12em] text-slate-400 uppercase">{label}</div>
      <div className={cx('font-mono text-sm font-semibold', tone)}>{value}</div>
    </div>
  )
}

export default function App() {
  const { state, derived, actions } = useGoBackN()
  useKeyboardShortcuts(actions)

  const losses = state.stats.dataLost + state.stats.acksLost

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-white/10 bg-slate-950/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-50">
              Simulador <span className="text-indigo-400">Go-Back-N</span>
            </h1>
            <p className="mt-0.5 text-[12.5px] text-slate-400">
              Protocolo de ventana deslizante con retroceso N · retransmisión por temporizador y ACK
              acumulativos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <HeaderStat
              label="Reloj"
              value={`${(state.time / 1000).toFixed(1)} s`}
              tone="text-slate-200"
            />
            <HeaderStat
              label="Entregadas"
              value={`${state.receiver.delivered.length}/${state.config.totalPackets}`}
              tone="text-emerald-300"
            />
            <HeaderStat
              label="Eficiencia"
              value={derived.totalTransmissions === 0 ? '—' : formatPercent(derived.efficiency, 0)}
              tone="text-sky-300"
            />
            <HeaderStat
              label="Timeouts"
              value={String(state.stats.timeouts)}
              tone={state.stats.timeouts > 0 ? 'text-amber-300' : 'text-slate-400'}
            />
            <HeaderStat
              label="Pérdidas"
              value={String(losses)}
              tone={losses > 0 ? 'text-rose-300' : 'text-slate-400'}
            />
            {!state.running && <Tag tone="amber">⏸ en pausa</Tag>}
            {derived.complete && <Tag tone="emerald">✓ transferencia completa</Tag>}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1680px] gap-4 px-4 pt-4 xl:grid-cols-[336px_minmax(0,1fr)]">
        <ControlPanel state={state} derived={derived} actions={actions} />

        <div className="min-w-0 space-y-4">
          <SenderPanel state={state} derived={derived} />
          <NetworkChannel state={state} derived={derived} actions={actions} />
          <ReceiverPanel state={state} />
          <div className="grid gap-4 2xl:grid-cols-2">
            <SequenceDiagram state={state} />
            <EventLog state={state} />
          </div>
          <TheoryPanel />
        </div>
      </main>
    </div>
  )
}
