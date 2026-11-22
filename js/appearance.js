/* boot.js wires the existing desktop and mobile buttons to App.theme. */
(function () {
  const root = document.documentElement;
  const panel = document.getElementById("appearanceDialog");
  const loginButton = document.getElementById("loginAppearance");
  const buttons = ["themeBtn", "mobileThemeBtn"].map(id => document.getElementById(id));
  const modes = { light: "Day", dark: "Night" };
  const palettes = { emerald: "Emerald", indigo: "Lavender Indigo" };

  function syncControls() {
    const { palette, theme } = root.dataset;
    for (const radio of panel.querySelectorAll('input[type="radio"]')) {
      radio.checked = radio.value === (radio.name === "deskMode" ? theme : palette);
    }
    const title = "Appearance (" + palettes[palette] + ", " + modes[theme] + ")";
    for (const button of buttons) {
      button.innerHTML = App.ic("palette");
      button.title = title;
      button.setAttribute("aria-label", title);
    }
    loginButton.title = title;
    document.querySelector('meta[name="theme-color"]').content =
      getComputedStyle(root).getPropertyValue("--nav").trim();
  }

  App.syncThemeControls = syncControls;
  App.theme = function () {
    syncControls();
    if (!panel.open) panel.showModal();
  };
  loginButton.addEventListener("click", App.theme);

  panel.addEventListener("change", event => {
    const radio = event.target;
    if (!radio.checked) return;
    let key;
    if (radio.name === "deskMode") {
      root.dataset.theme = radio.value;
      key = "tcet_theme";
    } else if (radio.name === "deskPalette") {
      root.dataset.palette = radio.value;
      key = "tcet_palette";
    } else return;
    try { localStorage.setItem(key, radio.value); } catch (_) {}
    syncControls();
    // Chart.js reads its colours when drawing. Ordinary views update through CSS.
    if (!document.getElementById("app").hidden && document.querySelector("#view [data-chart] canvas")) {
      App.render({ soft: true });
    }
  });
  syncControls();
})();
