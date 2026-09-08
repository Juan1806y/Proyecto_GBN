/**
 * Canal de comunicación: las tramas de datos viajan de izquierda a derecha y
 * los ACK de derecha a izquierda.
 *
 * La posición horizontal NO la interpola Framer Motion: se calcula a partir
 * del reloj de simulación (`frameProgress`), de modo que el tiempo que una
 * trama tarda en cruzar la pantalla es exactamente el retardo de propagación
 * configurado. Framer Motion se encarga solo de la entrada, la salida y los
 * efectos de pérdida.
 *
 * Con la simulación en pausa el canal se convierte en un tablero manipulable:
 * cada trama se puede seleccionar y actuar sobre ella con la barra de acciones
 * que aparece debajo, y el efecto se ve en el acto.
 */

import { AnimatePresence, motion } from 'framer-motion'
import type { Derived, GoBackNActions } from '../hooks/useGoBackN'
import { frameProgress, predictOutcome } from '../simulation/engine'
import type { Frame, SimState } from '../simulation/types'
import { cx } from '../lib/cx'
import { Panel, Tag } from './ui'

const SPRITE_W = 62
const SPRITE_H = 44
const DATA_LANE = 30
const ACK_LANE = 74

/** Desplazamientos verticales para tramas que se solapan en el mismo carril. */
const STACK_STEPS = [0, 36, -36, 72, -72]

/**
 * Reparte en vertical las tramas que ocupan casi el mismo punto del canal
 * (algo habitual al enviar varias con la simulación en pausa, o tras una
 * ráfaga de retransmisiones) para que no queden una encima de otra.
 */
function stackOffsets(frames: Frame[], time: number): Map<number, number> {
  const offsets = new Map<number, number>()
  for (const kind of ['DATA', 'ACK'] as const) {
    const lane = frames
      .filter((f) => f.kind === kind)
      .map((f) => ({ id: f.id, progress: frameProgress(f, time) }))
      .sort((a, b) => a.progress - b.progress)

    let stack = 0
    let anchor = Number.NEGATIVE_INFINITY
    for (const item of lane) {
      if (item.progress - anchor > 0.055) {
        stack = 0
        anchor = item.progress
      } else {
        stack += 1
      }
      offsets.set(item.id, STACK_STEPS[Math.min(stack, STACK_STEPS.length - 1)])
    }
  }
  return offsets
}

function FrameSprite({
  frame,
  time,
  offsetY,
  selected,
  onSelect,
}: {
  frame: Frame
  time: number
  offsetY: number
  selected: boolean
  onSelect: () => void
}) {
  const progress = frameProgress(frame, time)
  const isData = frame.kind === 'DATA'
  const lost = frame.status === 'LOST'
  const left = isData ? progress : 1 - progress

  const palette = lost
    ? 'border-rose-400 bg-rose-500/25 text-rose-100'
    : frame.isRetransmission
      ? 'border-amber-300 bg-amber-400/20 text-amber-100'
      : isData
        ? 'border-sky-400 bg-sky-500/20 text-sky-100'
        : 'border-emerald-400 bg-emerald-500/20 text-emerald-100'

  return (
    <motion.div
      className="absolute z-10"
      style={{
        left: `${left * 100}%`,
        top: `${isData ? DATA_LANE : ACK_LANE}%`,
        marginLeft: -SPRITE_W / 2,
        marginTop: -SPRITE_H / 2 + offsetY,
        width: SPRITE_W,
        height: SPRITE_H,
      }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={
        lost
          ? { opacity: [1, 1, 0.35], scale: [1, 1.28, 0.8], rotate: [0, -7, 9] }
          : { opacity: 1, scale: 1, rotate: 0 }
      }
      exit={{ opacity: 0, scale: 0.45 }}
      transition={
        lost
          ? { duration: 0.55, times: [0, 0.35, 1] }
          : { type: 'spring', stiffness: 380, damping: 26 }
      }
    >
      <button
        type="button"
        onClick={onSelect}
        title={`${frame.kind} ${frame.seq} · ${Math.round(progress * 100)} % del trayecto`}
        className={cx(
          'flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 shadow-lg shadow-black/40 transition-shadow',
          palette,
          selected
            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950'
            : 'hover:ring-2 hover:ring-white/50 hover:ring-offset-2 hover:ring-offset-slate-950',
        )}
      >
        <span className="text-[9px] leading-none font-bold tracking-wider opacity-80">
          {isData ? 'DATA' : 'ACK'}
        </span>
        <span className="font-mono text-lg leading-none font-bold">{frame.seq}</span>
      </button>

      {lost && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-black text-rose-300">
          ✕
        </span>
      )}
      {!lost && (frame.isRetransmission || frame.delayed) && (
        <span className="pointer-events-none absolute -top-2 -right-2 rounded-full border border-amber-300/70 bg-slate-900 px-1 text-[10px] leading-tight text-amber-200">
          {frame.isRetransmission ? '↻' : '🐢'}
        </span>
      )}

    </motion.div>
  )
}

/** Ancho fijo de la barra de acciones, necesario para acotarla con clamp(). */
const TOOLBAR_W = 148

