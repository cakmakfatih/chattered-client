import { useClerk } from '@clerk/expo';
import { TabPlaceholderScreen } from '../../components/TabPlaceholderScreen';

export default function ProfileRoute() {
  const { signOut } = useClerk();

  return (
    <TabPlaceholderScreen
      title="Profil"
      description="Profil alanını sonraki adımda birlikte şekillendireceğiz."
      actionLabel="Çıkış yap"
      onAction={() => { void signOut(); }}
    />
  );
}
