# Chattered Mobile

Expo and React Native client for Chattered.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.dev`.
3. Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to the publishable key from the Clerk dashboard. The development API URL is `https://130.61.98.51`.
4. Start Expo with `npm run start`, or use `npm run android`, `npm run ios`, or `npm run web`.

These npm scripts load `.env.dev` and disable Expo's automatic `.env` loading. `.env.dev` is local-only and ignored by git. Expo bundles `EXPO_PUBLIC_` variables into the client app, so never put Clerk secret keys or other private credentials in this file.
