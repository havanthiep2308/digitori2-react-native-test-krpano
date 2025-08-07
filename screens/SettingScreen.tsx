import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, Chip, useTheme } from 'react-native-paper';

const COLORS = [
  '#ede7f6', '#fffde7', '#e8f5e9', '#e3f2fd', '#fce4ec', '#fff', '#222', '#1976d2', '#d81b60', '#388e3c'
];

const SettingScreen = () => {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [color, setColor] = useState(COLORS[0]);
  const theme = useTheme();

  return (
    <View style={styles.root}>
      <Card style={[styles.card, { backgroundColor: color }]} elevation={4}>
        <Card.Title title={lang === 'vi' ? 'Cài đặt' : 'Settings'} titleStyle={{ fontWeight: 'bold', fontSize: 28, color: '#512da8' }} />
        <Card.Content>
          <Text style={styles.desc}>{lang === 'vi' ? 'Chọn ngôn ngữ và màu chủ đề cho app.' : 'Choose language and theme color.'}</Text>
          <View style={styles.row}>
            <Chip
              selected={lang === 'vi'}
              onPress={() => setLang('vi')}
              style={styles.chip}
              textStyle={{ color: lang === 'vi' ? '#fff' : '#512da8' }}
              selectedColor="#fff"
              >VI</Chip>
            <Chip
              selected={lang === 'en'}
              onPress={() => setLang('en')}
              style={styles.chip}
              textStyle={{ color: lang === 'en' ? '#fff' : '#512da8' }}
              selectedColor="#fff"
              >EN</Chip>
          </View>
          <Text style={[styles.desc, { marginTop: 24 }]}>{lang === 'vi' ? 'Chọn màu chủ đề:' : 'Choose theme color:'}</Text>
          <View style={styles.colorRow}>
            {COLORS.map(c => (
              <Button
                key={c}
                mode={color === c ? 'contained' : 'outlined'}
                style={[styles.colorBtn, { backgroundColor: c }]}
                onPress={() => setColor(c)}
                compact
              >
                {color === c ? '✓' : ''}
              </Button>
            ))}
          </View>
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
    backgroundColor: '#ede7f6',
  },
  card: {
    width: '92%',
    borderRadius: 16,
    paddingVertical: 16,
  },
  desc: {
    marginBottom: 8,
    fontSize: 16,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 8,
    justifyContent: 'center',
  },
  chip: {
    marginHorizontal: 8,
    backgroundColor: '#ede7f6',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    justifyContent: 'center',
  },
  colorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    margin: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#512da8',
  },
});

export default SettingScreen; 