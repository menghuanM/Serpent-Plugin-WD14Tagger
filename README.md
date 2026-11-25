# Serpent Plugin: WD14 Tagger

Offline WD14 image tagging for [Serpent](https://github.com/dolag233/Serpent), using
ONNX models (`wd-eva02-large-tagger-v3`, `wd-vit-large-tagger-v3`,
`wd-v1-4-swinv2-tagger-v2`, `wd-v1-4-convnext-tagger-v2`,
`wd-v1-4-convnextv2-tagger-v2`, `wd-v1-4-vit-tagger-v2`,
`wd-v1-4-moat-tagger-v2`, `wd-vit-tagger-v3`, `wd-convnext-tagger-v3`,
`wd-swinv2-tagger-v3` and compatible formats).
Inference runs in-process via onnxruntime-web (WASM, CPU). No network access.
JPEG and PNG are supported. WebP needs conversion to JPEG/PNG first.

## Usage

1. Install the versioned ZIP via Serpent 设置 → 插件 → 高级安装, then trust and
   enable the unrestricted plugin. When upgrading, install it into the same
   library/scope as the previous version; the plugin ID and saved settings stay
   the same. The host may ask to trust the updated package.
2. In plugin settings for the current library, set **Model directory** to a
   folder containing matching `.onnx` + `.csv` pairs (e.g. the ComfyUI wd14-tagger
   `models` directory), pick a model, and adjust thresholds. The model options show the
   repository, tag count and a local status snapshot: **本地有** means both matching
   `.onnx` and `.csv` files were found, while **本地不完整** identifies a missing pair
   file. Re-check the files after changing the model directory. Library settings
   take priority over user-level defaults.
3. Right-click selected images → **WD14: Tag selected images**, or use the
   folder menu to tag an entire folder recursively. Open Serpent's background
   tasks to see the current image number, completed/total, percentage and stage
   (loading the model, reading, inference or writing tags). The first task loads
   the local model before tagging. Progress notifications also appear at most
   once every five seconds when the stage changes.
4. A completion or cancellation notification reports the processed/tagged count.
   Missing models, decoding errors and failed writes appear in notifications and
   the background task's error details. A warning explains when no tags passed
   the thresholds.

## Version 0.1.7

- Add a reviewed model-vocabulary supplement for legacy names and missing tags,
  including `pink_footwear` → `粉色鞋类` and `night_sky` → `夜空`.
- Keep new keys in `data/tags-zh-CN.additions.json`, separate from corrections to
  existing upstream translations. Both are included in the generated offline dictionary.
- Check every general/character label in local model CSVs with
  `scripts/check-translation-coverage.cjs`; report missing keys separately from
  deliberately preserved names or symbols.
- Regenerate from SHA-256-verified cached source CSVs with `--source-dir`, and
  verify generated files without writing them with `--check`.

## Version 0.1.6

- Remove the standalone WD14 progress and stop toolbar/context-menu entries.
- Keep image and folder tagging actions in their existing menus; progress remains visible
  in Serpent's background task panel.

## 中文输出 / Chinese output

安装 **0.1.3 或更高版本** 后，在当前资源库的插件设置中，将 **Output language** 设为
**中文（离线翻译） / Chinese (offline)**，再对图片执行 WD14 打标。
中文词典随插件安装，无需翻译 API、密钥或联网下载。未收录的标签（例如部分角色名）
保留原文；相同中文译名自动合并。默认仍为 **English (raw)**，已有标签会保留，
切换语言后再次打标会追加所选语言的标签。

Choose **Chinese (offline)** in **Output language** to translate model tags with
an included English-to-Simplified-Chinese dictionary. Unknown tags keep their
original names. Translation preserves ranking, applies after the configured tag
limit, and merges duplicate translated names. English output remains raw.

## Version 0.1.5

- Add all ten WD14 model options from the SmilingWolf repositories.
- Show each model's tag count, source repository and local `.onnx`/`.csv` status in
  the model setting; the current directory has four complete models and one incomplete
  `wd-convnext-tagger-v3` pair.

## Version 0.1.4

- Report the current image number before reading, inference and tag write-back,
  with completed/total, percentage and outcome counts.
- Add Chinese progress/status and stop commands to context menus and the plugin
  toolbar, plus bounded progress notifications.
- Cancel the current library's running and queued WD14 jobs through the host.
- Check cancellation between tag pages/creations and before further image work;
  report the preserved results when a task stops.
- Reset stopped task state when the host starts a new retry attempt of the same
  job ID, without reviving an older cancelled execution.

## Version 0.1.3

- Make the output-language setting effective in inference and tag write-back.
- Include an offline Chinese dictionary, with no external translation service.
- Preserve unknown tag names and reuse existing Chinese tags in the library.
- Keep the optional translator backend hook for custom Chinese translations.
- Package the dictionary and its attribution, and verify installed translation.

## Version 0.1.2

- Bind jobs and progress to the invocation's resource library; fixes
  `JOB_TARGET_REQUIRED` on the selection/folder context menu.
- Use a library-scoped plugin instance and read library settings before user
  defaults, matching the host's settings storage.
- Read image format from content signatures/MIME; metadata does not provide
  filename/extension fields. Preserve the invocation's selected asset IDs.
- Feed WD14 interleaved NHWC BGR pixels as float32 values in `[0,255]`, composite
  alpha onto white, and read the actual model input size.
- Surface failures instead of finishing failed images as a successful job.
- Correctly parse quoted CSV tag names and enforce the configured tag limit.

## Verification

```sh
node scripts/test-tagging.cjs
node build.js --zip
node scripts/validate-package.cjs
node scripts/smoke-tagging.cjs --model-dir <models> --image <image.jpg> --output-language chinese
node scripts/smoke-tagging.cjs --model-dir <models> --image <image.jpg> --copies 2 --stop-after 1
```

The regression suite uses a small mock ONNX session and real image decoders.
Package validation installs the ZIP into a separate verification profile and
checks it with Serpent 0.3.8's package manager. The smoke test runs the real
local ONNX model through the selection command and job handler, uses the real
Serpent guest API, and keeps tag writes in memory. It never writes the source
image or the user's library. Add `--entry <installed/entry/main.js>` to test an
installed package, and `--report <report.json>` to save its results.

## Translation backend

The built-in backend combines **85,810 upstream entries** (66,077 canonical
Danbooru general/character tags plus 19,733 unambiguous English aliases) with a
[reviewed 251-entry model-vocabulary supplement](data/tags-zh-CN.additions.json),
for **86,061 entries** in total. The supplement has 226 values containing Chinese
characters and 25 preserved names/symbols; this is key coverage, not a claim that
every label has a confirmed Chinese name. Lookup
accepts model underscores, spaces, case differences and escaped parentheses.
Unmapped names keep their exact original spelling. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the MIT-licensed dictionary's
source and attribution.

An optional local backend can replace the Chinese translator through
`__internals.setTranslatorBackend({ translate(tags) })`. Return one nonempty
string of at most 255 characters for each input tag, in the same order. The
backend is called only for Chinese output; `setTranslatorBackend(null)` restores
the included dictionary. Invalid results or translation errors fail the image's
tagging operation before writing tags.

### 继续补充缺失翻译

模型输出以它配套的 CSV 为准，上游中文词典不一定收录旧名称或所有别名。
不要只靠词典总条数判断覆盖率；先检查实际模型的完整词表：

```sh
node scripts/check-translation-coverage.cjs --model-dir "<models>" --report dist/translation-coverage.json --strict
```

报告列出每个模型未收录的全部通用/角色标签，忽略不写回的评级标签。
`--strict` 在存在未收录键时返回失败。原样保留的条目列入 `unchanged`，
已收录但不含汉字的品牌、型号、专名或符号等列入 `withoutHan`，其中也包括仅调整
大小写或空格的名称；键覆盖率与含汉字比例分别统计，均不代表语义准确率。

1. 新增标签译文写入 [data/tags-zh-CN.additions.json](data/tags-zh-CN.additions.json)，
   例如 `"pink_footwear": "粉色鞋类"`、`"night_sky": "夜空"`。
2. 修正已收录标签的译文写入 [data/tags-zh-CN.overrides.json](data/tags-zh-CN.overrides.json)，
   并同步修改相关别名。两张表都使用小写下划线键及非空、最多 255 字符的译文。
3. 在源码项目中重新生成运行时词典，再测试、打包并在 Serpent 中安装新 ZIP：

```sh
node scripts/update-translations.cjs
node scripts/test-tagging.cjs
node build.js --zip
```

生成命令下载锁定版本的两份上游 CSV，仅维护时需要网络。已有该版本的
`general.csv` 和 `character.csv` 缓存时，可完全离线生成或核对：

```sh
node scripts/update-translations.cjs --source-dir "<cached-csv-directory>"
node scripts/update-translations.cjs --source-dir "<cached-csv-directory>" --check
```

导入会验证两份固定源 CSV 及许可证的 SHA-256、拒绝未知修正键及已存在的补充键，
并记录许可证哈希及两张本地表的哈希与条数。更新上游版本需同时修改 `REVISION`、
两份 CSV 的源哈希和 `LICENSE_SHA256`；若上游新收录了补充键，需复核该译文并从
补充表移除，必要时改放修正表。正常打标仍完全离线。
详见 [原词典审阅记录](data/TRANSLATION_REVIEW.md)及[模型补充审阅记录](data/MODEL_TRANSLATION_REVIEW.md)。

## Permissions disclosure

This plugin runs in unrestricted mode (Node.js): it reads asset content via the
Gateway, reads model files from the configured directory with direct `fs`,
and creates/assigns tags in the library. Each open library owns its settings,
job queue and model session.
