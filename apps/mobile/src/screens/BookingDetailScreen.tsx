import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { calculateCancellationOutcome } from "@taskswift/business-logic";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { StatusPill } from "../components/StatusPill";
import { Avatar } from "../components/Avatar";
import { MapView } from "../components/MapView";
import { MapMarker } from "../components/mapTypes";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { formatDateTime, formatMoney } from "../lib/format";

const STEPS: { status: string; label: string }[] = [
  { status: "accepted", label: "Aceptado" },
  { status: "provider_en_route", label: "En camino" },
  { status: "in_progress", label: "En curso" },
  { status: "completed", label: "Completado" },
];

export function BookingDetailScreen({ bookingId, chatPathname }: { bookingId: string; chatPathname: string }) {
  const router = useRouter();
  const navigation = useNavigation();
  const currentUser = useCurrentUser();
  const booking = useTaskSwiftStore((s) => s.bookings.find((b) => b.id === bookingId));
  const users = useTaskSwiftStore((s) => s.users);
  const reviews = useTaskSwiftStore((s) => s.reviews);
  const serviceAreas = useTaskSwiftStore((s) => s.serviceAreas);
  const respondToRequest = useTaskSwiftStore((s) => s.respondToRequest);
  const markEnRoute = useTaskSwiftStore((s) => s.markEnRoute);
  const startService = useTaskSwiftStore((s) => s.startService);
  const markProviderComplete = useTaskSwiftStore((s) => s.markProviderComplete);
  const confirmCompletion = useTaskSwiftStore((s) => s.confirmCompletion);
  const cancelBooking = useTaskSwiftStore((s) => s.cancelBooking);
  const [busy, setBusy] = useState(false);
  const [cancelingActor, setCancelingActor] = useState<"customer" | "provider" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: "Detalle del servicio" });
  }, [navigation]);

  if (!booking || !currentUser) {
    return (
      <Screen>
        <Text style={typography.body}>Reserva no encontrada.</Text>
      </Screen>
    );
  }

  const isProviderView = currentUser.id === booking.providerId;
  const counterpart = users.find((u) => u.id === (isProviderView ? booking.customerId : booking.providerId));
  const alreadyReviewed = reviews.some((r) => r.bookingId === booking.id && r.authorId === currentUser.id);
  const isActive = !["cancelled_customer", "cancelled_provider", "expired", "refunded"].includes(booking.status);
  const isTerminalCancelled = booking.status === "cancelled_customer" || booking.status === "cancelled_provider";

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const cancellationOutcome = cancelingActor ? calculateCancellationOutcome(booking, cancelingActor, new Date()) : null;

  const providerArea = serviceAreas.find((a) => a.providerId === booking.providerId);
  const trackingMarkers: MapMarker[] = [
    ...(providerArea ? [{ id: "provider", position: providerArea.center, variant: "provider" as const }] : []),
    {
      id: "destination",
      position: booking.address.location,
      variant: "destination",
      label: booking.status === "provider_en_route" ? "5 min" : undefined,
    },
  ];

  return (
    <Screen scroll padded={false}>
      <View style={styles.header}>
        <StatusPill status={booking.status} />
        <Text style={[typography.h2, { marginTop: spacing.sm }]}>{formatMoney(booking.priceBreakdown.total, booking.priceBreakdown.currency)}</Text>
        <Text style={typography.caption}>
          {booking.timing === "now" ? "Servicio inmediato" : formatDateTime(booking.scheduledFor)}
        </Text>
      </View>

      {isActive && !isTerminalCancelled && (
        <View style={styles.timeline}>
          {STEPS.map((step, i) => {
            const stepIndex = STEPS.findIndex((s) => s.status === booking.status);
            const reached = stepIndex >= i || booking.status === "awaiting_completion_confirmation";
            const isCompletedStep = step.status === "completed" && booking.status !== "completed";
            const done = isCompletedStep ? false : reached;
            return (
              <View key={step.status} style={styles.timelineItem}>
                <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={18} color={done ? colors.brand : colors.textMuted} />
                <Text style={[typography.caption, done && { color: colors.textPrimary, fontWeight: "600" }]}>{step.label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {(booking.status === "provider_en_route" || booking.status === "in_progress") && (
        <View style={styles.section}>
          <MapView height={200} markers={trackingMarkers} />
        </View>
      )}

      {counterpart && (
        <View style={styles.counterpartCard}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Avatar firstName={counterpart.firstName} lastName={counterpart.lastName} size={48} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={typography.bodyStrong}>
                {counterpart.firstName} {counterpart.lastName}
              </Text>
              <Text style={typography.caption}>{isProviderView ? "Cliente" : "Proveedor"}</Text>
            </View>
          </View>
          <View style={styles.quickActionsRow}>
            {counterpart.phone && (
              <QuickAction icon="call-outline" label="Llamar" onPress={() => Linking.openURL(`tel:${counterpart.phone}`)} />
            )}
            <QuickAction
              icon="chatbubble-outline"
              label="Mensaje"
              onPress={() => router.push({ pathname: chatPathname as never, params: { bookingId: booking.id } })}
            />
            <QuickAction
              icon="help-buoy-outline"
              label="Soporte"
              onPress={() => router.push({ pathname: chatPathname as never, params: { bookingId: booking.id } })}
            />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={typography.h3}>Ubicación</Text>
        <Text style={typography.body}>
          {booking.address.line1 || booking.address.label}, {booking.address.city}
        </Text>
        {booking.notes && (
          <>
            <Text style={[typography.h3, { marginTop: spacing.md }]}>Notas</Text>
            <Text style={typography.body}>{booking.notes}</Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={typography.h3}>Precio</Text>
        <View style={styles.priceCard}>
          <PriceRow label="Servicio" value={formatMoney(booking.priceBreakdown.servicePrice, booking.priceBreakdown.currency)} />
          <View style={styles.priceDivider} />
          <PriceRow label="Total" value={formatMoney(booking.priceBreakdown.total, booking.priceBreakdown.currency)} bold />
          {isProviderView && <PriceRow label="Recibes" value={formatMoney(booking.priceBreakdown.providerPayout, booking.priceBreakdown.currency)} />}
        </View>
      </View>

      {actionError && (
        <View style={styles.section}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        </View>
      )}

      {cancelingActor && cancellationOutcome ? (
        <View style={styles.section}>
          <View style={styles.cancelCard}>
            <Text style={typography.h3}>¿Cancelar servicio?</Text>
            <Text style={[typography.body, { marginTop: spacing.xs }]}>
              {cancellationOutcome.cancellationFee > 0
                ? `Se aplicará una tarifa de cancelación tardía de ${formatMoney(cancellationOutcome.cancellationFee, cancellationOutcome.currency)}. Reembolso: ${formatMoney(cancellationOutcome.refundAmount, cancellationOutcome.currency)}.`
                : `Cancelación gratuita. Reembolso completo: ${formatMoney(cancellationOutcome.refundAmount, cancellationOutcome.currency)}.`}
            </Text>
            <View style={styles.actionRow}>
              <Button label="Volver" variant="outline" fullWidth={false} style={styles.halfButton} onPress={() => setCancelingActor(null)} />
              <Button
                label="Cancelar servicio"
                variant="danger"
                fullWidth={false}
                loading={busy}
                onPress={() => withBusy(() => cancelBooking(booking.id, cancelingActor)).then(() => setCancelingActor(null))}
                style={styles.halfButton}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {isProviderView ? (
            <ProviderActions
              status={booking.status}
              busy={busy}
              onAccept={() => withBusy(() => respondToRequest(booking.id, "accept"))}
              onDecline={() => withBusy(() => respondToRequest(booking.id, "decline"))}
              onEnRoute={() => withBusy(() => markEnRoute(booking.id))}
              onStart={() => withBusy(() => startService(booking.id))}
              onComplete={() => withBusy(() => markProviderComplete(booking.id))}
              onCancel={() => setCancelingActor("provider")}
            />
          ) : (
            <CustomerActions
              status={booking.status}
              busy={busy}
              alreadyReviewed={alreadyReviewed}
              onConfirmCompletion={() => withBusy(() => confirmCompletion(booking.id))}
              onReview={() => router.push({ pathname: "/(customer)/review/[bookingId]", params: { bookingId: booking.id } })}
              onCancel={() => setCancelingActor("customer")}
            />
          )}
        </View>
      )}
    </Screen>
  );
}

function ProviderActions(props: {
  status: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onEnRoute: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const { status, busy } = props;
  if (status === "requested" || status === "pending_provider") {
    return (
      <View style={styles.actionRow}>
        <Button label="Rechazar" variant="outline" onPress={props.onDecline} loading={busy} />
        <Button label="Aceptar" onPress={props.onAccept} loading={busy} />
      </View>
    );
  }
  if (status === "accepted") {
    return (
      <>
        <Button label="Marcar en camino" onPress={props.onEnRoute} loading={busy} />
        <Button label="Cancelar" variant="outline" onPress={props.onCancel} style={styles.spacedTop} />
      </>
    );
  }
  if (status === "provider_en_route") {
    return <Button label="Iniciar servicio" onPress={props.onStart} loading={busy} />;
  }
  if (status === "in_progress") {
    return <Button label="Marcar como completado" onPress={props.onComplete} loading={busy} />;
  }
  if (status === "awaiting_completion_confirmation") {
    return <Text style={typography.caption}>Esperando la confirmación del cliente...</Text>;
  }
  return null;
}

function CustomerActions(props: {
  status: string;
  busy: boolean;
  alreadyReviewed: boolean;
  onConfirmCompletion: () => void;
  onReview: () => void;
  onCancel: () => void;
}) {
  const { status, busy } = props;
  if (status === "requested" || status === "pending_provider" || status === "accepted" || status === "provider_en_route") {
    return <Button label="Cancelar solicitud" variant="outline" onPress={props.onCancel} loading={busy} />;
  }
  if (status === "awaiting_completion_confirmation") {
    return <Button label="Confirmar finalización" onPress={props.onConfirmCompletion} loading={busy} />;
  }
  if (status === "completed" && !props.alreadyReviewed) {
    return <Button label="Calificar servicio" onPress={props.onReview} />;
  }
  return null;
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <Text style={typography.tiny}>{label}</Text>
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  timeline: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  timelineItem: { alignItems: "center", gap: 4, flex: 1 },
  counterpartCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  quickActionsRow: { flexDirection: "row", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  quickAction: { alignItems: "center", gap: 4 },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  priceCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, gap: spacing.xs },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  actions: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xxl, gap: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  spacedTop: { marginTop: spacing.sm },
  cancelCard: { borderWidth: 1, borderColor: colors.danger, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.xxl },
  halfButton: { flex: 1 },
  errorBox: { backgroundColor: "#FDECEC", borderWidth: 1, borderColor: colors.danger, borderRadius: radii.md, padding: spacing.md },
  errorText: { color: colors.danger },
});
