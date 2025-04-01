import { Stack } from "expo-router";

export default function RootLayout() {
  return (
  <Stack>
    <Stack.Screen name="index" options={{ title: 'Дом' }} />
    <Stack.Screen name="markerPages/[id]" options={{ title: 'Маркер' }} />
  </Stack>
  )

}