/**
 * Barra de acciones de la trama seleccionada. Se ancla a la zona de vuelo (y no
 * al sprite) para poder limitarla con `clamp()` al ancho visible del canal:
 * así no la recorta el borde cuando la trama está en un extremo.
 */
function FrameToolbar({
  frame,
  time,
  offsetY,
  paused,
  onLose,
  onDelay,
}: {
  frame: Frame
  time: number
  offsetY: number
  paused: boolean
  onLose: () => void
  onDelay: () => void
}) {
  const progress = frameProgress(frame, time)
  const isData = frame.kind === 'DATA'
  const left = isData ? progress : 1 - progress

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute z-20 flex justify-center gap-1 rounded-lg border border-white/15 bg-slate-950/95 p-1 shadow-xl shadow-black/50"
      style={{
        width: TOOLBAR_W,
        left: `clamp(0px, calc(${left * 100}% - ${TOOLBAR_W / 2}px), calc(100% - ${TOOLBAR_W}px))`,
        top: `calc(${isData ? DATA_LANE : ACK_LANE}% + ${SPRITE_H / 2 + 8 + offsetY}px)`,
      }}
    >
      <button
        type="button"
        onClick={onLose}
        title={`Perder ${frame.kind} ${frame.seq}${paused ? ' ahora mismo' : ''}`}
        className="rounded px-1.5 py-0.5 text-[11px] whitespace-nowrap text-rose-300 hover:bg-rose-500/20"
      >
        ✂ perder
      </button>
      <button
        type="button"
        onClick={onDelay}
        title={`Retrasar ${frame.kind} ${frame.seq}`}
        className="rounded px-1.5 py-0.5 text-[11px] whitespace-nowrap text-amber-300 hover:bg-amber-500/20"
      >
        🐢 retrasar
      </button>
    </motion.div>
  )
}

