# Chat API Request Flow

This document describes how Scenara constructs and sends OpenAI-compatible API requests for every operation that calls an AI model: regular chat messages, out-of-character (OOC) messages, auto-titling, and summarization. The flow is provider-agnostic — all supported providers (Groq, OpenRouter, AI-Horde, LM Studio) use the same payload construction and a shared `sendChatCompletion` fetch function.

---

## 1. Overview: The Four Request Kinds

| Kind              | Trigger                                   | Builder Function                     | Profile Key                           | Fallback       |
| ----------------- | ----------------------------------------- | ------------------------------------ | ------------------------------------- | -------------- |
| **chat**          | User sends a message, regeneration        | `buildMessagesPayload()`             | `requestKind.chat.profileId`          | —              |
| **ooc**           | User sends with OOC toggle on             | `buildOOCMessagesPayload()`          | `requestKind.ooc.profileId`           | → chat profile |
| **autoTitle**     | After chat response, threshold met        | `triggerAutoTitle()` (builds inline) | `requestKind.autoTitle.profileId`     | → chat profile |
| **summarization** | After chat response, memory threshold met | `buildSummarizationPayload()`        | `requestKind.summarization.profileId` | → chat profile |

All four use the same transport function: `sendChatCompletion()` in `src/services/chatApi.js`.

---

## 2. Connection Profile Resolution

Every request kind resolves to a **connection profile** — a Dexie-backed object holding `{ providerId, key, model, params }`.

### Resolution chain (`getEffectiveProfileFor` in `src/services/connectionProfiles.js:138-167`)

```
getEffectiveProfileFor(kind)
  → read setting "requestKind.{kind}.profileId"
  → if null and kind !== 'chat', read "requestKind.chat.profileId"
  → if null, return null (request is blocked)
  → load profile from db.connectionProfiles
  → resolve API key from profile.keyId → db.settings "api.{providerId}.keys"
```

- Profiles are reusable across request kinds. A single profile can serve chat, OOC, auto-title, and summarization if all fall through to chat.
- If no profile is configured for chat (`requestKind.chat.profileId` is null), the entire chat UI shows a "no profile" blocking state (`ChatView.jsx:144`).

### Request Profiles in Settings

Defined in `src/services/settings.js:555-593`:

```
requestKind.chat.profileId       → default: null
requestKind.ooc.profileId        → default: null (falls back to chat)
requestKind.autoTitle.profileId  → default: null (falls back to chat)
requestKind.summarization.profileId → default: null (falls back to chat)
requestKind.director.profileId   → default: null (falls back to chat)
```

### Resolved Profile Shape

```js
{
  providerId: string,      // 'groq' | 'openrouter' | 'ai-horde' | 'lm-studio'
  key: string | null,       // resolved API key
  model: string | null,
  params: {                 // merged from provider definition + profile overrides
    max_completion_tokens?: number,
    temperature?: number,
    top_p?: number,
    frequency_penalty?: number,
    presence_penalty?: number,
    stream?: boolean,
    stop?: string[],
  }
}
```

Deprecated params (e.g. `max_tokens`) are filtered out by `getActiveParams()` in `chatApi.js:111-119`.

### Zero-valued params

In `sendChatCompletion` (lines 284-286), zero-valued params are deleted from the body:

- `top_p: 0` → deleted
- `frequency_penalty: 0` → deleted
- `presence_penalty: 0` → deleted

This avoids sending meaningless zero defaults to the API.

---

## 3. Regular Chat Payload (`buildMessagesPayload`)

**File**: `src/services/chatApi.js:34-127`  
**Called from**: `ChatView.doChatRequest()` and `ChatView.handleRegenerate()`

### Input Parameters

```js
{
  character,         // db.characters row
  chatPersona,       // persona from thread.personaId (the "default" persona for this thread)
  currentPersona,    // persona selected in ChatInputArea for this specific message
  messages,          // filtered message array (post getMessagesForApiRequest)
  isFirstMessage,    // boolean — true if messages array was empty before this send
  settings,          // object of resolved global settings (see below)
  writingInstruction, // resolved WritingInstruction object or null
  memoryText,        // thread.memory (summary text from summarization)
  memoryHeader,      // "prompting.apiRequestSectionHeaders.memories" setting
}
```

### Settings Resolved by Caller

In `ChatView.doChatRequest()` (lines 546-558):

```js
{
  firstMessageRole,               // 'system' | 'assistant' | 'user'
  firstMessagePrompt,             // text
  continueRole,                   // 'system' | 'assistant' | 'user'
  continuePrompt,                 // text
  personaInjectionTemplate,       // text
  writingInjectionTiming,         // 'always' | 'never'
  writingPlacement,               // 'endOfSystemPrompt' | 'endOfMessages'
  writingMessageRole,             // 'system' | 'assistant' | 'user'
  personaInjectionTiming,         // 'always' | 'never'
  personaInjectionPlacement,      // 'endOfSystemPrompt' | 'endOfMessages'
  personaInjectionMessageRole,    // 'system' | 'assistant' | 'user'
}
```

