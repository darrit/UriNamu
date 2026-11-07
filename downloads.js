const releaseApi = "https://api.github.com/repos/darrit/UriNamu/releases/latest";
const assetPrefix = "https://github.com/darrit/UriNamu/releases/download/";

const packages = {
  windows: /_x64-setup\.exe$/i,
  macos: /_universal\.dmg$/i,
  deb: /_amd64\.deb$/i,
  appimage: /_amd64\.appimage$/i,
};

async function loadDownloads() {
  const list = document.getElementById("download-packages");
  const status = document.getElementById("release-status");
  status.textContent = "Loading the latest release…";

  try {
    const response = await fetch(releaseApi, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);

    const release = await response.json();
    const assets = release.assets.filter(
      (asset) => asset.state === "uploaded" && asset.browser_download_url?.startsWith(assetPrefix),
    );

    for (const item of list.querySelectorAll("[data-package]")) {
      const pattern = packages[item.dataset.package];
      const asset = assets.find((candidate) => pattern.test(candidate.name));
      if (!asset) continue;
      item.querySelector("a").href = asset.browser_download_url;
      item.hidden = false;
    }

    list.hidden = !list.querySelector("li:not([hidden])");
    status.textContent = list.hidden
      ? "Open the latest release on GitHub to see available files."
      : `Latest release · ${release.tag_name}`;
  } catch {
    status.textContent = "Direct downloads are unavailable. Open the latest release on GitHub.";
  }
}

void loadDownloads();
