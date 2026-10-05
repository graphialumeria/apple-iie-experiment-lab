# Apple IIe Experiment Lab

A small browser emulator for experimenting with the original Apple IIe's 6502, display memory, keyboard, and one-bit speaker. Includes **Color / Pulse**, an original ROM that cycles through color blocks while playing a chiptune.

No installation or Apple ROM is needed to run the included demos. No runtime libraries, accounts, API keys, external assets, or network requests are used.

## Run it

Open **`dist/index.html`** in a modern browser. Click **Play colors + music** to start the ROM and enable browser audio. The browser requires this click before playing sound.

Or open **`dist/color-music.html`** for the dedicated color-and-music player. Click **Play colors + music** to hear it.

The `dist` pages are self-contained and work offline. Keep the whole repository if you want to edit the source. The root `index.html` loads the adjacent JavaScript files and is the editable version.

Optional local server, with Python 3.10 or later:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Visit http://localhost:8000/dist/ . On Windows, use `py -3` instead of `python3` if needed.

## Put it on GitHub

1. Extract the ZIP. The `apple-iie-github` folder is the repository root.
2. Create an empty GitHub repository, for example `apple-iie-experiment-lab`.
3. From a terminal in the extracted folder, run the commands below. Replace `YOUR-USERNAME` with your GitHub username. If you choose a different repository name, update the URL too.

```sh
git init -b main
git add .
git commit -m "Add Apple IIe emulator and Color / Pulse ROM"
git remote add origin https://github.com/YOUR-USERNAME/apple-iie-experiment-lab.git
git push -u origin main
```

GitHub may ask you to authenticate. GitHub Desktop is also an option: create a repository from this folder, commit the included files, then Publish repository.

Upload the **contents** of the extracted folder to your repository root, including `.github/workflows`. Do not upload only the ZIP or place the entire project inside another repository subfolder. The workflows expect the project at the repository root.

## Host a playable version with GitHub Pages

1. In the repository, go to **Settings → Pages** and choose **GitHub Actions** as the source.
2. Go to **Actions → Deploy GitHub Pages → Run workflow**. Run it from `main`.
3. When deployment finishes, open the URL shown in the deployment job or Settings → Pages.

The main emulator will be at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`. The dedicated player will be at the same URL plus `color-music.html`.

Deployment is manual so uploading code does not immediately publish a website. Run the deployment workflow again after edits. Build and test checks run automatically on pushes and pull requests. The deployment workflow builds and tests before publishing only the files in `dist/`.

GitHub Pages settings and permissions must be enabled in your repository. See [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Edit, rebuild, and test

Development requires **Python 3.10+** and **Node.js 20+**. There are no pip or npm dependencies to install.

```sh
python3 build-rom.py
node test.cjs
node test-rom.cjs
node test-ui.cjs
```

Or, with Python available as `python3`:

```sh
npm run build
npm test
```

- Edit `core.js` for CPU and memory behavior.
- Edit `speaker.js` for audio rendering.
- Edit `index.html` for controls and display rendering.
- Edit `color-music.asm` for the ROM, palette, and note tables.
- Run the build after edits, then commit the source **and generated files**. CI checks that the generated ROM and `dist` pages match the source.

`build-rom.py` assembles the ROM, regenerates `rom-data.js` and the address listing, then bundles both standalone pages into `dist/`. Its small assembler supports the subset of official 6502 instructions and directives used by this ROM; it is not a general-purpose assembler. `test-rom.cjs` also regenerates the eight-second WAV preview directly from the ROM's emulated speaker transitions.

## Controls and experiments

Click the screen before typing. Enter, Backspace, Escape, arrows, and Ctrl + letter are supported in the keyboard demo. Pause and Step expose individual instructions and live CPU registers.

In the machine-code editor, load this at `$0800`:

```text
A9 C1 8D 00 04 4C 05 08
```

This writes an A into the upper-left text cell and loops. Change `C1` to `C2` for B. Click Text demo before loading another experiment to restore the default memory switches.

Color / Pulse loops a 32-note melody, rotates the palette on each note, and changes among tiles, vertical bars and horizontal bands every eight notes. It uses documented NMOS 6502 instructions, main RAM, standard 40×48 low-resolution graphics, and the built-in speaker at `$C030`. Each note lasts about 200 ms with a short gap while the next picture is drawn. The Web Audio backend plays the speaker's CPU-timed edges; the tune is executed by the ROM.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Editable emulator interface |
| `core.js` | CPU and Apple IIe bus |
| `speaker.js` | One-bit speaker audio backend |
| `color-music.asm` | Commented original ROM assembly |
| `color-music.rom` | 12 KB system-ROM image, mapped at $D000–$FFFF |
| `color-music.lst` | Assembled addresses and bytes |
| `rom-data.js` | Generated embedded ROM bytes |
| `color-music-preview.wav` | Eight-second listening preview |
| `build-rom.py` | Dependency-free assembler and bundler |
| `test*.cjs` | CPU, ROM, and simulated interface/audio tests |
| `dist/` | Ready-to-open and ready-to-host standalone pages |
| `.github/workflows/` | Build checks and manual Pages deployment |

## Compatibility and limits

This is an experimental foundation, not a compatibility-complete Apple IIe emulator.

Implemented: all 151 documented NMOS 6502 opcodes, decimal arithmetic, stack and interrupts, branch/page-cross cycle counts, main/auxiliary RAM, keyboard latch, several video/memory soft switches, language-card banking, 40/80-column text, 16-color lo-res, monochrome hi-res, mixed mode, and one-bit speaker playback.

Not implemented: 65C02 extensions, Disk II, disk-image booting, expansion cards, paddles, MouseText, exact character-ROM glyphs, double hi-res, artifact color, floating bus, complete internal/slot-ROM selection, or cycle-exact bus/video timing. Speaker timestamps are instruction based. Background-tab throttling can interrupt playback.

Apple ROMs are not included. The optional loader accepts a 16 KB image at $C000 or a 12 KB image at $D000; Apple firmware compatibility is unverified. The original Color / Pulse ROM is included and tests pass in this emulator. It is a combined system-ROM image, not an Apple cartridge or directly packaged physical replacement chip. Actual Apple IIe hardware has not been tested.

Tests cover focused CPU/bus cases, a full melody loop, each complete screen layout, note pitch/duration, and simulated browser/audio controls. They are not an exhaustive CPU conformance suite. Live visual and audible browser verification was unavailable in the build environment. The GitHub workflows are provided and locally checked; deployment itself must be run in your repository.

## License and references

Project code, original ROM, and generated demo assets are provided under the MIT license in `LICENSE`. No Apple firmware, character ROM, or third-party music is bundled. This project is not affiliated with Apple.

Hardware references:

- [MOS Technology MCS6500 hardware manual, Appendix A](https://xotmatrix.com/6502/6502-single-cycle-execution.html)
- [Apple IIe Reference Manual](https://www.applelogic.org/files/AIIEREF.pdf)
