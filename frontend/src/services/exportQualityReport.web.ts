/** Open during the user's click so browser popup protection permits the report. */
export function prepareReportExport() {
  const target = window.open("", "_blank");
  if (!target) throw new Error("Allow popups to open and save your PDF report.");
  target.opener = null;
  target.document.title = "Preparing CinnAI report";
  target.document.body.textContent = "Preparing your report…";
  return {
    cancel() {
      target.close();
    },
    async exportHtml(html: string) {
      if (target.closed) throw new Error("Report window was closed. Please try again.");
      target.document.open();
      target.document.write(html);
      target.document.close();
      await target.document.fonts.ready;
      target.focus();
      target.print();
    },
  };
}
