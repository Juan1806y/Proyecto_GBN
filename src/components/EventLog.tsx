/** Bitácora de eventos del protocolo, en orden cronológico inverso. */

import { AnimatePresence, motion } from 'framer-motion'
import type { LogSource, SimState } from '../simulation/types'
import { Panel } from './ui'
import { cx } from '../lib/cx'

const SOURCE_STYLE: Record<LogSource, { label: string; dot: string; text: string }> = {
  sender: { label: 'EMISOR', dot: 'bg-indigo-400', text: 'text-indigo-300' },
  receiver: { label: 'RECEPTOR', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  channel: { label: 'CANAL', dot: 'bg-rose-400', text: 'text-rose-300' },
  timer: { label: 'TIMER', dot: 'bg-amber-400', text: 'text-amber-300' },
  system: { label: 'SISTEMA', dot: 'bg-slate-400', text: 'text-slate-400' },
}

export function EventLog({ state }: { state: SimState }) {
  return (
    <Panel
      title="Bitácora de eventos"
      subtitle="Cada transición de la máquina de estados"
      bodyClassName="p-0"
    >
      <ul className="max-h-[300px] divide-y divide-white/[0.06] overflow-y-auto">
        <AnimatePresence initial={false}>
          {state.log.map((entry) => {
            const style = SOURCE_STYLE[entry.source]
            return (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex gap-2.5 px-3 py-2"
              >
                <span className="mt-1 flex flex-col items-center gap-1">
                  <span className={cx('h-2 w-2 shrink-0 rounded-full', style.dot)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-slate-500">
                      {(entry.time / 1000).toFixed(2)}s
                    </span>
                    <span className={cx('text-[10px] font-semibold tracking-wider', style.text)}>
                      {style.label}
                    </span>
                  </div>
                  <p className="text-[13px] leading-snug text-slate-200">{entry.title}</p>
                  {entry.detail && (
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{entry.detail}</p>
                  )}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </Panel>
  )
}
