# Changelog

## [1.3.0](https://github.com/tbui17/opencode-openrouter-sync/compare/v1.2.0...v1.3.0) (2026-03-16)


### Features

* remove stale models not present in API response ([#6](https://github.com/tbui17/opencode-openrouter-sync/issues/6)) ([45e662e](https://github.com/tbui17/opencode-openrouter-sync/commit/45e662e7260b5cb3676963f8ed6f8b7d2fcc321c))
* return structured errors from fetchModels and fix release publish ([#8](https://github.com/tbui17/opencode-openrouter-sync/issues/8)) ([39144fc](https://github.com/tbui17/opencode-openrouter-sync/commit/39144fc3ecfd0d31d4c5fc18d26b6ae713820dcc))

## [1.2.0](https://github.com/tbui17/opencode-openrouter-sync/compare/v1.1.0...v1.2.0) (2026-03-16)


### Features

* add JSONC support and update model schema to match OpenCode ([#4](https://github.com/tbui17/opencode-openrouter-sync/issues/4)) ([c072f63](https://github.com/tbui17/opencode-openrouter-sync/commit/c072f63229532e5978ee446ac4237d2291c72083))

## [1.1.0](https://github.com/tbui17/opencode-openrouter-sync/compare/v1.0.0...v1.1.0) (2026-03-16)


### Features

* add changelog section to README ([0dd5e3f](https://github.com/tbui17/opencode-openrouter-sync/commit/0dd5e3fe72496e73c35d1925c2d9156b0ece98e7))
* switch to npm OIDC trusted publishing ([33b5edf](https://github.com/tbui17/opencode-openrouter-sync/commit/33b5edfb608d727b2edb62fe29fb88012d1092e0))


### Bug Fixes

* add publishConfig.access: public for npm provenance ([771384f](https://github.com/tbui17/opencode-openrouter-sync/commit/771384f3cc411456009d925e7d35301a1031eab7))
* add repository field for provenance verification ([165a4e1](https://github.com/tbui17/opencode-openrouter-sync/commit/165a4e1128093acd778e2200c4f966727b419522))
* add workflow_dispatch to publish.yml ([7d3e681](https://github.com/tbui17/opencode-openrouter-sync/commit/7d3e6817d0e96d6138d8df83ef56a7d516c6947b))
* remove provenance from publish workflow ([4c41e94](https://github.com/tbui17/opencode-openrouter-sync/commit/4c41e941692fb64d837b49b1d32a5bbb50d3c47f))
* remove provenance from publishConfig for local publish compatibility ([ac0a0ef](https://github.com/tbui17/opencode-openrouter-sync/commit/ac0a0efd1133c66fa757bbbabbbd8e6a598d92bb))
* use tsc-only prepublishOnly for Node.js CI compatibility ([8eb6d72](https://github.com/tbui17/opencode-openrouter-sync/commit/8eb6d72999b0dba35e48b2bd1e58c0329f3ee801))

## 1.0.0 (2026-03-16)


### Features

* add new model fields from OpenRouter API ([865aa76](https://github.com/tbui17/opencode-openrouter-sync/commit/865aa76ddb144f4fa7654ea680bcc186d84ffe35))
* add OpenRouter model sync plugin ([5d2e9c7](https://github.com/tbui17/opencode-openrouter-sync/commit/5d2e9c75123f92cbf33c7176071e530c02a92e72))
* restructure exports for npm distribution ([7545cc8](https://github.com/tbui17/opencode-openrouter-sync/commit/7545cc87a0383d078b7b8fc1b408dfaaa5862d18))


### Bug Fixes

* isolate tests from real user config ([3679f50](https://github.com/tbui17/opencode-openrouter-sync/commit/3679f50d3a27d69a29a34aef719e8b741effc91a))
