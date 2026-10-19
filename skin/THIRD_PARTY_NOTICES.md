# Third-party notices

## OpenDLSS-NR

Copyright (c) 2026 maan. MIT. Full license: `vendor/opendlss/LICENSE`.
Three vendored JS files have local URL/shard-loader adaptations. Shader math, graph and tensor bytes are unchanged. Upstream and adapted hashes: `vendor/opendlss/PROVENANCE.json`.

## three.js

MIT. Full license and original copyright: `vendor/three/LICENSE`.
Vendored version: 0.180.0.

## Hand scan

"Female hand" by deep3dstudio, CC BY-NC 4.0.
Source: https://sketchfab.com/3d-models/female-hand-3e9b8ad1942048e3a267d92fb1124d46
Author: https://sketchfab.com/deep3dstudio
License: https://creativecommons.org/licenses/by-nc/4.0/
Provided by the user as female_hand.glb. Noncommercial use only.
Changes: legacy specular/glossiness metadata moved to extras for a custom physical
material; binary geometry and embedded images unchanged (hashes in
assets/female_hand.provenance.json). Mobile copy: embedded PNG images resized to 2K with macOS sips. Runtime texture resizing up to 4K, conversion
of glossiness alpha to roughness, normalization to 0.25 m height, lighting and
approximate screen-space SSS.

## Model data

NVIDIA DLSS-NR weights are separate proprietary data. They are not covered by the
MIT licenses above. This local package contains extracted tensor data in weights/.
Source hashes are recorded in weights/manifest.json; rights to public redistribution
were not established. No files have been published by this task. This demo is not
affiliated with or endorsed by NVIDIA.
