(function () {
  var STORAGE_KEY = "portfolio-theme";
  var root = document.documentElement;
  function systemDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("title", theme === "dark" ? "Light mode" : "Dark mode");
    }
  }
  function resolve(stored) {
    if (stored === "light" || stored === "dark") return stored;
    return systemDark() ? "dark" : "light";
  }
  apply(resolve(localStorage.getItem(STORAGE_KEY)));
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      apply(next);
    });
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (localStorage.getItem(STORAGE_KEY)) return;
    apply(systemDark() ? "dark" : "light");
  });
})();