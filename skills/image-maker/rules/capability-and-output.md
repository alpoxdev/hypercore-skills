# Capability, Delivery, and Stop Rules

Use observed runtime evidence, not product names. A request does not prove a tool, permission, source, or safe destination exists.

## Typed inputs and policy origin

The resolver accepts only the final typed model:

- `requested_mode`: `generate`, `edit`, or `prompt_only`
- `material_context`: `complete` or `missing`
- `missing_fact`: `none`, `subject`, `reference`, `rendered_text`, or `preserve_change`
- `edit_source`: `supplied`, `absent`, or `not_applicable`
- `authorization`: `authorized`, `denied`, or `unknown`
- `fallback_policy`: `explicitly_allowed`, `explicitly_rejected`, or `unspecified`
- `image_generation`, `image_editing`, `retrieve_persist`, `inspect`, and `file_write`: `available`, `unavailable`, or `unknown`
- `inspection_requirement`: `required` or `optional`
- a valid single-component `topic`; `compiled_brief` may be empty only while material is missing

Reject unrecognized fields, missing required fields, invalid values, or incoherent mode/source/fact combinations with `E_CAPABILITY_SCHEMA`. `material_context=missing` exactly when `missing_fact` is not `none`. `unknown` is conservative evidence, never permission or availability. `edit_source=not_applicable` is required outside `edit`; an edit uses `supplied` or `absent`.

Normal image requests set `fallback_policy=explicitly_allowed`. An explicit refusal to save a prompt sets `explicitly_rejected` and overrides that default. A direct resolver caller without package-policy evidence uses `unspecified`; do not infer consent.

## Resolver order

Apply these rules in order and stop at the first applicable result:

1. Malformed typed input: `blocked`.
2. Before compiling, when `material_context=missing`, ask exactly one Korean question, return `awaiting_input`, and do not compile, invoke, or write: `subject` → “이미지의 주제를 알려 주세요.”; `reference` → “참조 이미지 또는 자료를 제공해 주세요.”; `rendered_text` → “이미지에 정확히 넣을 문구를 알려 주세요.”; `preserve_change` → “유지할 요소와 변경할 요소를 알려 주세요.” Do not combine questions or ask for optional style details.
3. Denied authorization is `blocked` with `E_AUTHORIZATION`. Unknown authorization asks exactly “제공한 원본을 사용하고 편집할 권한이 있나요?” only for a supplied edit source, returning `awaiting_input` without compiling, invoking, or writing; every other unknown-authorization case is `blocked` with `E_AUTHORIZATION`.
4. `file_write` other than `available`: `blocked` with `E_FILE_WRITE_UNAVAILABLE`. Do not claim an artifact was saved. A route that reaches persistence without descriptor-relative secure-write evidence blocks rather than reporting saved output.
5. An explicit `prompt_only` request selects a pending prompt route.
6. `generate` may invoke only when image generation and retrieval/persistence are available and inspection is available or optional.
7. `edit` may invoke only when image editing and retrieval/persistence are available and inspection is available or optional. Generation never substitutes for editing.
8. When the relevant image capability, retrieval/persistence, or required inspection is unavailable or unknown, reapply `fallback_policy`: `explicitly_allowed` selects a pending prompt route; `explicitly_rejected` is `blocked`; `unspecified` asks once, returns `awaiting_input`, and stops without invoking or writing.

The sole question for the final `unspecified` branch is: “이미지 생성 또는 편집을 완료할 수 없습니다. 이미지 대신 프롬프트 전용 파일을 저장할까요?” Normal package execution does not ask it.

## Attempts, terminals, and evidence

An image action is `invoke → retrieve/persist → inspect`; invocation is not delivery. Use one immutable compiled brief. Record an ordered attempt history: each entry has its attempt number and either its objective invocation failure or successful returned-result evidence. Retry once only after the first objective invocation failure: two attempts total. Never reinvoke after retrieval or persistence failure.

Use only these terminals:

- `generated_verified`: invocation, descriptor-relative persisted regular image, and passed required inspection evidence exist. Include the persisted relative path, content digest, and inspection record; only then claim verified visual, text, constraint, or series results.
- `generated_caveated`: invocation and persisted-image evidence exist; inspection is optional and unavailable or unknown. Include the persisted relative path and content digest, and inspection status; state that visual, rendered-text, exact-constraint, and series results are unverified. An actual inspection failure is `blocked`.
- `prompt_saved`: an explicit prompt route or allowed fallback has an exclusive, regular, non-empty contained UTF-8 `.txt` file. Include its relative path and content digest; claim only that a prompt-only file was saved.
- `awaiting_input`: exactly one stated Korean question or reason, with no compilation, invocation, or write.
- `blocked`: record the reason and ordered truthful attempt history; claim neither image nor prompt was saved.

Write reports in Korean by default. Every report states its terminal, exact observed invocation count, ordered attempt history, and terminal evidence fields. Bilingual reports retain the same terminal, evidence, attempt history, and claim limits.

## Safe output and source handling

All writes are beneath `.hypercore/image-maker/<topic>/`. Normalize topic to NFC and trim it. Reject with `E_TOPIC_UNSAFE` rather than rewriting it when it is empty, `.` or `..`, contains a separator or control character, or is not exactly one path component. Korean topics remain their exact normalized component.

Race-safe creation requires an observed descriptor-relative secure-write capability: resolve and open each directory relative to trusted descriptors without following links, create the final file exclusively relative to the verified parent, and verify the opened descriptor is a non-empty regular file before retaining its relative path and digest. `lstat`, `realpath`, pathname containment, or exclusive pathname creation alone do not establish this guarantee. When that capability is unavailable or unknown, block; the package cannot guarantee descriptor safety by itself. On ordinary `EEXIST`, retry with `-2`, `-3`, and later suffixes before the extension (for example, `image-2.png`), never after it.

No route may report `prompt_saved` from a compiled string or proposed path, or generated delivery without persisted-image evidence. An edit writes a new target and never opens its source for writing; preserve the supplied source unchanged.
