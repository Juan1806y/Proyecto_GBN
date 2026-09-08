# Simulador Go-Back-N

Simulador web interactivo del protocolo de ventana deslizante **Go-Back-N** (retroceso N),
pensado para docencia de redes de computadoras: muestra en todo momento el estado del
**emisor**, del **canal** y del **receptor**, con las tramas viajando en tiempo real.

React 19 · TypeScript · Vite · Tailwind CSS 4 · Framer Motion

## Puesta en marcha

```bash
npm install
npm run dev
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo (http://localhost:5173) |
| `npm run build` | comprobación de tipos + compilación de producción |
| `npm run verify` | banco de pruebas de la máquina de estados (sin navegador) |
| `npm run lint` | oxlint |

## Arquitectura

La lógica de red está **completamente separada** de la capa visual: los componentes no
calculan nada del protocolo, solo dibujan el estado que produce el motor.

```
src/
├── simulation/          ← lógica pura, sin React ni DOM
│   ├── types.ts             modelo de datos (tramas, emisor, receptor, estadísticas)
│   ├── engine.ts            máquina de estados y simulador de eventos discretos
│   └── formulas.ts          fórmulas de rendimiento y sus fuentes
├── hooks/
│   └── useGoBackN.ts    ← puente con React: reloj rAF, comandos y valores derivados
├── components/          ← capa visual
│   ├── SenderPanel.tsx      búfer 0..15, ventana deslizante, punteros base/nextSeq
│   ├── NetworkChannel.tsx   carriles de datos (→) y de ACK (←)
│   ├── ReceiverPanel.tsx    expectedSeqNum y ventana de recepción de tamaño 1
│   ├── ControlPanel.tsx     envío, parámetros y fallos provocados
│   ├── SequenceDiagram.tsx  diagrama espacio-tiempo
│   ├── EventLog.tsx         bitácora de transiciones
│   ├── TheoryPanel.tsx      teoría, fórmulas y calculadora de rendimiento
│   └── ui.tsx               primitivas visuales compartidas
└── App.tsx              ← composición
```

### Fidelidad temporal de la animación

El motor es un **simulador de eventos discretos**: en cada fotograma procesa, en orden
cronológico estricto, las salidas, llegadas, pérdidas y expiraciones que caen dentro del
intervalo transcurrido. La posición de una trama en pantalla **no** la interpola Framer
Motion, sino que se deriva del reloj de simulación:

```
progreso = (t_actual − t_salida) / (t_llegada − t_salida)
```

Así, el tiempo que una trama tarda en cruzar la pantalla es exactamente el retardo de
propagación configurado, y el resultado no depende de la tasa de refresco del navegador.
Framer Motion se ocupa solo de lo que es animación pura: entradas y salidas de tramas,
el efecto de destrucción al perderse y el deslizamiento de la ventana.

## Protocolo implementado

**Emisor** (ventana de tamaño N)

- `enviar`: transmite si `nextSeq < base + N`; si no, rechaza (el botón se deshabilita).
- Un **único temporizador**, el de la trama `base` (la más antigua sin confirmar).
- `ACK n`: **acumulativo**, `base = n + 1`. Si se pierde el ACK 1 pero llega el ACK 2, la
  ventana se desliza igualmente. Los ACK obsoletos se ignoran.
- `timeout`: reinicia el temporizador y **retransmite todas** las tramas `base..nextSeq−1`.

**Receptor** (ventana de tamaño 1)

- Acepta únicamente `expectedSeqNum`; la entrega a la capa de red y envía `ACK(seq)`.
- Cualquier otra trama se **descarta** (no hay búfer de reordenación) y se reenvía el
  último ACK válido, `ACK(expectedSeqNum − 1)`.

`npm run verify` comprueba estas reglas sin navegador: transferencia limpia, ACK perdido
recuperado por acumulación, pérdida de datos con descarte fuera de orden y retroceso N,
reenvío del último ACK válido, ACK duplicados, el caso `N = 1` (parada y espera), los
fallos aplicados en pausa y el modo paso a paso.

## Trabajo con la simulación en pausa

Perseguir tramas en movimiento es incómodo, así que la pausa es un modo de trabajo
completo, no una simple congelación:

- **El canal se vuelve manipulable.** Al pulsar una trama se abre su ficha: recorrido
  hecho, tiempo que le falta, instante de salida y de llegada, y la **previsión** de lo que
  ocurrirá cuando llegue (si el receptor la aceptará o la descartará y con qué ACK
  responderá). Sobre la propia trama aparece además un menú con `✂ perder` y `🐢 retrasar`.
- **Los fallos se aplican en el acto.** Con la simulación en pausa, «provocar pérdida»
  destruye la trama en el punto exacto del canal donde se la ve: aparece la ✕, se anota en
  la bitácora con la marca de tiempo actual, cuenta en las estadísticas y se dibuja en el
  diagrama espacio-tiempo. No queda pendiente de reanudar.
- **Paso a paso.** El botón «⏭ Avanzar al próximo evento» (atajo `S` o `→`) adelanta el
  reloj justo hasta el siguiente suceso discreto —una llegada, una pérdida, la expiración
  del temporizador— y anuncia de antemano cuál será y cuánto falta. Permite recorrer el
  protocolo suceso a suceso sin salir de la pausa.

El ciclo natural en clase es: **pausar → seleccionar una trama → provocar el fallo →
avanzar evento a evento** para ver la consecuencia.

## Escenarios didácticos sugeridos

1. **La ventana llena al emisor.** Con N = 4, pulsa «Enviar» cinco veces: el quinto envío
   se rechaza hasta que llegue un ACK.
2. **ACK acumulativo.** Envía dos tramas y pierde el ACK 0. El ACK 1 confirma las dos y la
   ventana se desliza sin retransmisiones.
3. **El coste del retroceso N.** Pierde la trama 0 con la ventana llena: las tres
   siguientes llegan, se descartan por estar fuera de orden y, tras el timeout, las cuatro
   se retransmiten.
4. **Timeout prematuro.** Provoca un retraso (×2,6) o baja el timeout por debajo del RTT:
   aparecen retransmisiones inútiles y tramas duplicadas que el receptor descarta.
5. **N = 1.** Go-Back-N degenera en parada y espera; compárala con la eficiencia que
   calcula la pestaña «Calculadora».

## Fórmulas y bibliografía

La pestaña «Fórmulas» y la «Calculadora» (precargada con el ejemplo del canal satelital de
50 kbps del libro de Tanenbaum: t_f = 20 ms, eficiencia 3,8 %, ventana necesaria de 26
tramas) implementan:

| Expresión | Fuente |
| --- | --- |
| `t_f = L / B` | Tanenbaum & Wetherall §3.4 |
| `U = t_f / (t_f + 2·t_p) = 1/(1+2a)` | Tanenbaum & Wetherall §3.4 |
| `w ≥ (t_f + 2·t_p)/t_f = 1 + 2a` | Tanenbaum & Wetherall §3.4 |
| `BD = B × RTT` | Tanenbaum & Wetherall §3.4 |
| `N ≤ 2^m − 1` | Tanenbaum & Wetherall §3.4.2 |
| `U = N(1−P)/[(1+2a)(1−P+N·P)]` | Stallings §7.4 |

- Tanenbaum, A. S. y Wetherall, D. J. (2012). *Redes de Computadoras* (5.ª ed.). Pearson.
  §3.4 «Protocolos de ventana deslizante»; §3.4.2 «Protocolo de ventana deslizante con
  retroceso N».
- Stallings, W. (2004). *Comunicaciones y Redes de Computadores* (7.ª ed.). Pearson.
  §7.4 «Rendimiento de ARQ».
- Kurose, J. F. y Ross, K. W. *Redes de Computadoras: un enfoque descendente*. §3.4.3
  «Retroceso N (GBN)».

## Atajos de teclado

`Espacio` enviar · `S` o `→` avanzar al próximo evento · `X` perder paquete ·
`A` perder ACK · `D` retrasar trama ·
`P` pausar/reanudar · `R` reiniciar
