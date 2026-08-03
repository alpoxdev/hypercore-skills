---
name: expo-architecture
description: "Use this skill when creating, reviewing, or refactoring scalable Android and iOS app architecture with React Native, Expo, Expo Router, and TypeScript, including project structure, routing, feature boundaries, native configuration, data/state, platform code, and validation. Do not use for bare React Native projects without Expo, web-only React apps, or docs-only summaries."
compatibility: Requires an Expo project or an explicit request to create one; current API claims may require official Expo and React Native documentation plus local package inspection.
---

@architecture-rules.md
@rules/project-structure.md
@rules/routing-and-navigation.md
@rules/data-state-and-boundaries.md
@rules/native-platform-and-security.md
@rules/testing-and-validation.md
@references/official/expo-react-native-2026-08-03.md

# Expo Architecture

> Create and enforce scalable React Native + Expo + TypeScript architecture for Android and iOS while separating official framework behavior from Hypercore conventions.

<output_language>

Default user-facing deliverables, reports, plans, handoff notes, and validation notes to Korean. Preserve code identifiers, commands, paths, schema keys, package names, API names, and source excerpts in their required language.

</output_language>

<purpose>

- Bootstrap or refactor Expo applications around Expo Router, strict TypeScript, feature boundaries, and explicit native-platform seams.
- Keep route files thin and organize growing product code by domain/feature rather than by one global technical bucket.
- Protect secrets, permissions, native configuration, storage, and Android/iOS divergence with explicit gates.
- Validate architecture against the installed Expo SDK and project evidence before applying current official guidance.

</purpose>

<routing_rule>

Use this skill for architecture setup, implementation, review, or remediation in Expo-managed or Expo prebuild projects targeting Android and iOS.

Do not use it for bare React Native without Expo, generic web React, a single visual component with no architecture impact, deployment-only work, or documentation-only summaries. For brownfield apps, preserve working project conventions unless the user requests migration or a safety/correctness issue requires change.

</routing_rule>

<instruction_contract>

| Field | Contract |
|---|---|
| Intent | Produce a scalable, testable Expo architecture whose route, feature, data, native, and platform boundaries remain understandable as the app grows. |
| Trigger | Expo/React Native/TypeScript work involving app setup, folder structure, Expo Router, state/data flow, native configuration, platform divergence, testing, or architecture review. |
| Scope | Touched app configuration, TypeScript source, route tree, feature/shared modules, tests, and architecture validation notes; broad native regeneration and dependency replacement require explicit scope. |
| Authority | User and project instructions outrank this skill. Installed package/config evidence controls project behavior. Official Expo/React Native docs control API facts; Hypercore conventions are recommendations unless adopted by the project. |
| Evidence | Inspect `package.json`, app config, router entry, TypeScript/Metro/Babel config, native directories, existing source/tests, and lockfile first. Use dated official references when version drift matters. |
| Tools | Use capability-based inspect/read/search/edit/execute. Validate commands and paths. Gate network installs, credentials, EAS operations, native clean regeneration, signing, publication, deployment, and production effects. |
| Loop | Use a bounded verify-repair loop: run relevant checks, repair only observed failures, and stop after two repair passes. Keep changes only when critical type, route, native-config, and safety guards pass. |
| Output | A project-local architecture implementation or review, plus a concise Korean report of decisions, changed files, checks, source/version caveats, and residual risks. |
| Verification | Run project-defined format/lint/type/test checks plus Expo diagnostics and platform checks relevant to touched surfaces; inspect resolved config and route behavior when changed. |
| Stop condition | Finish when project mode and SDK are identified, applicable critical gates pass, changes are verified, and residual risk is recorded; block on missing authority, unsafe native effects, unresolved package incompatibility, or unavailable required verification. |

</instruction_contract>

<activation_examples>

Positive:
- "React Native + Expo + TypeScript로 iOS/Android 앱 구조를 확장 가능하게 세팅해줘."
- "Expo Router 앱의 routes, features, API, state 경계를 리팩터링해줘."
- "Audit this Expo app for scalable architecture and platform-boundary violations."
- "EAS 환경과 iOS/Android 설정까지 고려해서 Expo 프로젝트 구조를 잡아줘."

Negative:
- "Bare React Native CLI 앱의 native module architecture를 설계해줘."
- "이 React 웹 컴포넌트의 CSS만 고쳐줘."
- "Expo 문서를 요약만 해줘."

Boundary:
- "Expo 로그인 화면의 문구 하나만 바꿔줘." Apply only a quick boundary check; do not force architecture churn.
- "Expo 앱을 스토어에 배포해줘." Use this skill only for architecture/config review; deployment authorization and execution belong to the deployment workflow.

