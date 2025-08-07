import React, { useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Card, Text, IconButton, useTheme } from 'react-native-paper';

const LoveScreen = () => {
  const [count, setCount] = useState(0);
  const [scale] = useState(new Animated.Value(1));
  const theme = useTheme();

  const handleLove = () => {
    setCount(c => c + 1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.5, duration: 150, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={styles.root}>
      <Card style={styles.card} elevation={4}>
        <Card.Title title="Love" titleStyle={{ fontWeight: 'bold', fontSize: 28, color: '#d81b60' }} />
        <Card.Content style={{ alignItems: 'center' }}>
          <Text style={styles.desc}>Thả tim và đếm số lượt yêu thích:</Text>
          <Animated.View style={{ transform: [{ scale }], marginVertical: 16 }}>
            <IconButton
              icon="heart"
              color={theme.colors.error}
              size={64}
              onPress={handleLove}
              style={styles.heartBtn}
            />
          </Animated.View>
          <Text style={styles.count}>{count} lượt yêu thích</Text>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fce4ec',
  },
  card: {
    width: '90%',
    borderRadius: 16,
    paddingVertical: 16,
  },
  desc: {
    marginBottom: 8,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  heartBtn: {
    alignSelf: 'center',
  },
  count: {
    fontSize: 22,
    color: '#d81b60',
    fontWeight: 'bold',
    marginTop: 8,
  },
});

export default LoveScreen; 