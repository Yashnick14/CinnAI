import AsyncStorage from "@react-native-async-storage/async-storage";
import { createUserHistory } from "./userHistory";
import { firebaseAuth } from "../services/firebaseAuth";
import { preservePhoto, resolvePhotoUri } from "./photos";

export const history = createUserHistory(
  AsyncStorage,
  {
    persist: preservePhoto,
    resolve: resolvePhotoUri,
  },
  () => firebaseAuth().currentUser?.uid ?? null,
);
