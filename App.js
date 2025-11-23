// App.js 
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 10;
const CARD_WIDTH = (width - 60) / 2;

// Spotify API credentials and functions
const SPOTIFY_CLIENT_ID = "e3df452510864d4a91c06978d9c293ec";
const SPOTIFY_CLIENT_SECRET = "2c422c5e193b413dbfef4c54b86ac101";
let spotifyAccessToken = null;

async function getSpotifyAccessToken() {
  if (spotifyAccessToken) return spotifyAccessToken;

  const tokenUrl = "https://accounts.spotify.com/api/token";
  const body = "grant_type=client_credentials";
  const headers = {
    Authorization: "Basic " + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`),
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    const response = await axios.post(tokenUrl, body, { headers });
    spotifyAccessToken = response.data.access_token;
    return spotifyAccessToken;
  } catch (error) {
    console.error("Error getting Spotify token:", error);
    throw error;
  }
}

async function getPlaylistsForMood(mood) {
  try {
    const token = await getSpotifyAccessToken();
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(mood)}&type=playlist&limit=6`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    // Safely handle the response
    if (!response.data || !response.data.playlists || !response.data.playlists.items) {
      console.log('No playlists found in response');
      return [];
    }
    
    // Filter out any null or invalid playlist objects
    const validPlaylists = response.data.playlists.items.filter(playlist => 
      playlist && 
      playlist.name && 
      playlist.external_urls && 
      playlist.external_urls.spotify
    );
    
    return validPlaylists;
  } catch (error) {
    console.error("Error fetching playlists:", error);
    return [];
  }
}

// Map weather conditions to Spotify search terms
const weatherToMoodMap = {
  Clear: "sunny happy",
  Clouds: "chill cozy", 
  Rain: "rainy calm",
  Snow: "winter cozy",
  Default: "mood booster"
};

