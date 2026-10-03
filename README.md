# Chattered Mobile

Expo and React Native client for Chattered.

## Local development

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.dev`.
3. Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to the publishable key from the Clerk dashboard. The development API URL is `https://130.61.98.51`.
4. Start Expo with `npm run start`, or use `npm run android`, `npm run ios`, or `npm run web`.

These npm scripts load `.env.dev` and disable Expo's automatic `.env` loading. `.env.dev` is local-only and ignored by git. Expo bundles `EXPO_PUBLIC_` variables into the client app, so never put Clerk secret keys or other private credentials in this file.

## Expo Go on a physical device over LAN

1. Install dependencies with `npm ci` and install Expo Go on the device.
2. Copy `.env.example` to `.env.local`.
3. Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local` to the Clerk publishable key. Never use a Clerk secret key in an `EXPO_PUBLIC_` variable.
4. Replace `192.168.1.100` in `EXPO_PUBLIC_API_URL` with the development computer's LAN IPv4 address. Keep the URL in the form `http://<computer-lan-ip>:8080`.
5. Start the Server on `0.0.0.0:8080`. Do not put `0.0.0.0`, `localhost`, or `127.0.0.1` in the mobile URL; those addresses do not identify the development computer from the phone.
6. Connect the phone and development computer to the same Wi-Fi network, then run:

```bash
npm run start:local
```

The command loads only `.env.local`, disables Expo's automatic dotenv loading, explicitly starts Expo Go with LAN hosting, and prints a QR code for the physical device. If the app or API cannot be reached, check that the local firewall allows Expo/Metro traffic and TCP port `8080` on the private network.
