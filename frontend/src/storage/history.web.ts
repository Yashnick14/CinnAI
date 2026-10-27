import AsyncStorage from "@react-native-async-storage/async-storage";
import { createHistoryRepository } from "./historyRepository";

// Browser preview only. Native history uses the application's documents directory.
export const history = createHistoryRepository(AsyncStorage, {
  async persist(uri) {
    if (uri.startsWith("data:")) return uri;
    const blob = await (await fetch(uri)).blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Could not preserve the preview image."));
      reader.readAsDataURL(blob);
    });
  },
});