function Endpoint({ side, label, detail }: { side: 'left' | 'right'; label: string; detail: string }) {
  return (
    <div
      className={cx(
        'absolute inset-y-3 flex w-[86px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-slate-900/80 text-center',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      <span className="text-lg">{side === 'left' ? '📤' : '📥'}</span>
      <span className="text-[11px] font-semibold tracking-[0.1em] text-slate-200 uppercase">
        {label}
      </span>
      <span className="px-1 font-mono text-[10px] text-slate-400">{detail}</span>
    </div>
  )
}

/** Ficha de la trama seleccionada: estado exacto y desenlace previsto. */
function FrameInspector({
  state,
  frame,
  actions,
}: {
  state: SimState
  frame: Frame
  actions: GoBackNActions
}) {
  const progress = frameProgress(frame, state.time)
  const remaining = Math.max(0, frame.arrival - state.time)
  const isData = frame.kind === 'DATA'
  const actionable = frame.status === 'IN_FLIGHT' && frame.deathTime === null

  const situation =
    frame.status === 'LOST'
      ? 'destruida en el canal'
      : frame.deathTime !== null
        ? 'condenada: se destruirá en el canal'
        : frame.status === 'ARRIVED'
          ? 'entregada en destino'
          : 'en tránsito'

  return (
    <div className="mt-2 rounded-xl border border-indigo-400/30 bg-indigo-500/[0.07] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone={isData ? 'sky' : 'emerald'}>
            {frame.kind} {frame.seq}
          </Tag>
          <span className="text-[12px] text-slate-300">{situation}</span>
          {frame.isRetransmission && <Tag tone="amber">retransmisión</Tag>}
          {frame.delayed && <Tag tone="amber">retrasada</Tag>}
        </div>
        <button
          type="button"
          onClick={() => actions.select(null)}
          className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-200"
        >
          quitar selección
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>
          <div className="text-[10px] tracking-wide text-slate-500 uppercase">Recorrido</div>
          <div className="font-mono text-[13px] text-slate-100">{Math.round(progress * 100)} %</div>
        </div>
        <div>
          <div className="text-[10px] tracking-wide text-slate-500 uppercase">Le falta</div>
          <div className="font-mono text-[13px] text-slate-100">
            {frame.status === 'IN_FLIGHT' ? `${(remaining / 1000).toFixed(2)} s` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-wide text-slate-500 uppercase">Salió a los</div>
          <div className="font-mono text-[13px] text-slate-100">
            {(Math.max(0, frame.departure) / 1000).toFixed(2)} s
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-wide text-slate-500 uppercase">
            {frame.deathTime === null ? 'Llega a los' : 'Se destruye a los'}
          </div>
          <div
            className={cx(
              'font-mono text-[13px]',
              frame.deathTime === null ? 'text-slate-100' : 'text-rose-300',
            )}
          >
            {((frame.deathTime ?? frame.arrival) / 1000).toFixed(2)} s
          </div>
        </div>
      </div>

      <p className="mt-2 border-t border-white/10 pt-2 text-[11.5px] leading-snug text-slate-300">
        <span className="font-semibold text-indigo-300">Previsión: </span>
        {predictOutcome(state, frame)}
      </p>

      {actionable && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={isData ? actions.losePacket : actions.loseAck}
            className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-[12px] text-rose-200 hover:bg-rose-500/25"
          >
            ✂ Perder esta trama
          </button>
          <button
            type="button"
            onClick={actions.delayFrame}
            className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[12px] text-amber-200 hover:bg-amber-500/25"
          >
            🐢 Retrasarla
          </button>
          {!state.running && (
            <span className="self-center text-[11px] text-slate-500">
              en pausa el efecto se aplica al instante
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function NetworkChannel({
  state,
  derived,
  actions,
}: {
  state: SimState
  derived: Derived
  actions: GoBackNActions
}) {
  const inFlight = state.frames.filter((f) => f.status === 'IN_FLIGHT')
  const traps = state.traps
  const offsets = stackOffsets(state.frames, state.time)
  const selected = derived.selectedFrame

  return (
    <Panel
      title="2 · Canal de comunicación"
      subtitle={`Retardo de propagación de ida: ${(state.config.propagationDelay / 1000).toFixed(2)} s · RTT ≈ ${((state.config.propagationDelay * 2) / 1000).toFixed(2)} s`}
      aside={
        <div className="flex flex-wrap items-center gap-1.5">
          {traps.dataLoss && <Tag tone="rose">✂ próxima trama DATA se perderá</Tag>}
          {traps.ackLoss && <Tag tone="rose">✂ próximo ACK se perderá</Tag>}
          {traps.delay && <Tag tone="amber">🐢 próxima trama DATA se retrasará</Tag>}
          <Tag tone="sky">{inFlight.length} en tránsito</Tag>
        </div>
      }
      bodyClassName="p-3"
    >
      <div
        className={cx(
          'relative h-[280px] overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.07),transparent_70%)] transition-colors',
          state.running ? 'border-white/10' : 'border-amber-400/30',
        )}
      >
        <Endpoint
          side="left"
          label="Emisor"
          detail={`base ${state.sender.base} · next ${state.sender.nextSeq}`}
        />
        <Endpoint side="right" label="Receptor" detail={`espera ${state.receiver.expected}`} />

        {!state.running && (
          <div className="pointer-events-none absolute top-2 left-1/2 z-30 -translate-x-1/2 rounded-full border border-amber-400/40 bg-slate-950/90 px-3 py-1 text-[10px] font-semibold tracking-wide text-amber-200 uppercase">
            ⏸ Pausa · las tramas se pueden seleccionar y modificar aquí mismo
          </div>
        )}

        {/* Zona de vuelo: sistema de coordenadas de las tramas. */}
        <div className="absolute inset-y-0 right-[96px] left-[96px]">
          {/* Carril de datos (→) */}
          <div
            className="absolute right-0 left-0 h-px bg-gradient-to-r from-sky-500/10 via-sky-400/40 to-sky-400/70"
            style={{ top: `${DATA_LANE}%` }}
          />
          <div
            className="absolute right-0 -translate-y-1/2 text-sky-400/70"
            style={{ top: `${DATA_LANE}%` }}
          >
            ▶
          </div>
          <span className="absolute top-2 left-0 text-[10px] font-semibold tracking-[0.16em] text-sky-400/70 uppercase">
            Tramas de datos →
          </span>

          {/* Carril de confirmaciones (←) */}
          <div
            className="absolute right-0 left-0 h-px bg-gradient-to-l from-emerald-500/10 via-emerald-400/40 to-emerald-400/70"
            style={{ top: `${ACK_LANE}%` }}
          />
          <div
            className="absolute left-0 -translate-y-1/2 text-emerald-400/70"
            style={{ top: `${ACK_LANE}%` }}
          >
            ◀
          </div>
          <span className="absolute right-0 bottom-2 text-[10px] font-semibold tracking-[0.16em] text-emerald-400/70 uppercase">
            ← Confirmaciones (ACK acumulativo)
          </span>

          <AnimatePresence>
            {state.frames.map((frame) => (
              <FrameSprite
                key={frame.id}
                frame={frame}
                time={state.time}
                offsetY={offsets.get(frame.id) ?? 0}
                selected={state.selectedFrameId === frame.id}
                onSelect={() => actions.select(frame.id)}
              />
            ))}
          </AnimatePresence>

          {/* Acciones directas sobre la trama seleccionada: en pausa es la
              forma cómoda de provocar un fallo justo donde se está mirando. */}
          {selected && selected.status === 'IN_FLIGHT' && selected.deathTime === null && (
            <FrameToolbar
              frame={selected}
              time={state.time}
              offsetY={offsets.get(selected.id) ?? 0}
              paused={!state.running}
              onLose={selected.kind === 'DATA' ? actions.losePacket : actions.loseAck}
              onDelay={actions.delayFrame}
            />
          )}

          {state.frames.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-slate-600">
              El canal está vacío.
              <br />
              Pulsa «Enviar nuevo paquete» para transmitir la trama {state.sender.nextSeq}.
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <FrameInspector state={state} frame={selected} actions={actions} />
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">
          Haz clic en cualquier trama del canal para inspeccionarla y actuar sobre ella.
          {!state.running && ' Con la simulación en pausa los fallos se aplican en el acto.'}
        </p>
      )}
    </Panel>
  )
}
