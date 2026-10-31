import AsyncStorage from "@react-native-async-storage/async-storage";
import { createUserHistory } from "./userHistory";
import { createCloudHistory } from "./cloudHistory";
import { CLOUD_ENABLED } from "../services/cloudApi";
import { firebaseAuth } from "../services/firebaseAuth";

// Browser preview only. Native history uses the application's documents directory.
const localHistory = createUserHistory(AsyncStorage, {
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
}, () => firebaseAuth().currentUser?.uid ?? null);

export const cloudHistory = createCloudHistory(localHistory);
export const history = CLOUD_ENABLED ? cloudHistory : localHistory;