</activation_examples>

<project_validation>

Before enforcement, identify:
1. Expo SDK, React Native, Expo Router, TypeScript, package manager, and workspace mode from local files.
2. Managed/CNG, committed `ios/` or `android/`, development build, or Expo Go constraints.
3. Existing route root (`src/app` or `app`), aliases, generated files, tests, and project commands.
4. Whether requested changes need package installation, `prebuild`, EAS, credentials, signing, or store-side effects.

If the target is not Expo and the user did not request creating an Expo app, stop routing through this skill.

</project_validation>

<support_file_read_order>

1. Read `architecture-rules.md` for rule classes and blocking gates.
2. Read only affected topics:
   - `rules/project-structure.md` for scalable folders, ownership, imports, and migration.
   - `rules/routing-and-navigation.md` for Expo Router layouts, route groups, params, and route thinness.
   - `rules/data-state-and-boundaries.md` for server state, client state, DTOs, persistence, and dependency direction.
   - `rules/native-platform-and-security.md` for app config, permissions, secrets, storage, native code, and platform files.
   - `rules/testing-and-validation.md` before implementation completion.
3. Read `references/official/expo-react-native-2026-08-03.md` only when current SDK/API behavior affects a decision.

</support_file_read_order>

<workflow>

| Phase | Task | Output |
|---|---|---|
| 0 | Confirm Expo mode, SDK, platforms, request scope, and side-effect gates | Scope decision |
| 1 | Inventory routes, features, shared modules, state/data, native config, tests, and dependency direction | Architecture map |
| 2 | Classify findings as Official, Safety, or Hypercore convention | Prioritized plan |
| 3 | Define target boundaries and the smallest migration slice; preserve user work | Change set |
| 4 | Implement safe reversible changes and update affected callsites/tests/config | Integrated architecture |
| 5 | Run focused then project-level checks and inspect resolved behavior | Verification evidence |
| 6 | Report decisions, versions/sources, results, and residual risks in Korean | Handoff |

</workflow>

<required>

- Prefer `src/app` for routes in current Expo Router projects while keeping non-route code outside it.
- Organize growth by `src/features/<domain>` and narrowly scoped `src/shared/*`; avoid dumping domain behavior into global `components`, `hooks`, `utils`, or `services` buckets.
- Keep route files composition-oriented; business rules and reusable data access belong to feature/application layers.
- Keep TypeScript strict, validate untrusted runtime data at boundaries, and avoid `any` and unchecked casts.
- Separate server state, client UI state, form state, and persisted device state by ownership and lifecycle.
- Treat `EXPO_PUBLIC_*` as public; store small secrets only in secure platform-backed storage and never bundle server secrets.
- Make platform divergence explicit with `.ios.ts(x)` / `.android.ts(x)` or a small adapter when behavior truly differs.
- Use the installed SDK and `expo install` compatibility rather than guessing package versions.

</required>

<forbidden>

- Inventing project commands, packages, native capabilities, API contracts, or environment variables.
- A universal folder template applied without inspecting project scale and existing conventions.
- Domain features importing route files, UI importing infrastructure internals, or broad barrel files that create cycles.
- Secrets in source, app config `extra`, `EXPO_PUBLIC_*`, logs, AsyncStorage, or client bundles.
- Running package installs, `prebuild --clean`, EAS builds/updates/submits, signing, or store publication without explicit authorization.
- Treating Expo Go success as proof that development/standalone builds, permissions, config plugins, or native modules work.
- Unbounded refactoring or migration without a verified incremental boundary.

</forbidden>

<validation>

- [ ] Expo mode, SDK, React Native, Router, package manager, platforms, and native-directory ownership are identified.
- [ ] At least 3 positive, 2 negative, and 1 boundary trigger examples remain present.
- [ ] Route files are thin and non-route modules do not live under `app`/`src/app`.
- [ ] Dependency direction and feature/shared ownership are explicit; cycles and unsafe barrels are absent.
- [ ] Runtime inputs, environment, persistence, permissions, and secure storage follow boundary rules.
- [ ] Android/iOS changes are checked independently where behavior or config differs.
- [ ] Relevant typecheck, lint, tests, Expo diagnostics, resolved config, and build checks ran or are explicitly reported as unavailable.
- [ ] English/Korean skill files retain equivalent trigger, authority, workflow, safety, and completion semantics.
- [ ] Current official claims cite the dated reference; source dates are not in the future.
- [ ] Completion records `Claim -> Risk -> Evidence -> Verification -> Result -> Caveat` and decides ship, iterate, caveated ship, or block.

</validation>
