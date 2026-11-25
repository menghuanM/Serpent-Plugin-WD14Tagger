# Third-party notices

## Chinese tag dictionary

The bundled [Chinese tag dictionary](data/tags-zh-CN.json) is derived from the
`general` and `character` datasets in
[amenorira/danbooru-tags-data-zh](https://github.com/amenorira/danbooru-tags-data-zh),
at commit [`8e73f3b1c15b30f873c11a8c65d2d8264cdf0224`](https://github.com/amenorira/danbooru-tags-data-zh/tree/8e73f3b1c15b30f873c11a8c65d2d8264cdf0224).

Copyright (c) 2026 amenorira. Distributed under the MIT License. The complete
upstream license is included in
[data/LICENSE.danbooru-tags-data-zh.txt](data/LICENSE.danbooru-tags-data-zh.txt).

The import retains upstream tag names, normalizes lookup keys, and includes
unambiguous ASCII aliases. Simplified Chinese translations use the upstream
values with [reviewed local corrections](data/tags-zh-CN.overrides.json) applied
after alias expansion. A separate [model-vocabulary supplement](data/tags-zh-CN.additions.json)
adds reviewed translations for model labels absent from the pinned upstream data;
these additions are local work and are not attributed to the upstream dictionary.
Notes, usage counts and non-ASCII aliases are omitted
from the runtime dictionary. Some upstream names deliberately retain their
original spelling when no established Chinese translation exists.
[Source metadata](data/source.json) records input file SHA-256 hashes, both local
translation files' SHA-256 hashes and entry counts.

The dictionary is distributed with the plugin. Normal tagging and translation
never request this repository or any other translation service.
