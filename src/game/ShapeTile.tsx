import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Tile } from './content/patterns';

/**
 * Shapes are drawn, not shipped as images: the tier-3 "subtle pattern
 * difference" needs the dot count and rotation to be parameters, and an asset
 * set would make that a combinatorial mess.
 */
export function ShapeTile({ tile, size }: { tile: Tile; size: number }) {
  const inner = size * 0.66;

  if (tile.shape === 'triangle') {
    return (
      <View style={[styles.center, { width: size, height: size }]}>
        <View style={{ transform: [{ rotate: `${tile.rotation}deg` }] }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: inner * 0.58,
              borderRightWidth: inner * 0.58,
              borderBottomWidth: inner,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: tile.fill,
            }}
          />
          <Dots count={tile.dots} width={inner} bottomBias />
        </View>
      </View>
    );
  }

  const radiusFor: Record<string, number> = {
    circle: inner / 2,
    square: 4,
    rounded: inner * 0.28,
    diamond: 6,
  };

  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: inner,
          height: inner,
          backgroundColor: tile.fill,
          borderRadius: radiusFor[tile.shape] ?? 4,
          transform: [
            { rotate: `${tile.shape === 'diamond' ? 45 + tile.rotation : tile.rotation}deg` },
          ],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Dots count={tile.dots} width={inner} />
      </View>
    </View>
  );
}

function Dots({
  count,
  width,
  bottomBias,
}: {
  count: number;
  width: number;
  bottomBias?: boolean;
}) {
  if (count <= 0) return null;
  const dot = Math.max(6, width * 0.11);
  return (
    <View
      style={[
        styles.dots,
        bottomBias && { position: 'absolute', bottom: width * 0.14, alignSelf: 'center' },
        { maxWidth: width * 0.78 },
      ]}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: '#FFFFFF',
            opacity: 0.92,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
