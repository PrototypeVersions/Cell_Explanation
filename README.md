# Inside the Answer

An original, interactive cell-learning concept by **Blake Myers**. Built as a portfolio demonstration of how medical illustration can become a learning experience: explore a structure, follow a mechanism, predict a consequence, and investigate the answer.

**[Open the live experience](https://prototypeversions.github.io/Cell_Explanation/)**

## Explore at your own pace

- Rotate and zoom a real-time 3D animal cell with nine selectable structures.
- Switch between cutaway, whole-cell, and separated views; inspect organelle interiors.
- Take a five-stop guided introduction, or explore freely without a time limit.
- Follow a secreted protein or a soluble lysosomal hydrolase through six teaching stages.
- Pause, scrub, change playback speed, and compare normal trafficking with blocked ER export or failed mannose-6-phosphate targeting.
- Solve three original cases. Each answer connects a prediction with an explanation and the 3D mechanism.

## Run locally

No build step, package installation, API key, or server-side code is needed.

```sh
python3 -m http.server 8765
```

Open http://localhost:8765. Serve the folder over HTTP; opening index.html directly as a file will not load JavaScript modules correctly.

For GitHub Pages, select **Settings → Pages → Deploy from a branch → main → / (root)**. All URLs are relative and work under the repository path.

## Controls

Drag to orbit, scroll or pinch to zoom, and select a structure in the atlas or model. Keyboard shortcuts: **1 / 2 / 3** switch learning modes, **L** toggles labels, **R** resets the view, and **Space** toggles pathway playback. Standard buttons, selectors, and the timeline support keyboard input. Model labels have equivalent controls in the learning panel.

The responsive interface includes reduced-motion camera transitions and a static illustration fallback when WebGL initialization fails. Case progress is stored only in this browser's local storage. There is no account, tracking, or analytics.

## Implementation

Vanilla HTML, CSS, and ES modules; Three.js **0.170.0**, with OrbitControls and RoomEnvironment. The cell is original procedural geometry, with deterministic details. Fonts and JavaScript dependencies are hosted with the site, so the live experience makes no third-party asset requests.

| File | Responsibility |
| --- | --- |
| `scene.js` | Geometry, rendering, camera, picking, labels, and cargo routes |
| `content.js` | Organelles, guided tour, pathways, and case explanations |
| `app.js` | Learning states, controls, playback, and saved case progress |
| `style.css` | Responsive layout and visual design |
| `index.html` | Application shell, controls, help, and sources |

## Scientific scope

This is a schematic teaching model. Geometry, scale, organelle counts, distances, and elapsed times are illustrative. The pathway focuses on soluble M6P-dependent lysosomal hydrolases and includes an endosomal intermediate. It simplifies vesicle coats, receptor recycling, and membrane fusion. M6P targeting is a two-step modification; it is summarized as one teaching stage. Not every lysosomal protein uses M6P targeting.

The cases are original fictional educational scenarios. The project is an independent portfolio concept and is not affiliated with or endorsed by UWorld. No UWorld artwork, questions, or branding are included. Clinical editorial review would be needed before use as a commercial exam-preparation product.

Scientific references are also linked in the site's **Field notes**:

- [MedlinePlus Genetics: Mucolipidosis II alpha/beta](https://medlineplus.gov/genetics/condition/mucolipidosis-ii-alpha-beta/)
- [Dahms et al.: Strategies for carbohydrate recognition by the mannose 6-phosphate receptors](https://pmc.ncbi.nlm.nih.gov/articles/PMC2733771/)
- [Lord, Ferro-Novick, and Miller: The highly conserved COPII coat complex sorts cargo from the endoplasmic reticulum and targets it to the Golgi](https://pmc.ncbi.nlm.nih.gov/articles/PMC3552504/)
- [Cooper: The Golgi Apparatus, The Cell: A Molecular Approach](https://www.ncbi.nlm.nih.gov/books/NBK9838/)

## Third-party licenses

Three.js and its example modules: MIT, in `vendor/LICENSE-three.txt`. DM Sans and DM Serif Display: SIL Open Font License 1.1, in `assets/LICENSE-dmsans.txt` and `assets/LICENSE-dmserifdisplay.txt`.
