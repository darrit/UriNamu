const messages = {
  en: {
    loading: "Loading the latest release…",
    noAssets: "Open the latest release on GitHub to see available files.",
    latest: "Latest release · {version}",
    unavailable: "Direct downloads are unavailable. Open the latest release on GitHub.",
  },
  de: {
    pageTitle: "UriNamu | Dein Stammbaum auf deinem Computer",
    description: "UriNamu ist eine Offline-Stammbaum-App für Windows, macOS und Linux. Bewahre Familiengeschichten, Fotos und Beziehungen auf deinem Computer auf.",
    project: "Projekt",
    tryLayouts: "Ansichten ausprobieren",
    features: "Funktionen",
    download: "Download",
    language: "Sprache",
    heroLabel: "Eine Offline-App für Stammbäume",
    heroLead: "Dein Stammbaum auf deinem Computer.",
    heroSummary: "Erforsche deine Wurzeln, verbinde Verwandte und bewahre Fotos und Erinnerungen bei ihren Geschichten auf.",
    downloadApp: "UriNamu herunterladen",
    treeTitle: "Drei Generationen einer fiktiven Familie",
    treeDescription: "Clara Weber und Daniel Reed sind die Eltern von Sofia Reed. Sofia Reed und Ren Sato sind die Eltern von Mia Reed und Leo Sato.",
    treeCaption: "Beispiel mit drei Generationen",
    treeFiction: "Illustration mit fiktiven Personen",
    previewLabel: "Interaktive Vorschau",
    previewTitle: "Probiere die vier Baumansichten aus",
    previewBody: "Verschiebe Personen und bewege oder vergrößere den Ausschnitt eines fiktiven Stammbaums. Jede Ansicht behält dabei ihre eigene Anordnung.",
    generations: "Die Vorschau zeigt drei Generationen. In der App kannst du weiter zurückliegende Vorfahren und weitere Nachkommen hinzufügen, insgesamt bis zu 5.000 Personen pro Stammbaum.",
    previewFrame: "Interaktive Vorschau der UriNamu-Ansichten",
    featuresTitle: "Stammbäume erstellen, verwalten und teilen",
    profilesTitle: "Ein Profil für jede Person",
    profilesBody: "Halte Namen, ein Porträt und Erinnerungen fest. Trage ein vollständiges Datum oder nur das bekannte Jahr ein.",
    familyTitle: "Die ganze Familie im Blick",
    familyBody: "Erfasse Eltern, Kinder und Partnerschaften samt Trennungen und Scheidungen. Wechsle zwischen Klassisch, Horizontal, Wandteppich und Tafel.",
    storageTitle: "Stammbäume auf deinem Gerät speichern",
    storageBody: "Verwalte getrennte Stammbäume mit eigener Sicherungshistorie. Exportiere den Stammbaum als PDF zum Drucken oder Teilen.",
    pdfData: "PDFs enthalten standardmäßig auch unverschlüsselte Namen, Daten und Notizen. Deaktiviere die Option vor dem Export, um nur die Baumansicht zu teilen.",
    shareTitle: "Einen Stammbaum mit Passwort teilen",
    shareBody: "Exportiere Profile, Fotos und Beziehungen in eine passwortgeschützte .urinamu-Datei. Die empfangende Person importiert sie mit demselben Passwort als separaten Stammbaum in der Desktop-App.",
    languagesTitle: "Die App in deiner Sprache nutzen",
    languagesBody: "Die App bietet Deutsch, Englisch und Koreanisch. Japanisch ist ab UriNamu 0.10.0 verfügbar.",
    gettingStarted: "Erste Schritte",
    downloadBody: "Wähle den Installer für dein System. Beim ersten Start kannst du deine Sprache wählen und einen leeren Stammbaum beginnen oder das fiktive Beispiel erkunden.",
    licenseSummary: "Kostenlos für die private Nutzung. Der Quellcode steht unter PolyForm Noncommercial 1.0.0 zur Verfügung.",
    directDownloads: "Direktdownloads",
    windowsDownload: "Download für Windows (x64, EXE)",
    macDownload: "Download für macOS (Intel und Apple Silicon, DMG)",
    macPlatforms: "Intel und Apple Silicon · DMG",
    debDownload: "Download für Linux (x64, DEB)",
    releaseLink: "Versionshinweise und Dateien auf GitHub",
    userGuide: "Benutzerhandbuch lesen (nur auf Englisch)",
    inAppGuide: "In der Desktop-App findest du in der Seitenleiste unter „Leitfaden“ bebilderte Vorschauen der wichtigsten Funktionen in deiner gewählten Sprache.",
    privacyLink: "Datenschutz",
    privacyTitle: "Datenschutzhinweis",
    privacyHostingTitle: "Website und Downloads",
    privacyHostingBody: "Du kannst diese Seite besuchen und UriNamu herunterladen, ohne ein Konto anzulegen oder ein Formular auszufüllen. Die Seite wird über GitHub Pages bereitgestellt. GitHub gibt an, die IP-Adressen der Besucher aus Sicherheitsgründen zu protokollieren.",
    privacyDownloadBody: "Dein Browser ruft Informationen zur neuesten Version über die GitHub-API ab, um die Downloadbuttons anzuzeigen. Wenn du einen Download auswählst, stellt GitHub die Installationsdatei bereit.",
    privacyGitHub: "GitHub-Datenschutzerklärung und Kontaktmöglichkeiten",
    privacyAppTitle: "Vorschau und Desktop-App",
    privacyAppBody: "Die Vorschau zeigt einen fiktiven Stammbaum. Änderungen an seiner Anordnung bleiben im Browser, solange die Seite geöffnet ist. Die installierte Desktop-App speichert deine Stammbäume, Fotos und Sicherungen auf deinem Computer.",
    more: "Mehr über UriNamu",
    license: "Lizenz",
    previewLicenses: "Lizenzen der Vorschau-Abhängigkeiten",
    changelog: "Änderungsprotokoll",
    source: "Quellcode",
    loading: "Neueste Version wird geladen…",
    noAssets: "Die verfügbaren Dateien findest du in der neuesten Version auf GitHub.",
    latest: "Neueste Version · {version}",
    unavailable: "Direktdownloads sind derzeit nicht verfügbar. Öffne die neueste Version auf GitHub.",
  },
  ja: {
    pageTitle: "UriNamu | 家系図を自分のパソコンに",
    description: "UriNamuはWindows、macOS、Linux向けのオフライン家系図アプリです。家族の物語や写真、つながりを自分のパソコンに保存できます。",
    project: "プロジェクト",
    tryLayouts: "表示形式を試す",
    features: "機能",
    download: "ダウンロード",
    language: "言語",
    heroLabel: "オフラインで使える家系図アプリ",
    heroLead: "家系図を自分のパソコンに。",
    heroSummary: "家族のルーツをたどり、親族のつながりや写真、思い出を記録しましょう。",
    downloadApp: "UriNamuをダウンロード",
    treeTitle: "架空の家族の3世代",
    treeDescription: "Clara WeberとDaniel ReedはSofia Reedの両親です。Sofia ReedとRen SatoはMia ReedとLeo Satoの両親です。",
    treeCaption: "3世代のサンプル",
    treeFiction: "架空の人物を使ったイラスト",
    previewLabel: "操作できるプレビュー",
    previewTitle: "4つの表示形式を試す",
    previewBody: "架空の家系図で人物の移動、表示範囲の移動、拡大・縮小を試せます。配置は表示形式ごとに保持されます。",
    generations: "このプレビューでは3世代を表示しています。アプリではさらに前の世代の先祖や後の世代の子孫を追加でき、家系図1つにつき最大5,000人を登録できます。",
    previewFrame: "UriNamuの表示形式を操作できるプレビュー",
    featuresTitle: "家系図を作成、整理、共有",
    profilesTitle: "一人ひとりのプロフィール",
    profilesBody: "名前、写真、思い出を記録できます。年月日が分かる場合はすべて、年だけ分かる場合は年だけを入力できます。",
    familyTitle: "家族全体を見渡す",
    familyBody: "親、子ども、パートナーの関係と、別離や離婚を記録できます。クラシック、横型、タペストリー、系図表を切り替えられます。",
    storageTitle: "家系図を端末に保存",
    storageBody: "家系図を個別に管理でき、それぞれにバックアップ履歴が残ります。印刷や共有には家系図をPDFにエクスポートできます。",
    pdfData: "PDFには既定で暗号化されていない名前、日付、メモが含まれます。家系図の表示だけを共有するには、エクスポート前にこのオプションをオフにしてください。",
    shareTitle: "家系図をパスワードで保護して共有",
    shareBody: "プロフィール、写真、関係をパスワードで保護した .urinamu ファイルにエクスポートできます。受け取った人は同じパスワードを使い、デスクトップアプリで別の家系図としてインポートできます。",
    languagesTitle: "使いやすい言語を選ぶ",
    languagesBody: "アプリはドイツ語、英語、韓国語に対応しています。日本語はUriNamu 0.10.0から利用できます。",
    gettingStarted: "はじめに",
    downloadBody: "お使いのOSに合ったインストーラーを選んでください。初回起動時に言語を選び、空の家系図を作るか架空のサンプルを開けます。",
    licenseSummary: "個人利用は無料です。ソースコードは PolyForm Noncommercial 1.0.0 で公開しています。",
    directDownloads: "直接ダウンロード",
    windowsDownload: "Windows版をダウンロード（x64、EXE）",
    macDownload: "macOS版をダウンロード（Intel・Apple Silicon、DMG）",
    macPlatforms: "Intel・Apple Silicon · DMG",
    debDownload: "Linux版をダウンロード（x64、DEB）",
    releaseLink: "GitHubでリリースノートとファイルを見る",
    userGuide: "ユーザーガイドを読む（英語のみ）",
    inAppGuide: "デスクトップアプリのサイドバーにある「ガイド」では、選択した言語で主な機能を画像付きのプレビューで確認できます。",
    privacyLink: "プライバシー",
    privacyTitle: "プライバシーに関するお知らせ",
    privacyHostingTitle: "ウェブサイトとダウンロード",
    privacyHostingBody: "アカウントの作成やフォームへの入力なしで、このサイトの閲覧と UriNamu のダウンロードができます。このサイトは GitHub Pages で公開しています。GitHub はセキュリティのために訪問者の IP アドレスを記録すると説明しています。",
    privacyDownloadBody: "ダウンロードボタンを表示するため、ブラウザーは GitHub API から最新リリースの情報を取得します。ダウンロードを選ぶと、GitHub からインストーラーが配信されます。",
    privacyGitHub: "GitHub のプライバシーに関する声明と連絡先",
    privacyAppTitle: "プレビューとデスクトップアプリ",
    privacyAppBody: "プレビューには架空の家系図が表示されます。配置の変更はページを開いている間、ブラウザー内に保持されます。デスクトップアプリでは、家系図、写真、バックアップはお使いのパソコンに保存されます。",
    more: "UriNamuについて",
    license: "ライセンス",
    previewLicenses: "プレビューの依存ライブラリのライセンス",
    changelog: "変更履歴",
    source: "ソースコード",
    loading: "最新リリースを取得中…",
    noAssets: "配布ファイルはGitHubの最新リリースで確認できます。",
    latest: "最新リリース · {version}",
    unavailable: "直接ダウンロードを表示できません。GitHubの最新リリースを開いてください。",
  },
  ko: {
    pageTitle: "UriNamu | 내 컴퓨터에 보관하는 가계도",
    description: "UriNamu는 Windows, macOS, Linux용 오프라인 가계도 앱입니다. 가족 이야기와 사진, 관계를 내 컴퓨터에 보관하세요.",
    project: "프로젝트",
    tryLayouts: "보기 방식 체험",
    features: "기능",
    download: "다운로드",
    language: "언어",
    heroLabel: "오프라인 가계도 앱",
    heroLead: "내 컴퓨터에 보관하는 가계도.",
    heroSummary: "가족의 뿌리를 찾고 친척의 관계와 사진, 추억을 함께 기록하세요.",
    downloadApp: "UriNamu 다운로드",
    treeTitle: "가상의 가족 3세대",
    treeDescription: "Clara Weber와 Daniel Reed는 Sofia Reed의 부모입니다. Sofia Reed와 Ren Sato는 Mia Reed와 Leo Sato의 부모입니다.",
    treeCaption: "3세대 예시",
    treeFiction: "가상 인물을 사용한 그림",
    previewLabel: "인터랙티브 미리보기",
    previewTitle: "네 가지 보기 방식 체험",
    previewBody: "가상의 가계도에서 인물을 옮기고 화면을 이동하거나 확대해 보세요. 보기 방식마다 배치가 따로 유지됩니다.",
    generations: "이 미리보기에는 3세대가 표시됩니다. 앱에서는 더 이전 세대의 조상과 이후 세대의 후손을 추가할 수 있으며, 가계도 하나에 최대 5,000명을 등록할 수 있습니다.",
    previewFrame: "UriNamu 보기 방식 체험",
    featuresTitle: "가계도 만들기, 정리하기, 공유하기",
    profilesTitle: "인물별 프로필 만들기",
    profilesBody: "이름, 사진, 추억을 기록하세요. 날짜를 모두 알고 있으면 연월일을, 연도만 알고 있으면 연도만 입력할 수 있습니다.",
    familyTitle: "가족 전체를 한눈에 보기",
    familyBody: "부모, 자녀, 배우자 관계와 별거, 이혼을 기록하세요. 고전, 가로, 벽걸이, 도표 보기로 전환할 수 있습니다.",
    storageTitle: "내 기기에 가계도 저장",
    storageBody: "가계도를 각각 관리하고 개별 백업 기록을 보관하세요. 인쇄하거나 공유할 때는 가계도를 PDF로 내보낼 수 있습니다.",
    pdfData: "PDF에는 기본적으로 암호화되지 않은 이름, 날짜, 메모도 포함됩니다. 가계도 그림만 공유하려면 내보내기 전에 이 옵션을 끄세요.",
    shareTitle: "비밀번호로 보호한 가계도 공유",
    shareBody: "프로필, 사진, 관계를 비밀번호로 보호된 .urinamu 파일로 내보낼 수 있습니다. 파일을 받은 사람은 데스크톱 앱에서 같은 비밀번호로 별도의 가계도로 가져올 수 있습니다.",
    languagesTitle: "원하는 언어로 앱 사용",
    languagesBody: "앱은 독일어, 영어, 한국어를 지원합니다. 일본어는 UriNamu 0.10.0부터 사용할 수 있습니다.",
    gettingStarted: "시작하기",
    downloadBody: "운영체제에 맞는 설치 파일을 선택하세요. 처음 실행할 때 언어를 선택하고 빈 가계도를 만들거나 가상의 예시를 둘러볼 수 있습니다.",
    licenseSummary: "개인 용도로 무료입니다. 소스 코드는 PolyForm Noncommercial 1.0.0에 따라 공개됩니다.",
    directDownloads: "직접 다운로드",
    windowsDownload: "Windows용 다운로드 (x64, EXE)",
    macDownload: "macOS용 다운로드 (Intel 및 Apple Silicon, DMG)",
    macPlatforms: "Intel 및 Apple Silicon · DMG",
    debDownload: "Linux용 다운로드 (x64, DEB)",
    releaseLink: "GitHub에서 릴리스 노트와 파일 보기",
    userGuide: "사용자 안내서 읽기 (영어로만 제공)",
    inAppGuide: "데스크톱 앱의 사이드바에서 ‘안내’를 열면 선택한 언어로 주요 기능의 미리보기를 그림과 함께 볼 수 있습니다.",
    privacyLink: "개인정보 보호",
    privacyTitle: "개인정보 처리 안내",
    privacyHostingTitle: "웹사이트와 다운로드",
    privacyHostingBody: "계정을 만들거나 양식을 작성하지 않고도 이 사이트를 방문하고 UriNamu를 다운로드할 수 있습니다. 이 사이트는 GitHub Pages에서 호스팅합니다. GitHub는 보안을 위해 방문자의 IP 주소를 기록한다고 안내합니다.",
    privacyDownloadBody: "다운로드 버튼을 표시하기 위해 브라우저가 GitHub API에서 최신 릴리스 정보를 가져옵니다. 다운로드를 선택하면 GitHub가 설치 파일을 제공합니다.",
    privacyGitHub: "GitHub 개인정보 처리방침 및 연락처",
    privacyAppTitle: "미리보기와 데스크톱 앱",
    privacyAppBody: "미리보기에는 가상의 가계도가 표시됩니다. 배치 변경 사항은 페이지가 열려 있는 동안 브라우저에 유지됩니다. 데스크톱 앱은 가계도, 사진 및 백업을 사용자의 컴퓨터에 저장합니다.",
    more: "UriNamu 더 알아보기",
    license: "라이선스",
    previewLicenses: "미리보기 의존성 라이선스",
    changelog: "변경 이력",
    source: "소스 코드",
    loading: "최신 릴리스를 불러오는 중…",
    noAssets: "GitHub의 최신 릴리스에서 제공되는 파일을 확인하세요.",
    latest: "최신 릴리스 · {version}",
    unavailable: "직접 다운로드를 표시할 수 없습니다. GitHub에서 최신 릴리스를 열어 주세요.",
  },
};

