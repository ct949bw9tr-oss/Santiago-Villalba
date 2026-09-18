import React, { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PricingModel } from "@taskswift/types";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { pricingLabel } from "../lib/format";

const PRICING_MODELS: { value: PricingModel; label: string }[] = [
  { value: "fixed", label: "Precio fijo" },
  { value: "starting_at", label: "Desde" },
  { value: "hourly", label: "Por hora" },
  { value: "custom_quote", label: "Cotización" },
];

export function MyServicesScreen() {
  const currentUser = useCurrentUser();
  const categories = useTaskSwiftStore((s) => s.categories);
  const subcategories = useTaskSwiftStore((s) => s.subcategories);
  const allServices = useTaskSwiftStore((s) => s.services);
  const providerServices = useTaskSwiftStore((s) => s.providerServices);
  const addProviderService = useTaskSwiftStore((s) => s.addProviderService);
  const updateProviderService = useTaskSwiftStore((s) => s.updateProviderService);

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUser) return null;

  const myServices = providerServices.filter((ps) => ps.providerId === currentUser.id);

  return (
    <Screen scroll>
      <Text style={typography.display}>Mis servicios y precios</Text>
      <Text style={typography.caption}>Monta tu propia oferta: agrega tantos servicios y precios como quieras.</Text>

      <View style={styles.list}>
        {myServices.map((ps) => (
          <ServiceRow
            key={ps.id}
            name={allServices.find((s) => s.id === ps.serviceId)?.name ?? "Servicio"}
            pricingLabelText={pricingLabel(ps.pricingModel, ps.price, ps.currency)}
            isActive={ps.isActive}
            onToggleActive={(next) => updateProviderService(ps.id, { isActive: next }).catch((e) => setError(e instanceof Error ? e.message : String(e)))}
          />
        ))}
        {myServices.length === 0 && <Text style={[typography.caption, { marginTop: spacing.md }]}>Todavía no tienes servicios publicados.</Text>}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {adding ? (
        <AddServiceForm
          categories={categories}
          subcategories={subcategories}
          allServices={allServices}
          existingServiceIds={new Set(myServices.map((ps) => ps.serviceId))}
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            setError(null);
            try {
              await addProviderService({ providerId: currentUser.id, ...input });
              setAdding(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        />
      ) : (
        <Button label="+ Agregar servicio" variant="outline" onPress={() => setAdding(true)} style={styles.addButton} />
      )}
    </Screen>
  );
}

function ServiceRow({
  name,
  pricingLabelText,
  isActive,
  onToggleActive,
}: {
  name: string;
  pricingLabelText: string;
  isActive: boolean;
  onToggleActive: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={typography.bodyStrong}>{name}</Text>
        <Text style={typography.caption}>{pricingLabelText}</Text>
      </View>
      <Switch value={isActive} onValueChange={onToggleActive} trackColor={{ true: colors.brand }} />
    </View>
  );
}

function AddServiceForm({
  categories,
  subcategories,
  allServices,
  existingServiceIds,
  onCancel,
  onSubmit,
}: {
  categories: { id: string; name: string }[];
  subcategories: { id: string; categoryId: string }[];
  allServices: { id: string; subcategoryId: string; name: string }[];
  existingServiceIds: Set<string>;
  onCancel: () => void;
  onSubmit: (input: { serviceId: string; pricingModel: PricingModel; price: number | null }) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState<string | undefined>(categories[0]?.id);
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [pricingModel, setPricingModel] = useState<PricingModel>("fixed");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableSubcategories = subcategories.filter((sc) => sc.categoryId === categoryId);
  const availableServices = allServices.filter(
    (svc) => availableSubcategories.some((sc) => sc.id === svc.subcategoryId) && !existingServiceIds.has(svc.id)
  );
  const canSubmit = !!serviceId && (pricingModel === "custom_quote" || price.trim().length > 0);

  async function submit() {
    if (!canSubmit || !serviceId) return;
    setSubmitting(true);
    try {
      await onSubmit({ serviceId, pricingModel, price: pricingModel === "custom_quote" ? null : Number(price) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={[typography.h3, styles.label]}>Categoría</Text>
      <View style={styles.chipsWrap}>
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => { setCategoryId(c.id); setServiceId(undefined); }} />
        ))}
      </View>

      <Text style={[typography.h3, styles.label]}>Servicio</Text>
      <View style={styles.chipsWrap}>
        {availableServices.length === 0 ? (
          <Text style={typography.caption}>Ya tienes todos los servicios de esta categoría.</Text>
        ) : (
          availableServices.map((svc) => <Chip key={svc.id} label={svc.name} active={serviceId === svc.id} onPress={() => setServiceId(svc.id)} />)
        )}
      </View>

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

      <View style={styles.actionRow}>
        <Button label="Cancelar" variant="outline" fullWidth={false} style={styles.halfButton} onPress={onCancel} />
        <Button label="Agregar" fullWidth={false} style={styles.halfButton} disabled={!canSubmit} loading={submitting} onPress={submit} />
      </View>
    </View>
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
  list: { marginTop: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  addButton: { marginTop: spacing.xl, marginBottom: spacing.xxl },
  form: { marginTop: spacing.xl, marginBottom: spacing.xxl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  halfButton: { flex: 1 },
  errorBox: { backgroundColor: "#FDECEC", borderWidth: 1, borderColor: colors.danger, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  errorText: { color: colors.danger },
});