Character-level settings (on `character`) take precedence over the global settings object above:

| Character field                         | Fallback Setting                   |
| --------------------------------------- | ---------------------------------- |
| `character.writingInjectionTiming`      | `prompting.writingInjectionTiming` |
| `character.writingPlacement`            | `prompting.writingPlacement`       |
| `character.writingMessageRole`          | `prompting.writingMessageRole`     |
| `character.personaInjectionTiming`      | `prompting.personaInjectionTiming` |
| `character.personaInjectionPlacement`   | `personaInjectionPlacement`        |
| `character.personaInjectionMessageRole` | `personaInjectionMessageRole`      |

### Payload Construction Steps

#### Step 1: Variable Resolution

```js
charName        = character.name
personaName     = chatPersona.name          (from thread.personaId)
currentPersonaName = currentPersona?.name || personaName
```

Three variable replacement functions are created:

- `replaceVarsIn(text)` — replaces `{{char}}`, `{{user}}`, `{{name}}`
- `replacePersonaTemplate(text, { currentPersona, chatPersona, defaultPersona })` — same as above, plus replaces `{{description}}` (currentPersona), `{{description_chat}}` (chatPersona), `{{description_default}}` (default persona)

The `{{user}}` variable uses `chatPersona` (the thread's default persona), not `currentPersona` (the message-specific persona). The `{{name}}` variable prefers `currentPersona` but falls back to `chatPersona`.

#### Step 2: Build System Message Parts

An array `systemParts` is assembled (for elements configured with `endOfSystemPrompt` placement):

1. **Character Prompt** (`character.prompt`, required): pushed first after `replaceVarsIn()`
2. **Extra Prompt** (`character.extraPrompt`): pushed only if `isFirstMessage === true` and text is non-empty
3. **Writing Instruction** (when `placement: 'endOfSystemPrompt'`): pushed if ALL of:
   - `writingInstruction?.content` exists
   - resolved `writingTiming === 'always'`
   - resolved `writingPlacement === 'endOfSystemPrompt'`
4. **Persona Injection** (when `placement: 'endOfSystemPrompt'`): pushed if ALL of:
   - resolved `personaTiming !== 'never'`
   - `personaTemplate` (from settings) is non-empty
   - resolved `personaPlacement === 'endOfSystemPrompt'`

The parts are joined with `\n\n` (double newline):

```js
result = [{ role: 'system', content: systemParts.join('\n\n') }]
```

#### Step 3: First Message vs. Message History

**If `isFirstMessage === true`:**

- The `firstMessagePrompt` setting text (with variable replacement) is added as a second entry:
  ```js
  result.push({ role: firstMessageRole, content: firstMessagePrompt })
  ```
- `firstMessageRole` can be `'system'`, `'assistant'`, or `'user'` (default: `'user'`)

**If `isFirstMessage === false`:**

- All messages from the filtered `messages` array are appended with their original `role`:
  ```js
  for (const msg of messages) {
    result.push({ role: msg.role, content: replaceVarsIn(msg.content) })
  }
  ```
- **Continue Prompt**: If the last message in `messages` has `role !== 'user'` (i.e., the conversation ended with an assistant message) and `continuePrompt` is non-empty:
  ```js
  result.push({ role: continueRole, content: continuePrompt })
  ```
  - `continueRole` can be `'system'`, `'assistant'`, or `'user'` (default: `'user'`)

#### Step 4: Memory Appending

If `memoryText` is non-empty, `appendMemoryToPayload()` is called. This function:

1. Finds the first `{ role: 'system' }` entry in the payload
2. Appends the memory section to its content:
   ```
   {systemContent}\n\n{memoryHeader}\n\n{memoryText}
   ```
   (or just `\n\n{memoryText}` if no memoryHeader)

#### Step 5: endOfMessages Placement

After the main message array is built (and before memory appending), elements configured with `placement: 'endOfMessages'` are injected as **new entries at the end**:

1. **Writing Instruction** (when `placement: 'endOfMessages'`):

   ```js
   result.push({ role: writingMessageRole, content: writingInstruction })
   ```

   Where `writingMessageRole` comes from `character.writingMessageRole ?? settings.writingMessageRole ?? 'system'`.

2. **Persona Injection** (when `placement: 'endOfMessages'`):
   ```js
   result.push({ role: personaInjectionMessageRole, content: personaTemplate })
   ```
   Where `personaInjectionMessageRole` comes from `character.personaInjectionMessageRole ?? settings.personaInjectionMessageRole ?? 'system'`.

### Final Payload Shape (non-first-message example, endOfMessages placement)

```json
[
  { "role": "system", "content": "{characterPrompt}\n\n{memoryHeader}\n\n{memoryText}" },
  { "role": "user", "content": "..." },
  { "role": "assistant", "content": "..." },
  { "role": "user", "content": "..." },
  { "role": "user", "content": "(continue prompt)" },
  { "role": "assistant", "content": "(writing instruction with endOfMessages)" },
  { "role": "system", "content": "(persona injection with endOfMessages)" }
]
```

---

## 4. OOC Message Payload (`buildOOCMessagesPayload`)

**File**: `src/services/chatApi.js:188-274`  
**Called from**: `ChatView.doChatRequest()` (line 517) and `ChatView.handleRegenerate()` (line 883)

### Input Parameters

```js
{
  character,
  chatPersona,
  currentPersona,
  messages,         // apiMessages.slice(0, -1) — excludes the last user msg
  oocSettings,      // object of resolved settings (see below)
  userMessage,      // the last user message content
  personaMap,       // { [personaId]: persona } for resolving personae in transcript
  memoryText,
  memoryHeader,
}
```

### Settings Resolved by Caller

In `ChatView.doChatRequest()` (lines 497-538):

```js
{
  oocSystemInstructions,      // 'prompting.oocSystem'
  oocUserInstructions,        // 'prompting.oocUser'
  characterPromptHeader,      // 'prompting.apiRequestSectionHeaders.characterPrompt'
  messagesHeader,             // 'prompting.apiRequestSectionHeaders.messages'
  systemRolePrefix,           // 'prompting.systemRolePrefix'
  assistantRolePrefix,        // 'prompting.assistantRolePrefix'
  userRolePrefix,             // 'prompting.userRolePrefix'
  userRolePrefixWithPersona,  // 'prompting.userRolePrefixWithPersona'
  systemRolePrefixOoc,        // 'prompting.systemRolePrefixOoc'
  assistantRolePrefixOoc,     // 'prompting.assistantRolePrefixOoc'
  userRolePrefixOoc,          // 'prompting.userRolePrefixOoc'
}
```

### Payload Construction Steps

#### Step 1: System Message Assembly

The system message is built from these parts (joined with `\n\n`):

1. **OOC System Instructions** (`oocSystemInstructions`): pushed first if non-empty
2. **Character Prompt**: pushed if non-empty. If `characterPromptHeader` exists, it's prepended: `"{header}\n\n{prompt}"`; otherwise the raw prompt is used.

#### Step 2: Transcript of Prior Messages

If `messages.length > 0`:

1. A plain-text transcript is built via `buildTranscript()` (see §8) using the OOC role prefixes
2. If `messagesHeader` exists, it's prepended: `"{header}\n\n{transcript}"`; otherwise the raw transcript is used
3. The transcript (with or without header) is appended to the system content

#### Step 3: User Message

```js
if (userMessage) {
  if (oocUserInstructions.includes('{content}')) {
    result.push({
      role: 'user',
      content: replaceVarsIn(oocUserInstructions).replace('{content}', userMessage),
    })
  } else {
    result.push({
      role: 'user',
      content: replaceVarsIn(oocUserInstructions) + '\n\n' + userMessage,
    })
  }
}
```

If `oocUserInstructions` is empty, the raw `userMessage` is used as the user entry.

#### Step 4: Memory Appending

Same as regular chat — `appendMemoryToPayload()` appends memory to the system entry.

### Character-Level Overrides for OOC

Two character fields affect OOC transcript behavior:

| Character field     | Effect                                                       | Default (if unset)             |
| ------------------- | ------------------------------------------------------------ | ------------------------------ |
| `includeOOC`        | If `false`, OOC messages are excluded from the transcript    | `true` (via `!== false` check) |
| `userPersonaPrefix` | If `false`, user persona prefixes are not used in transcript | `true` (via `!== false` check) |

These are also used by `getMessagesForApiRequest` and `buildTranscript` respectively.

### Final Payload Shape

```json
[
  {
    "role": "system",
    "content": "{oocSystemInstructions}\n\n{characterPromptHeader}\n\n{characterPrompt}\n\n{messagesHeader}\n\n{transcript}\n\n{memory}"
  },
  { "role": "user", "content": "{oocUserInstructions with {content} replaced}" }
]
```

---

## 5. Auto-Title Payload (`triggerAutoTitle`)

**File**: `src/services/autoTitle.js:26-97`  
**Called from**: `ChatView.handleSend()` (line 752)

### Trigger Conditions (`shouldAutoTitle`)

```js
character.autoTitle === true // must be enabled per-character
thread.titleEdited !== true // user hasn't manually edited the title
thread.autoTitleGenerated !== true // hasn't been auto-titled already
getCountedMessageCount(messages, includeOOC) >= character.autoTitleThreshold // default: 3
```

The threshold defaults to `3` if not set on the character. OOC messages are excluded from the count if `character.includeOOC` is `false`.

### Payload Construction

```js
payload = [{ role: 'system', content: systemContent }]
```

1. **System Instruction Resolution** (priority order):
   - `character.autoTitleSystemInstructions` (per-character override)
   - `prompting.autoTitleSystem` (global setting, default: "You are a title generator for conversational AI.")
   - Hardcoded `DEFAULT_SYSTEM_INSTRUCTION` ("You are a title generator for conversational AI.")

2. The system content has `{{char}}`, `{{user}}`, `{{name}}` replaced, and `{{transcript}}` replaced with the full transcript of all messages (built via `buildTranscript()`).

3. **Memory Appending**: `appendMemoryToPayload()` appends `thread.memory` with `prompting.apiRequestSectionHeaders.memories` as header.

4. **User Message**: if `autoTitleUserInstructions` exists (per-character or global), it's added with `{{transcript}}` replaced. Otherwise, the raw transcript is used as the user message:

```js
if (userContent) {
  payload.push({ role: 'user', content: userContent }) // with {{transcript}} replaced
} else {
  payload.push({ role: 'user', content: transcript })
}
```

Global default for `prompting.autoTitleUser`:

> "Read the following thread and create one concise title (7 words max, in Title Case) capturing its core topic in plain-text (output the title ONLY, no markup, no formatting):\n\n{{transcript}}"

6. The response from the API is trimmed and stored as `thread.title`, and `thread.autoTitleGenerated` is set to `true`.

### Final Payload Shape

```json
[
  { "role": "system", "content": "{autoTitleSystemInstruction}\n\n{memory}" },
  { "role": "user", "content": "{autoTitleUserInstruction with transcript}" }
]
```

---

## 6. Summarization Payload (`buildSummarizationPayload`)

**File**: `src/services/summarization.js:72-129`  
**Called from**: `ChatView.handleSummarization()` → `triggerSummarization()` (line 675)

### Trigger Conditions (`shouldTriggerSummarization`)

```js
resolvedMemory = character.memory ?? globalDefault('defaultMemory') ?? 'messages'
```

Three modes:

| `memory` value         | Threshold Source                                                              | Trigger Condition                                   |
| ---------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `'never'`              | —                                                                             | Never triggers                                      |
| `'messages'` (default) | `character.messagesThreshold` ?? `defaultMessagesThreshold` ?? 7              | Unsummarized count >= threshold                     |
| `'contextWindow'`      | `character.contextWindowThreshold` ?? `defaultContextWindowThreshold` ?? 1024 | Token estimate of unsummarized content >= threshold |

### Message Filtering for Summarization

`getUnsummarizedMessages()` filters messages where `summarizedAt === null || summarizedAt === undefined`. If `includeOOC` is false, OOC messages are also excluded.

### Input Parameters

```js
{
  character,         // db.characters row
  thread,            // db.threads row (provides memory and personaId)
  messages,          // unsummarized messages only
  personaMap,        // persona lookup for transcript
  rolePrefixes,      // role prefix settings for transcript
  currentPersona,    // persona selected in ChatInputArea
  memoryText,        // thread.memory (existing summary, if any)
  memoryHeader,      // "prompting.apiRequestSectionHeaders.memories" setting
}
```

### Payload Construction

```js
payload = [{ role: 'system', content: systemContent }]
```

1. **System Instruction Resolution** (priority order):
   - `character.summarizationSystemInstructions`
   - `prompting.summarizationSystem` (global setting)
   - Hardcoded `DEFAULT_SYSTEM_INSTRUCTION` ("You are a memory generator for conversational AI.")

2. **Transcript Assembly**: A plain-text transcript of unsummarized messages is built via `buildTranscript()`, with `{{char}}`, `{{user}}`, `{{name}}` replaced.

3. **Memory Prepending**: If `memoryText` is non-empty, it is prepended to the transcript with the `memoryHeader` as a section title (if non-empty):

   ```
   {memoryHeader}

   {memoryText}

   {unsummarized transcript}
   ```

   This ensures the model can see prior memory context and de-duplicate / build upon it rather than starting fresh.

4. The system content has `{{char}}`, `{{user}}`, `{{name}}` replaced, and `{{transcript}}` replaced with the **memory-prepended transcript** from step 3.

5. **User Message**: if `summarizationUserInstructions` exists (per-character or global), it's added with `{{transcript}}` replaced. Otherwise, the raw transcript is used:

```js
if (userContent) {
  payload.push({ role: 'user', content: userContent }) // with {{transcript}} replaced
} else {
  payload.push({ role: 'user', content: transcript })
}
```

Global default for `prompting.summarizationUser`: `"Summarize this:"`

The global default for `prompting.summarizationSystem` is a detailed instruction set that reads all `# MESSAGES`, extracts key facts, eliminates duplicates from `# MEMORY`, and writes in concise style (details in `settings.js:626-631`).

### Post-Processing

After receiving the summary:

1. All unsummarized messages are marked with `summarizedAt: timestamp`
2. A `threadMemories` record is created with `{ threadId, content, payload, model, params }`
3. `thread.memory` is updated to the new summary text
4. `thread.lastSummarizationAt` is set

### Final Payload Shape

```json
[
  { "role": "system", "content": "{summarizationSystemInstruction with {{transcript}} replaced}" },
  { "role": "user", "content": "{summarizationUserInstruction with {{transcript}} replaced}" }
]
```

---

## 7. Message Filtering and Pre-Processing

### `getMessagesForApiRequest()`

**File**: `src/services/summarization.js:17-27`  
**Called from**: `ChatView.doChatRequest()` (line 486) and `ChatView.handleRegenerate()` (lines 876, 928)

Before any payload is built, the raw messages from Dexie are filtered:

```js
function getMessagesForApiRequest(messages, { includeOOC = true, keepMessages = 0 }) {
  // Step 1: Filter by OOC
  const eligible = messages.filter((m) => includeOOC || !m.isOOC)

  if (keepMessages <= 0) {
    // Step 2a: Remove all summarized messages
    return eligible.filter((m) => !m.summarizedAt)
  }

  // Step 2b: Keep up to keepMessages most recent messages even if summarized
  const cutoff = Math.max(0, eligible.length - keepMessages)
  return eligible.filter((m, index) => !m.summarizedAt || index >= cutoff)
}
```

Key behavior:

- `includeOOC` is determined by `character.includeOOC !== false` (defaults to `true`)
- `keepMessages` is determined by `character.messagesToKeep ?? globalSetting('defaultMessagesToKeep') ?? 0`
- When `keepMessages > 0`, the most recent N messages are always included regardless of summarization state
- When summarization is disabled (`memory === 'never'`), messages are never summarized, so all pass through
- The `keepMessages` setting is associated with `dependsOn: { key: 'defaultMemory', value: 'never', not: true }` — it's only shown when summarization is not 'never', but the code still uses it regardless

### OOC Filtering in Transcripts

`buildTranscript()` also has its own OOC filtering:

```js
for (const msg of messages) {
  if (msg.isOOC && !includeOOCOverride) continue
  // ... build line ...
}
```

This is separate from the pre-filtering in `getMessagesForApiRequest()`. For OOC payloads, the messages are explicitly sliced (`apiMessages.slice(0, -1)`) to separate the transcript history from the current user message.

---

## 8. Transcript Building (`buildTranscript`)

**File**: `src/services/chatApi.js:121-186`

This function creates a plain-text representation of messages, used in OOC, auto-title, and summarization payloads.

### Role Prefix Resolution

For OOC messages (`msg.isOOC === true`):

| Original role | Prefix setting           | Default               |
| ------------- | ------------------------ | --------------------- |
| `system`      | `systemRolePrefixOoc`    | `[SYSTEM in OOC]:`    |
| `assistant`   | `assistantRolePrefixOoc` | `[ASSISTANT in OOC]:` |
| `user`        | `userRolePrefixOoc`      | `[USER in OOC]:`      |

For regular messages:

| Original role | Prefix setting                                  | Default                                    |
| ------------- | ----------------------------------------------- | ------------------------------------------ |
| `system`      | `systemRolePrefix`                              | `[SYSTEM]:`                                |
| `assistant`   | `assistantRolePrefix`                           | `[ASSISTANT]:`                             |
| `user`        | `userRolePrefix` or `userRolePrefixWithPersona` | `[USER]:` or `[USER as {{persona_name}}]:` |

The user role prefix has two modes:

- If `userPersonaPrefixOverride` is `true` and the message has a `personaId`, the persona's name is resolved from `personaMap` and the `userRolePrefixWithPersona` template is used (with `{{name}}` and `{{persona_name}}` replaced)
- Otherwise, the simple `userRolePrefix` is used

### Output Format

Lines joined with `\n\n`:

```
{prefix} {content}\n\n{prefix} {content}\n\n...
```

Each line's prefix gets a trailing space added if it doesn't already end with one.

### Character Overrides Affecting Transcript

- `character.includeOOC`: If `false`, OOC messages are excluded (checked as `includeOOCOverride`)
- `character.userPersonaPrefix`: If `false`, persona names are not used in user prefixes (checked as `userPersonaPrefixOverride`)

---

## 9. Variable Substitution

**File**: `src/services/chatApi.js:13-19`

```js
function replaceVars(text, { charName, personaName, currentPersonaName }) {
  return text
    .replace(/{{char}}/g, charName || '')
    .replace(/{{user}}/g, personaName || '')
    .replace(/{{name}}/g, currentPersonaName || personaName || '')
}
```

| Variable   | Source                                       | Resolves To                                                                                |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `{{char}}` | `character.name`                             | Character name                                                                             |
| `{{user}}` | `chatPersona.name` (from `thread.personaId`) | The thread's default persona name                                                          |
| `{{name}}` | `currentPersona?.name ?? chatPersona.name`   | The message-specific persona name (from ChatInputArea), falls back to the thread's default |

In `buildMessagesPayload` and `buildSummarizationPayload`, there are also persona description tokens via `replacePersonaTemplate()`:

| Variable                  | Source                       | Resolves To                                                                    |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| `{{description}}`         | `currentPersona.description` | The active user persona description (may differ from the thread's default)     |
| `{{description_chat}}`    | `chatPersona.description`    | The description of the persona that started the chat (from `thread.personaId`) |
| `{{description_default}}` | `defaultPersonaId` persona   | The description of the global default user persona                             |

### Where Variables are Replaced

| Payload Type  | Variables Replaced In                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat          | All system parts, message content, first message prompt, continue prompt, persona injection template, writing instruction content                                                           |
| OOC           | System instructions, character prompt, headers, transcript (via `buildTranscript` → prefix templates)                                                                                       |
| Auto-title    | System instruction, user instruction, transcript (the transcript itself is built from raw messages — variables in the messages themselves are replaced in the chat flow, not in auto-title) |
| Summarization | System instruction, user instruction                                                                                                                                                        |

---

## 10. API Request Execution (`sendChatCompletion`)

**File**: `src/services/chatApi.js:276-370`

### Request Shape

```js
{
  method: 'POST',
  url: `${baseUrl}/chat/completions`,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,   // if key exists
  },
  body: {
    model: profile.model,
    messages: payload,                    // the constructed messages array
    ...activeParams,                      // filtered params from profile
  }
}
```

### Base URL Resolution

```js
const BASE_URLS = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  'ai-horde': 'https://oai.aihorde.net/v1',
}
```

For LM Studio, the base URL comes from user input (stored in `api.lm-studio.baseUrl`) and must be set manually. The `getChatBaseUrl()` function returns `null` for LM Studio, but the caller in `ChatView` doesn't use it — instead, LM Studio profiles store their URL via a different mechanism. The base URL handling currently only covers the three predefined providers.

### Streaming vs. Non-Streaming

Controlled by `profile.params.stream`.

#### Streaming (default: false)

1. `fetch()` POST with `body` as JSON
2. Parse response as `ReadableStream` via `res.body.getReader()`
3. Decode UTF-8, split by `\n`, parse SSE `data: {...}` lines
4. Extract `choices[0].delta.content` from each chunk
5. Accumulate into `fullContent`, call `onToken(fullContent)` on each delta
6. Return accumulated `fullContent`

The `onToken` callback updates the Dexie message record and React state for live UI updates.

#### Non-Streaming

Direct `await res.json()`, return `choices[0].message.content`.

### Error Handling

- Non-OK HTTP responses throw with `HTTP {status}: {body}`
- Streaming errors during parsing are silently skipped (unparseable chunks)
- AbortError (from `AbortController`) propagates to the caller

---

## 11. Regeneration Flow

**File**: `src/pages/ChatView.jsx:794-1039`

When a user regenerates a message:

1. **Bundle Management**: The message's `bundleMessages` JSON field is parsed. If it doesn't exist, a single-entry bundle is created from the current `content` and `promptData`.

2. **New Slot**: A new empty entry is appended to the bundle:

   ```js
   entries.push({ content: '', promptData: null, createdAt: new Date().toISOString() })
   ```

3. **Message Slicing**: Messages are sliced at the regeneration point — only messages before the target message are included:

   ```js
   const currentMsgs = messages.slice(0, idx)
   ```

4. **Payload Reconstruction**: The same payload building functions are called with `currentMsgs` (messages before the target) and `isFirstMessage` computed as `currentMsgs.length === 0 && character?.firstMessage`.

5. **OOC Regeneration Handling**: For OOC messages, the regeneration flow mirrors the initial send — the last user message in `currentMsgs` is extracted and passed separately as `userMessage`, while `apiMessages.slice(0, -1)` is used as the transcript. If the preceding user message was deleted, `userMessage` is empty and all eligible messages are passed as transcript — the correct fallthrough.

6. **Profile Resolution**: Resolves the profile based on whether the target message was OOC or regular.

7. **API Call**: Same `sendChatCompletion()` with streaming callback.

8. **Result Storage**: The new content is stored in the new bundle slot. The `promptData` is also stored per-slot.

9. **Slot Navigation**: `activeSlotIndices` tracks which slot is active, enabling the user to navigate between bundle versions.

---

## 12. Initial Messages & Auto-First-Message

### Thread Creation with Initial Messages

**File**: `src/pages/CharacterDiscovery.jsx:251-271`

```js
const initialMessages = character.initialMessages?.length ? character.initialMessages : null
const threadId = await createThread({ characterId, title, personaId, initialMessages })

if (!initialMessages && character.greeting) {
  await createMessage(threadId, 'assistant', character.greeting)
}
```

Two paths:

- **If `character.initialMessages` exist**: they're stored as JSON on the thread, deferred for migration
- **If no initial messages but `character.greeting` (legacy field)**: a single assistant message is created immediately

### Initial Messages Migration

**File**: `src/pages/ChatView.jsx:171-183`

On ChatView load, if `thread.initialMessages` is non-empty and no messages exist yet:

```js
const entries = thr.initialMessages.map(m => ({
  content: m.content, promptData: null, origin: 'initial', createdAt: ...
}))
const msgId = await createAssistantMessage(threadId, entries[0].content)
await updateMessage(msgId, { bundleMessages: JSON.stringify(entries) })
await updateThread(threadId, { initialMessages: null })
```

Each initial message becomes a bundle entry in a single assistant message. The `initialMessages` field is cleared from the thread after migration.

### Auto-First-Message Trigger

**File**: `src/pages/ChatView.jsx:384-395`

When all conditions are met:

- Loading is complete
- Character exists
- Chat profile is configured
- No auto-trigger has fired yet (`autoTriggeredRef`)
- No messages exist in the thread
- No initial messages are pending migration
- `character.firstMessage` (the boolean flag) is truthy

...an empty-text `handleSend('', null, false)` is fired automatically. This creates a chat request with `isFirstMessage = true`, injecting the first message prompt from settings.

---

## 13. End-to-End Send Flow

```
ChatInputArea.handleSend()
  │
  ├─ Commands: /ai → empty send, /mem → open memory modal, /ooc not a command
  │
  └─ ChatView.handleSend(text, personaId, isOOC, autoReply)
       │
       ├─ If text: createMessage(threadId, 'user', text, personaId, isOOC)
       │           → Dexie write + promptHistory write + thread timestamp update
       │
       ├─ If text && !autoReply: stop here (user wants to just store the message)
       │
       ├─ isFirstMessage = (messages.length === 0)
       │
       ├─ doChatRequest(isFirstMessage, messages, chatPersona, currentPersona, isOOC)
       │    │
       │    ├─ getEffectiveProfileFor(isOOC ? 'ooc' : 'chat')
       │    ├─ getMessagesForApiRequest(messages, { includeOOC, keepMessages })
       │    ├─ Build payload (buildMessagesPayload or buildOOCMessagesPayload)
       │    ├─ createAssistantMessage(threadId, '', null, isOOC) → empty placeholder
       │    ├─ Store promptData JSON on the message
       │    ├─ sendChatCompletion({ profile, messages: payload, signal, onToken })
       │    │    └─ Streaming: onToken → updateMessage + setMessages each chunk
       │    ├─ On success: updateMessage with final content
       │    ├─ On error: clear content, refresh from Dexie, show error toast
       │    └─ On abort: clear content, refresh from Dexie (don't show toast)
       │
       ├─ Refresh messages from Dexie
       │
       ├─ shouldTriggerSummarization()? → handleSummarization()
       │    └─ triggerSummarization() → marks messages summarizedAt
       │       → creates threadMemories entry → updates thread.memory
       │
       └─ shouldAutoTitle()? → triggerAutoTitle()
            └─ Updates thread.title, sets autoTitleGenerated
```

### Unread Tracking

After a successful chat completion:

- If user is away from the thread or not at the bottom of the scroll: `addUnread(threadId, assistantMsgId)`
- If `unreadSound` is enabled: play notification sound
- Messages are marked `isUnread` in React state for visual highlighting

---

## 14. Settings Reference

All settings that affect API payloads, with their keys and defaults:

### Prompting Category (`prompting.*`)

| Key                                  | Type          | Default                                                         | Used In       |
| ------------------------------------ | ------------- | --------------------------------------------------------------- | ------------- |
| `prompting.autoTitleSystem`          | textarea      | "You are a title generator for conversational AI."              | autoTitle     |
| `prompting.autoTitleUser`            | textarea      | "Read the following thread..." with `{{transcript}}`            | autoTitle     |
| `prompting.summarizationSystem`      | textarea      | Detailed summarization instructions                             | summarization |
| `prompting.summarizationUser`        | textarea      | "Summarize this:"                                               | summarization |
| `prompting.oocSystem`                | textarea      | "This is an OOC request. Reply in OOC..."                       | OOC           |
| `prompting.oocUser`                  | textarea      | "((OOC: {content}))"                                            | OOC           |
| `prompting.oocDelimiters`            | oocDelimiters | `{ enabled: false, left: '((OOC: ', right: '))' }`              | (UI only)     |
| `prompting.oocMessageRole`           | select        | `'system'`                                                      | OOC (display) |
| `prompting.firstMessageRole`         | select        | `'user'`                                                        | Chat          |
| `prompting.firstMessagePrompt`       | textarea      | "((OOC: Start with the first message...))"                      | Chat          |
| `prompting.continueRole`             | select        | `'user'`                                                        | Chat          |
| `prompting.continuePrompt`           | textarea      | "((OOC: Continue the current scene...))"                        | Chat          |
| `prompting.personaInjectionTemplate` | textarea      | `"\n\n---\n\n**User**:\n\n- Name: {{name}}\n- {{description}}"` | Chat          |
| `prompting.writingInjectionTiming`   | select        | `'always'`                                                      | Chat          |
| `prompting.writingPlacement`         | select        | `'endOfSystemPrompt'`                                           | Chat          |
| `prompting.writingMessageRole`       | select        | `'system'`                                                      | Chat          |
| `prompting.personaInjectionTiming`   | select        | `'always'`                                                      | Chat          |
| `personaInjectionPlacement`          | select        | `'endOfSystemPrompt'`                                           | Chat          |
| `personaInjectionMessageRole`        | select        | `'system'`                                                      | Chat          |

### Role Prefixes

| Key                                   | Default                       | Used In         |
| ------------------------------------- | ----------------------------- | --------------- |
| `prompting.systemRolePrefix`          | `[SYSTEM]:`                   | All transcripts |
| `prompting.assistantRolePrefix`       | `[ASSISTANT]:`                | All transcripts |
| `prompting.userRolePrefix`            | `[USER]:`                     | All transcripts |
| `prompting.userRolePrefixWithPersona` | `[USER as {{persona_name}}]:` | All transcripts |
| `prompting.systemRolePrefixOoc`       | `[SYSTEM in OOC]:`            | OOC transcripts |
| `prompting.assistantRolePrefixOoc`    | `[ASSISTANT in OOC]:`         | OOC transcripts |
| `prompting.userRolePrefixOoc`         | `[USER in OOC]:`              | OOC transcripts |

### API Request Section Headers

| Key                                                  | Default                                  | Used In                             |
| ---------------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| `prompting.apiRequestSectionHeaders.characterPrompt` | `Description:`                           | OOC payload                         |
| `prompting.apiRequestSectionHeaders.messages`        | `Messages:`                              | OOC payload                         |
| `prompting.apiRequestSectionHeaders.memories`        | `Memories:`                              | Chat, OOC, autoTitle, summarization |
| `prompting.apiRequestSectionHeaders.memoryEntry`     | `Memory Level {{level}} Entry {{slot}}:` | (future use)                        |
| `prompting.apiRequestSectionHeaders.loreContext`     | `Lore:`                                  | (future use)                        |

### Defaults Category (`defaults.*`)

| Key                             | Type   | Default      | Used In                        |
| ------------------------------- | ------ | ------------ | ------------------------------ |
| `defaultAutoTitle`              | toggle | `true`       | Character creation default     |
| `defaultAutoTitleThreshold`     | text   | `3`          | Character creation default     |
| `defaultMemory`                 | select | `'messages'` | Character creation default     |
| `defaultMessagesThreshold`      | text   | `7`          | Summarization trigger          |
| `defaultContextWindowThreshold` | slider | `1024`       | Summarization trigger          |
| `defaultMessagesToKeep`         | text   | `5`          | Message filtering              |
| `defaultMemorySlots`            | text   | `3`          | (future use)                   |
| `defaultFirstMessage`           | toggle | `true`       | Character creation default     |
| `defaultIncludeOOC`             | toggle | `true`       | Character creation default     |
| `defaultUserPersonaPrefix`      | toggle | `true`       | Character creation default     |
| `defaultMessageThreshold`       | text   | `0`          | Chat view (message load limit) |
| `defaultPostProcessing`         | toggle | `true`       | Character creation default     |

### Character-Level Overrides

Characters can override most defaults. Key override fields on the `characters` Dexie object:

```js
{
  // Prompting
  prompt: string,                          // character system prompt
  extraPrompt: string,                     // one-time extra prompt (injected on first message)
  writingInstruction: number | null,       // FK to writingInstructions table
  writingInjectionTiming: 'always' | 'never',
  writingPlacement: 'endOfSystemPrompt' | 'endOfMessages',
  writingMessageRole: 'system' | 'assistant',
  personaInjectionTiming: 'always' | 'never',
  personaInjectionPlacement: 'endOfSystemPrompt' | 'endOfMessages',
  personaInjectionMessageRole: 'system' | 'assistant',

  // Auto-title
  autoTitle: boolean,
  autoTitleThreshold: number,
  autoTitleSystemInstructions: string,
  autoTitleUserInstructions: string,

  // Summarization / Memory
  memory: 'never' | 'messages' | 'contextWindow',
  messagesThreshold: number,
  contextWindowThreshold: number,
  messagesToKeep: number,
  memorySlots: number,
  summarizationSystemInstructions: string,
  summarizationUserInstructions: string,

  // OOC / Transcript
  includeOOC: boolean,
  userPersonaPrefix: boolean,

  // Display
  firstMessage: boolean,                   // enables auto-trigger
  initialMessages: Array<{ id, content }>, // pre-seeded assistant messages
  greeting: string,                        // legacy fallback (migrated on thread creation)

  // Other
  postProcessing: boolean,
}
```

---

## 15. Notable Implementation Gaps

Based on code analysis, these features are defined in the settings schema and UI but have **incomplete or missing implementation** in the payload builders:

1. **Multi-level / Multi-slot Memory**: The `memorySlots` setting and `Memory Level {{level}} Entry {{slot}}:` header are declared but the summarization system currently only writes a single `thread.memory` field, overwriting the previous summary each time. There is no iteration over multiple `threadMemories` entries when appending memory to the chat payload.
