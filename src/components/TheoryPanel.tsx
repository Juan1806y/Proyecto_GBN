/**
 * Teoría, fórmulas y calculadora de rendimiento.
 *
 * Las expresiones y sus fuentes están documentadas en `simulation/formulas.ts`.
 */

import { useState } from 'react'
import {
  TANENBAUM_EXAMPLE,
  bitErrorRate,
  bitsForWindow,
  formatBits,
  formatMs,
  formatPercent,
  formatScientific,
  goBackNUtilization,
  linkMetrics,
  maxWindowForBits,
  stopAndWaitUtilization,
  windowUtilization,
} from '../simulation/formulas'
import type { LinkParams } from '../simulation/formulas'
import { Panel, Slider } from './ui'
import { cx } from '../lib/cx'

type Tab = 'protocolo' | 'parametros' | 'formulas' | 'calculadora'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'protocolo', label: 'Máquina de estados' },
  { id: 'parametros', label: 'Parámetros' },
  { id: 'formulas', label: 'Fórmulas' },
  { id: 'calculadora', label: 'Calculadora' },
]

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[12.5px] leading-relaxed text-slate-600">
      {children}
    </pre>
  )
}

function Formula({
  title,
  expression,
  description,
  source,
}: {
  title: string
  expression: string
  description: string
  source: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-[13px] font-semibold text-slate-700">{title}</h4>
      <p className="my-2 rounded-lg bg-indigo-50 px-3 py-2 text-center font-mono text-[14px] text-indigo-700">
        {expression}
      </p>
      <p className="text-[12.5px] leading-snug text-slate-600">{description}</p>
      <p className="mt-1.5 text-[11.5px] text-slate-500 italic">{source}</p>
    </div>
  )
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-[13px] text-slate-600">
        {label}
        {hint && <span className="ml-1 text-[11px] text-slate-500">{hint}</span>}
      </span>
      <span className="font-mono text-[13.5px] font-semibold text-slate-800">{value}</span>
    </div>
  )
}

interface ParamDoc {
  symbol: string
  name: string
  where: string
  unit: string
  meaning: string
  relation?: string
}

