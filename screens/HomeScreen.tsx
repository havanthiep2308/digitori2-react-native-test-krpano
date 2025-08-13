import React, { useEffect, useState, createContext, useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, useTheme, Switch } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

// Context cho theme (demo, có thể chuyển sang global context sau)
const ThemeContext = createContext({
  isDark: false,
  toggleTheme: () => {},
});

const EXAMPLES = [
  {
    title: 'Krpano Paris Tour',
    url: 'https://krpano.com/tours/paris/',
  },,
  {
    title: 'Krpano Apartment Tour (3D)',
    url: 'https://krpano.com/releases/1.23/viewer/krpano.html?xml=examples/demotour-apartment/tour.xml',
  },
  {
    title: 'Krpano Corfu Holiday Trip',
    url: 'https://krpano.com/releases/1.23/viewer/krpano.html?xml=examples/demotour-corfu/tour.xml',
  },
  {
    title: 'Krpano Winecellar',
    url: 'https://krpano.com/releases/1.23/viewer/krpano.html?xml=examples/demotour-winecellar/tour.xml',
  },
  {
    title: 'Krpano Indian Temple Stereoscopic 3D',
    url: 'https://krpano.com/tours/indiantemple3d/',
  },
  {
    title: 'Krpano Little Temple of Abu Simbel',
    url: 'https://krpano.com/releases/1.23/viewer/krpano.html?xml=examples/depthmap/abu-simbel-tempel-tour/tour.xml',
  },,
  {
    title: 'Krpano Gravina Apartment',
    url: 'https://krpano.com/releases/1.23/viewer/krpano.html?xml=examples/depthmap/gravina-apartment-tour/main.xml',
  },
];

const HomeScreen = () => {
  const [now, setNow] = useState(new Date());
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const theme = useTheme();
  const navigation = useNavigation<any>();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }] }>
      <Card style={styles.card} elevation={4}>
        <Card.Title title="Home" titleStyle={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 28 }} />
        <Card.Content>
          <Text style={{ color: theme.colors.onSurface, fontSize: 16 }}>
            Đây là ví dụ về View, Text, Color, StyleSheet trong React Native.
          </Text>
          <Text style={{ marginTop: 20, fontSize: 18, color: theme.colors.primary }}>
            {now.toLocaleString()}
          </Text>
          <View style={{ marginTop: 12 }}>
            {EXAMPLES.map((item, idx) => (
              <Button
                key={item.title}
                mode="contained"
                style={{ marginVertical: 8 }}
                onPress={() => navigation.navigate('Krpano', { url: item.url })}
              >
                {item.title}
              </Button>
            ))}
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

export default function HomeScreenWithTheme() {
  const [isDark, setIsDark] = useState(false);
  const toggleTheme = () => setIsDark(v => !v);
  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <HomeScreen />
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '90%',
    borderRadius: 16,
    paddingVertical: 16,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
}); 