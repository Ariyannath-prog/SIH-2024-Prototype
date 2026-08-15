# SIH 2024 Virtual Herbal Garden

This repository contains the GitHub Pages-ready version of the SIH 2024 Virtual Herbal Garden prototype.

## Project structure

```text
public/
  index.html                 GitHub Pages entry point
  h1.html ... h25.html       Individual plant pages
  assets/
    css/                     Site styles
    images/plants/           Plant photography
    images/background.png    Shared site background
    js/model-viewer.js       Shared responsive Three.js viewer
    models/                  glTF, binary and texture assets
    vendor/three/            Bundled Three.js r128 viewer dependencies
    video/                   Web-optimized garden tour
.github/workflows/pages.yml  Automatic Pages deployment
scripts/check-site.mjs       Asset and path validator
```

All browser URLs are relative. This is important because a project Pages site is served from a repository subpath such as `https://username.github.io/repository-name/`.

## Run locally

The glTF files must be served over HTTP; opening an HTML file directly is not enough.

```bash
cd public
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

Validate every local HTML/CSS/glTF reference before committing:

```bash
npm test
```

## Publish with GitHub Pages

1. Create an empty GitHub repository, for example `sih-2024-herbal-garden`.
2. From this folder, run:

   ```bash
   git init
   git add .
   git commit -m "Prepare SIH 2024 prototype for GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/sih-2024-herbal-garden.git
   git push -u origin main
   ```

3. In the repository, open **Settings → Pages**.
4. Set **Build and deployment → Source** to **GitHub Actions**.

Every push to `main` will validate and deploy only the `public/` directory.

## Prototype asset notes

- The original 140 MiB garden video is preserved locally at `source-material/V1-original.mp4` and intentionally ignored by Git. The deployed 720p version is about 4.5 MiB.
- The original files did not include the `v13` (Sweet Flag) or `v22` (Drumstick) glTF packages. Those two pages now show a clear unavailable message instead of making broken requests.
- To restore either missing model, add its `.gltf`, `.bin`, and textures under `public/assets/models/`, then set that page's `data-model-url` to the relative `.gltf` path.
- Three.js r128, GLTFLoader, and OrbitControls are bundled under `public/assets/vendor/three/`, so every viewer dependency and model asset is served from the same GitHub Pages origin.