/** Tabla de definiciones reutilizada por los glosarios de parámetros. */
function ParamTable({ title, note, rows }: { title: string; note?: string; rows: ParamDoc[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <h4 className="text-[13px] font-semibold text-slate-700">{title}</h4>
        {note && <p className="mt-0.5 text-[12px] text-slate-500">{note}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="text-[11px] tracking-wide text-slate-500 uppercase">
              <th className="px-3 py-2 font-medium">Símbolo</th>
              <th className="px-3 py-2 font-medium">Parámetro</th>
              <th className="px-3 py-2 font-medium">Dónde</th>
              <th className="px-3 py-2 font-medium">Unidad</th>
              <th className="px-3 py-2 font-medium">Qué representa</th>
              <th className="px-3 py-2 font-medium">Relación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol + row.name} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 font-mono text-[13px] font-semibold whitespace-nowrap text-indigo-700">
                  {row.symbol}
                </td>
                <td className="px-3 py-2 text-[12.5px] font-medium text-slate-700">{row.name}</td>
                <td className="px-3 py-2 text-[12px] whitespace-nowrap text-slate-500">
                  {row.where}
                </td>
                <td className="px-3 py-2 text-[12px] text-slate-500">{row.unit}</td>
                <td className="max-w-[340px] px-3 py-2 text-[12.5px] leading-snug text-slate-600">
                  {row.meaning}
                </td>
                <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap text-slate-500">
                  {row.relation ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const CALCULATOR_PARAMS: ParamDoc[] = [
  {
    symbol: 'B',
    name: 'Velocidad de transmisión del enlace',
    where: 'entrada',
    unit: 'bits/s (bps)',
    meaning:
      'Ritmo al que el emisor inyecta bits en el medio, es decir la capacidad del enlace. No es la velocidad a la que viaja la señal: un enlace de 50 kbps tarda siempre 20 ms en poner en el cable una trama de 1000 bits, recorra esta un metro o 36 000 km.',
    relation: 't_f = L / B',
  },
  {
    symbol: 'L',
    name: 'Longitud de la trama',
    where: 'entrada',
    unit: 'bits',
    meaning:
      'Bits que ocupa una trama completa, cabeceras y cola incluidas. Tramas largas aprovechan mejor el enlace, pero exponen más bits a los errores.',
    relation: 'P ≈ L · BER',
  },
  {
    symbol: 't_p',
    name: 'Retardo de propagación de ida',
    where: 'entrada',
    unit: 'milisegundos',
    meaning:
      'Tiempo que tarda un bit en recorrer el medio desde el emisor hasta el receptor. Depende de la distancia y del medio físico, nunca del ancho de banda.',
    relation: 't_p = d / v',
  },
  {
    symbol: 'N',
    name: 'Apertura de la ventana',
    where: 'entrada',
    unit: 'tramas',
    meaning:
      'Número de tramas que el emisor puede tener enviadas y sin confirmar a la vez. Con N = 1 el protocolo se reduce a parada y espera.',
    relation: 'N ≤ 2^m − 1',
  },
  {
    symbol: 'P',
    name: 'Probabilidad de error por trama',
    where: 'entrada',
    unit: 'adimensional (0 a 1)',
    meaning:
      'Fracción de las tramas transmitidas que se pierde o llega dañada. Es POR TRAMA: no es una tasa por unidad de tiempo ni por bit. P = 0,10 significa que unas 10 de cada 100 tramas fallan, sea cual sea la velocidad del enlace o la duración de la transmisión.',
    relation: 'P = 1 − (1 − BER)^L',
  },
  {
    symbol: 't_f',
    name: 'Tiempo de transmisión de la trama',
    where: 'resultado',
    unit: 'milisegundos',
    meaning:
      'Lo que tarda el emisor en poner la trama completa en el medio. Es distinto del retardo de propagación t_p, que es lo que tarda en llegar al otro extremo.',
    relation: 't_f = L / B',
  },
  {
    symbol: 'a',
    name: 'Parámetro de retardo normalizado',
    where: 'resultado',
    unit: 'adimensional',
    meaning:
      'Cuántos tiempos de trama cabe el retardo de propagación. Con a « 1 el enlace es corto y rápido de llenar; con a » 1 (satélite) la tubería es larga y hace falta una ventana grande.',
    relation: 'a = t_p / t_f',
  },
  {
    symbol: 'BER',
    name: 'Tasa de error de bit',
    where: 'resultado',
    unit: 'errores por bit',
    meaning:
      'Probabilidad de que un bit concreto llegue alterado. Se deduce de P y de L, y permite comprobar si la P elegida es realista para el medio (fibra ≈ 10⁻¹², radio ≈ 10⁻⁵).',
    relation: 'BER = 1 − (1 − P)^(1/L)',
  },
  {
    symbol: 'BD',
    name: 'Producto ancho de banda × retardo',
    where: 'resultado',
    unit: 'bits',
    meaning:
      'Bits que caben simultáneamente «dentro» del cable en un viaje de ida y vuelta. Es la capacidad de almacenamiento del propio enlace y fija la apertura mínima útil de la ventana.',
    relation: 'BD = B × RTT',
  },
  {
    symbol: 'U',
    name: 'Utilización del enlace',
    where: 'resultado',
    unit: 'porcentaje',
    meaning:
      'Fracción del tiempo que el enlace transporta datos útiles. Es el resultado que resume todo lo demás: cuanto más se acerca al 100 %, menos tiempo pasa el emisor esperando.',
    relation: 'U = N(1−P)/[(1+2a)(1−P+N·P)]',
  },
]

const SIMULATOR_PARAMS: ParamDoc[] = [
  {
    symbol: 'N',
    name: 'Apertura de la ventana',
    where: 'panel de control',
    unit: 'tramas (1 a 8)',
    meaning:
      'Número máximo de tramas que el emisor puede tener enviadas y sin confirmar. Es la anchura del recuadro punteado del panel del emisor: cuando se llena, el botón de envío se deshabilita.',
    relation: 'N ≤ 2^m − 1',
  },
  {
    symbol: 'T_out',
    name: 'Temporizador de retransmisión',
    where: 'panel de control',
    unit: 'segundos (1 a 12)',
    meaning:
      'Tiempo que el emisor espera el ACK de la trama base antes de darla por perdida y retransmitir TODAS las tramas no confirmadas. Si se fija por debajo del RTT se producen timeouts prematuros.',
    relation: 'T_out > RTT',
  },
  {
    symbol: 't_p',
    name: 'Retardo de propagación',
    where: 'panel de control',
    unit: 'segundos (0,4 a 3,5)',
    meaning:
      'Tiempo que tarda una trama en cruzar el canal de un extremo al otro. Es exactamente lo que la animación tarda en llevar la trama de un lado a otro de la pantalla.',
    relation: 't_p = d / v',
  },
  {
    symbol: '×',
    name: 'Velocidad de reproducción',
    where: 'panel de control',
    unit: 'factor (0,25 a 3)',
    meaning:
      'Ritmo al que se reproduce la animación. Es un control de vídeo: no modifica N, T_out ni t_p, ni altera en nada el comportamiento del protocolo.',
  },
  {
    symbol: 'base',
    name: 'Base de la ventana',
    where: 'panel del emisor',
    unit: 'nº de secuencia',
    meaning:
      'Primera trama enviada y todavía sin confirmar. Es la única que lleva temporizador y la que marca el extremo izquierdo de la ventana.',
  },
  {
    symbol: 'nextSeqNum',
    name: 'Siguiente número de secuencia',
    where: 'panel del emisor',
    unit: 'nº de secuencia',
    meaning:
      'Número que se asignará a la próxima trama nueva. Solo puede enviarse mientras quede por debajo de base + N.',
    relation: 'nextSeqNum < base + N',
  },
  {
    symbol: 'expectedSeqNum',
    name: 'Número esperado por el receptor',
    where: 'panel del receptor',
    unit: 'nº de secuencia',
    meaning:
      'Única trama que el receptor aceptará. Cualquier otra se descarta y provoca el reenvío del último ACK válido. Su ventana tiene apertura 1.',
  },
  {
    symbol: 'RTT',
    name: 'Tiempo de ida y vuelta',
    where: 'derivado',
    unit: 'segundos',
    meaning:
      'Tiempo mínimo que transcurre entre enviar una trama y poder recibir su confirmación. Marca el suelo del temporizador de retransmisión.',
    relation: 'RTT = 2·t_p',
  },
  {
    symbol: 'η',
    name: 'Eficiencia observada',
    where: 'cabecera',
    unit: 'porcentaje',
    meaning:
      'Tramas entregadas a la capa de red dividido entre el total de transmisiones realizadas, retransmisiones incluidas. Cae en cuanto aparecen pérdidas, porque el retroceso N reenvía la ventana entera.',
    relation: 'η = entregadas / transmisiones',
  },
]

function Calculator() {
  const [params, setParams] = useState<LinkParams>(TANENBAUM_EXAMPLE)
  const [windowSize, setWindowSize] = useState(7)
  const [errorRate, setErrorRate] = useState(0)

  const metrics = linkMetrics(params)
  const idealWindowUse = windowUtilization(windowSize, metrics.a)
  const gbn = goBackNUtilization(windowSize, metrics.a, errorRate)
  const saw = stopAndWaitUtilization(metrics.a, errorRate)
  const bits = bitsForWindow(windowSize)

  const isTanenbaumExample =
    params.bitrate === TANENBAUM_EXAMPLE.bitrate &&
    params.frameBits === TANENBAUM_EXAMPLE.frameBits &&
    params.oneWayDelayMs === TANENBAUM_EXAMPLE.oneWayDelayMs

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Slider
          label="Velocidad de transmisión del enlace (B)"
          value={params.bitrate}
          min={10_000}
          max={10_000_000}
          step={10_000}
          onChange={(bitrate) => setParams((p) => ({ ...p, bitrate }))}
          format={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)} Mbps` : `${v / 1000} kbps`)}
          hint={
            <>
              Bits por segundo que la interfaz puede inyectar en el medio: la{' '}
              <strong>capacidad</strong> del enlace. No es la velocidad a la que viaja la señal;
              determina cuánto tarda en salir una trama, <span className="font-mono">t_f = L / B</span>.
            </>
          }
        />
        <Slider
          label="Longitud de la trama (L)"
          value={params.frameBits}
          min={200}
          max={12_000}
          step={100}
          onChange={(frameBits) => setParams((p) => ({ ...p, frameBits }))}
          format={(v) => `${v} bits (${(v / 8).toFixed(0)} B)`}
          hint="Bits que ocupa una trama completa, cabeceras incluidas. Tramas largas aprovechan mejor el enlace, pero son más vulnerables a los errores."
        />
        <Slider
          label="Retardo de propagación de ida (t_p)"
          value={params.oneWayDelayMs}
          min={1}
          max={400}
          onChange={(oneWayDelayMs) => setParams((p) => ({ ...p, oneWayDelayMs }))}
          format={(v) => `${v} ms`}
          hint={
            <>
              Tiempo que tarda un bit en recorrer el medio:{' '}
              <span className="font-mono">t_p = d / v</span>, con v ≈ 2·10⁸ m/s en cobre y fibra.
              Depende de la distancia, no del ancho de banda.
            </>
          }
        />
        <Slider
          label="Apertura de la ventana (N)"
          value={windowSize}
          min={1}
          max={64}
          onChange={setWindowSize}
          format={(v) => `${v} tramas`}
          hint={`Tramas que el emisor puede tener enviadas sin confirmar. Necesita m = ${bits} bits de secuencia (N ≤ 2^${bits} − 1 = ${maxWindowForBits(bits)}).`}
        />
        <Slider
          label="Probabilidad de error por trama (P)"
          value={errorRate}
          min={0}
          max={0.5}
          step={0.01}
          onChange={setErrorRate}
          format={(v) => `${(v * 100).toFixed(0)} % de las tramas`}
          hint={
            <>
              Es una probabilidad <strong>por trama</strong>, no por unidad de tiempo ni por bit:
              P = 10 % significa que unas 10 de cada 100 tramas transmitidas se pierden o llegan
              dañadas, sea cual sea la velocidad del enlace.
            </>
          }
        />
        <button
          type="button"
          onClick={() => {
            setParams(TANENBAUM_EXAMPLE)
            setWindowSize(7)
            setErrorRate(0)
          }}
          className={cx(
            'w-full rounded-xl border px-3 py-2 text-[13px] transition-colors',
            isTanenbaumExample
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          Cargar el ejemplo del satélite de Tanenbaum (50 kbps, RTT 500 ms)
        </button>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Row label="t_f · tiempo de trama" value={formatMs(metrics.frameTimeMs)} hint="= L / B" />
          <Row label="2·t_p · ida y vuelta" value={formatMs(2 * params.oneWayDelayMs)} />
          <Row label="t_f + 2·t_p · ciclo" value={formatMs(metrics.cycleMs)} />
          <Row label="a = t_p / t_f" value={metrics.a.toFixed(2)} />
          <Row
            label="Producto ancho de banda × retardo"
            value={formatBits(metrics.bandwidthDelayBits)}
            hint="bits en vuelo"
          />
          <Row
            label="BER equivalente"
            value={errorRate === 0 ? '0' : formatScientific(bitErrorRate(errorRate, params.frameBits))}
            hint="errores por bit"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Row
            label="Eficiencia con parada y espera"
            value={formatPercent(metrics.stopAndWait)}
            hint="N = 1, sin errores"
          />
          <Row
            label="Ventana para llenar la tubería"
            value={`${metrics.optimalWindow} tramas`}
            hint="w ≥ 1 + 2a"
          />
          <Row
            label={`Utilización con N = ${windowSize} (sin errores)`}
            value={formatPercent(idealWindowUse)}
          />
          <Row
            label={`Utilización Go-Back-N (P = ${(errorRate * 100).toFixed(0)} %)`}
            value={formatPercent(gbn)}
          />
          <Row
            label={`Utilización parada y espera (P = ${(errorRate * 100).toFixed(0)} %)`}
            value={formatPercent(saw)}
          />
        </div>

        <p className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-[12.5px] leading-snug text-slate-600">
          {windowSize >= metrics.optimalWindow ? (
            <>
              Con N = {windowSize} ≥ {metrics.optimalWindow} la ventana <strong>llena la tubería</strong>:
              el emisor nunca queda ocioso esperando confirmaciones y la pérdida de eficiencia se debe
              solo a los errores.
            </>
          ) : (
            <>
              Con N = {windowSize} &lt; {metrics.optimalWindow} el emisor <strong>se queda bloqueado</strong>{' '}
              esperando el primer ACK: usa apenas el {formatPercent(idealWindowUse, 0)} del enlace.
              Súbela a {metrics.optimalWindow} para saturarlo.
            </>
          )}
        </p>
      </div>

      <div className="lg:col-span-2">
        <ParamTable
          title="Descripción de los parámetros de la calculadora"
          note="Todas las entradas describen el enlace físico y el protocolo; los resultados se derivan de ellas con las fórmulas de la pestaña anterior."
          rows={CALCULATOR_PARAMS}
        />
      </div>
    </div>
  )
}

export function TheoryPanel() {
  const [tab, setTab] = useState<Tab>('protocolo')

  return (
    <Panel
      title="Teoría y fórmulas"
      subtitle="Fundamentos del protocolo y cálculo de rendimiento"
      aside={
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cx(
                'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                tab === item.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'protocolo' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-indigo-700 uppercase">
              Emisor · ventana de apertura N
            </h3>
            <Code>{`enviar(datos):
    si nextSeq < base + N:
        transmitir(trama[nextSeq])
        si base == nextSeq:
            arrancar_temporizador()
        nextSeq = nextSeq + 1
    si no:
        rechazar        // ventana llena

al recibir ACK n:      // ACK ACUMULATIVO
    base = n + 1
    si base == nextSeq:
        detener_temporizador()
    si no:
        arrancar_temporizador()

al expirar el temporizador:
    arrancar_temporizador()
    para i = base hasta nextSeq - 1:
        retransmitir(trama[i])     // «retroceso N»`}</Code>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-emerald-700 uppercase">
              Receptor · ventana de apertura 1
            </h3>
            <Code>{`al recibir trama con nº de secuencia seq:
    si seq == expectedSeqNum:
        entregar_a_capa_de_red(trama)
        enviar(ACK expectedSeqNum)
        expectedSeqNum = expectedSeqNum + 1
    si no:
        descartar(trama)                  // fuera de orden
        enviar(ACK expectedSeqNum - 1)    // último ACK válido`}</Code>
            <ul className="mt-3 space-y-2 text-[13px] leading-snug text-slate-600">
              <li>
                <strong className="text-slate-800">Sin búfer de reordenación.</strong> El receptor no
                guarda tramas fuera de orden; por eso una sola pérdida obliga a retransmitir toda la
                ventana. Ese es el precio de su simplicidad frente a la repetición selectiva.
              </li>
              <li>
                <strong className="text-slate-800">ACK acumulativo.</strong> ACK n confirma todas las
                tramas hasta la n. Si se pierde ACK 1 pero llega ACK 2, la ventana se desliza igual y
                la pérdida pasa inadvertida.
              </li>
              <li>
                <strong className="text-slate-800">Un solo temporizador.</strong> Corresponde a la
                trama <em>base</em>: es la más antigua sin confirmar.
              </li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'parametros' && (
        <ParamTable
          title="Descripción de los parámetros del simulador"
          note="Los cuatro primeros se ajustan con los sliders del panel de control; el resto son los indicadores que el simulador muestra en pantalla."
          rows={SIMULATOR_PARAMS}
        />
      )}

      {tab === 'formulas' && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Formula
            title="Tiempo de transmisión de una trama"
            expression="t_f = L / B"
            description="L es la longitud de la trama en bits y B la velocidad del enlace en bits/s. Es el tiempo que tarda el emisor en poner la trama en el cable, distinto del tiempo de propagación t_p."
            source="Tanenbaum & Wetherall, Redes de Computadoras, 5.ª ed., §3.4"
          />
          <Formula
            title="Eficiencia con parada y espera"
            expression="U = t_f / (t_f + 2·t_p) = 1 / (1 + 2a)"
            description="Con una sola trama en vuelo el emisor queda ocioso durante todo el viaje de ida y vuelta. En el canal satelital del libro (50 kbps, 1000 bits, RTT 500 ms) da 20/520 ≈ 3,8 %."
            source="Tanenbaum & Wetherall §3.4 · parámetro a = t_p / t_f de Stallings"
          />
          <Formula
            title="Ventana que llena la tubería"
            expression="w ≥ (t_f + 2·t_p) / t_f = 1 + 2a"
            description="Nº de tramas que el emisor debe poder tener sin confirmar para no quedarse nunca parado. En el ejemplo del satélite: 520/20 = 26 tramas."
            source="Tanenbaum & Wetherall §3.4 («pipelining»)"
          />
          <Formula
            title="Producto ancho de banda–retardo"
            expression="BD = B × RTT"
            description="Bits que caben simultáneamente en el canal. Es la capacidad de almacenamiento del propio enlace y fija la apertura mínima útil de la ventana."
            source="Tanenbaum & Wetherall §3.4"
          />
          <Formula
            title="Espacio de números de secuencia"
            expression="N ≤ 2^m − 1"
            description="Con m bits de secuencia la ventana de envío no puede llegar a 2^m: el receptor no podría distinguir una retransmisión de una trama nueva. Con m = 3 bits, N ≤ 7."
            source="Tanenbaum & Wetherall §3.4.2 (protocolo de retroceso N)"
          />
          <Formula
            title="Utilización de Go-Back-N con errores"
            expression="U = N(1−P) / [(1+2a)(1−P+N·P)]"
            description="Válida cuando N < 1 + 2a; si N ≥ 1 + 2a se reduce a U = (1−P)/(1−P+N·P). P es la probabilidad de que una trama se pierda o llegue dañada. Nótese cómo una N grande penaliza más al aumentar P: cada error cuesta N retransmisiones."
            source="Stallings, Comunicaciones y Redes de Computadores, 7.ª ed., §7.4"
          />
        </div>
      )}

      {tab === 'calculadora' && <Calculator />}

      <div className="mt-4 border-t border-slate-200 pt-3 text-[12px] leading-relaxed text-slate-600">
        <strong className="text-slate-600">Bibliografía:</strong> Tanenbaum, A. S. y Wetherall, D. J.
        (2012). <em>Redes de Computadoras</em> (5.ª ed.), Pearson — §3.4 «Protocolos de ventana
        deslizante» y §3.4.2 «Protocolo de ventana deslizante con retroceso N». · Stallings, W.
        (2004). <em>Comunicaciones y Redes de Computadores</em> (7.ª ed.), Pearson — §7.4
        «Rendimiento de ARQ». · Kurose, J. F. y Ross, K. W. <em>Redes de Computadoras: un enfoque
        descendente</em> — §3.4.3 «Retroceso N (GBN)», autómatas del emisor y del receptor.
      </div>
    </Panel>
  )
}
