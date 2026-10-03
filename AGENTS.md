This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Safe areas

- Do not use `SafeAreaView` from `react-native`; that API is deprecated.
- Use `react-native-safe-area-context` with `useSafeAreaInsets()` for screen layout.
- Apply the insets on every full-screen screen, including screens shown after authentication. Keep content clear of the status bar and bottom system/navigation area.
- Prefer the shared `ScreenContainer` component so new screens inherit safe-area spacing by default.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Repository Scope

- Keep all changes for this conversation within the `mobile/` repository.
- Redirect root-level, background, and server work to their corresponding conversations; do not modify those files here.

## Git Operations

- Do not perform any Git operation unless the user explicitly requests it. This includes read-only inspection commands such as `status`, `log`, and `diff`, as well as `fetch`, `checkout`, `branch`, `merge`, `commit`, `push`, and similar operations.
- Commit only when the user explicitly asks. Never commit or push without explicit user instruction.
- When the user authorizes Git work, follow Git Flow principles.
- Write all commit messages in English.

## Language and Naming

- Write all documentation in English, including README files and other document files.
- Use English for identifiers and names, including variables, functions, types, files, and resources. Follow the project's established language conventions for casing and formatting.
- Use Turkish only for user-facing language inside the application. Do not use Turkish for identifiers, technical names, documentation, or commit messages.
- Apply Clean Code Architecture naming logic: choose names that clearly communicate meaning, action, responsibility, and architectural role while following existing project conventions.
- Name functions clearly according to their action and responsibility.

## Code Design

- Keep functions short, focused, understandable, and limited to a cohesive responsibility.
- Avoid excessive context and unrelated responsibilities. Apply judgment based on clarity and cohesion rather than a rigid line-count rule.
