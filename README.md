# 耳から日本語 · Mimikara Nihongo

**Learn Japanese by ear, from the anime and audiobooks you actually watch and listen to.**

Mimikara Nihongo ("Japanese from your ears") turns your own anime episodes and Japanese audiobooks into bite-sized listening practice. A Python script on your PC cuts every subtitle line into its own clip, analyses the sentence (words, readings, meanings, JLPT grammar, difficulty) and packs each episode into a `.zip`. The web app on your phone imports those packs and gives you dictation, fill-in-the-blank, sentence ordering, listening, grammar and shadowing drills with spaced repetition, plus a reader, a vocabulary list, word flashcards, progress charts and one-tap Anki cards.

Everything runs in the browser and is stored on the device. It works offline, and there is no account or server.

<p align="center">
  <img src="docs/screenshots/01-home.png" width="240" alt="Home screen">
  <img src="docs/screenshots/04-dictation.png" width="240" alt="Dictation exercise">
  <img src="docs/screenshots/12-furigana.png" width="240" alt="Reader with furigana">
</p>

> The app's interface is in Japanese (it is meant for immersion). This README gives the English meaning of every button you need.

---

## Contents

- [Features](#features)
  - [Home screen](#home-screen)
  - [Practice drills](#practice-drills-練習)
  - [Learning tools](#learning-tools-学ぶ)
  - [Progress](#progress-記録)
  - [Anki](#anki)
  - [Settings](#settings-設定)
  - [Audiobooks](#audiobooks-オーディオブック)
- [Setup guide](#setup-guide)
  - [1. Install the PC tools](#1-install-the-pc-tools)
  - [2. Create episode packs (.zip)](#2-create-episode-packs-zip)
  - [3. Create audiobook packs (optional)](#3-create-audiobook-packs-optional)
  - [4. Open the app on your phone](#4-open-the-app-on-your-phone)
  - [5. Import the packs](#5-import-the-packs)
  - [6. Set up Anki](#6-set-up-anki)
  - [7. Back up your progress](#7-back-up-your-progress)
- [Customising the grammar list](#customising-the-grammar-list)
- [Project structure](#project-structure)
- [Privacy and copyright](#privacy-and-copyright)
- [Credits](#credits)

---

## Features

### Home screen

<p>
  <img src="docs/screenshots/01-home.png" width="240" alt="Home">
  <img src="docs/screenshots/03-add-episode.png" width="240" alt="Episode shelf with the add card">
  <img src="docs/screenshots/02-home-practice.png" width="240" alt="Practice modes">
</p>

- **Anime / Audiobook tabs** (アニメ / オーディオブック). Each tab has its own episodes, drills and stats.
- **Today's progress.** A ring shows today's answers against your daily goal, next to the number of sentences practised, your accuracy, the sentences due for review and your day streak (日連続). Tap the card to open the [progress screen](#progress-記録).
- **Episode shelf** (エピソード). Tap an episode to include or exclude it from the drills; excluded episodes are dimmed. The last card, **＋ エピソードを追加** ("add episode"), imports new `.zip` packs, and you can pick several at once.
- **Difficulty filter** (むずかしさ: easy / normal / hard). The script gives each sentence a difficulty level. The number on the right is how many sentences match your filters.

### Practice drills (練習)

Every drill plays the real clip of the line. You can replay it (もう一度), slow it down to 75 % (ゆっくり), or hide the video and keep only the audio (映像). Each round has 5, 10 or 20 questions, and you get a summary at the end.

<p>
  <img src="docs/screenshots/04-dictation.png" width="240" alt="Dictation">
  <img src="docs/screenshots/05-fill-blank.png" width="240" alt="Fill in the blank">
  <img src="docs/screenshots/06-order.png" width="240" alt="Sentence ordering">
</p>
<p>
  <img src="docs/screenshots/07-listening.png" width="240" alt="Listening">
  <img src="docs/screenshots/08-grammar.png" width="240" alt="Grammar question">
  <img src="docs/screenshots/08b-grammar-answer.png" width="240" alt="Grammar answer with explanation">
</p>
<p>
  <img src="docs/screenshots/09-shadowing.png" width="240" alt="Shadowing">
  <img src="docs/screenshots/10-round-summary.png" width="240" alt="Round summary">
  <img src="docs/screenshots/17-word-card-front.png" width="240" alt="Word card">
</p>

| Drill | What you do |
|---|---|
| **Mixed** (ミックス練習) | A random mix of the sentence drills below (everything except word cards), weighted towards dictation and grammar. |
| **Dictation** (書き取り) | Listen and type the line in kanji or kana, either is accepted. You get a score, and each word is coloured green, orange or red. There are three hints: the length and first kana, then a ○○○ outline, then the translation. |
| **Fill in the blank** (穴埋め) | One content word is missing; pick it from four options. Words you have not marked as known come up first. |
| **Order** (並べ替え) | Tap the phrase blocks in the right order. |
| **Listening** (聞き取り) | Choose which of four sentences you heard. Only similar-length sentences are used as distractors. |
| **Grammar** (文法) | A grammar pattern is highlighted in the line; choose what it means. Only the JLPT levels enabled in Settings are asked. |
| **Shadowing** (シャドーイング) | Record yourself after the clip or together with it. You get scores for **intonation** (your pitch curve against the character's), **rhythm** and **pronunciation**. The pronunciation score uses the browser's speech recognition, so it needs an internet connection. |
| **Word cards** (単語カード) | Vocabulary flashcards. See the word, reveal the reading, meanings and a real line from the anime where it appears, then choose *knew it* (わかった) or *didn't* (わからなかった). **✓ 覚えた** marks the word as known so it never comes back. |

After each answer the full line is shown, with the speaker, the translation, the grammar patterns and their JLPT level, and an **Anki** button. Tap any word to see its meaning, and any grammar chip for an explanation.

**Spaced repetition.** Sentences and words you get right come back later and later, up to 120 days. Mistakes come back after 10 minutes. Sentences that are due, or that you often get wrong, are picked more often.

**＋ Anki** in the top-right corner of every drill saves the current line for Anki. It is available before you answer, too.

### Learning tools (学ぶ)

<p>
  <img src="docs/screenshots/11-reader.png" width="240" alt="Reader">
  <img src="docs/screenshots/13-word-sheet.png" width="240" alt="Word details">
  <img src="docs/screenshots/14-grammar-sheet.png" width="240" alt="Grammar details">
</p>
<p>
  <img src="docs/screenshots/15-vocabulary.png" width="240" alt="Vocabulary list">
  <img src="docs/screenshots/16-grammar-list.png" width="240" alt="JLPT grammar list">
  <img src="docs/screenshots/18-word-card-back.png" width="240" alt="Word card answer">
</p>

- **Reader** (読む). The whole episode line by line, with timestamps and speakers. Play any line, listen to the whole episode continuously (通して聞く), show or hide the translation (翻訳), send a line to Anki (＋) or shadow it (🎤).
- **Word details.** Tap any word anywhere in the app to see its dictionary form, reading, part of speech, meanings (JMdict, in English), how often it appears, and example lines with audio. **覚えた？** marks it as known.
- **Grammar details.** Each pattern has its JLPT level, a short explanation, a link to [IMABI](https://imabi.org/) for a full lesson (in English) and every line in your episodes that uses it.
- **Vocabulary** (単語帳). Every word from your episodes, most frequent first, filtered by episode and by *not yet* (まだ), *known* (覚えた) or *all* (すべて), with a progress bar of known words.
- **Grammar list** (文法リスト). 560 patterns from N5 to N1. For each level it shows how many appear in your episodes, and it can be filtered to those that appear.
- **Furigana** (optional, off by default). When turned on in Settings, readings appear above the kanji in every sentence.

### Progress (記録)

<p>
  <img src="docs/screenshots/19-stats.png" width="240" alt="Progress overview">
  <img src="docs/screenshots/20-stats-accuracy.png" width="240" alt="Accuracy by drill">
</p>

- Totals: questions answered, days practised, current streak, best streak, known words and words seen in word cards.
- **Last 30 days**: one bar per day with your daily goal as a dashed line. Bars that reach the goal are highlighted, and tapping a bar shows that day's count.
- **Accuracy by drill**, with your weakest drill called out.

### Anki

<p>
  <img src="docs/screenshots/21-anki.png" width="240" alt="Anki export">
  <img src="docs/screenshots/23-settings-ankidroid.png" width="240" alt="Direct AnkiDroid setup">
</p>

Any line can become an Anki card, with the clip on the front and the sentence, translation, word meanings, grammar and source on the back. There are two ways to get cards into Anki:

1. **Export an `.apkg`** from the Anki screen (Anki カード). Choose whether the front shows the video alone or the video plus the sentence, and whether the video plays inside the card (AnkiDroid) or in a separate window (desktop Anki). **＋ まちがえた文をまとめて追加** adds every line you have got wrong in one go.
2. **Send cards directly to AnkiDroid** when you tap ＋, with no files involved. AnkiDroid then syncs them to AnkiWeb and desktop Anki. See [Set up Anki](#6-set-up-anki).

### Settings (設定)

<p>
  <img src="docs/screenshots/22-settings.png" width="240" alt="Settings">
  <img src="docs/screenshots/24-settings-backup.png" width="240" alt="Episodes and backup">
</p>

| Setting | Meaning |
|---|---|
| 一日の目標 | Daily goal: 10, 20, 30 or 50 questions. |
| 1ラウンドの問題数 | Questions per round: 5, 10 or 20. |
| ふりがなを表示する | Show furigana. |
| とても短い文もふくめる | Include very short lines such as ハァ… or ん？. |
| テーマ | Theme: auto, light or dark. |
| 文法クイズのレベル | JLPT levels used in the grammar drill. |
| AnkiDroid に直接追加 | Send cards straight to AnkiDroid. |
| アニメ／オーディオブック | Your imported episodes and chapters, with **削除** to delete them and buttons to import more. |
| バックアップ | Save or restore your progress. |

### Audiobooks (オーディオブック)

The audiobook tab works the same way, using clips cut from a narrated book. It also has:

- **Paragraph listening** (段落リスニング). Listen to a whole paragraph without text, then reveal the text (文字を見る) and rate how much you understood.
- **Chapter reader.** Read and listen paragraph by paragraph.

---

## Setup guide

The overall workflow:

```
Your PC                                            Your phone
───────                                            ──────────
anime .mkv/.mp4 + Japanese .srt/.ass ─┐
                                      ├─ script ─▶ .zip packs ─▶ import in the app
audiobook .mp3 (one file / chapter) ──┘  (Python)                (stored on the phone)
```

### 1. Install the PC tools

You need **Python 3.10 or newer**. [Anaconda](https://www.anaconda.com/download) or the regular [python.org](https://www.python.org/downloads/) installer both work. Open a terminal (on Windows, *Anaconda Prompt* or *Command Prompt*) and run:

```bash
cd "C:\path\to\mimikara-nihongo\script"
pip install -r requirements.txt
```

This installs:

| Package | Used for |
|---|---|
| `fugashi` + `unidic-lite` | Splitting Japanese into words, with readings |
| `pysubs2` | Reading `.srt` / `.ass` subtitles |
| `numpy` | Aligning the subtitles with the audio |
| `imageio-ffmpeg` | A bundled `ffmpeg` for cutting clips. If `ffmpeg` is already on your PATH, that one is used instead. |
| `faster-whisper` | Transcribing audiobooks. Only needed for audiobooks. |

The dictionary, `jmdict_min.zip`, is included and is unpacked automatically the first time you run the script.

### 2. Create episode packs (.zip)

**a) Put each series in one folder.** For every episode you need the video (`.mkv` or `.mp4`) and a **Japanese subtitle file** (`.srt` or `.ass`). Subfolders are fine.

```
E:\Anime\Frieren\
├── Frieren S01E01.mkv
├── Frieren S01E01.ja.srt
├── Frieren S01E02.mkv
├── Frieren S01E02.ja.srt
└── ...
```

File naming rules:

- Every file name must contain the season and episode, as `S01E05` or `S1 - 05`. That is how a video is matched with its subtitle. Files without it are ignored.
- Subtitle files whose name contains `.en.`, `.eng.`, `.es.` or `.spa.` are treated as non-Japanese and skipped. Any other `.srt`/`.ass` with an episode code is taken as the Japanese subtitle, so keep other languages out of the folder or name them that way.
- Keep one Japanese subtitle per episode. If there are two, only one is used.

**The translation** shown in the app comes from the subtitle tracks **inside** the `.mkv`: Spanish if there is one, otherwise English, which the app labels 翻訳（英語）. With neither, the episode has no translation.

**b) Run the script** on the series folder:

```bash
python run_all.py "E:\Anime\Frieren"
```

The packs are written to `<project>\paquetes\anime\<series folder name>\S01E01.zip`, and so on. Each episode takes a few minutes and ends up around 20 MB. If you stop the script and run it again, episodes that already have a `.zip` are skipped. Before starting, it lists the videos it found without a Japanese subtitle.

Useful options:

| Option | Effect |
|---|---|
| `--solo S01E01 S01E02` | Only process these episodes. |
| `--salida "D:\packs"` | Write the packs somewhere else. |
| `--rehacer` | Rebuild episodes that already have a `.zip`, for example after updating the script. |
| `--no-unir` | Don't merge consecutive subtitle lines from the same speaker into one sentence. |

For each episode, the script:

1. Cleans the Japanese subtitles: removes speaker names in brackets, song lyrics and sound effects.
2. Merges consecutive lines spoken by the same character into one sentence and one clip. The speaker comes from the name in brackets in the Japanese subtitle, or from the *Actor* field of the embedded subtitles.
3. Measures the offset between the subtitles and the audio, and corrects it.
4. Splits each sentence into words with readings and furigana, looks up meanings in JMdict, and detects JLPT grammar patterns.
5. Rates each sentence as easy, normal or hard.
6. Cuts a 360p clip (H.264 + AAC) for every sentence.

### 3. Create audiobook packs (optional)

Put the book in a folder with **one audio file per chapter** (`.mp3`, `.m4b`, `.m4a`, `.aac`, `.flac`, `.wav`, `.ogg` or `.opus`). Chapter numbers are read from names like `Book title - 03 - Chapter name.mp3`, or from any number in the file name.

```bash
python audiobook.py "C:\Audiobooks\MyBook\mp3"
```

- Each chapter is transcribed with Whisper. The first run downloads the model, about 1.5 GB.
- The text is split into sentences and into paragraphs (段落) using the narrator's pauses, and then analysed like the anime.
- One `.zip` per chapter is written to `<project>\paquetes\audiolibros\<book title>\`.
- Transcriptions are cached in a `_transcripciones` folder, so `--rehacer` never transcribes again.

| Option | Effect |
|---|---|
| `--solo 2 3` | Only these chapters. Try the shortest chapter first to see how long it takes. |
| `--modelo small` | Much faster, less accurate. The default is `large-v3-turbo`. |
| `--dispositivo cuda` | Use an NVIDIA GPU instead of the CPU. |
| `--id BOOK1` | Short ID for the book. By default it is taken from the name. |
| `--salida "D:\packs"` | Write the packs somewhere else. |
| `--rehacer` | Rebuild the packs using the saved transcriptions. |

On a CPU, `large-v3-turbo` runs at roughly 1× to 3× the length of the audio.

### 4. Open the app on your phone

The app in the `app/` folder is a set of static files with no build step. It has to be served over **HTTPS** for the microphone (shadowing), offline mode and "Add to Home screen" to work. Pick one of these options:

**Option A: GitHub Pages (recommended)**

1. On GitHub, open the repository, go to **Settings → Pages**, and under *Build and deployment* choose **Deploy from a branch → `main` → `/ (root)`**.
2. After a minute the app is live at `https://<your-user>.github.io/<repo-name>/app/`.
3. Open that address in Chrome on your phone, then use **⋮ → Add to Home screen** to install it like a normal app.

GitHub Pages is free for public repositories. For a private repository it needs a paid GitHub plan. Making the repository public is safe, because the packs in `paquetes/` are never uploaded (see [Privacy and copyright](#privacy-and-copyright)).

**Option B: another static host.** Netlify, Cloudflare Pages, Vercel and similar hosts all work. Publish the `app/` folder.

**Option C: from your PC, for testing.**

```bash
cd app
python -m http.server 8000
```

On the PC, open `http://localhost:8000` and everything works, including the microphone. From the phone on the same Wi-Fi, `http://<your-PC-IP>:8000` works too, but without the microphone or offline install, because it is not HTTPS.

### 5. Import the packs

1. Copy the `.zip` files to your phone, using a USB cable, Google Drive or anything else. Each anime episode is about 20 MB.
2. In the app, tap **＋ エピソードを追加** at the end of the episode shelf, or go to **⚙ 設定 → アニメのエピソードを読み込む（.zip）**. For audiobooks, use the オーディオブック tab or **オーディオブックの章を読み込む（.zip）**.
3. Select one or more `.zip` files. The clips are copied into the app's storage, so the `.zip` files can be deleted afterwards.

To remove an episode, go to **⚙ 設定 → アニメ／オーディオブック → 削除**. This deletes its sentences and clips.

### 6. Set up Anki

#### Option 1: `.apkg` files (simplest)

1. In any drill, the reader or a word's example lines, tap **＋ Anki** on the lines you want.
2. Open **Anki** from the home screen (学ぶ → Anki).
3. Choose the card layout, then tap **.apkg を作る** ("create .apkg").
4. On Android the share menu opens: choose **AnkiDroid**. On a PC the file is downloaded; double-click it to import it into Anki.

Re-exporting the same line updates the existing card instead of creating a duplicate. The deck is called `耳から日本語::アニメ` (or `…::オーディオブック`).

#### Option 2: straight into AnkiDroid when you tap ＋

This uses [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid), a free companion app that lets other apps on the phone add cards to AnkiDroid.

1. Install **[AnkiDroid](https://play.google.com/store/apps/details?id=com.ichi2.anki)**, and install **AnkiConnect Android** from its [GitHub releases](https://github.com/KamWithK/AnkiconnectAndroid/releases).
2. Open AnkiConnect Android, allow it to access AnkiDroid, and start the service. If Android keeps closing it, turn off battery optimisation for the app.
3. In Mimikara Nihongo, go to **⚙ 設定 → AnkiDroid に直接追加** and turn the switch on. The instructions that appear show **your app's address**, for example `https://your-user.github.io`.
4. In AnkiConnect Android's settings, paste that address into **CORS Host**. Without it, the phone's browser blocks the connection.
5. Import **one** `.apkg` from Option 1 into AnkiDroid. This creates the card type and the deck, which AnkiConnect Android cannot create by itself.
6. Tap **接続テスト** ("connection test"). When you see ✓, every ＋ goes straight into AnkiDroid.

If Chrome asks whether the page may access devices on your local network, allow it. If a card cannot be sent, for example because the service is closed, the line is kept in the Anki screen with a **AnkiDroid に直接送る** button to send everything pending later. The `.apkg` export still works as a fallback.

**If the video has no sound in AnkiDroid:** on the Anki screen, set **動画の入れ方** to **PC版 Anki（別ウィンドウ）**. AnkiDroid then plays the clip in its own player.

### 7. Back up your progress

Progress lives in the phone's browser storage. **Clearing the browser data or changing phones erases it**, so make a backup now and then:

- **⚙ 設定 → バックアップ → 記録を保存** saves a small `mimikara_backup_<date>.json` file, and on a phone the share menu opens so you can send it to Drive, email and so on. The backup includes sentence and word progress, known words, streaks, Anki selections and settings.
- **記録をもどす** restores a backup, asking for confirmation first.
- Clips are **not** included. Re-import the episode `.zip` files after restoring.

---

## Customising the grammar list

All grammar patterns are defined in `script/grammar_jlpt.py`, with the level, a Japanese explanation, a detection pattern and an IMABI link for each. After editing it:

```bash
cd script
python export_grammar.py "../app/grammar_ja.js"
```

Then rebuild your packs with `--rehacer` so the new patterns are detected in the episodes.

## Project structure

```
.
├── app/                    The web app (plain HTML/CSS/JS, no build step)
│   ├── index.html
│   ├── app.js              Screens, drills, spaced repetition, stats, backup, AnkiConnect
│   ├── app.css
│   ├── audio.js            Pitch/rhythm analysis for shadowing, answer alignment for dictation
│   ├── anki.js             Builds .apkg files in the browser (sql.js)
│   ├── grammar_ja.js       JLPT grammar list (generated)
│   ├── sw.js               Service worker (offline)
│   └── manifest.webmanifest
├── script/                 PC tools (Python)
│   ├── run_all.py          Processes a whole anime folder → one .zip per episode
│   ├── process.py          Processes one episode
│   ├── audiobook.py        Processes an audiobook → one .zip per chapter
│   ├── grammar_jlpt.py     Grammar definitions (N5–N1)
│   ├── export_grammar.py   Regenerates app/grammar_ja.js
│   ├── jmdict_min.zip      Compact JMdict dictionary
│   └── LEEME.txt           Short guide in Spanish
├── docs/screenshots/       Images used in this README
└── paquetes/               Your generated packs (not in the repository)
```

## Privacy and copyright

- The app has no backend. Nothing leaves your device, with three exceptions: the optional speech recognition used for the shadowing pronunciation score (the browser's own service), IMABI links when you open them, and AnkiConnect, which stays on the same phone.
- **The repository contains no anime or audiobook content.** `paquetes/` is excluded in `.gitignore`. Only process media you own, and don't publish the generated packs, since they contain copyrighted clips and subtitles.
- The screenshots in this README show a few frames and subtitle lines from *Frieren: Beyond Journey's End* (葬送のフリーレン) purely to illustrate how the app works. They are © their respective owners.

## Credits

- Dictionary: [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) © Electronic Dictionary Research and Development Group, used under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). `script/jmdict_min.zip` is a reduced version.
- Morphological analysis: [fugashi](https://github.com/polm/fugashi) + [UniDic](https://clrd.ninjal.ac.jp/unidic/).
- Audiobook transcription: [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
- In the app: [sql.js](https://github.com/sql-js/sql.js) (building `.apkg` files) and [fflate](https://github.com/101arrowz/fflate) (reading `.zip` files).
- Grammar lessons: links to [IMABI](https://imabi.org/).
- Direct AnkiDroid integration: [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid).
