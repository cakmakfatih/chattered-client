import { Alert } from 'react-native';
import { TabPlaceholderScreen } from '../../components/TabPlaceholderScreen';
import { useAuthTransition } from '../../features/auth/AuthTransitionProvider';

export default function ProfileRoute() {
  const { endSession } = useAuthTransition();

  const signOut = () => {
    void endSession().catch(() => {
      Alert.alert('Çıkış yapılamadı', 'Lütfen tekrar deneyin.');
    });
  };

  return (
    <TabPlaceholderScreen
      title="Profil"
      description="Profil alanını sonraki adımda birlikte şekillendireceğiz."
      actionLabel="Çıkış yap"
      onAction={signOut}
    />
  );
}
