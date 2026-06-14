import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { diagBreadcrumb, diagRecordError } from '@/lib/crashDiag';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  children: React.ReactNode;
  onBack: () => void;
};

type State = { error: Error | null };

export class LiveSessionErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    diagRecordError(error, false);
    diagBreadcrumb('live_session:error_boundary', {
      message: error.message,
      componentStack: info.componentStack?.slice(0, 400),
    });
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Session failed to load</Text>
          <Text style={styles.msg} selectable>
            {this.state.error.message}
          </Text>
          <Pressable style={styles.btn} onPress={this.props.onBack}>
            <Text style={styles.btnTxt}>Go back</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg_v3,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodyLg,
  },
  msg: {
    color: colors.accent_red,
    fontSize: typography.fontSize.bodySm,
    lineHeight: 20,
  },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surface_v3,
  },
  btnTxt: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.medium,
  },
});
