export function updateTheme() {
  let theme;
  if (localStorage.getItem("theme")) {
    try {
      theme = JSON.parse(localStorage.getItem("theme")!) as string;
    } catch {
      theme = "system";
    }
  } else {
    theme = "system";
  }
  if (
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
