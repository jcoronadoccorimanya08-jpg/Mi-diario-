# Mi Diario — guía para Claude

PWA personal de diario: cada día, ánimo, lo que pasó (a mano con S Pen en hoja con renglones/cuadros, con teclado o por voz del teclado), lo mejor del día, para mañana y etiquetas. Racha, calendario de ánimo, recuerdos, buscar y PDF. Se usa en una tablet Samsung (principal, a lápiz) y en el celular. Independiente de las otras apps: no compartas código en tiempo de ejecución ni datos.

## Privacidad: reglas que no se rompen

- **El repositorio y el sitio son públicos.** Nunca pongas en el código, commits o issues nada de lo que la persona escribe, su nombre ni sus respaldos.
- Las apps comparten el mismo sitio (mismo origen): las llaves empiezan con `midiario.` y la base IndexedDB es `midiario-v1`. Nunca leas ni borres llaves de otra app.
- Datos **solo cifrados** (`src/lib/vault.ts`), con patrón (PBKDF2) y opcionalmente huella (passkey con PRF). Sin cifrar solo tema y apariencia (`midiario.theme`, `midiario.look`) y el aviso de instalación.
- Sin analítica ni librerías externas: la única conexión a internet es la sincronización cifrada (abajo). La voz es la del teclado del sistema; lo escrito a mano no se busca por palabras (necesitaría internet).
- **Sincronización celular ↔ tablet** (`src/lib/sync.ts`, `src/lib/syncSetup.ts`, pedido de la persona): con un código de sincronización (5 palabras + número, guardado solo dentro de los datos cifrados), el estado se cifra en el dispositivo (PBKDF2 + AES-GCM, llave derivada del código) y se guarda en Supabase (`atusufrroqtbbuffzjrw`) por funciones `put_blob`/`get_blob` que no permiten listar. El servidor solo ve texto ilegible. Un dispositivo recién vinculado nunca pisa la nube: si ya tiene datos propios, pregunta cuáles se quedan y guarda una copia cifrada para «Deshacer» (14 días). Antes de subir siempre mira la nube; si los dos cambiaron, se juntan (`src/lib/merge.ts`, con la última versión en común guardada cifrada en `<app>.sync-base`). Única llamada a internet permitida; la llave pública (publishable) puede estar en el código, la secreta nunca.
- **Widget (app «Rachas»)** (`src/lib/widget.ts`): solo racha, montaña y la pregunta del día (el widget ya no muestra caritas; «hace un año» solo dice que escribiste). **Nunca el texto ni las hojas.**

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
- Antes de entregar: `npm run check`. Se publica copiando el build (`BASE_PATH=/diario/ npx vite build`) a la carpeta `diario/` del repositorio del sitio raíz.
