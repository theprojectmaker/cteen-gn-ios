// Takes a check-in photo and shrinks it to a small JPEG (base64) for the server.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type Snap = { uri: string; base64: string };

export async function snapPhoto(): Promise<Snap | { error: string } | null> {
  try {
    let result: ImagePicker.ImagePickerResult;
    if (Platform.OS === 'web') {
      // Browsers have no camera API here; pick a file instead.
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    } else {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { error: 'CTeen GN needs the camera for photo check-ins. Turn it on in Settings.' };
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    }
    if (result.canceled || !result.assets?.[0]) return null;
    const small = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 720 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
    if (!small.base64) return { error: "Couldn't read that photo. Try again." };
    return { uri: small.uri, base64: small.base64.replace(/^data:image\/\w+;base64,/, '') };
  } catch {
    return { error: "Couldn't open the camera. Try again." };
  }
}
