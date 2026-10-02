import { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';
import { AppText } from '../components/AppText';
import { AppPressable } from '../components/AppPressable';
import { BrandMark } from '../components/BrandMark';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors } from '../theme/colors';

type UserCard = {
  id: string;
  type: 'user';
  handle: string;
  description: string;
  isOnline: boolean;
  avatar?: ImageSourcePropType;
};

type ExploreListItem =
  | { id: 'search'; type: 'search'; value: string }
  | { id: 'empty'; type: 'empty' }
  | UserCard;

const additionalHandles = [
  'dalgasesi', 'ayisigi', 'morbulut', 'kirikpusula', 'birbardaksu',
  'uzakdurak', 'minikmola', 'geceacik', 'yolarkadasi', 'kisbahcesi',
  'lacivertoda', 'birnefes', 'dusdefteri', 'sakinbiri', 'sokakmuzisyeni',
  'gunesekalan', 'pencerekenari', 'sonbahar', 'kahvekokusu', 'uzunhikaye',
  'yildiztozu', 'boskoltuk', 'denizfeneri', 'tatlibirtesaduf', 'incebirruzgar',
  'sessizfilm', 'radyodakises', 'geceyaris',
];

const descriptions = [
  'Akşam yürüyüşünden yeni geldim',
  'Son zamanlarda güzel filmler arıyorum',
  'Kahve molasında biraz sohbet',
  'Bugün nasılsın diye soran biri olsun',
  'Yeni şarkı önerilerine açığım',
  'Biraz gündelik şeylerden konuşalım',
  'Kitaplığımda sıradaki kitabı seçiyorum',
  'Şehrin sakin köşelerini keşfediyorum',
  'Güzel bir dizi önerin var mı?',
  'Bir çay koyup dinleniyorum',
  'Hafta sonu planı yapmaya çalışıyorum',
  'Bugün güzel bir şey anlat',
  'Sokak kedileriyle arkadaşım',
  'Müzik dinleyip çalışıyorum',
  'Yeni tarifler denemeyi seviyorum',
  'Yağmurlu havada ev keyfi',
  'Biraz gülmeye ihtiyacım var',
  'Deniz kenarını özledim',
  'Küçük şeylerden mutlu olanlardanım',
  'Şu sıralar eski şarkılara sardım',
  'Günün nasıl geçti?',
  'Bir şeyler öğrenmeye her zaman varım',
  'Sessiz bir akşam geçiriyorum',
  'Fotoğraf çekmek için dışarı çıktım',
  'Tatlı mı tuzlu mu, karar veremedim',
  'Biraz hayal kurma molası',
  'Güzel bir sohbet akşamı kurtarabilir',
  'Favori kahvemi arıyorum',
];

const placeholderUsers: UserCard[] = [
  { id: '1', type: 'user', handle: 'maviay', description: 'Yeni insanlarla tanışmaya açık', isOnline: true, avatar: require('../../assets/avatars/woman-68.jpg') },
  { id: '2', type: 'user', handle: 'geceyolcusu', description: 'Film ve müzik üzerine sohbet', isOnline: false, avatar: require('../../assets/avatars/man-75.jpg') },
  { id: '3', type: 'user', handle: 'kucukbirara', description: 'Bugün nasılsın?', isOnline: true },
  { id: '4', type: 'user', handle: 'sessiznotlar', description: 'Bazen yabancıya anlatmak daha kolay', isOnline: false, avatar: require('../../assets/avatars/woman-44.jpg') },
  { id: '5', type: 'user', handle: 'kahvearasi', description: 'Biraz sohbete ne dersin?', isOnline: true, avatar: require('../../assets/avatars/man-32.jpg') },
  { id: '6', type: 'user', handle: 'biriyeter', description: 'Burada yeniyim', isOnline: false },
  { id: '7', type: 'user', handle: 'yoldanbiri', description: 'Aklında ne varsa anlat', isOnline: false },
  ...additionalHandles.map((handle, index): UserCard => ({
    id: `demo-${index + 1}`,
    type: 'user',
    handle,
    description: descriptions[index],
    isOnline: index % 4 === 0,
  })),
];

const LIST_HEADER_HEIGHT = 104;
const SEARCH_ROW_HEIGHT = 58;
const USER_ROW_HEIGHT = 78;
const USER_ROW_GAP = StyleSheet.hairlineWidth;
const USER_ROW_LENGTH = USER_ROW_HEIGHT + USER_ROW_GAP;

