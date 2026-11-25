# Mi Diario — guía para Claude

PWA personal de diario: cada día, ánimo, lo que pasó (a mano con S Pen en hoja con renglones/cuadros, con teclado o por voz del teclado), lo mejor del día, para mañana y etiquetas. Racha, calendario de ánimo, recuerdos, buscar y PDF. Se usa en una tablet Samsung (principal, a lápiz) y en el celular. Independiente de las otras apps: no compartas código en tiempo de ejecución ni datos.

## Privacidad: reglas que no se rompen

- **El repositorio y el sitio son públicos.** Nunca pongas en el código, commits o issues nada de lo que la persona escribe, su nombre ni sus respaldos.
- Las apps comparten el mismo sitio (mismo origen): las llaves empiezan con `midiario.` y la base IndexedDB es `midiario-v1`. Nunca leas ni borres llaves de otra app.
- Datos **solo cifrados** (`src/lib/vault.ts`), con patrón (PBKDF2) y opcionalmente huella (passkey con PRF). Sin cifrar solo tema y apariencia (`midiario.theme`, `midiario.look`) y el aviso de instalación.
- Sin servidores, analítica ni librerías que llamen a internet. La voz es la del teclado del sistema; lo escrito a mano no se busca por palabras (necesitaría internet).
- **Widget (app «Rachas»)** (`src/lib/widget.ts`): solo racha, montaña, caritas de 7 días, pregunta del día y la fecha/carita de «hace un año». **Nunca el texto ni las hojas.**

## Reglas del producto

- Español de Bolivia, cálido y **sin culpa**.
- **El día cambia a las 4:00** (`appDay`). Guardar el día antes de medianoche vale 100 %; de 00:00 a 03:59, 75 %. Un día escrito después de su plazo queda en el diario pero **no cuenta** para la racha. Hoy sin escribir no corta.
- **Hoja a mano** (`src/components/Ink.tsx`): solo el lápiz escribe (la palma no raya, el dedo desplaza) salvo «Escribir con el dedo»; la presión cambia el grosor; la tinta se guarda como trazos enteros en una hoja virtual de 1000 × 1414.
- **Etiquetas**: cada una nueva queda guardada como botón (`settings.tags`); se sugieren si aparecen en lo escrito.
- **Pasar mi diario**: el respaldo de otro dispositivo se junta día por día sin borrar nada (`mergeEntries`).
- Aviso de la noche a la hora elegida (22:30 por defecto). Botones de 48 px o más.

## Reglas técnicas

- Fechas siempre en `America/La_Paz` (`src/lib/dates.ts`).
- Reglas en `src/lib/engine.ts`, funciones puras con pruebas en `tests/`.
- Estado `schema: 1` validado en `src/lib/sanitize.ts`. Si cambias el formato, sube `schema` y migra. Nunca pierdas un día.
- Antes de entregar: `npm run check`. El push a `main` publica en GitHub Pages (`/Mi-diario-/`).
