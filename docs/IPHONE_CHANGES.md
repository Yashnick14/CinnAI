# Physical iPhone camera phase

## Implemented behavior

- The app opens on Home and follows Preparation → real rear camera → Review →
  explicit mock result → local History.
- Camera access supports first-time permission, denial, iOS Settings recovery,
  app background/foreground transitions, readiness, capture locking, restart,
  mount errors, and capture errors.
- A captured cache image is checked and copied immediately into the app's
  document directory. Review only enables Analyse after the image renders and
  storage validation passes.
- The mock grading boundary validates the durable photo and produces the
  existing fixture with a fixed 11.8% demo moisture value. It performs no image
  processing, inference, coin detection, diameter calculation, or sensor work.
- Result and History display the real captured image. Stored URIs are rebased to
  the current iOS application container so records survive container path
  changes after an update.
- EAS uses an internal development-client profile, a concrete bundle ID,
  camera-only native permission, and a project-ID file that can be safely linked
  after `eas init`.

## Changed files

- `frontend/app.config.ts`
- `frontend/eas-project.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/scripts/configure-eas-project.mjs`
- `frontend/src/components/CapturedPhoto.tsx`
- `frontend/src/components/GradeResultDisplay.tsx`
- `frontend/src/components/HistoryRow.tsx`
- `frontend/src/hooks/useDeviceCamera.ts`
- `frontend/src/navigation/AppNavigator.tsx`
- `frontend/src/screens/AnalysingScreen.tsx`
- `frontend/src/screens/CameraScreen.tsx`
- `frontend/src/screens/HistoryDetailScreen.tsx`
- `frontend/src/screens/ImageReviewScreen.tsx`
- `frontend/src/screens/PreparationScreen.tsx`
- `frontend/src/screens/ResultScreen.tsx`
- `frontend/src/screens/SettingsScreen.tsx`
- `frontend/src/services/camera.ts`
- `frontend/src/services/mockGradingService.ts`
- `frontend/src/storage/history.ts`
- `frontend/src/storage/historyRepository.ts`
- `frontend/src/storage/photos.ts`
- `frontend/src/storage/photos.web.ts`
- `frontend/tests/photos.test.ts`
- `docs/IPHONE_SETUP.md`
- `docs/IPHONE_CHANGES.md`
- `docs/SETUP.md`
- `docs/TESTING.md`
- `docs/VALIDATION.md`
- `README.md`

`eas.json` and the Expo camera/dev-client dependencies were already correct and
were verified without changing them.