function getItemLayout(_: ArrayLike<ExploreListItem> | null | undefined, index: number) {
  const item = _?.[index];

  if (item?.type === 'search') {
    return { length: SEARCH_ROW_HEIGHT, offset: LIST_HEADER_HEIGHT, index };
  }
  if (item?.type === 'empty') {
    return {
      length: 112,
      offset: LIST_HEADER_HEIGHT + SEARCH_ROW_HEIGHT,
      index,
    };
  }

  return {
    length: USER_ROW_HEIGHT,
    offset: LIST_HEADER_HEIGHT + SEARCH_ROW_HEIGHT + (index - 1) * USER_ROW_LENGTH,
    index,
  };
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

const ExploreHeading = memo(function ExploreHeading({
  opacity,
}: {
  opacity: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <Animated.View style={[styles.pageHeading, { opacity }]}>
      <AppText style={styles.title}>Keşfet</AppText>
      <AppText style={styles.subtitle}>Bazen bir selam, güzel bir sohbete dönüşür.</AppText>
    </Animated.View>
  );
});

const SearchRow = memo(function SearchRow({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.stickySearch}>
      <View style={styles.searchField}>
        <View style={styles.searchIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.searchLens} />
          <View style={styles.searchHandle} />
        </View>
        <TextInput
          accessibilityLabel="Kullanıcı ara"
          placeholder="Kullanıcı ara"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          value={value}
          onChangeText={onChangeText}
          style={styles.searchInput}
          selectionColor={colors.primary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value.length > 0 ? (
          <AppPressable
            accessibilityRole="button"
            accessibilityLabel="Aramayı temizle"
            hitSlop={8}
            onPress={() => onChangeText('')}
            style={styles.clearButton}
          >
            <AppText style={styles.clearText}>×</AppText>
          </AppPressable>
        ) : null}
      </View>
    </View>
  );
});

const UserRow = memo(function UserRow({
  user,
  onPress,
  bioMaxWidth,
}: {
  user: UserCard;
  onPress: (handle: string) => void;
  bioMaxWidth: number;
}) {
  return (
    <AppPressable
      accessibilityRole="button"
      accessibilityLabel={`@${user.handle}, ${user.description}, ${user.isOnline ? 'çevrimiçi' : 'çevrimdışı'}`}
      onPress={() => onPress(user.handle)}
      style={styles.userRow}
    >
      <View style={styles.avatarFrame}>
        {user.avatar ? (
          <Image source={user.avatar} style={styles.avatarImage} />
        ) : (
          <View style={styles.defaultAvatar}>
            <MaterialDesignIcons
              name="account"
              size={34}
              color="#9AA0A6"
              accessible={false}
            />
          </View>
        )}
        <View style={[styles.presenceDot, user.isOnline ? styles.onlineDot : styles.offlineDot]} />
      </View>
      <View style={styles.userCopy}>
        <AppText style={styles.handle}>@{user.handle}</AppText>
        <AppText
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.userDescription, { maxWidth: bioMaxWidth }]}
        >
          {user.description}
        </AppText>
      </View>
      <AppText style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">›</AppText>
    </AppPressable>
  );
});

function renderExploreItem(
  item: ExploreListItem,
  onChangeText: (value: string) => void,
  onUserPress: (handle: string) => void,
  bioMaxWidth: number,
) {
  if (item.type === 'search') return <SearchRow value={item.value} onChangeText={onChangeText} />;
  if (item.type === 'empty') {
    return (
      <View style={styles.emptyState}>
        <AppText style={styles.emptyTitle}>Kullanıcı bulunamadı</AppText>
        <AppText style={styles.emptyDescription}>Başka bir kullanıcı adıyla aramayı dene.</AppText>
      </View>
    );
  }
  return <UserRow user={item} onPress={onUserPress} bioMaxWidth={bioMaxWidth} />;
}

