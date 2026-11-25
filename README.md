# Serpent Plugin: WD14 Tagger

Offline WD14 image tagging for [Serpent](https://github.com/dolag233/Serpent), using
ONNX models (`wd-eva02-large-tagger-v3`, `wd-vit-large-tagger-v3`,
`wd-v1-4-swinv2-tagger-v2`, `wd-v1-4-convnext-tagger-v2`,
`wd-v1-4-convnextv2-tagger-v2`, `wd-v1-4-vit-tagger-v2`,
`wd-v1-4-moat-tagger-v2`, `wd-vit-tagger-v3`, `wd-convnext-tagger-v3`,
`wd-swinv2-tagger-v3` and compatible formats).
Inference runs in-process via onnxruntime-web (WASM, CPU). No network access.
JPEG and PNG are supported. WebP needs conversion to JPEG/PNG first.
