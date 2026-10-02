import { Tabs } from 'expo-router';
import { Compass, MessageCircle, UserRound } from 'lucide-react-native';
import { StyleSheet, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

type TabIconName = 'chats' | 'explore' | 'profile';

function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  const iconColor = color as string;

  if (name === 'chats') {
    return <MessageCircle size={24} color={iconColor} strokeWidth={2} />;
  }

  if (name === 'explore') {
    return <Compass size={24} color={iconColor} strokeWidth={2} />;
  }

  return <UserRound size={24} color={iconColor} strokeWidth={2} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: [styles.tabBar, { paddingBottom: insets.bottom + 8 }],
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Sohbetler',
          tabBarAccessibilityLabel: 'Sohbetler sekmesi',
          tabBarIcon: ({ color }) => <TabIcon name="chats" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Keşfet',
          tabBarAccessibilityLabel: 'Keşfet sekmesi',
          tabBarIcon: ({ color }) => <TabIcon name="explore" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil sekmesi',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.surfaceBlue,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: 5,
  },
  tabLabel: { fontFamily: 'GoogleSansMedium', fontSize: 11, fontWeight: '500' },
});
