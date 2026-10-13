import { memo } from 'react';
import { ActivityIndicator, Image, StyleSheet, TextInput, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import { AppPressable } from '../../components/AppPressable';
import { AppText } from '../../components/AppText';
import { ButtonLabel } from '../../components/ButtonLabel';
import { colors } from '../../theme/colors';
import type { Gender, SelectedPhoto } from './types';
import { getBioError, maxBioCodePoints, maxUsernameCharacters } from './validation';
import { isUsernameAvailable, isUsernameCheckPending, type useUsernameAvailability } from './useUsernameAvailability';

type Availability = ReturnType<typeof useUsernameAvailability>;

export const genderOptions: { value: Gender; label: string; description: string }[] = [
  { value: 'male', label: 'Erkek', description: 'Erkek olarak tanımlıyorum' },
  { value: 'female', label: 'Kadın', description: 'Kadın olarak tanımlıyorum' },
  { value: 'other', label: 'Diğer', description: 'Farklı bir şekilde tanımlıyorum' },
];

export const genderLabels: Record<Gender, string> = {
  female: 'Kadın',
  male: 'Erkek',
  other: 'Diğer',
};

export const UsernameStep = memo(function UsernameStep({
  username,
  availability,
  errorMessage,
  onChange,
}: {
  username: string;
  availability: Availability;
  errorMessage?: string;
  onChange: (value: string) => void;
}) {
  const available = isUsernameAvailable(availability.status);
  const checking = isUsernameCheckPending(availability.status);
  const availabilityText = getAvailabilityText(availability);

  return (
    <View style={styles.stepContent}>
      <AppText style={styles.fieldLabel}>Kullanıcı adın</AppText>
      <View style={[styles.usernameField, (errorMessage || availability.status === 'taken') && styles.fieldInvalid, available && styles.fieldValid]}>
        <AppText style={styles.usernamePrefix}>@</AppText>
        <TextInput
          accessibilityLabel="Kullanıcı adı"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={maxUsernameCharacters}
          onChangeText={onChange}
          placeholder="ornek_kullanici"
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          selectionColor={colors.primary}
          spellCheck={false}
          style={styles.usernameInput}
          value={username}
        />
        {checking ? <ActivityIndicator size="small" color={colors.muted} /> : available ? <Check size={20} color={colors.green} /> : null}
      </View>
      <AppText style={[styles.helperText, (errorMessage || availability.status === 'taken' || availability.status === 'error') && styles.errorText, available && styles.successText]}>
        {errorMessage ?? availabilityText}
      </AppText>
      {availability.status === 'error' ? (
        <AppPressable accessibilityRole="button" onPress={availability.retry} hitSlop={8} style={styles.retryLink}>
          <ButtonLabel style={styles.retryText}>Tekrar kontrol et</ButtonLabel>
        </AppPressable>
      ) : null}
    </View>
  );
});

function getAvailabilityText(availability: Availability): string {
  if (availability.status === 'error') return availability.message ?? 'Kullanıcı adı şu an kontrol edilemedi.';
  if (availability.status === 'available') return 'Bu kullanıcı adı uygun.';
  if (availability.status === 'taken') return 'Bu kullanıcı adı kullanımda.';
  if (isUsernameCheckPending(availability.status)) return 'Kullanıcı adı kontrol ediliyor…';
  return `3–${maxUsernameCharacters} karakter; küçük harf, rakam ve alt çizgi kullan.`;
}

export const GenderStep = memo(function GenderStep({
  value,
  errorMessage,
  onChange,
}: {
  value: Gender | null;
  errorMessage?: string;
  onChange: (value: Gender) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <AppText style={styles.fieldLabel}>Kendini nasıl tanımlıyorsun?</AppText>
      <View style={styles.options}>
        {genderOptions.map((option) => {
          const selected = value === option.value;
          return (
            <AppPressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={[styles.genderOption, selected && styles.genderOptionSelected]}
            >
              <View style={styles.optionCopy}>
                <AppText style={styles.optionTitle}>{option.label}</AppText>
                <AppText style={styles.optionDescription}>{option.description}</AppText>
              </View>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
            </AppPressable>
          );
        })}
      </View>
      {errorMessage ? <AppText style={[styles.helperText, styles.errorText]}>{errorMessage}</AppText> : null}
    </View>
  );
});

export const BioStep = memo(function BioStep({
  bio,
  errorMessage,
  onChange,
}: {
  bio: string;
  errorMessage?: string;
  onChange: (value: string) => void;
}) {
  const localError = errorMessage ?? getBioError(bio);
  const characterCount = Array.from(bio).length;

  return (
    <View style={styles.stepContent}>
      <AppText style={styles.fieldLabel}>Biyografin</AppText>
      <TextInput
        accessibilityLabel="Biyografi"
        multiline
        onChangeText={(value) => onChange(Array.from(value).slice(0, maxBioCodePoints).join(''))}
        placeholder="İlgi alanların, sevdiğin şeyler veya seni anlatan birkaç kelime…"
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        style={[styles.bioInput, localError && styles.fieldInvalid]}
        textAlignVertical="top"
        value={bio}
      />
      <View style={styles.bioMeta}>
        <AppText style={[styles.helperText, localError && styles.errorText]}>
          {localError ?? 'İstersen boş bırakabilirsin.'}
        </AppText>
        <AppText style={styles.characterCount}>{characterCount}/{maxBioCodePoints}</AppText>
      </View>
    </View>
  );
});

export const ReviewStep = memo(function ReviewStep({
  username,
  genderLabel,
  bio,
  photo,
  onEdit,
}: {
  username: string;
  genderLabel: string;
  bio: string;
  photo: SelectedPhoto | null;
  onEdit: (step: number) => void;
}) {
  return (
    <View style={styles.reviewList}>
      <ReviewRow label="Kullanıcı adı" value={`@${username}`} onPress={() => onEdit(0)} />
      <ReviewRow label="Cinsiyet" value={genderLabel} onPress={() => onEdit(1)} />
      <ReviewRow label="Biyografi" value={bio ? 'Eklendi' : 'Eklenmedi'} onPress={() => onEdit(2)} />
      <AppPressable accessibilityRole="button" accessibilityLabel="Profil fotoğrafı bilgisini düzenle" onPress={() => onEdit(3)} style={styles.reviewRow}>
        <AppText style={styles.reviewLabel}>Profil fotoğrafı</AppText>
        <View style={styles.reviewValueGroup}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.reviewPhoto} /> : <AppText style={styles.reviewValue}>Eklenmedi</AppText>}
          <ChevronRight size={17} color={colors.muted} />
        </View>
      </AppPressable>
    </View>
  );
});

function ReviewRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <AppPressable accessibilityRole="button" accessibilityLabel={`${label} bilgisini düzenle`} onPress={onPress} style={styles.reviewRow}>
      <AppText style={styles.reviewLabel}>{label}</AppText>
      <View style={styles.reviewValueGroup}>
        <AppText style={styles.reviewValue}>{value}</AppText>
        <ChevronRight size={17} color={colors.muted} />
      </View>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  stepContent: { paddingTop: 26 },
  fieldLabel: { color: colors.ink, fontSize: 15, fontWeight: '600', marginBottom: 10 },
  usernameField: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#DADCE0', borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 16 },
  fieldInvalid: { borderColor: colors.error },
  fieldValid: { borderColor: colors.green },
  usernamePrefix: { color: colors.muted, fontSize: 17 },
  usernameInput: { flex: 1, minWidth: 0, height: 54, color: colors.ink, fontSize: 16, fontFamily: 'GoogleSansRegular', paddingVertical: 0 },
  helperText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  errorText: { color: colors.error },
  successText: { color: colors.green },
  retryLink: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  options: { gap: 10 },
  genderOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#DADCE0', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  genderOptionSelected: { borderColor: colors.primary, backgroundColor: '#F7FAFF' },
  optionCopy: { flex: 1, paddingRight: 12 },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  optionDescription: { color: colors.muted, fontSize: 12, marginTop: 4 },
  radioOuter: { width: 20, height: 20, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  bioInput: { minHeight: 156, borderWidth: 1, borderColor: '#DADCE0', borderRadius: 16, color: colors.ink, fontSize: 15, lineHeight: 22, padding: 15, fontFamily: 'GoogleSansRegular' },
  bioMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  characterCount: { color: colors.muted, fontSize: 12, marginTop: 8 },
  reviewList: { paddingTop: 22 },
  reviewRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceBlue },
  reviewValueGroup: { maxWidth: '70%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewLabel: { color: colors.muted, fontSize: 13 },
  reviewValue: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '500', textAlign: 'right' },
  reviewPhoto: { width: 42, height: 42, borderRadius: 21 },
});
