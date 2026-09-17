import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { calculatePriceBreakdown } from "@taskswift/business-logic";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useProviderBundle, useTaskSwiftStore } from "../data";
import { formatMoney, pricingLabel } from "../lib/format";

interface TimeSlot {
  label: string;
  daysFromNow: number;
  hour: number;
}

const SLOTS: TimeSlot[] = [
  { label: "Hoy 5:00 PM", daysFromNow: 0, hour: 17 },
  { label: "Mañana 9:00 AM", daysFromNow: 1, hour: 9 },
  { label: "Mañana 3:00 PM", daysFromNow: 1, hour: 15 },
  { label: "Pasado mañana 11:00 AM", daysFromNow: 2, hour: 11 },
];

function slotToIso(slot: TimeSlot): string {
  const d = new Date();
  d.setDate(d.getDate() + slot.daysFromNow);
  d.setHours(slot.hour, 0, 0, 0);
  return d.toISOString();
}

export function BookingRequestScreen({ providerId, providerServiceId }: { providerId: string; providerServiceId: string }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const bundle = useProviderBundle(providerId);
  const addresses = useTaskSwiftStore((s) => s.addresses);
  const createBooking = useTaskSwiftStore((s) => s.createBooking);

  const [timing, setTiming] = useState<"now" | "scheduled">("scheduled");
  const [slotIndex, setSlotIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const myAddresses = useMemo(() => addresses.filter((a) => a.userId === currentUser?.id), [addresses, currentUser]);
  const [addressId, setAddressId] = useState<string | undefined>(myAddresses[0]?.id);

  if (!bundle || !currentUser) return null;
  const { user, service } = bundle;

  const breakdown = calculatePriceBreakdown({
    servicePrice: service.price ?? 0,
    currency: service.currency,
    countryCode: "CO",
  });

  const selectedAddress = myAddresses.find((a) => a.id === addressId);
  const canSubmit = !!selectedAddress && (timing === "now" || SLOTS[slotIndex]);

  async function submit() {
    if (!canSubmit || !selectedAddress) return;
    setSubmitting(true);
    try {
      const booking = await createBooking({
        customerId: currentUser!.id,
        providerId,
        providerServiceId,
        timing,
        scheduledFor: timing === "scheduled" ? slotToIso(SLOTS[slotIndex]!) : undefined,
        addressId: selectedAddress.id,
        notes: notes.trim() || undefined,
      });
      router.replace({ pathname: "/(customer)/booking/[id]", params: { id: booking.id } });
    } catch (e) {
      Alert.alert("No se pudo crear la reserva", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      scroll
      padded={false}
      footer={<Button label="Solicitar servicio" onPress={submit} disabled={!canSubmit} loading={submitting} />}
    >
      <View style={styles.section}>
        <Text style={typography.h2}>Con {user.firstName}</Text>
        <Text style={typography.caption}>{pricingLabel(service.pricingModel, service.price, service.currency)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={typography.h3}>¿Cuándo?</Text>
        <View style={styles.timingRow}>
          <ToggleButton label="Programar" active={timing === "scheduled"} onPress={() => setTiming("scheduled")} />
          <ToggleButton label="Lo necesito ahora" active={timing === "now"} onPress={() => setTiming("now")} />
        </View>
        {timing === "scheduled" && (
          <View style={styles.slotsWrap}>
            {SLOTS.map((slot, i) => (
              <Pressable key={slot.label} onPress={() => setSlotIndex(i)} style={[styles.slotChip, slotIndex === i && styles.slotChipActive]}>
                <Text style={[typography.captionStrong, slotIndex === i && { color: colors.textInverse }]}>{slot.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={typography.h3}>¿Dónde?</Text>
        {myAddresses.length === 0 ? (
          <Text style={typography.caption}>No tienes direcciones guardadas.</Text>
        ) : (
          myAddresses.map((addr) => (
            <Pressable key={addr.id} onPress={() => setAddressId(addr.id)} style={[styles.addressCard, addressId === addr.id && styles.addressCardActive]}>
              <Ionicons name={addressId === addr.id ? "radio-button-on" : "radio-button-off"} size={20} color={addressId === addr.id ? colors.brand : colors.textMuted} />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text style={typography.bodyStrong}>{addr.label}</Text>
                <Text style={typography.caption}>
                  {addr.line1}, {addr.city}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={typography.h3}>Notas para el proveedor (opcional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Ej: el apartamento queda en el piso 4, portería con recepción..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <Pressable style={styles.attachRow}>
          <Ionicons name="camera-outline" size={18} color={colors.textSecondary} />
          <Text style={typography.caption}>Agregar fotos (opcional)</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={typography.h3}>Método de pago</Text>
        <View style={styles.paymentCard}>
          <Ionicons name="card-outline" size={20} color={colors.textPrimary} />
          <Text style={[typography.body, { marginLeft: spacing.sm }]}>Tarjeta terminada en 4242 (modo demo)</Text>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={{ marginLeft: "auto" }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={typography.h3}>Resumen de precio</Text>
        <View style={styles.priceCard}>
          <PriceRow label="Servicio" value={formatMoney(breakdown.servicePrice, breakdown.currency)} />
          <PriceRow label="Tarifa TaskSwift" value={formatMoney(breakdown.customerFee, breakdown.currency)} />
          <View style={styles.priceDivider} />
          <PriceRow label="Total" value={formatMoney(breakdown.total, breakdown.currency)} bold />
        </View>
      </View>
    </Screen>
  );
}

function ToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggleBtn, active && styles.toggleBtnActive]}>
      <Text style={[typography.captionStrong, active && { color: colors.textInverse }]}>{label}</Text>
    </Pressable>
  );
}

function PriceRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.priceRow}>
      <Text style={bold ? typography.bodyStrong : typography.body}>{label}</Text>
      <Text style={bold ? typography.h3 : typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  timingRow: { flexDirection: "row", gap: spacing.sm },
  toggleBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  toggleBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  slotsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  slotChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  slotChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  addressCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md },
  addressCardActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  notesInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, minHeight: 72, textAlignVertical: "top" },
  attachRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  paymentCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md },
  priceCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, gap: spacing.xs },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
