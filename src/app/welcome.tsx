import { ClerkAuthGate } from '../features/auth/ClerkAuthGate';

export default function WelcomeRoute() {
  return <ClerkAuthGate />;
}
