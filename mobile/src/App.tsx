import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

type AttendanceRecord = {
  id: string;
  date: string;
  status: string;
  remarks?: string;
};

const API_BASE_URL =
  (Constants?.expoConfig?.extra as any)?.API_BASE_URL ||
  (Constants?.manifest2?.extra as any)?.API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function App() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAttendance() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAttendance();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.subtitle}>{API_BASE_URL}</Text>
      </View>
      {error ? <Text style={styles.error}>Error: {error}</Text> : null}
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAttendance} />}
        contentContainerStyle={records.length === 0 ? styles.emptyContainer : undefined}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.status}>{item.status}</Text>
            {item.remarks ? <Text style={styles.remarks}>{item.remarks}</Text> : null}
          </View>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No attendance records found.</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  error: { color: '#b00020', paddingHorizontal: 16, paddingVertical: 8 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 8, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  date: { fontSize: 16, fontWeight: '600', color: '#111' },
  status: { fontSize: 14, marginTop: 6, color: '#0b6' },
  remarks: { fontSize: 12, marginTop: 6, color: '#666' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#666' }
});
