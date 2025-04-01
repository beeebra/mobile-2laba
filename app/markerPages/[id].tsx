import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as SQLite from 'expo-sqlite';


const db = SQLite.openDatabaseSync('markers.db');

export default function MarkerPage() {
  const router = useRouter();
  const { marker: markerJson } = useLocalSearchParams<{ marker?: string }>();
  const [localImages, setLocalImages] = useState<string[]>([]);
  
  // Парсим данные маркера
  const marker = markerJson ? JSON.parse(markerJson) : null;

  // Загружаем фото при монтировании
  useEffect(() => {
    if (marker?.id) {
      loadPhotos(marker.id);
    }
  }, [marker?.id]);

  // Загрузка фото из базы данных
  const loadPhotos = async (pointId: string) => {
    try {
      const results = await db.getAllAsync<{ uri: string }>(
        'SELECT uri FROM photos WHERE point_id = ?',
        [pointId]
      );
      setLocalImages(results.map(item => item.uri));
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  };

  // Добавление новых фото
  const handleAddImage = async () => {
    if (!marker?.id) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      aspect: [1, 1],
      quality: 1,
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled && result.assets) {
      try {
        await db.withTransactionAsync(async () => {
          for (const asset of result.assets) {
            const fileName = asset.uri.split('/').pop();
            const newUri = `${FileSystem.documentDirectory}${fileName}`;
            
            // Копируем файл в постоянное хранилище
            await FileSystem.copyAsync({
              from: asset.uri,
              to: newUri,
            });

            // Сохраняем в базу данных
            await db.runAsync(
              'INSERT INTO photos (id, point_id, uri) VALUES (?, ?, ?)',
              [Date.now().toString(), marker.id, newUri]
            );
          }
          
          // Обновляем список фото
          await loadPhotos(marker.id);
        });
      } catch (error) {
        console.error('Error saving images:', error);
      }
    }
  };

  // Сохранение и возврат
  const handleSave = () => {
    router.back();
    if (marker) {
      router.setParams({ 
        updatedMarker: JSON.stringify({
          id: marker.id,
          images: localImages
        }) 
      });
    }
  };

  if (!marker) return <Text style={styles.errorText}>Маркер не найден</Text>;

  return (
    <LinearGradient colors={['#e0f7fa', '#80deea']} style={styles.container}>
      <View style={styles.content}>
        <FlatList
          data={localImages}
          keyExtractor={(item, index) => index.toString()}
          numColumns={3}
          renderItem={({ item }) => (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: item }} 
                style={styles.image}
                contentFit="cover"
              />
            </View>
          )}
        />
        <View style={styles.buttonContainer}>
          <Button 
            title="Добавить фото" 
            onPress={handleAddImage} 
            color="#00796b" 
          />
          <Button 
            title="Сохранить" 
            onPress={handleSave} 
            color="#00796b" 
          />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  imageContainer: {
    margin: 5,
    aspectRatio: 1,
    width: '30%',
    height: undefined,
    overflow: 'hidden',
    borderRadius: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  buttonContainer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
});