import { createCloudHistory } from "./cloudHistory";
import { CLOUD_ENABLED } from "../services/cloudApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createUserHistory } from "./userHistory";
import { firebaseAuth } from "../services/firebaseAuth";
import { preservePhoto, resolvePhotoUri } from "./photos";

const localHistory = createUserHistory(
  AsyncStorage,
  {
    persist: preservePhoto,
    resolve: resolvePhotoUri,
  },
  () => firebaseAuth().currentUser?.uid ?? null,
);

export const cloudHistory = createCloudHistory(localHistory);
export const history = CLOUD_ENABLED ? cloudHistory : localHistory;
