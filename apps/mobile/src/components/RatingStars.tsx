import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";

interface RatingStarsProps {
  rating: number;
  count?: number;
  size?: number;
  showValue?: boolean;
}

export function RatingStars({ rating, count, size = 13, showValue = true }: RatingStarsProps) {
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.star, fontSize: size }}>★</Text>
      {showValue && <Text style={[typography.captionStrong, styles.value]}>{rating.toFixed(1)}</Text>}
      {count !== undefined && <Text style={typography.caption}> · {count} reseñas</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  value: { marginLeft: 4 },
});
