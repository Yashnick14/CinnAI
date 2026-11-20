import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { deleteAsync } from "expo-file-system/legacy";

/** Reserve an export target before loading the authenticated report data. */
export function prepareReportExport() {
  return {
    cancel() {},
    async exportHtml(html: string) {
      const { uri } = await Print.printToFileAsync({
        html,
        width: 595.28,
        height: 841.89,
      });
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            UTI: "com.adobe.pdf",
            dialogTitle: "CinnAI Quality Report",
          });
        } else {
          await Print.printAsync({ uri });
        }
      } finally {
        await deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    },
  };
}
