# 耳から日本語

App web (PWA) para estudiar japonés con clips de anime y audiolibros: dictado, huecos, ordenar frases, escucha, gramática JLPT, shadowing con puntuación de entonación, tarjetas de vocabulario con repaso espaciado y envío de frases a Anki / AnkiDroid.

Todo funciona en el navegador del móvil y los datos se guardan en el propio dispositivo.

## Estructura

- `app/` — la app web (HTML/CSS/JS, sin compilar). Se sirve con cualquier servidor estático, por ejemplo `python -m http.server 8000` dentro de `app/`.
- `script/` — scripts de Python que convierten tus vídeos + subtítulos japoneses (o audiolibros) en paquetes `.zip` que la app importa. Instrucciones en [`script/LEEME.txt`](script/LEEME.txt).
- `paquetes/` — donde se guardan los `.zip` generados. **No se incluye en el repositorio**: los clips y subtítulos tienen derechos de autor. Cada uno genera los suyos a partir de su propio material.

## Créditos

- Diccionario: [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project), © Electronic Dictionary Research and Development Group, usado bajo licencia [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). `script/jmdict_min.zip` es una versión reducida.
- Análisis morfológico: [fugashi](https://github.com/polm/fugashi) + UniDic.
- Transcripción de audiolibros: [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
- En la app: [sql.js](https://github.com/sql-js/sql.js) (para crear los `.apkg`) y [fflate](https://github.com/101arrowz/fflate) (para leer los `.zip`).
- Explicaciones de gramática ampliadas: enlaces a [IMABI](https://imabi.org/).