// Fallback hardcoded playlists in case Spotify API fails
const fallbackPlaylists = {
  Clear: [
    { name: '☀️ Sunshine Vibes', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6', image: require('./assets/sunshine.png') },
    { name: 'Good Day Energy', url: 'https://open.spotify.com/playlist/37i9dQZF1DXdPec7aLTmlC', image: require('./assets/lofi.png') },
  ],
  Clouds: [
    { name: '☁️ Chill & Cozy', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO', image: require('./assets/vibes.png') },
    { name: 'Lo‑Fi Study', url: 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS', image: require('./assets/golden.png') },
  ],
  Rain: [
    { name: '🌧️ Rainy Day', url: 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF', image: require('./assets/rainyday.png') },
    { name: 'Calm & Mellow', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6', image: require('./assets/calm.png') },
  ],
  Snow: [
    { name: '❄️ Winter Chill', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4H7FFUM2osB', image: require('./assets/winterchill.png') },
    { name: 'Cozy Fireplace', url: 'https://open.spotify.com/playlist/37i9dQZF1DWVY4Y6o9hW0X', image: require('./assets/fireplace.png') },
  ],
  Default: [
    { name: 'Mood Booster', url: 'https://open.spotify.com/playlist/37i9dQZF1DX3rxVfibe1L0', image: require('./assets/moodbooster.png') },
    { name: 'Chill Hits', url: 'https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn7', image: require('./assets/chillhits.png') },
  ],
};

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true); 
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState([]);

  const WEATHER_API_KEY = '5899dba5aca60a7561ed6c3f68e0d755';

  useEffect(() => {
    if (!showWelcome) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Denied',
            'We need location access to show weather‑based playlists.'
          );
          setLoading(false);
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        try {
          // Fetch weather data
          const weatherRes = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=imperial`
          );
          const weatherData = weatherRes.data; 
          const condition = weatherData.weather[0].main;

          setWeather({
            city: weatherData.name,
            temp: `${Math.round(weatherData.main.temp)}°F`,
            condition,
            icon: `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`,
          });

          // Get mood based on weather condition
          const mood = weatherToMoodMap[condition] || weatherToMoodMap.Default;
          
          // Try to fetch playlists from Spotify API
          let spotifyPlaylists = [];
          try {
            spotifyPlaylists = await getPlaylistsForMood(mood);
          } catch (spotifyError) {
            console.log('Spotify API failed, using fallback playlists');
          }
          
          let formattedPlaylists = [];
          
          if (spotifyPlaylists && spotifyPlaylists.length > 0) {
            // Transform Spotify API response to match our app's format
            formattedPlaylists = spotifyPlaylists.map(playlist => {
              // Safe access to properties with fallbacks
              const playlistName = playlist?.name || 'Unknown Playlist';
              const playlistUrl = playlist?.external_urls?.spotify || 'https://open.spotify.com';
              const playlistImage = playlist?.images?.[0]?.url 
                ? { uri: playlist.images[0].url } 
                : require('./assets/calm.png');
              
              return {
                name: playlistName,
                url: playlistUrl,
                image: playlistImage
              };
            }).filter(playlist => playlist.name !== 'Unknown Playlist'); // Remove any invalid ones
          }
          
          // If Spotify returned no playlists or we got an error, use fallback
          if (formattedPlaylists.length === 0) {
            console.log('Using fallback playlists');
            formattedPlaylists = fallbackPlaylists[condition] || fallbackPlaylists.Default;
          }
          
          setPlaylists(formattedPlaylists);

        } catch (error) {
          console.error('General error:', error);
          // On any error, use fallback playlists
          const condition = weather?.condition || 'Default';
          setPlaylists(fallbackPlaylists[condition] || fallbackPlaylists.Default);
          Alert.alert('Error', 'Failed to fetch data, using offline playlists.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [showWelcome]);

  // Welcome Screen
  if (showWelcome) {
    return (
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeText}>🎵 Welcome to TuneCast! 🎶</Text>
        <Text style={styles.welcomeSubText}>Music that matches your weather</Text>
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => setShowWelcome(false)}
        >
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading 
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF69B4" />
      </View>
    );
  }

  // Main App content 
  return (
    <View style={styles.container}>
      {weather && (
        <View style={styles.weatherBox}>
          <Text style={styles.city}>{weather.city}</Text>
          <Image source={{ uri: weather.icon }} style={styles.weatherIcon} />
          <Text style={styles.temp}>{weather.temp}</Text>
          <Text style={styles.condition}>{weather.condition}</Text>
        </View>
      )}

      <Text style={styles.playlistTitle}>Recommended Playlists</Text>
      <FlatList
        data={playlists}
        keyExtractor={(item, index) => index.toString()}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 15 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.playlistCard, { width: CARD_WIDTH }]}
            onPress={() => Linking.openURL(item.url)}
          >
            <Image
              source={item.image}
              style={[styles.playlistImage, { width: CARD_WIDTH - 20, height: CARD_WIDTH - 20 }]}
            />
            <Text style={styles.playlistName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8FB',
    padding: 20,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FF69B4',
    textAlign: 'center',
    marginBottom: 15,
  },
  welcomeSubText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: '#FFB6C1',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    shadowColor: '#FF69B4',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  container: { flex: 1, backgroundColor: '#FFF8FB', paddingTop: 50, paddingHorizontal: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  weatherBox: {
    alignItems: 'center',
    backgroundColor: '#FFE6EF',
    padding: 20,
    borderRadius: 25,
    marginBottom: 25,
    shadowColor: '#FF69B4',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  city: { fontSize: 26, fontWeight: '700', color: '#FF69B4' },
  weatherIcon: { width: 80, height: 80, marginVertical: 10 },
  temp: { fontSize: 22, fontWeight: '600' },
  condition: { fontSize: 18, color: '#555' },
  playlistTitle: { fontSize: 22, fontWeight: '700', marginBottom: 15, color: '#FF69B4' },
  playlistCard: {
    backgroundColor: '#FFE6EF',
    borderRadius: 20,
    height: CARD_WIDTH + 50,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 10,
    shadowColor: '#FF69B4',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  playlistImage: { borderRadius: 15, marginBottom: 8 },
  playlistName: { fontSize: 14, fontWeight: '700', textAlign: 'center', color: '#333' },
});