import { setReleaseStatus } from "./site-language.js?v=sample-family";

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
    setReleaseStatus(list.hidden ? "noAssets" : "latest", release.tag_name);
  } catch {
    setReleaseStatus("unavailable");
  }
}

void loadDownloads();
