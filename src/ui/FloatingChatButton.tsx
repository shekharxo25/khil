import React from 'react';
import { Pressable, StyleSheet, View, Modal } from 'react-native';
import { Txt } from './Txt';
import { color, space } from '../theme/tokens';

/**
 * Floating chat button in bottom right corner.
 * Opens a mini chat modal when pressed.
 */
export function FloatingChatButton({
  onPress,
  visible,
  onClose,
  children,
}: {
  onPress: () => void;
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Pressable
        onPress={onPress}
        style={styles.button}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Open chat"
      >
        <Txt style={styles.emoji}>💬</Txt>
      </Pressable>

      {children && (
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <Pressable style={styles.backdrop} onPress={onClose}>
            <View style={styles.modal}>{children}</View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: space.xl,
    right: space.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.brand,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  emoji: {
    fontSize: 28,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: color.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 300,
  },
});
