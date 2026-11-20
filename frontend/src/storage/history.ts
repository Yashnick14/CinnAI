import { createCloudHistory } from "./cloudHistory";
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
export const history = cloudHistory;
