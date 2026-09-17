import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { PricingModel } from "@taskswift/types";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";

const CITIES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"];
const PRICING_MODELS: { value: PricingModel; label: string }[] = [
  { value: "fixed", label: "Precio fijo" },
  { value: "starting_at", label: "Desde" },
  { value: "hourly", label: "Por hora" },
  { value: "custom_quote", label: "Cotización" },
];

export function ProviderOnboardingScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const categories = useTaskSwiftStore((s) => s.categories);
  const subcategories = useTaskSwiftStore((s) => s.subcategories);
  const services = useTaskSwiftStore((s) => s.services);
  const becomeProvider = useTaskSwiftStore((s) => s.becomeProvider);

  const [categoryId, setCategoryId] = useState<string | undefined>(categories[0]?.id);
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [pricingModel, setPricingModel] = useState<PricingModel>("fixed");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState(CITIES[0]);

  if (!currentUser) return null;

  const availableSubcategories = subcategories.filter((sc) => sc.categoryId === categoryId);
  const availableServices = services.filter((svc) => availableSubcategories.some((sc) => sc.id === svc.subcategoryId));
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = !!serviceId && headline.trim().length > 2 && (pricingModel === "custom_quote" || price.trim().length > 0);

  async function submit() {
    if (!canSubmit || !serviceId) return;
    setSubmitting(true);
    try {
      await becomeProvider({
        userId: currentUser!.id,
        headline: headline.trim(),
        bio: bio.trim() || undefined,
        serviceId,
        pricingModel,
        price: pricingModel === "custom_quote" ? null : Number(price),
        city: city!,
      });
      router.replace("/(provider)/(tabs)/home");
    } catch (e) {
      Alert.alert("No se pudo publicar tu perfil", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={typography.display}>Ofrece tus servicios</Text>
      <Text style={typography.caption}>Publica tu perfil de proveedor en TaskSwift en unos minutos.</Text>

      <Text style={[typography.h3, styles.label]}>Categoría</Text>
      <View style={styles.chipsWrap}>
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => { setCategoryId(c.id); setServiceId(undefined); }} />
        ))}
      </View>

      <Text style={[typography.h3, styles.label]}>Servicio</Text>
      <View style={styles.chipsWrap}>
        {availableServices.map((svc) => (
          <Chip key={svc.id} label={svc.name} active={serviceId === svc.id} onPress={() => setServiceId(svc.id)} />
        ))}
      </View>

      <Text style={[typography.h3, styles.label]}>Título profesional</Text>
      <TextInput style={styles.input} placeholder="Ej: Barbero, Maquilladora, Handyman..." placeholderTextColor={colors.textMuted} value={headline} onChangeText={setHeadline} />

      <Text style={[typography.h3, styles.label]}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Cuéntale a tus clientes sobre tu experiencia..."
        placeholderTextColor={colors.textMuted}
        value={bio}
        onChangeText={setBio}
        multiline
      />

      <Text style={[typography.h3, styles.label]}>Modelo de precio</Text>
      <View style={styles.chipsWrap}>
        {PRICING_MODELS.map((pm) => (
          <Chip key={pm.value} label={pm.label} active={pricingModel === pm.value} onPress={() => setPricingModel(pm.value)} />
        ))}
      </View>

      {pricingModel !== "custom_quote" && (
        <>
          <Text style={[typography.h3, styles.label]}>Precio (COP)</Text>
          <TextInput style={styles.input} placeholder="35000" placeholderTextColor={colors.textMuted} value={price} onChangeText={setPrice} keyboardType="numeric" />
        </>
      )}

      <Text style={[typography.h3, styles.label]}>Ciudad</Text>
      <View style={styles.chipsWrap}>
        {CITIES.map((c) => (
          <Chip key={c} label={c} active={city === c} onPress={() => setCity(c)} />
        ))}
      </View>

      <Button label="Publicar mi perfil" onPress={submit} disabled={!canSubmit} loading={submitting} style={styles.submit} />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[typography.captionStrong, active && { color: colors.textInverse }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  submit: { marginTop: spacing.xxl, marginBottom: spacing.xxl },
});
