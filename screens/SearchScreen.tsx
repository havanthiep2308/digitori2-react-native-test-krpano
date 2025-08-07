import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, TextInput, List, Divider } from 'react-native-paper';

const DATA = [
  'React Native',
  'Expo',
  'Navigation',
  'Component',
  'Props',
  'State',
  'Hook',
  'TypeScript',
  'Android',
  'iOS',
];

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const filtered = DATA.filter(item => item.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={styles.root}>
      <Card style={styles.card} elevation={4}>
        <Card.Title title="Search" titleStyle={{ fontWeight: 'bold', fontSize: 28, color: '#fbc02d' }} />
        <Card.Content>
          <Text style={styles.desc}>Tìm kiếm trong danh sách:</Text>
          <TextInput
            mode="outlined"
            style={styles.input}
            placeholder="Nhập từ khoá..."
            value={query}
            onChangeText={setQuery}
            left={<TextInput.Icon icon="magnify" />}
          />
          <View style={{ marginTop: 10 }}>
            {filtered.length === 0 ? (
              <Text style={{ color: '#aaa', marginTop: 10 }}>Không có kết quả</Text>
            ) : (
              filtered.map((item, idx) => (
                <View key={item}>
                  <List.Item
                    title={item}
                    titleStyle={{ color: query && item.toLowerCase().includes(query.toLowerCase()) ? '#1976d2' : '#222', fontWeight: 'bold' }}
                    left={props => <List.Icon {...props} icon="chevron-right" color="#1976d2" />}
                  />
                  {idx < filtered.length - 1 && <Divider />}
                </View>
              ))
            )}
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
    backgroundColor: '#fffde7',
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
  input: {
    backgroundColor: '#fff',
  },
});

export default SearchScreen; 