export function UserDirectoryScreen() {
  const [search, setSearch] = useState('');
  const [userOrder, setUserOrder] = useState(() => placeholderUsers.map((user) => user.id));
  const [scrollY] = useState(() => new Animated.Value(0));
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(windowWidth - insets.left - insets.right, 440)
    - insets.left - insets.right - 40;
  const bioMaxWidth = Math.max(0, contentWidth - 68 - 56 - 8);
  const collapsedTitleOpacity = useMemo(() => scrollY.interpolate({
    inputRange: [0, 48],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  }), [scrollY]);
  const brandOpacity = useMemo(() => scrollY.interpolate({
    inputRange: [0, 48],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  }), [scrollY]);
  const headingOpacity = useMemo(() => scrollY.interpolate({
    inputRange: [0, 84],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  }), [scrollY]);
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    const orderRank = new Map(userOrder.map((id, index) => [id, index]));
    return placeholderUsers
      .filter((user) => !query || `${user.handle} ${user.description}`.toLocaleLowerCase('tr-TR').includes(query))
      .sort((first, second) => {
        const onlineFirst = Number(second.isOnline) - Number(first.isOnline);
        if (onlineFirst !== 0) return onlineFirst;
        return (orderRank.get(first.id) ?? 0) - (orderRank.get(second.id) ?? 0);
      });
  }, [search, userOrder]);

  const listData = useMemo<ExploreListItem[]>(() => [
    { id: 'search', type: 'search', value: search },
    ...(filteredUsers.length > 0 ? filteredUsers : [{ id: 'empty' as const, type: 'empty' as const }]),
  ], [filteredUsers, search]);

  const onUserPress = useCallback((handle: string) => {
    Alert.alert('Birazdan burada', `@${handle} ile mesajlaşma ekranını sonraki adımda ekleyeceğiz.`);
  }, []);
  const onShuffle = useCallback(() => {
    const onlineUsers = placeholderUsers.filter((user) => user.isOnline);
    const offlineUsers = placeholderUsers.filter((user) => !user.isOnline);
    setUserOrder(
      [...shuffleItems(onlineUsers), ...shuffleItems(offlineUsers)].map((user) => user.id),
    );
  }, []);
  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  ), [scrollY]);
  const listHeader = useMemo(() => (
    <ExploreHeading opacity={headingOpacity} />
  ), [headingOpacity]);
  const renderItem = useCallback<ListRenderItem<ExploreListItem>>(
    ({ item }) => renderExploreItem(item, setSearch, onUserPress, bioMaxWidth),
    [bioMaxWidth, onUserPress],
  );

  return (
    <ScreenContainer contentStyle={styles.screenContent} topPadding={12} bottomPadding={0} horizontalPadding={20}>
      <View style={styles.topBar}>
        <Animated.View style={[styles.topBarBrand, { opacity: brandOpacity }]} pointerEvents="none">
          <BrandMark />
        </Animated.View>
        <Animated.View style={[styles.collapsedTitle, { opacity: collapsedTitleOpacity }]} pointerEvents="none">
          <AppText style={styles.collapsedTitleText}>Keşfet</AppText>
        </Animated.View>
      </View>

      <Animated.FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={9}
        getItemLayout={getItemLayout}
        ItemSeparatorComponent={ExploreItemSeparator}
      />
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel="Kişileri karıştır"
        onPress={onShuffle}
        style={styles.fab}
      >
        <MaterialDesignIcons
          name="shuffle"
          size={24}
          color={colors.surface}
          accessible={false}
        />
      </AppPressable>
    </ScreenContainer>
  );
}

function ExploreItemSeparator({
  leadingItem,
  trailingItem,
}: {
  leadingItem?: ExploreListItem;
  trailingItem?: ExploreListItem;
}) {
  if (leadingItem?.type !== 'user' || trailingItem?.type !== 'user') return null;
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screenContent: { flex: 1 },
  topBar: { height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2, elevation: 2 },
  topBarBrand: { alignSelf: 'flex-start' },
  collapsedTitle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  collapsedTitleText: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  list: { flex: 1, overflow: 'hidden' },
  listContent: { paddingBottom: 12, flexGrow: 1 },
  pageHeading: { height: LIST_HEADER_HEIGHT, justifyContent: 'flex-end', paddingBottom: 18, backgroundColor: colors.surface },
  title: { color: colors.ink, fontSize: 29, lineHeight: 36, letterSpacing: -0.7, fontWeight: '600' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 20, marginTop: 5 },
  stickySearch: { height: SEARCH_ROW_HEIGHT, justifyContent: 'flex-start', backgroundColor: colors.surface, zIndex: 1 },
  searchField: { height: 52, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#F1F3F4', paddingHorizontal: 16 },
  searchIcon: { width: 21, height: 21, marginRight: 12, justifyContent: 'flex-start' },
  searchLens: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.muted },
  searchHandle: { position: 'absolute', left: 13, top: 13, width: 7, height: 2, borderRadius: 1, backgroundColor: colors.muted, transform: [{ rotate: '45deg' }] },
  searchInput: { flex: 1, height: 50, color: colors.ink, fontSize: 15, fontFamily: 'GoogleSansRegular', paddingVertical: 0 },
  clearButton: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -7 },
  clearText: { color: colors.muted, fontSize: 24, lineHeight: 28 },
  userRow: { height: USER_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  avatarFrame: { width: 54, height: 54, marginRight: 14 },
  avatarImage: { width: 54, height: 54, borderRadius: 27 },
  defaultAvatar: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', backgroundColor: '#F1F3F4', alignItems: 'center', justifyContent: 'center' },
  presenceDot: { position: 'absolute', width: 13, height: 13, right: 0, bottom: 0, borderRadius: 7, borderWidth: 2, borderColor: colors.surface },
  onlineDot: { backgroundColor: '#F9AB00' },
  offlineDot: { backgroundColor: '#DADCE0' },
  userCopy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  handle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  userDescription: { color: colors.muted, fontSize: 13, marginTop: 4, flexShrink: 1 },
  chevron: { color: colors.muted, fontSize: 25, lineHeight: 28, paddingLeft: 10 },
  separator: { height: USER_ROW_GAP, backgroundColor: colors.surfaceBlue, marginLeft: 68 },
  emptyState: { height: 112, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  fab: { position: 'absolute', right: 12, bottom: 12, zIndex: 3, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyDescription: { color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center' },
});
