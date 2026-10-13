import 'react-native-gesture-handler/jestSetup';

process.env.EXPO_PUBLIC_API_URL = 'https://api.chattered.test/';
process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_chattered';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
