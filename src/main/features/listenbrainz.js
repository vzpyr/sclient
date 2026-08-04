function register({ ipcMain, config }) {
  ipcMain.handle("submit_listenbrainz", async (_e, args) => {
    try {
      const token = config.getSecure("integrations.listenbrainz.token").trim();
      if (!token) return { ok: false, code: 0 };
      const res = await fetch("https://api.listenbrainz.org/1/submit-listens", {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (data.code) return { ok: false, code: data.code, message: data.error };
      return { ok: true };
    } catch (e) {
      console.error("[SClient] Listenbrainz submit error:", e);
      return { ok: false, code: 0, message: e.message };
    }
  });
}

module.exports = { register };