const picker = document.getElementById("site-language");
const preview = document.querySelector("iframe[data-i18n-title]");
const releaseStatus = document.getElementById("release-status");
const labels = [
  ["data-i18n", null],
  ["data-i18n-label", "aria-label"],
  ["data-i18n-title", "title"],
  ["data-i18n-content", "content"],
].flatMap(([marker, attribute]) =>
  Array.from(document.querySelectorAll(`[${marker}]`), (element) => ({
    element,
    attribute,
    key: element.getAttribute(marker),
    english: attribute ? element.getAttribute(attribute) : element.textContent,
  })),
);

let locale = "en";
let releaseKey = "loading";
let releaseVersion = "";

function syncPreview() {
  preview.contentWindow?.postMessage({ type: "urinamu-language", locale }, location.origin);
}

function showReleaseStatus() {
  releaseStatus.textContent = messages[locale][releaseKey].replace("{version}", releaseVersion);
}

export function setReleaseStatus(key, version = "") {
  releaseKey = key;
  releaseVersion = version;
  showReleaseStatus();
}

function applyLanguage(language) {
  locale = language;
  document.documentElement.lang = locale;
  picker.value = locale;
  for (const { element, attribute, key, english } of labels) {
    const value = messages[locale][key] ?? english;
    if (attribute) element.setAttribute(attribute, value);
    else element.textContent = value;
  }
  showReleaseStatus();
  syncPreview();
}

window.addEventListener("message", (event) => {
  if (event.origin === location.origin && event.source === preview.contentWindow &&
      event.data?.type === "urinamu-preview-ready") syncPreview();
});
const requested = new URL(location.href).searchParams.get("lang");
applyLanguage(Object.hasOwn(messages, requested) ? requested : "en");
picker.closest("label").hidden = false;
picker.addEventListener("change", () => {
  const url = new URL(location.href);
  url.searchParams.set("lang", picker.value);
  history.replaceState(null, "", url);
  applyLanguage(picker.value);
});
