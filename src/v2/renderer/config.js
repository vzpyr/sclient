const SCLIENT_CONFIG = {
  _data: (typeof window.__SCLIENT_CONFIG__ !== "undefined" && window.__SCLIENT_CONFIG__) || {},

  get(key, fallback = "") {
    const v = this._data[key];
    return v !== undefined && v !== null ? v : fallback;
  },

  get customCss() {
    return this.get("css", "");
  },
  get customJs() {
    return this.get("js", "");
  },
  get lazyScroll() {
    return this.get("lazy_scroll", false);
  },
  get titlebarStyle() {
    return this.get("titlebar_style", "custom");
  },
  get customAccent() {
    return this.get("custom_accent", false);
  },
  get accentColor() {
    return this.get("accent_color", "#FF0000");
  },
  get customFont() {
    return this.get("custom_font", false);
  },
  get customFontFamily() {
    return this.get("custom_font_family", "");
  },
  get wideLayout() {
    return this.get("wide_layout", false);
  },
  get wideLayoutWidth() {
    return this.get("wide_layout_width", "1200");
  },
  get customBgColor() {
    return this.get("custom_bg_color", false);
  },
  get bgColor() {
    return this.get("bg_color", "#000000");
  },
  get adblock() {
    return this.get("adblock", false);
  },
  get discordRpc() {
    return this.get("discord_rpc", false);
  },
  get trayIcon() {
    return this.get("tray_icon", false);
  },
  get hideUpsell() {
    return this.get("hide_upsell", false);
  },
  get hideArtists() {
    return this.get("hide_artists", false);
  },
  get showLyrics() {
    return this.get("show_lyrics", false);
  },
  get showMiniplayer() {
    return this.get("show_miniplayer", false);
  },
  get showDownloader() {
    return this.get("show_downloader", false);
  },
  get showEffects() {
    return this.get("show_effects", false);
  },
  get showVisualizer() {
    return this.get("show_visualizer", false);
  },
  get trueShuffle() {
    return this.get("true_shuffle", false);
  },
  get trueShuffleMode() {
    return this.get("true_shuffle_mode", "native");
  },
  get regionBypass() {
    return this.get("region_bypass", false);
  },
  get proxyUrl() {
    return this.get("proxy_url", "");
  },
  get enhancedHeader() {
    return this.get("enhanced_header", false);
  },
  get collapsibleSidebar() {
    return this.get("collapsible_sidebar", false);
  },
  get listenbrainzEnabled() {
    return this.get("listenbrainz", false);
  },
  get listenbrainzToken() {
    return this.get("listenbrainz_token", "");
  },
  get lastfmEnabled() {
    return this.get("lastfm", false);
  },
  get lastfmApiKey() {
    return this.get("lastfm_api_key", "");
  },
  get lastfmSecret() {
    return this.get("lastfm_secret", "");
  },
  get lastfmSessionKey() {
    return this.get("lastfm_session_key", "");
  },
  get lastfmUsername() {
    return this.get("lastfm_username", "");
  },
  get loadLastPage() {
    return this.get("load_last_page", false);
  },
  get mpris() {
    return this.get("mpris", false);
  },
  get statsApiSync() {
    return this.get("stats_api_sync", false);
  },
  get statsLocalTracking() {
    return this.get("stats_local_tracking", false);
  },
};
