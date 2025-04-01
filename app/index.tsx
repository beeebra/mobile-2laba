import React, { useEffect, useState } from 'react';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams, RelativePathString } from 'expo-router';
import * as SQLite from 'expo-sqlite';

interface MarkerData {
  id: string;
  latitude: number;
  longitude: number;
  images: string[];
}

const db = SQLite.openDatabaseSync('markers.db');

export default function MapScreen() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const { updatedMarker } = useLocalSearchParams<{ updatedMarker?: string }>();
  const router = useRouter();

  const INITIAL_REGION = {
    latitude: 44,
    longitude: 43.19,
    latitudeDelta: 2,
    longitudeDelta: 2,
  };

  useEffect(() => {
    db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS points (
          id TEXT PRIMARY KEY,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL
        );
      `);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS photos (
          id TEXT PRIMARY KEY,
          point_id TEXT NOT NULL,
          uri TEXT NOT NULL,
          FOREIGN KEY (point_id) REFERENCES points (id)
        );
      `);
      loadMarkers();
    });
  }, []);

  const loadMarkers = async () => {
    try {
      const results = await db.getAllAsync<{
        id: string;
        latitude: number;
        longitude: number;
        images: string;
      }>(`
        SELECT p.id, p.latitude, p.longitude, 
        (SELECT GROUP_CONCAT(ph.uri, ',') 
         FROM photos ph 
         WHERE ph.point_id = p.id) as images
        FROM points p
      `);
      
      const loadedMarkers = results.map(row => ({
        id: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
        images: row.images ? row.images.split(',') : []
      }));
      
      setMarkers(loadedMarkers);
    } catch (error) {
      console.error('Error loading markers:', error);
    }
  };

  useEffect(() => {
    if (updatedMarker) {
      try {
        const parsedMarker = JSON.parse(updatedMarker);
        setMarkers(prev =>
          prev.map(m =>
            m.id === parsedMarker.id ? { ...m, images: parsedMarker.images } : m
          )
        );
      } catch (error) {
        console.error('Failed to parse updatedMarker:', error);
      }
    }
  }, [updatedMarker]);

  const handleLongPress = async (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const newMarker: MarkerData = {
      id: Date.now().toString(),
      latitude: e.nativeEvent.coordinate.latitude,
      longitude: e.nativeEvent.coordinate.longitude,
      images: [],
    };

    try {
      await db.runAsync(
        'INSERT INTO points (id, latitude, longitude) VALUES (?, ?, ?)',
        [newMarker.id, newMarker.latitude, newMarker.longitude]
      );
      setMarkers(prev => [...prev, newMarker]);
    } catch (error) {
      console.error('Error adding marker:', error);
    }
  };

  const handleMarkerPress = (id: string) => {
    const marker = markers.find(m => m.id === id);
    if (marker) {
      router.push({
        pathname: `/markerPages/[id]` as const,
        params: { 
          id: marker.id,
          marker: JSON.stringify(marker) 
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Карта точек</Text>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        onLongPress={handleLongPress}
      >
        {markers.map(marker => (
          <Marker
            key={marker.id}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            onPress={() => handleMarkerPress(marker.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  map: {
    width: '100%',
    height: '85%',
    borderRadius: 10,
  },
});