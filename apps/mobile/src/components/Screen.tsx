import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
  /** Rendered below the scroll content, outside the ScrollView, so a primary
   * CTA (e.g. "Solicitar servicio") stays reachable without scrolling to the end. */
  footer?: React.ReactNode;
}

export function Screen({ children, scroll = false, padded = true, style, edges = ["top"], footer }: ScreenProps) {
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <Container
        style={scroll ? styles.scroll : [styles.flex, style]}
        contentContainerStyle={scroll ? [padded && styles.padded, style] : undefined}
      >
        {children}
      </Container>
      {footer && <View style={styles.footer}>{footer}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  padded: { padding: 16, paddingBottom: 40 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
});
