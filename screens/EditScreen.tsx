import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Card, Text, TextInput, Button, List, Divider, IconButton } from 'react-native-paper';

const initialData = [
  { key: '1', value: 'React Native' },
  { key: '2', value: 'FlatList' },
  { key: '3', value: 'Demo List' },
];

const EditScreen = () => {
  const [data, setData] = useState(initialData);
  const [text, setText] = useState('');

  const addItem = () => {
    if (!text.trim()) return;
    setData(prev => [...prev, { key: Date.now().toString(), value: text }]);
    setText('');
    Alert.alert('Thành công', 'Đã thêm item!');
  };

  const removeItem = (key: string) => {
    setData(prev => prev.filter(item => item.key !== key));
    Alert.alert('Thành công', 'Đã xoá item!');
  };

  return (
    <View style={styles.root}>
      <Card style={styles.card} elevation={4}>
        <Card.Title title="Edit" titleStyle={{ fontWeight: 'bold', fontSize: 28, color: '#388e3c' }} />
        <Card.Content>
          <Text style={styles.desc}>Thêm/Xoá item trong List (FlatList):</Text>
          <View style={styles.row}>
            <TextInput
              mode="outlined"
              style={styles.input}
              placeholder="Nhập nội dung..."
              value={text}
              onChangeText={setText}
            />
            <Button mode="contained" style={styles.addBtn} onPress={addItem} icon="plus">
              Thêm
            </Button>
          </View>
          <View style={{ marginTop: 10 }}>
            {data.map((item, idx) => (
              <View key={item.key} style={styles.itemRow}>
                <List.Item
                  title={item.value}
                  left={props => <List.Icon {...props} icon="circle" color="#388e3c" />}
                  right={props => (
                    <IconButton {...props} icon="delete" color="#d32f2f" onPress={() => removeItem(item.key)} />
                  )}
                />
                {idx < data.length - 1 && <Divider />}
              </View>
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
    backgroundColor: '#e8f5e9',
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
    marginTop: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  addBtn: {
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
  },
  itemRow: {
    backgroundColor: 'transparent',
  },
});

export default EditScreen; 